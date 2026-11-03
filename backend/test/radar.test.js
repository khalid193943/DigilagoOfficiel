'use strict';
/* Liaison avec le Radar Digilago : demandes envoyées par le Radar, diagnostic des demandes reçues, étapes du devis. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dg-radar-')), 'test.db');
process.env.RADAR_URL = 'https://radar.test';
process.env.RADAR_SECRET = 'secret-de-test-partage-entre-radar-et-gestion';
const RADAR = require('../lib/radar');
const app = require('../server');
const { db } = require('../db');
let server, base, cookie = '';
before(() => new Promise((r) => { server = app.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); }); server.unref(); }));
after(() => { RADAR.setFetch(null); server.close(); });
const post = async (p, data) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams(data).toString() });
const get = async (p) => fetch(base + p, { redirect: 'manual', headers: { cookie } });
/** appel du Radar vers la gestion, signé comme il le fait */
const fromRadar = (p, body, secret) => { const raw = JSON.stringify(body), { ts, sig } = RADAR.sign(raw, undefined, secret); return fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Digilago-Timestamp': ts, 'X-Digilago-Signature': sig }, body: raw }); };

/* faux Radar : vérifie la signature de chaque appel, répond selon la route, garde la trace */
const calls = []; let failEvents = false;
const snap = (over = {}) => ({ radarId: '11111111-1111-4111-8111-111111111111', ref: 'DLG-000001', name: 'Clinique Dentaire Nour', sector: 'Santé', city: 'El Jadida', segment: 'no_site', segmentLabel: 'Aucun site trouvé', score: 84,
  status: 'replied', statusLabel: 'Réponse reçue', pitch: 'Les clients qui cherchent « santé à El Jadida » en ligne ne vous trouvent pas.', reasons: ['Aucun site trouvé', 'Secteur prioritaire'],
  website: null, google: 'not_found', googleLabel: 'Aucune fiche Google trouvée', phones: ['+212661223344'], whatsapp: [], emails: [], socials: [{ platform: 'facebook', url: 'https://facebook.com/nour' }],
  address: null, analyzedAt: '2026-11-03T10:00:00Z', isDemo: false, doNotContact: false, url: 'https://radar.test/entreprises/11111111-1111-4111-8111-111111111111', ...over });
RADAR.setFetch(async (url, init) => {
  const route = url.split('/').pop(), body = JSON.parse(init.body);
  assert.ok(RADAR.verify(init.body, init.headers['X-Digilago-Timestamp'], init.headers['X-Digilago-Signature']), 'appel non signé');
  calls.push({ route, body });
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  if (route === 'lookup') return json({ ok: true, matches: body.phone && body.phone.includes('22 33 44') ? [{ match: 'telephone', strong: true, company: snap() }] : body.company === 'Garage Atlas' ? [{ match: 'nom', strong: false, similarity: 0.62, company: snap({ radarId: '22222222-2222-4222-8222-222222222222', name: 'Garage Atlas Auto', segment: 'weak_site', segmentLabel: 'Site basique' }) }] : [] });
  if (route === 'link') return json({ ok: true, company: snap({ radarId: body.radarId }) });
  if (route === 'create') return json({ ok: true, created: true, company: snap({ radarId: '33333333-3333-4333-8333-333333333333', name: body.company, segment: 'unknown', segmentLabel: 'À analyser', score: null }) });
  if (route === 'snapshot') return json({ ok: true, company: snap({ radarId: body.radarId }) });
  if (route === 'event') return failEvents ? json({ ok: false, error: 'indisponible' }, 503) : json({ ok: true, status: 'proposal' });
  if (route === 'summary') return json({ ok: true, today: 12, replies: 3, meetings: 1, proposals: { n: 2, value: 26400 }, wonThisMonth: { n: 1, value: 9000 }, links: { today: 'https://radar.test/entreprises?view=today', pipeline: 'https://radar.test/pipeline', home: 'https://radar.test/' } });
  if (route === 'ping') return json({ ok: true, app: 'radar' });
  return json({ ok: false, error: 'route inconnue' }, 404);
});

test('signature : même secret, corps intact, appel récent', () => {
  const raw = '{"a":1}', now = Date.now(), { ts, sig } = RADAR.sign(raw, Math.floor(now / 1000));
  assert.ok(RADAR.verify(raw, ts, sig, undefined, now));
  assert.ok(!RADAR.verify('{"a":2}', ts, sig, undefined, now));
  assert.ok(!RADAR.verify(raw, ts, sig, 'un-autre-secret-un-autre-secret', now));
  assert.ok(!RADAR.verify(raw, ts, sig, undefined, now + 10 * 60e3));
});

test('« Préparer le devis » depuis le Radar : demande créée une fois, prête pour l’assistant', async () => {
  let r = await post('/installation', { pw: 'motdepasse123', pw2: 'motdepasse123' }); cookie = r.headers.get('set-cookie').split(';')[0];
  assert.strictEqual((await fetch(base + '/webhooks/radar/demande', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  assert.strictEqual((await fromRadar('/webhooks/radar/demande', { event: 'handoff', company: snap() }, 'mauvais-secret-mauvais-secret-mauvais')).status, 401);
  r = await fromRadar('/webhooks/radar/demande', { event: 'handoff', company: snap() });
  const a = await r.json();
  assert.deepStrictEqual({ ok: a.ok, path: a.path, assistant: a.assistant, created: a.created }, { ok: true, path: `/demandes/${a.id}`, assistant: `/assistant?demande=${a.id}`, created: true });
  const l = await db.prepare('SELECT * FROM leads WHERE id = ?').get(a.id);
  assert.deepStrictEqual([l.company, l.source, l.stage, l.kind, l.sector, l.phone], ['Clinique Dentaire Nour', 'Radar', 'contacte', 'vitrine', 'Santé et médical', '+212661223344']);
  const b = await (await fromRadar('/webhooks/radar/demande', { event: 'handoff', company: snap() })).json();
  assert.deepStrictEqual([b.id, b.created], [a.id, false]);
  assert.strictEqual((await fromRadar('/webhooks/radar/demande', { event: 'handoff', company: snap({ radarId: '99999999-9999-4999-8999-999999999999', isDemo: true }) })).status, 400);
  const asst = await (await get(`/assistant?demande=${a.id}`)).text();
  assert.match(asst, /Depuis la demande de Clinique Dentaire Nour/);
  const page = await (await get(`/demandes/${a.id}`)).text();
  assert.match(page, /Aucun site trouvé/); assert.match(page, /Ouvrir dans le Radar/);
});

test('demande du site : reconnue par le Radar à la première ouverture, diagnostic affiché', async () => {
  const r = await fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Yassine', company: 'Cabinet Nour', phone: '0661 22 33 44', need: 'Site web' }) });
  const { id } = await r.json();
  const page = await (await get(`/demandes/${id}`)).text();
  assert.match(page, /Reliée au Radar \(même téléphone\)/); assert.match(page, /score 84/);
  const link = calls.filter((c) => c.route === 'link').pop();
  assert.deepStrictEqual([link.body.leadId, link.body.inbound], [id, true]);
  /* nom seulement proche : proposé, puis confirmé à la main */
  const r2 = await fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Omar', company: 'Garage Atlas', phone: '0522 00 00 00' }) });
  const id2 = (await r2.json()).id;
  assert.match(await (await get(`/demandes/${id2}`)).text(), /C’est cette entreprise/);
  await post(`/demandes/${id2}/radar/relier`, { radar_id: '22222222-2222-4222-8222-222222222222' });
  assert.strictEqual((await db.prepare('SELECT radar_id FROM leads WHERE id = ?').get(id2)).radar_id, '22222222-2222-4222-8222-222222222222');
  /* inconnue du Radar : ajoutée, et reliée */
  const r3 = await fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Imane', company: 'Pâtisserie Lumière', phone: '0700 11 22 33' }) });
  const id3 = (await r3.json()).id;
  assert.match(await (await get(`/demandes/${id3}`)).text(), /Ajouter au Radar et analyser/);
  await post(`/demandes/${id3}/radar/ajouter`, {});
  const l3 = await db.prepare('SELECT radar_id FROM leads WHERE id = ?').get(id3);
  assert.strictEqual(l3.radar_id, '33333333-3333-4333-8333-333333333333');
  assert.strictEqual(calls.filter((c) => c.route === 'create').pop().body.company, 'Pâtisserie Lumière');
});

test('devis envoyé puis accepté : le Radar le sait (statut, montant, numéro) ; envoi repris après une panne', async () => {
  const lead = await db.prepare("SELECT id FROM leads WHERE company = 'Clinique Dentaire Nour' AND source = 'Radar'").get();
  let r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Dr Nour', nc_company: 'Clinique Dentaire Nour', nc_phone: '0661223344', title: 'Site vitrine', issue_date: '2026-11-03', validity: '30', tva_rate: '20', discount_pct: '0', deposit_pct: '50', lead_id: String(lead.id), 'items[0][label]': 'Site vitrine sur mesure', 'items[0][qty]': '1', 'items[0][unit_price]': '12000' });
  const qid = r.headers.get('location').split('/').pop().split('?')[0];
  failEvents = true;
  await post(`/devis/${qid}/statut`, { status: 'envoye' });
  const pending = await db.prepare('SELECT * FROM radar_outbox WHERE sent_at IS NULL').all();
  assert.strictEqual(pending.length, 1); assert.strictEqual(pending[0].tries, 1); assert.ok(pending[0].next_at);
  assert.deepStrictEqual(JSON.parse(pending[0].payload), { event: 'devis_envoye', radarId: snap().radarId, leadId: lead.id, path: `/demandes/${lead.id}`, amount: 14400, number: 'DG-D-2026-0001' });
  failEvents = false;
  await db.prepare("UPDATE radar_outbox SET next_at = datetime('now', '-1 minute')").run();
  await get('/api/pulse');
  assert.strictEqual((await db.prepare('SELECT COUNT(*) n FROM radar_outbox WHERE sent_at IS NULL').get()).n, 0);
  await post(`/devis/${qid}/statut`, { status: 'accepte' });
  const ev = calls.filter((c) => c.route === 'event').pop().body;
  assert.deepStrictEqual([ev.event, ev.amount, ev.number], ['devis_accepte', 14400, 'DG-D-2026-0001']);
});

test('tableau de bord et paramètres : le Radar en un coup d’œil, liaison vérifiable', async () => {
  const dash = await (await get('/')).text();
  assert.match(dash, /prospects à appeler aujourd’hui/); assert.match(dash, />12</);
  const set = await (await get('/parametres')).text(); assert.match(set, /Relié/);
  const r = await post('/parametres/radar/tester', {});
  assert.match(r.headers.get('location'), /radar=ok/);
});
