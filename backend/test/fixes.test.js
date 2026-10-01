'use strict';
/* Garde-fous : argent exact, documents sans doublon, sécurité. Chaque test correspond à un défaut corrigé. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dg-fix-')), 'test.db');
const app = require('../server');
const { num } = require('../lib/fmt');
let server, base, cookie = '';
before(() => new Promise((r) => { server = app.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); }); server.unref(); }));
after(() => server.close());
const post = async (p, data, opts = {}) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie, ...(opts.headers || {}) }, body: new URLSearchParams(data).toString() });
const get = async (p, c = cookie) => fetch(base + p, { redirect: 'manual', headers: { cookie: c } });
const idOf = (r) => r.headers.get('location').split('/').pop().split('?')[0];
const html = async (p) => (await get(p)).text();
let n = 0;
async function quote(extra = {}) {
  n++;
  const r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Client ' + n, nc_company: 'Société ' + n, title: 'Projet ' + n, issue_date: '2026-10-01', validity: '30', tva_rate: '20', 'items[0][label]': 'Site', 'items[0][qty]': '1', 'items[0][unit_price]': '10000', ...extra });
  assert.strictEqual(r.status, 302); return idOf(r);
}
const invoicesOf = async (qid) => [...(await html('/devis/' + qid)).matchAll(/href="\/factures\/(\d+)"/g)].map((m) => m[1]);

test('installation', async () => {
  const r = await post('/installation', { pw: 'motdepasse123', pw2: 'motdepasse123' });
  cookie = r.headers.get('set-cookie').split(';')[0];
});

test('nombres saisis : 12.000, 1.200,50, 1,200.50, 12,5', () => {
  assert.strictEqual(num('12.000'), 12000);
  assert.strictEqual(num('1.200,50'), 1200.5);
  assert.strictEqual(num('1,200.50'), 1200.5);
  assert.strictEqual(num('12,5'), 12.5);
  assert.strictEqual(num('0.500'), 0.5);
  assert.strictEqual(num('12 000'), 12000);
});

test('échéances facturées dans l’ordre, sans doublon au double-clic', async () => {
  const q = await quote({ plan_key: '30-40-30' });
  let r = await post(`/devis/${q}/facturer`, { idx: '2' });
  assert.match(decodeURIComponent(r.headers.get('location')), /Facturez d’abord/);
  r = await post(`/devis/${q}/facturer`, { idx: '0' }); const a1 = idOf(r);
  r = await post(`/devis/${q}/facturer`, { idx: '0' }); assert.strictEqual(idOf(r), a1, 'le double-clic renvoie la même facture');
  /* deux clics vraiment simultanés */
  const [x, y] = await Promise.all([post(`/devis/${q}/facturer`, { idx: '1' }), post(`/devis/${q}/facturer`, { idx: '1' })]);
  assert.strictEqual(idOf(x), idOf(y), 'deux clics simultanés : une seule facture');
  r = await post(`/devis/${q}/facturer`, { idx: '2' });
  const ids = await invoicesOf(q); assert.strictEqual(new Set(ids).size, 3);
});

test('solde au centime près : la somme des factures égale le devis', async () => {
  const q = await quote({ plan_key: '3x', 'items[0][unit_price]': '4999' });
  for (const i of [0, 1, 2]) await post(`/devis/${q}/facturer`, { idx: String(i) });
  let total = 0;
  for (const id of new Set(await invoicesOf(q))) { const t = (await html('/factures/' + id)).match(/Total TTC<\/span><b>([^<]+)</); total += num(t[1].replace(/[^\d,−-]/g, '').replace('−', '-')); }
  assert.strictEqual(Math.round(total * 100) / 100, 5998.8);
});

test('un avoir ne compte qu’une fois dans le reste dû du client', async () => {
  const q = await quote({ plan_key: '1x' });
  const inv = idOf(await post(`/devis/${q}/facturer`, { idx: '0' }));
  const [a, b] = await Promise.all([post(`/factures/${inv}/avoir`, {}), post(`/factures/${inv}/avoir`, {})]);
  const avoirs = [a, b].map(idOf).filter((x) => x !== inv);
  assert.ok(new Set(avoirs).size <= 1, 'un seul avoir');
  const page = await html('/clients');
  const row = page.split('<tr').find((t) => t.includes('Société ' + n));
  assert.ok(!/−/.test(row), 'pas de montant négatif dans le reste dû');
});

test('paiements : pas plus que le reste, jamais sur une facture annulée', async () => {
  const q = await quote({ plan_key: '1x' });
  const inv = idOf(await post(`/devis/${q}/facturer`, { idx: '0' }));
  let r = await post(`/factures/${inv}/paiements`, { amount: '999999', date: '2026-10-02', method: 'Virement' });
  assert.match(decodeURIComponent(r.headers.get('location')), /dépasse le reste/);
  await post(`/factures/${inv}/avoir`, {});
  r = await post(`/factures/${inv}/paiements`, { amount: '100', date: '2026-10-02', method: 'Virement' });
  assert.match(decodeURIComponent(r.headers.get('location')), /annulée par un avoir/);
});

test('devis accepté : verrouillé, et un devis refusé ne s’accepte plus en ligne', async () => {
  const q = await quote();
  await post(`/devis/${q}/statut`, { status: 'refuse' });
  const tok = (await html('/devis/' + q)).match(/\/d\/([A-Za-z0-9_-]+)/)[1];
  await fetch(base + '/d/' + tok + '/accepter', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Pirate&ok=1' });
  assert.match(await html('/devis/' + q), /Refusé/);
  const q2 = await quote(); await post(`/devis/${q2}/statut`, { status: 'accepte' });
  const r = await get(`/devis/${q2}/modifier`); assert.strictEqual(r.status, 302);
});

test('adresses invalides : 404 et non erreur 500', async () => {
  for (const p of ['/devis/abc', '/factures/1x', '/clients/%27']) assert.strictEqual((await get(p)).status, 404, p);
});

test('exports CSV : une formule ne s’exécute pas dans Excel', async () => {
  await post('/devis/nouveau', { client_id: 'new', nc_name: '=HYPERLINK("http://x")', nc_company: '=CMD()', title: 't', 'items[0][label]': 'x', 'items[0][qty]': '1', 'items[0][unit_price]': '10', plan_key: '1x' });
  const csv = await (await get('/export/factures.csv')).text();
  assert.ok(!/(^|;)=CMD/m.test(csv), 'formule neutralisée');
});

test('sauvegarde sans mot de passe ni jeton', async () => {
  await post('/parametres', { mail1_pass: 'SuperSecret!', wa1_token: 'EAAGtoken', company_name: 'Digilago' });
  const save = await (await get('/sauvegarde')).text();
  assert.ok(!/SuperSecret|EAAGtoken/.test(save));
  for (const t of ['orders', 'messages', 'tax_periods', 'reminders']) assert.ok(t in JSON.parse(save).tables, t);
});

test('webhook WhatsApp : signature exigée quand la clé de l’app est réglée', async () => {
  await post('/parametres', { wa_app_secret: 'app-secret-123', wa1_phone_id: '111', wa1_number: '212649953813' });
  const body = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' }, messages: [{ id: 'wamid.X1', from: '212600000099', timestamp: '1760000000', type: 'text', text: { body: 'faux message' } }] } }] }] });
  let r = await fetch(base + '/webhooks/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.strictEqual(r.status, 401);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'app-secret-123').update(body).digest('hex');
  r = await fetch(base + '/webhooks/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body });
  assert.strictEqual(r.status, 200);
});

test('demandes du site : piège à robots et limite par adresse', async () => {
  const send = (b) => fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://digilago.ma' }, body: JSON.stringify(b) });
  let r = await send({ name: 'Robot', phone: '0600', website: 'http://spam' }); assert.strictEqual(r.status, 200);
  assert.ok(!/Robot/.test(await html('/demandes')), 'le robot n’est pas enregistré');
  r = await send({ name: 'Vraie personne', phone: '0611' }); assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('access-control-allow-origin'), 'https://digilago.ma');
  let last; for (let i = 0; i < 8; i++) last = await send({ name: 'Flood ' + i, phone: '06' + i });
  assert.strictEqual(last.status, 429);
});

test('mot de passe : l’actuel est exigé, et les anciennes sessions sont fermées', async () => {
  let r = await post('/parametres/mot-de-passe', { cur: 'mauvais', pw: 'nouveaumotdepasse', pw2: 'nouveaumotdepasse' });
  assert.match(decodeURIComponent(r.headers.get('location')), /incorrect/);
  const old = cookie;
  r = await post('/parametres/mot-de-passe', { cur: 'motdepasse123', pw: 'nouveaumotdepasse', pw2: 'nouveaumotdepasse' });
  cookie = r.headers.get('set-cookie').split(';')[0];
  assert.strictEqual((await get('/', old)).status, 302, 'l’ancienne session est fermée');
  assert.strictEqual((await get('/', cookie)).status, 200, 'la nouvelle fonctionne');
});
