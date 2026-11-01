import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { guard } from '../auth/auth.js';
import { SEGMENT_LABEL } from '../audit/diagnostic.js';
import { config } from '../config.js';
import { one, q, tx } from '../db/pool.js';
import { CITIES, cityById } from '../domain/cities.js';
import { SECTORS, sectorById } from '../domain/sectors.js';
import { enqueue, queueStats } from '../jobs/queue.js';
import { logAction } from '../lib/audit.js';
import { badRequest } from '../lib/errors.js';
import { normalizeName } from '../normalize/text.js';
import { ingestPlace } from '../pipeline/ingest.js';
import { buildWhere, ListQuery, ORDER } from './company-filters.js';

export const EXPORT_COLUMNS: Record<string, { label: string; sql: string }> = {
  ref: { label: 'Référence', sql: 'c.ref' },
  name: { label: 'Entreprise', sql: 'c.name' },
  sector: { label: 'Secteur', sql: 'c.sector' },
  subsector: { label: 'Sous-secteur', sql: 'c.subsector' },
  city: { label: 'Ville', sql: 'c.city' },
  address: { label: 'Adresse', sql: `(SELECT address FROM locations l WHERE l.company_id=c.id ORDER BY is_primary DESC LIMIT 1)` },
  segment: { label: 'Case', sql: 'c.segment' },
  score: { label: 'Score', sql: 'c.score' },
  confidence: { label: 'Confiance', sql: 'c.confidence' },
  crm_status: { label: 'Statut', sql: 'c.crm_status' },
  phones: { label: 'Téléphones (type · source · date)', sql: `(SELECT string_agg(value_normalized || ' (' || coalesce(phone_type,'?') || ' · ' || source || ' · ' || to_char(collected_at,'DD/MM/YYYY') || ')', ' | ') FROM contacts k WHERE k.company_id=c.id AND kind='phone' AND verification<>'invalid')` },
  whatsapp: { label: 'WhatsApp (preuve)', sql: `(SELECT string_agg(value_normalized || ' (' || verification || ' · ' || coalesce(source_url, source) || ')', ' | ') FROM contacts k WHERE k.company_id=c.id AND kind='whatsapp' AND verification<>'invalid')` },
  emails: { label: 'Emails (source · date)', sql: `(SELECT string_agg(value_normalized || ' (' || source || ' · ' || to_char(collected_at,'DD/MM/YYYY') || ')', ' | ') FROM contacts k WHERE k.company_id=c.id AND kind='email' AND verification<>'invalid')` },
  website: { label: 'Site web', sql: `(SELECT string_agg(url, ' | ') FROM websites w WHERE w.company_id=c.id AND official_status<>'rejected')` },
  socials: { label: 'Réseaux sociaux', sql: `(SELECT string_agg(platform || ': ' || url, ' | ') FROM social_profiles s WHERE s.company_id=c.id AND official_status<>'rejected')` },
  google_rating: { label: 'Note Google', sql: `c.google_profile->>'rating'` },
  google_reviews: { label: 'Avis Google', sql: `c.google_profile->>'reviews'` },
  sources: { label: 'Sources', sql: `(SELECT string_agg(DISTINCT source, ', ') FROM source_records s WHERE s.company_id=c.id)` },
  first_seen: { label: 'Détectée le', sql: `to_char(c.first_seen_at,'DD/MM/YYYY')` },
  verified: { label: 'Dernière vérification', sql: `to_char(c.last_verified_at,'DD/MM/YYYY HH24:MI')` },
  demo: { label: 'Fictif (démo)', sql: `CASE WHEN c.is_demo THEN 'oui' ELSE 'non' END` },
};
const DEFAULT_COLUMNS = ['ref', 'name', 'sector', 'city', 'address', 'segment', 'score', 'crm_status', 'phones', 'whatsapp', 'emails', 'website', 'socials', 'sources', 'verified', 'demo'];

const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function dataRoutes(app: FastifyInstance) {
  app.get('/api/export/columns', { preHandler: guard('read') }, async () => ({ columns: Object.entries(EXPORT_COLUMNS).map(([id, c]) => ({ id, label: c.label })), defaults: DEFAULT_COLUMNS }));

  app.get('/api/export', { preHandler: guard('export') }, async (req, rep) => {
    const f = ListQuery.parse(req.query);
    const format = (req.query as any).format === 'xlsx' ? 'xlsx' : 'csv';
    const cols = String((req.query as any).columns ?? '').split(',').filter((c) => EXPORT_COLUMNS[c]);
    const columns = cols.length ? cols : DEFAULT_COLUMNS;
    const { where, params } = buildWhere(f);
    const rows = await q(`SELECT ${columns.map((c) => `${EXPORT_COLUMNS[c].sql} AS "${c}"`).join(', ')} FROM companies c WHERE ${where} AND NOT c.do_not_contact
      ORDER BY ${ORDER[f.sort ?? 'score']} LIMIT ${config.exportMaxRows}`, params);
    for (const r of rows) if (r.segment) r.segment = SEGMENT_LABEL[r.segment as keyof typeof SEGMENT_LABEL] ?? r.segment;
    await q(`INSERT INTO export_log (user_id, format, filters, columns, row_count) VALUES ($1,$2,$3,$4,$5)`, [req.user!.id, format, JSON.stringify(f), columns, rows.length]);
    await logAction(req.user!.id, 'export', null, format, { rows: rows.length, filters: f });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const header = columns.map((c) => EXPORT_COLUMNS[c].label);
    if (format === 'csv') {
      const body = '﻿' + [header.map(csvCell).join(';'), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(';'))].join('\r\n');
      return rep.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="radar-digilago-${stamp}.csv"`).send(body);
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Radar Digilago';
    const ws = wb.addWorksheet('Entreprises', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ header: EXPORT_COLUMNS[c].label, key: c, width: Math.min(60, Math.max(12, EXPORT_COLUMNS[c].label.length + 4)) }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2545' } };
    rows.forEach((r) => ws.addRow(r));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    const info = wb.addWorksheet('À propos');
    info.addRows([['Export Radar Digilago'], ['Date', new Date().toLocaleString('fr-FR')], ['Lignes', rows.length], ['Filtres', JSON.stringify(f)],
      ['Note', 'Chaque coordonnée indique sa source et sa date. Les entreprises « ne pas contacter » sont exclues. Les fiches « démo » sont fictives.']]);
    const buf = await wb.xlsx.writeBuffer();
    return rep.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').header('Content-Disposition', `attachment; filename="radar-digilago-${stamp}.xlsx"`).send(Buffer.from(buf));
  });

  // ----- import Excel / CSV -----
  app.post('/api/import', { preHandler: guard('edit') }, async (req) => {
    const file = await (req as any).file();
    if (!file) throw badRequest('Aucun fichier reçu');
    const buf: Buffer = await file.toBuffer();
    const name: string = file.filename ?? 'import';
    const cityId = (file.fields?.cityId?.value as string) || undefined;
    const rows = name.toLowerCase().endsWith('.xlsx') ? await readXlsx(buf) : readCsv(buf.toString('utf8').replace(/^﻿/, ''));
    if (!rows.length) throw badRequest('Fichier vide ou illisible');
    if (rows.length > 5000) throw badRequest('5 000 lignes maximum par import');
    const pick = (r: Record<string, string>, keys: string[]) => { for (const k of Object.keys(r)) if (keys.includes(normalizeName(k).replace(/ /g, ''))) return r[k]?.trim() || undefined; return undefined; };
    let created = 0, matched = 0, skipped = 0, review = 0;
    const ids: string[] = [];
    for (const r of rows) {
      const nm = pick(r, ['nom', 'name', 'entreprise', 'societe', 'raisonsociale', 'company']);
      if (!nm) { skipped++; continue; }
      const cityName = pick(r, ['ville', 'city']);
      const city = cityId ? cityById(cityId) : CITIES.find((c) => cityName && normalizeName(c.name) === normalizeName(cityName));
      const sectorRaw = pick(r, ['secteur', 'sector', 'activite', 'categorie']);
      const sector = sectorRaw ? SECTORS.find((s) => s.id === sectorRaw || normalizeName(s.label).includes(normalizeName(sectorRaw))) : undefined;
      const phone = pick(r, ['telephone', 'tel', 'phone', 'mobile', 'gsm']);
      const res = await tx((db) => ingestPlace({
        source: 'import', externalId: 'import:' + createHash('sha1').update(normalizeName(nm) + '|' + (phone ?? '') + '|' + (cityName ?? '')).digest('hex').slice(0, 20),
        attribution: `Import « ${name} » par ${req.user!.name}`, name: nm, sector: sector?.id, address: pick(r, ['adresse', 'address']),
        city: cityName ?? city?.name, region: city?.region, lat: city?.lat, lon: city?.lon, phones: phone ? phone.split(/[\/;,|]/) : [],
        emails: (pick(r, ['email', 'mail', 'courriel']) ?? '').split(/[;,|\s]+/).filter(Boolean),
        links: [pick(r, ['site', 'siteweb', 'website', 'url']), pick(r, ['facebook', 'fb']), pick(r, ['instagram', 'insta']), pick(r, ['whatsapp'])].filter(Boolean) as string[],
      }, { cityId: city?.id ?? null, userId: req.user!.id }, db));
      ids.push(res.companyId);
      if (res.created) created++; else matched++;
      if (res.review) review++;
    }
    for (const id of new Set(ids)) await enqueue('analyze', { companyId: id });
    await logAction(req.user!.id, 'import', null, 'file', { name, rows: rows.length, created, matched, skipped });
    return { rows: rows.length, created, matched, skipped, review };
  });

  // ----- administration -----
  app.post('/api/admin/purge-demo', { preHandler: guard('admin') }, async (req) => {
    const r = await one<{ n: number }>(`WITH d AS (DELETE FROM companies WHERE is_demo RETURNING 1) SELECT count(*)::int n FROM d`);
    await q(`DELETE FROM discovery_jobs WHERE 'demo' = ANY(sources) AND cardinality(sources)=1`);
    await logAction(req.user!.id, 'admin', null, 'purge_demo', r);
    return { deleted: r?.n ?? 0 };
  });
  app.get('/api/admin/audit-log', { preHandler: guard('admin') }, async () =>
    q(`SELECT a.*, u.name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY at DESC LIMIT 200`));
  app.get('/api/admin/queue', { preHandler: guard('read') }, async () => ({ stats: await queueStats() }));
  app.post('/api/admin/reanalyze', { preHandler: guard('admin') }, async (req) => {
    const b = z.object({ cityId: z.string().optional() }).parse(req.body ?? {});
    const rows = await q<{ id: string }>(`SELECT id FROM companies WHERE merged_into IS NULL ${b.cityId ? 'AND city_id=$1' : ''} LIMIT 5000`, b.cityId ? [b.cityId] : []);
    for (const r of rows) await enqueue('analyze', { companyId: r.id });
    return { queued: rows.length };
  });
  void sectorById;
}

function readCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  let row: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') inQ = false; else cell += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((c) => c.trim())) lines.push(row); row = []; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some((c) => c.trim())) lines.push(row); }
  const [head, ...rest] = lines;
  return head ? rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()]))) : [];
}
async function readXlsx(buf: Buffer): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const head: string[] = [];
  ws.getRow(1).eachCell((c, i) => { head[i] = String(c.text ?? '').trim(); });
  const out: Record<string, string>[] = [];
  ws.eachRow((r, n) => { if (n === 1) return; const o: Record<string, string> = {}; head.forEach((h, i) => { if (h) o[h] = String(r.getCell(i).text ?? '').trim(); }); if (Object.values(o).some(Boolean)) out.push(o); });
  return out;
}
