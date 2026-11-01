import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/auth/auth.js';
import { config } from '../src/config.js';
import { one, pool, q } from '../src/db/pool.js';
import { assertPublicHost } from '../src/enrich/fetcher.js';
import { drainQueue } from '../src/jobs/worker.js';
import { resetDb } from './helpers.js';

let app: FastifyInstance;
const cookies: Record<string, string> = {};
const call = async (who: string | null, method: string, url: string, body?: unknown) => {
  const r = await app.inject({ method: method as any, url, headers: { ...(who ? { cookie: cookies[who] } : {}), ...(method !== 'GET' ? { 'content-type': 'application/json' } : {}) }, payload: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined });
  return { status: r.statusCode, json: () => r.json(), body: r.body, headers: r.headers };
};

beforeAll(async () => {
  await resetDb();
  for (const [email, role] of [['admin@test.ma', 'admin'], ['lecture@test.ma', 'readonly'], ['vente@test.ma', 'sales']])
    await q(`INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,$3,$4)`, [email, role, role, await hashPassword('motdepasse-solide')]);
  app = await buildApp();
  await app.listen({ port: Number(process.env.PORT), host: '127.0.0.1' });
  for (const u of ['admin', 'lecture', 'vente']) {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: `${u}@test.ma`, password: 'motdepasse-solide' }) });
    expect(r.statusCode).toBe(200);
    cookies[u] = String(r.headers['set-cookie']).split(';')[0];
  }
});
afterAll(async () => { await app.close(); await pool.end(); });

describe('accès', () => {
  it('refuse sans connexion et selon le rôle', async () => {
    expect((await call(null, 'GET', '/api/companies')).status).toBe(401);
    expect((await call('lecture', 'POST', '/api/scans', { cityId: 'el-jadida', sectors: ['sante'], sources: ['demo'] })).status).toBe(403);
    expect((await call('admin', 'POST', '/api/auth/login', { email: 'admin@test.ma', password: 'faux' })).status).toBe(401);
  });
  it('ne révèle jamais la clé API au navigateur', async () => {
    const meta = await call('admin', 'GET', '/api/meta');
    expect(meta.status).toBe(200);
    expect(meta.body).not.toContain(config.sources.google.apiKey);
  });
});

describe('balayage de démonstration de bout en bout', () => {
  let jobId: string;
  it('estime puis lance un balayage complet', async () => {
    const est = (await call('admin', 'POST', '/api/scans/estimate', { cityId: 'el-jadida', sectors: ['sante', 'education'], sources: ['demo'], mode: 'full' })).json();
    expect(est.tiles).toBe(9);
    const r = await call('admin', 'POST', '/api/scans', { cityId: 'el-jadida', sectors: ['sante', 'education'], sources: ['demo'], mode: 'full', analyze: true });
    expect(r.status).toBe(200);
    jobId = r.json().id;
    await drainQueue();
    const s = (await call('admin', 'GET', `/api/scans/${jobId}`)).json();
    expect(['done', 'partial']).toContain(s.job.status);
    expect(s.job.coverage_note).toMatch(/exhaustivité/);
    expect(s.tiles.length).toBeGreaterThanOrEqual(9);
    expect(s.job.log.length).toBeGreaterThan(5);
    expect(s.job.counters.found).toBeGreaterThan(30);
  });
  it('redécoupe les tuiles saturées', async () => {
    const split = await q(`SELECT count(*)::int n FROM scan_tiles WHERE job_id=$1 AND status='split'`, [jobId]);
    const kids = await q(`SELECT count(*)::int n FROM scan_tiles WHERE job_id=$1 AND depth>0`, [jobId]);
    if (split[0].n > 0) expect(kids[0].n).toBe(split[0].n * 4);
  });
  it('analyse les sites, classe chaque entreprise dans une case et marque tout comme fictif', async () => {
    const seg = await q<any>(`SELECT segment, count(*)::int n FROM companies GROUP BY 1`);
    const by = Object.fromEntries(seg.map((r) => [r.segment, r.n]));
    expect(by.unknown ?? 0).toBe(0);
    expect(by.no_site).toBeGreaterThan(0);
    expect(by.social_or_generated).toBeGreaterThan(0);
    expect(by.weak_site).toBeGreaterThan(0);
    expect((await one<any>(`SELECT bool_and(is_demo) d FROM companies`)).d).toBe(true);
    const good = await one<any>(`SELECT c.id FROM companies c JOIN websites w ON w.company_id=c.id WHERE w.url LIKE 'https://good-%' AND c.site_class IN ('good','correct') LIMIT 1`);
    expect(good).toBeTruthy();
    // WhatsApp seulement grâce au lien publié sur la page contact du site
    const wa = await one<any>(`SELECT * FROM contacts WHERE company_id=$1 AND kind='whatsapp'`, [good.id]);
    expect(wa).toMatchObject({ verification: 'published_link', source: 'site_officiel' });
    expect(wa.source_url).toContain('/contact');
    // un mobile sans lien WhatsApp ne devient jamais « WhatsApp »
    const noWa = await one<any>(`SELECT count(*)::int n FROM companies c WHERE c.whatsapp_status IN ('official_link_found','confirmed')
      AND NOT EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id AND k.kind='whatsapp')`);
    expect(noWa.n).toBe(0);
    const audit = await one<any>(`SELECT * FROM website_audits WHERE classification='basic_template' LIMIT 1`);
    expect(audit.limits).toMatch(/Audit léger/);
    const score = await one<any>(`SELECT signals FROM lead_scores LIMIT 1`);
    expect(score.signals[0]).toMatchObject({ id: 'base', points: 40 });
  });
  it('ne crée aucun doublon quand on relance le même balayage', async () => {
    const before = (await one<any>(`SELECT count(*)::int n FROM companies`)).n;
    const r = await call('admin', 'POST', `/api/scans/${jobId}/rerun`);
    await drainQueue();
    expect((await one<any>(`SELECT count(*)::int n FROM companies`)).n).toBe(before);
    expect((await call('admin', 'GET', `/api/scans/${r.json().id}`)).json().job.counters.created).toBe(0);
  });
  it('alimente le tableau de bord, la carte, le flux et la couverture', async () => {
    const d = (await call('lecture', 'GET', '/api/dashboard')).json();
    expect(d.kpis.total).toBeGreaterThan(30);
    expect(d.cities.find((c: any) => c.id === 'el-jadida').n).toBe(d.kpis.total);
    const m = (await call('lecture', 'GET', '/api/map/points')).json();
    expect(m.points.length).toBe(d.kpis.total);
    expect(m.tiles.length).toBeGreaterThan(0);
    expect((await call('lecture', 'GET', '/api/feed?limit=5')).json()).toHaveLength(5);
    const cov = (await call('lecture', 'GET', '/api/coverage')).json();
    expect(cov.zones.find((z: any) => z.id === 'el-jadida').status).not.toBe('never');
    expect(cov.matrix.length).toBeGreaterThan(0);
  });
});

describe('fiches réelles : ajout, dédoublonnage, corrections, CRM', () => {
  let a: string;
  it('ajoute une entreprise à la main', async () => {
    const r = await call('admin', 'POST', '/api/companies', { name: 'Clinique Exemple Réelle', sector: 'sante', cityId: 'azemmour', phone: '0523 34 12 00', website: 'https://www.facebook.com/clinique.exemple' });
    expect(r.status).toBe(200);
    a = r.json().id;
    await drainQueue();
    const c = (await call('admin', 'GET', `/api/companies/${a}`)).json();
    expect(c.company.site_class).toBe('social_only');
    expect(c.company.is_demo).toBe(false);
    expect(c.contacts[0]).toMatchObject({ kind: 'phone', phone_type: 'fixed', value_normalized: '+212523341200' });
    expect(c.socials[0].platform).toBe('facebook');
  });
  it('fusionne automatiquement le même téléphone avec un nom proche', async () => {
    const r = await call('admin', 'POST', '/api/companies', { name: 'Clinique Exemple Réelle SARL', cityId: 'azemmour', phone: '+212523341200' });
    expect(r.json()).toMatchObject({ id: a, created: false, matched: 'certain' });
  });
  it('propose (sans fusionner) le même téléphone avec un autre nom', async () => {
    const r = await call('admin', 'POST', '/api/companies', { name: 'Laboratoire Différent', cityId: 'azemmour', phone: '+212523341200' });
    expect(r.json()).toMatchObject({ created: true, review: true });
    const mc = (await call('admin', 'GET', '/api/merge-candidates')).json().filter((m: any) => m.company_a === a || m.company_b === a);
    expect(mc).toHaveLength(1);
    expect(mc[0].signals.reasons).toContain('même téléphone, noms différents');
    const dec = await call('admin', 'POST', `/api/merge-candidates/${mc[0].id}`, { decision: 'merge' });
    expect(dec.status).toBe(200);
    const merged = await one<any>(`SELECT merged_into FROM companies WHERE id=$1`, [r.json().id]);
    expect(merged.merged_into).toBe(a);
    const m = await one<any>(`SELECT id FROM merges WHERE survivor_id=$1`, [a]);
    expect((await call('admin', 'POST', `/api/merges/${m.id}/undo`)).status).toBe(200);
    expect((await one<any>(`SELECT merged_into FROM companies WHERE id=$1`, [r.json().id])).merged_into).toBeNull();
  });
  it('protège les corrections manuelles lors des synchronisations', async () => {
    expect((await call('admin', 'PATCH', `/api/companies/${a}`, { name: 'Clinique Exemple (nom corrigé)', sector: 'sante' })).status).toBe(200);
    expect((await call('vente', 'PATCH', `/api/companies/${a}`, { name: 'tentative' })).status).toBe(403);
    expect((await call('vente', 'PATCH', `/api/companies/${a}`, { crm_status: 'to_contact' })).status).toBe(200);
    await call('admin', 'POST', '/api/companies', { name: 'Clinique Exemple Réelle', cityId: 'azemmour', phone: '+212523341200', address: 'Nouvelle adresse' });
    const c = (await call('admin', 'GET', `/api/companies/${a}`)).json();
    expect(c.company.name).toBe('Clinique Exemple (nom corrigé)');
    expect(c.company.locked_fields).toContain('name');
    expect(c.company.field_provenance.name.source).toBe('manual');
    expect(c.activities.some((x: any) => x.type === 'status_change')).toBe(true);
  });
  it('enregistre un WhatsApp confirmé uniquement sur attestation', async () => {
    await call('vente', 'POST', `/api/companies/${a}/contacts`, { kind: 'whatsapp', value: '0661234567', confirmed: false });
    expect((await one<any>(`SELECT whatsapp_status FROM companies WHERE id=$1`, [a])).whatsapp_status).toBe('official_link_found');
    await call('vente', 'POST', `/api/companies/${a}/contacts`, { kind: 'whatsapp', value: '0661234567', confirmed: true });
    expect((await one<any>(`SELECT whatsapp_status FROM companies WHERE id=$1`, [a])).whatsapp_status).toBe('confirmed');
  });
  it('liste avec filtres, vues et canaux', async () => {
    const r = (await call('lecture', 'GET', '/api/companies?city=azemmour&channel=whatsapp')).json();
    expect(r.total).toBe(1);
    expect(r.rows[0]).toMatchObject({ id: a, has_whatsapp: true, has_fixed: true, has_facebook: true });
    const all = (await call('lecture', 'GET', '/api/companies?view=all&segment=no_site&pageSize=5')).json();
    expect(all.rows.every((x: any) => x.segment === 'no_site')).toBe(true);
    expect(all.views.all).toBeGreaterThan(all.total - 1);
  });
  it('exporte en CSV et XLSX en respectant les filtres, avec provenance, et journalise', async () => {
    const csv = await call('vente', 'GET', '/api/export?format=csv&city=azemmour');
    expect(csv.status).toBe(200);
    expect(csv.body).toContain('Clinique Exemple (nom corrigé)');
    expect(csv.body).toMatch(/\+212523341200 \(fixed · manual · \d{2}\/\d{2}\/\d{4}\)/);
    expect(csv.body).not.toMatch(/\(démo\);/);
    const xlsx = await call('admin', 'GET', '/api/export?format=xlsx&segment=no_site');
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect((await call('lecture', 'GET', '/api/export?format=csv')).status).toBe(403);
    expect((await one<any>(`SELECT count(*)::int n FROM export_log`)).n).toBe(2);
  });
  it('applique la liste « ne pas contacter » partout', async () => {
    await call('vente', 'POST', `/api/companies/${a}/dnc`, { reason: 'Demande du gérant au téléphone', requestedBy: 'gérant' });
    const c = (await call('admin', 'GET', `/api/companies/${a}`)).json().company;
    expect(c).toMatchObject({ do_not_contact: true, crm_status: 'do_not_contact', score_band: 'excluded' });
    expect((await call('admin', 'GET', '/api/export?format=csv&city=azemmour')).body).not.toContain('Clinique Exemple');
    expect((await one<any>(`SELECT count(*)::int n FROM do_not_contact WHERE scope='phone' AND value='+212523341200'`)).n).toBe(1);
  });
  it('importe un fichier CSV', async () => {
    const boundary = '----radar';
    const csv = 'Nom;Téléphone;Ville;Secteur;Site\nÉcole Import Test;0522 11 22 33;Casablanca;Éducation;https://ecole-import.ma\n;;;;\n';
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="liste.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;
    const r = await app.inject({ method: 'POST', url: '/api/import', headers: { cookie: cookies.admin, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
    expect(r.json()).toMatchObject({ rows: 1, created: 1 });
    const c = await one<any>(`SELECT * FROM companies WHERE name='École Import Test'`);
    expect(c).toMatchObject({ city_id: 'casablanca', sector: 'education' });
  });
});

describe('sécurité réseau', () => {
  it('bloque les adresses internes (SSRF) hors démo', async () => {
    config.allowPrivateFetch = false;
    await expect(assertPublicHost('127.0.0.1')).rejects.toThrow(/privée|interne/);
    await expect(assertPublicHost('localhost')).rejects.toThrow();
    await expect(assertPublicHost('169.254.169.254')).rejects.toThrow();
    config.allowPrivateFetch = true;
  });
  it('refuse une requête modifiante sans en-tête JSON (CSRF)', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/scans', headers: { cookie: cookies.admin, 'content-type': 'text/plain' }, payload: 'x' });
    expect(r.statusCode).toBe(415);
  });
});
