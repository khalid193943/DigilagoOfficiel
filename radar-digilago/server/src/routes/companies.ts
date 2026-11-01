import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { can, guard } from '../auth/auth.js';
import { one, pool, q, tx } from '../db/pool.js';
import { cityById } from '../domain/cities.js';
import { sectorById } from '../domain/sectors.js';
import { enqueue } from '../jobs/queue.js';
import { logAction } from '../lib/audit.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { normalizePhone } from '../normalize/phone.js';
import { normalizeName } from '../normalize/text.js';
import { addWhatsapp, applyDoNotContact, emailType, ingestPlace } from '../pipeline/ingest.js';
import { buildWhere, LIST_JOINS, LIST_SELECT, ListQuery, ORDER, applyView } from './company-filters.js';

const EDITABLE = ['name', 'legal_name', 'description', 'sector', 'subsector', 'city', 'activity_status'] as const;

export async function companyRoutes(app: FastifyInstance) {
  // ----- liste -----
  app.get('/api/companies', { preHandler: guard('read') }, async (req) => {
    const f = ListQuery.parse(req.query);
    const { where, params } = buildWhere(f);
    const rows = await q(`SELECT ${LIST_SELECT} FROM companies c ${LIST_JOINS} WHERE ${where} ORDER BY ${ORDER[f.sort ?? 'score']} LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`, params);
    const total = (await one<{ n: number }>(`SELECT count(*)::int n FROM companies c WHERE ${where}`, params))!.n;
    // compteurs des vues et des cases (avec les autres filtres)
    const base = buildWhere(f, { skipView: true, skipSegment: true });
    const views: Record<string, number> = {};
    for (const v of ['today', 'all', 'new', 'nosite', 'wa', 'follow', 'review']) {
      const w = [base.where]; applyView(v, w);
      views[v] = (await one<{ n: number }>(`SELECT count(*)::int n FROM companies c WHERE ${w.join(' AND ')}`, base.params))!.n;
    }
    const wv = [base.where]; applyView(f.view, wv);
    const segments = await q(`SELECT segment, count(*)::int n FROM companies c WHERE ${wv.join(' AND ')} GROUP BY 1`, base.params);
    return { rows, total, page: f.page, pageSize: f.pageSize, views, segments };
  });

  // ----- fiche complète -----
  app.get('/api/companies/:id', { preHandler: guard('read') }, async (req) => {
    const { id } = req.params as { id: string };
    const c = await one<any>(`SELECT c.*, u.name owner_name FROM companies c LEFT JOIN users u ON u.id=c.owner_id WHERE c.id=$1`, [id]);
    if (!c) throw notFound('Entreprise');
    if (c.merged_into) return { redirect: c.merged_into };
    const [locations, contacts, websites, socials, sources, audit, score, activities, merges, competitors] = await Promise.all([
      q('SELECT * FROM locations WHERE company_id=$1 ORDER BY is_primary DESC, collected_at', [id]),
      q('SELECT * FROM contacts WHERE company_id=$1 ORDER BY kind, verification DESC, collected_at', [id]),
      q('SELECT * FROM websites WHERE company_id=$1 ORDER BY detected_at', [id]),
      q('SELECT * FROM social_profiles WHERE company_id=$1 ORDER BY platform', [id]),
      q('SELECT id, source, external_id, source_url, attribution, collected_at, expires_at FROM source_records WHERE company_id=$1 ORDER BY collected_at', [id]),
      one('SELECT * FROM website_audits WHERE company_id=$1 ORDER BY ran_at DESC LIMIT 1', [id]),
      one('SELECT * FROM lead_scores WHERE company_id=$1 ORDER BY computed_at DESC LIMIT 1', [id]),
      q(`SELECT a.*, u.name user_name FROM crm_activities a LEFT JOIN users u ON u.id=a.user_id WHERE company_id=$1 ORDER BY created_at DESC LIMIT 100`, [id]),
      q(`SELECT m.*, CASE WHEN m.company_a=$1 THEN cb.name ELSE ca.name END other_name, CASE WHEN m.company_a=$1 THEN m.company_b ELSE m.company_a END other_id
         FROM merge_candidates m JOIN companies ca ON ca.id=m.company_a JOIN companies cb ON cb.id=m.company_b
         WHERE (m.company_a=$1 OR m.company_b=$1) AND m.status='pending'`, [id]),
      c.lat != null && c.sector ? q(`SELECT id, name, segment, score, (google_profile->>'rating')::float rating, (google_profile->>'reviews')::int reviews,
           round((6371000 * acos(least(1, cos(radians($2))*cos(radians(lat))*cos(radians(lon)-radians($3)) + sin(radians($2))*sin(radians(lat))))))::int dist
         FROM companies WHERE id<>$1 AND merged_into IS NULL AND sector=$4 AND is_demo=$5 AND lat BETWEEN $2-0.015 AND $2+0.015 AND lon BETWEEN $3-0.018 AND $3+0.018
         ORDER BY dist LIMIT 4`, [id, c.lat, c.lon, c.sector, c.is_demo]) : Promise.resolve([]),
    ]);
    return { company: c, locations, contacts, websites, socials, sources, audit, score, activities, merges, competitors };
  });

  // ----- ajout manuel -----
  app.post('/api/companies', { preHandler: guard('edit') }, async (req) => {
    const b = z.object({
      name: z.string().min(2).max(200), sector: z.string().optional(), cityId: z.string().optional(), address: z.string().max(300).optional(),
      phone: z.string().max(40).optional(), email: z.string().email().optional().or(z.literal('')), website: z.string().max(300).optional(),
      facebook: z.string().max(300).optional(), instagram: z.string().max(300).optional(), whatsappLink: z.string().max(300).optional(),
      lat: z.number().optional(), lon: z.number().optional(), note: z.string().max(2000).optional(),
    }).parse(req.body);
    const city = b.cityId ? cityById(b.cityId) : undefined;
    const id = await tx(async (db) => {
      const r = await ingestPlace({
        source: 'manual', externalId: `manual:${randomUUID()}`, attribution: `Ajout manuel par ${req.user!.name}`, name: b.name.trim(),
        sector: b.sector && sectorById(b.sector) ? b.sector : undefined, address: b.address, city: city?.name, region: city?.region,
        lat: b.lat ?? city?.lat, lon: b.lon ?? city?.lon, phones: b.phone ? [b.phone] : [], emails: b.email ? [b.email] : [],
        links: [b.website, b.facebook, b.instagram, b.whatsappLink].filter(Boolean) as string[],
      }, { cityId: b.cityId ?? null, userId: req.user!.id }, db);
      if (b.note) await q(`INSERT INTO crm_activities (company_id, user_id, type, content) VALUES ($1,$2,'note',$3)`, [r.companyId, req.user!.id, b.note], db);
      return r;
    });
    await enqueue('analyze', { companyId: id.companyId });
    await logAction(req.user!.id, 'company', id.companyId, 'create_manual', { name: b.name, matched: id.matched });
    return { id: id.companyId, created: id.created, matched: id.matched, review: id.review };
  });

  // ----- correction manuelle (champs verrouillés ensuite) -----
  app.patch('/api/companies/:id', { preHandler: guard('read') }, async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({
      name: z.string().min(2).max(200).optional(), legal_name: z.string().max(200).nullable().optional(), description: z.string().max(4000).nullable().optional(),
      sector: z.string().nullable().optional(), subsector: z.string().max(120).nullable().optional(), city: z.string().max(120).nullable().optional(),
      activity_status: z.enum(['active', 'inactive', 'unknown']).optional(),
      crm_status: z.string().optional(), owner_id: z.string().uuid().nullable().optional(), next_action: z.string().max(300).nullable().optional(),
      next_action_at: z.string().datetime({ offset: true }).nullable().optional(), tags: z.array(z.string().max(40)).max(20).optional(),
    }).parse(req.body);
    const before = await one<any>('SELECT * FROM companies WHERE id=$1', [id]);
    if (!before) throw notFound('Entreprise');
    const dataFields = EDITABLE.filter((k) => (b as any)[k] !== undefined);
    const crmFields = (['crm_status', 'owner_id', 'next_action', 'next_action_at', 'tags'] as const).filter((k) => (b as any)[k] !== undefined);
    if (dataFields.length && !can(req.user, 'edit')) throw forbidden();
    if (crmFields.length && !can(req.user, 'crm')) throw forbidden();
    if (b.sector && !sectorById(b.sector)) throw badRequest('Secteur inconnu');
    const set: string[] = [], vals: unknown[] = [id];
    for (const k of [...dataFields, ...crmFields]) { vals.push((b as any)[k]); set.push(`${k}=$${vals.length}`); }
    if (b.name) { vals.push(normalizeName(b.name)); set.push(`name_normalized=$${vals.length}`); }
    if (dataFields.length) {
      vals.push(dataFields as unknown as string[]); set.push(`locked_fields = (SELECT array_agg(DISTINCT x) FROM unnest(locked_fields || $${vals.length}::text[]) x)`);
      const prov = { ...(before.field_provenance ?? {}) };
      for (const k of dataFields) prov[k] = { source: 'manual', at: new Date().toISOString(), by: req.user!.name };
      vals.push(JSON.stringify(prov)); set.push(`field_provenance=$${vals.length}`);
    }
    if (b.crm_status === 'do_not_contact') set.push(`do_not_contact=true`, `score_band='excluded'`);
    if (b.crm_status === 'won') set.push(`score_band='client'`);
    if (!set.length) return { ok: true };
    await q(`UPDATE companies SET ${set.join(', ')}, updated_at=now() WHERE id=$1`, vals);
    const diff: Record<string, unknown> = {};
    for (const k of [...dataFields, ...crmFields]) diff[k] = { from: before[k], to: (b as any)[k] };
    await logAction(req.user!.id, 'company', id, 'update', diff);
    if (b.crm_status && b.crm_status !== before.crm_status)
      await q(`INSERT INTO crm_activities (company_id, user_id, type, content, meta) VALUES ($1,$2,'status_change',$3,$4)`, [id, req.user!.id, b.crm_status, JSON.stringify({ from: before.crm_status })]);
    if (b.owner_id !== undefined && b.owner_id !== before.owner_id)
      await q(`INSERT INTO crm_activities (company_id, user_id, type, meta) VALUES ($1,$2,'assignment',$3)`, [id, req.user!.id, JSON.stringify({ to: b.owner_id })]);
    if (dataFields.length) await q(`INSERT INTO crm_activities (company_id, user_id, type, content) VALUES ($1,$2,'correction',$3)`, [id, req.user!.id, `Correction : ${dataFields.join(', ')}`]);
    return { ok: true };
  });

  // ----- actions de masse -----
  app.post('/api/companies/bulk', { preHandler: guard('crm') }, async (req) => {
    const b = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), action: z.enum(['assign', 'status', 'tag', 'analyze']), value: z.string().nullable().optional() }).parse(req.body);
    if (b.action === 'assign') await q(`UPDATE companies SET owner_id=$2 WHERE id = ANY($1)`, [b.ids, b.value ?? null]);
    if (b.action === 'status' && b.value) await q(`UPDATE companies SET crm_status=$2 WHERE id = ANY($1)`, [b.ids, b.value]);
    if (b.action === 'tag' && b.value) await q(`UPDATE companies SET tags = (SELECT array_agg(DISTINCT x) FROM unnest(tags || ARRAY[$2]) x) WHERE id = ANY($1)`, [b.ids, b.value]);
    if (b.action === 'analyze') for (const id of b.ids) await enqueue('analyze', { companyId: id });
    await logAction(req.user!.id, 'company', null, `bulk_${b.action}`, { count: b.ids.length, value: b.value });
    return { ok: true, count: b.ids.length };
  });

  // ----- contacts -----
  app.post('/api/companies/:id/contacts', { preHandler: guard('crm') }, async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({ kind: z.enum(['phone', 'email', 'whatsapp']), value: z.string().min(3).max(200), confirmed: z.boolean().default(false) }).parse(req.body);
    if (b.kind === 'email') {
      const v = b.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) throw badRequest('Email invalide');
      await q(`INSERT INTO contacts (company_id, kind, value_raw, value_normalized, email_type, verification, source, is_manual) VALUES ($1,'email',$2,$3,$4,'confirmed_manual','manual',true)
        ON CONFLICT (company_id, kind, value_normalized) DO UPDATE SET verification='confirmed_manual', is_manual=true`, [id, b.value, v, emailType(v)]);
    } else {
      const info = normalizePhone(b.value);
      if (!info) throw badRequest('Numéro invalide');
      if (b.kind === 'phone') await q(`INSERT INTO contacts (company_id, kind, value_raw, value_normalized, phone_type, verification, source, is_manual) VALUES ($1,'phone',$2,$3,$4,'confirmed_manual','manual',true)
        ON CONFLICT (company_id, kind, value_normalized) DO UPDATE SET verification='confirmed_manual', is_manual=true`, [id, b.value, info.e164, info.type]);
      else {
        // WhatsApp saisi à la main : « confirmé » uniquement si l'opérateur l'atteste (ex. l'entreprise a répondu sur WhatsApp).
        await addWhatsapp(id, info.e164, b.value, 'manual', null, pool);
        if (b.confirmed) {
          await q(`UPDATE contacts SET verification='confirmed_manual', is_manual=true WHERE company_id=$1 AND kind='whatsapp' AND value_normalized=$2`, [id, info.e164]);
          await q(`UPDATE companies SET whatsapp_status='confirmed' WHERE id=$1`, [id]);
        }
      }
    }
    await logAction(req.user!.id, 'contact', id, 'add', { kind: b.kind, confirmed: b.confirmed });
    return { ok: true };
  });
  app.patch('/api/contacts/:cid', { preHandler: guard('crm') }, async (req) => {
    const { cid } = req.params as { cid: string };
    const b = z.object({ verification: z.enum(['invalid', 'confirmed_manual', 'unverified']) }).parse(req.body);
    const c = await one<any>(`UPDATE contacts SET verification=$2 WHERE id=$1 RETURNING company_id, kind`, [cid, b.verification]);
    if (!c) throw notFound('Contact');
    if (c.kind === 'whatsapp' && b.verification === 'confirmed_manual') await q(`UPDATE companies SET whatsapp_status='confirmed' WHERE id=$1`, [c.company_id]);
    await logAction(req.user!.id, 'contact', cid, 'verify', b);
    return { ok: true };
  });

  // ----- CRM : notes, tâches, contacts passés -----
  app.post('/api/companies/:id/activities', { preHandler: guard('crm') }, async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({
      type: z.enum(['note', 'task', 'contact']), content: z.string().max(4000).optional(), channel: z.enum(['phone', 'email', 'whatsapp', 'facebook', 'instagram', 'visit', 'other']).optional(),
      outcome: z.enum(['no_answer', 'interested', 'not_interested', 'wrong_contact', 'wrong_number', 'callback', 'other']).optional(), due_at: z.string().datetime({ offset: true }).optional(),
    }).parse(req.body);
    const a = await one(`INSERT INTO crm_activities (company_id, user_id, type, content, channel, outcome, due_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, req.user!.id, b.type, b.content ?? null, b.channel ?? null, b.outcome ?? null, b.due_at ?? null]);
    if (b.type === 'contact') {
      await q(`UPDATE companies SET crm_status = CASE WHEN crm_status IN ('new','qualified','to_contact') THEN 'contacted' ELSE crm_status END WHERE id=$1`, [id]);
      if (b.outcome === 'wrong_number' || b.outcome === 'wrong_contact') await q(`UPDATE companies SET needs_review=true, review_reasons=array_append(review_reasons,'contact erroné') WHERE id=$1`, [id]);
    }
    if (b.type === 'task' && b.due_at) await q(`UPDATE companies SET next_action=$2, next_action_at=$3 WHERE id=$1`, [id, b.content ?? 'Tâche', b.due_at]);
    return a;
  });
  app.patch('/api/activities/:aid', { preHandler: guard('crm') }, async (req) => {
    const { aid } = req.params as { aid: string };
    const b = z.object({ done: z.boolean() }).parse(req.body);
    await q(`UPDATE crm_activities SET done_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$1`, [aid, b.done]);
    return { ok: true };
  });

  app.get('/api/tasks', { preHandler: guard('read') }, async (req) => {
    const mine = (req.query as any).mine === '1';
    return q(`SELECT a.id, a.content, a.due_at, a.done_at, a.company_id, c.name company_name, c.city, u.name user_name FROM crm_activities a
      JOIN companies c ON c.id=a.company_id LEFT JOIN users u ON u.id=a.user_id
      WHERE a.type='task' AND a.done_at IS NULL ${mine ? 'AND (a.user_id=$1 OR c.owner_id=$1)' : ''} ORDER BY a.due_at NULLS LAST LIMIT 50`, mine ? [req.user!.id] : []);
  });

  // ----- liste « ne pas contacter » -----
  app.post('/api/companies/:id/dnc', { preHandler: guard('crm') }, async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({ reason: z.string().min(2).max(300), requestedBy: z.string().max(200).optional() }).parse(req.body);
    await tx(async (db) => {
      await q(`INSERT INTO do_not_contact (scope, value, reason, requested_by, created_by) VALUES ('company',$1,$2,$3,$4) ON CONFLICT (scope, value) DO UPDATE SET reason=EXCLUDED.reason`,
        [id, b.reason, b.requestedBy ?? null, req.user!.id], db);
      for (const k of await q<any>(`SELECT kind, value_normalized FROM contacts WHERE company_id=$1`, [id], db))
        await q(`INSERT INTO do_not_contact (scope, value, reason, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [k.kind === 'email' ? 'email' : 'phone', k.value_normalized, b.reason, req.user!.id], db);
      await q(`UPDATE companies SET do_not_contact=true, crm_status='do_not_contact', score_band='excluded' WHERE id=$1`, [id], db);
      // toutes les autres fiches qui portent le même numéro ou le même email
      for (const o of await q<{ id: string }>(`SELECT DISTINCT k2.company_id id FROM contacts k1 JOIN contacts k2 ON k2.value_normalized=k1.value_normalized AND k2.company_id<>k1.company_id WHERE k1.company_id=$1`, [id], db))
        await applyDoNotContact(o.id, db);
      await q(`INSERT INTO crm_activities (company_id, user_id, type, content) VALUES ($1,$2,'status_change',$3)`, [id, req.user!.id, `Ne pas contacter : ${b.reason}`], db);
    });
    await logAction(req.user!.id, 'company', id, 'do_not_contact', b);
    return { ok: true };
  });

  app.post('/api/companies/:id/analyze', { preHandler: guard('crm') }, async (req) => {
    const { id } = req.params as { id: string };
    await enqueue('analyze', { companyId: id });
    return { ok: true };
  });

  // ----- doublons : validation humaine, fusion traçable et réversible -----
  app.get('/api/merge-candidates', { preHandler: guard('read') }, async () =>
    q(`SELECT m.*, a.name a_name, a.city a_city, b.name b_name, b.city b_city FROM merge_candidates m JOIN companies a ON a.id=m.company_a JOIN companies b ON b.id=m.company_b
       WHERE m.status='pending' ORDER BY m.created_at DESC LIMIT 100`));
  app.post('/api/merge-candidates/:mid', { preHandler: guard('edit') }, async (req) => {
    const { mid } = req.params as { mid: string };
    const b = z.object({ decision: z.enum(['merge', 'reject']) }).parse(req.body);
    const m = await one<any>(`SELECT * FROM merge_candidates WHERE id=$1 AND status='pending'`, [mid]);
    if (!m) throw notFound('Proposition');
    if (b.decision === 'reject') {
      await q(`UPDATE merge_candidates SET status='rejected', decided_by=$2, decided_at=now() WHERE id=$1`, [mid, req.user!.id]);
    } else {
      await mergeCompanies(m.company_a, m.company_b, req.user!.id, 'manual');
      await q(`UPDATE merge_candidates SET status='merged', decided_by=$2, decided_at=now() WHERE id=$1`, [mid, req.user!.id]);
      await enqueue('analyze', { companyId: m.company_a });
    }
    await q(`UPDATE companies SET needs_review = EXISTS (SELECT 1 FROM merge_candidates WHERE status='pending' AND (company_a=companies.id OR company_b=companies.id)) WHERE id IN ($1,$2)`, [m.company_a, m.company_b]);
    await logAction(req.user!.id, 'merge_candidate', mid, b.decision);
    return { ok: true };
  });
  app.post('/api/merges/:id/undo', { preHandler: guard('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const m = await one<any>(`SELECT * FROM merges WHERE id=$1 AND undone_at IS NULL`, [id]);
    if (!m) throw notFound('Fusion');
    await tx(async (db) => {
      for (const [table, ids] of Object.entries(m.moved as Record<string, string[]>)) if (ids.length) await q(`UPDATE ${table} SET company_id=$1 WHERE id = ANY($2)`, [m.merged_id, ids], db);
      await q(`UPDATE companies SET merged_into=NULL WHERE id=$1`, [m.merged_id], db);
      await q(`UPDATE merges SET undone_at=now(), undone_by=$2 WHERE id=$1`, [id, req.user!.id], db);
    });
    await enqueue('analyze', { companyId: m.survivor_id }); await enqueue('analyze', { companyId: m.merged_id });
    await logAction(req.user!.id, 'merge', id, 'undo');
    return { ok: true };
  });
}

const MOVABLE = ['locations', 'source_records', 'contacts', 'websites', 'social_profiles', 'crm_activities', 'website_audits'] as const;
export async function mergeCompanies(survivorId: string, mergedId: string, userId: string | null, reason: string) {
  return tx(async (db) => {
    const moved: Record<string, string[]> = {};
    for (const t of MOVABLE) {
      let rows: { id: string }[];
      if (t === 'contacts') rows = await q(`UPDATE contacts x SET company_id=$1 WHERE company_id=$2 AND NOT EXISTS (SELECT 1 FROM contacts y WHERE y.company_id=$1 AND y.kind=x.kind AND y.value_normalized=x.value_normalized) RETURNING id`, [survivorId, mergedId], db);
      else if (t === 'websites') rows = await q(`UPDATE websites x SET company_id=$1 WHERE company_id=$2 AND NOT EXISTS (SELECT 1 FROM websites y WHERE y.company_id=$1 AND y.domain=x.domain) RETURNING id`, [survivorId, mergedId], db);
      else if (t === 'social_profiles') rows = await q(`UPDATE social_profiles x SET company_id=$1 WHERE company_id=$2 AND NOT EXISTS (SELECT 1 FROM social_profiles y WHERE y.company_id=$1 AND y.url=x.url) RETURNING id`, [survivorId, mergedId], db);
      else rows = await q(`UPDATE ${t} SET company_id=$1 WHERE company_id=$2 RETURNING id`, [survivorId, mergedId], db);
      moved[t] = rows.map((r) => r.id);
    }
    await q(`UPDATE locations SET is_primary=false WHERE company_id=$1 AND id = ANY($2)`, [survivorId, moved.locations], db);
    await q(`UPDATE companies SET merged_into=$1, updated_at=now() WHERE id=$2`, [survivorId, mergedId], db);
    await q(`UPDATE companies s SET google_profile = m.google_profile || s.google_profile FROM companies m WHERE s.id=$1 AND m.id=$2`, [survivorId, mergedId], db);
    const r = await one<{ id: string }>(`INSERT INTO merges (survivor_id, merged_id, reason, moved, done_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [survivorId, mergedId, reason, JSON.stringify(moved), userId], db);
    return r!.id;
  });
}
