'use strict';
/* Parcours complet : installation, devis, acceptation, acompte, paiements, solde. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dg-')), 'test.db');
const app = require('../server');
let server, base, cookie = '';
before(() => new Promise((r) => { server = app.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); }); }));
after(() => server.close());
const post = async (p, data, opts = {}) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams(data).toString(), ...opts });
const get = async (p) => fetch(base + p, { redirect: 'manual', headers: { cookie } });

test('installation, devis, acompte, paiements, solde', async () => {
  let r = await get('/'); assert.strictEqual(r.headers.get('location'), '/installation');
  r = await post('/installation', { pw: 'motdepasse123', pw2: 'motdepasse123' });
  cookie = r.headers.get('set-cookie').split(';')[0];
  r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Sara Alami', nc_company: 'Clinique Azur', nc_phone: '0612345678', title: 'Site vitrine', issue_date: '2026-10-01', validity: '30', tva_rate: '20', discount_pct: '10', deposit_pct: '50', 'items[0][label]': 'Site vitrine sur mesure', 'items[0][qty]': '1', 'items[0][unit_price]': '10000', 'items[1][label]': 'Fiche Google Business', 'items[1][qty]': '1', 'items[1][unit_price]': '2000' });
  assert.strictEqual(r.status, 302); const qid = r.headers.get('location').split('/').pop().split('?')[0];
  const html = await (await get('/devis/' + qid)).text();
  assert.match(html, /DG-D-2026-0001/);
  assert.match(html, /12\u202f960,00/);       // (12 000 − 10 %) × 1,2
  assert.match(html, /Douze-mille-neuf-cent-soixante dirhams/);
  const tok = html.match(/\/d\/([A-Za-z0-9_-]+)/)[1];
  const pub = await (await fetch(base + '/d/' + tok)).text(); assert.match(pub, /Accepter ce devis/);
  r = await fetch(base + '/d/' + tok + '/accepter', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Sara+Alami&ok=1' });
  assert.match(r.headers.get('location'), /merci=1/);
  r = await post(`/devis/${qid}/facturer`, { kind: 'acompte' }); const a = r.headers.get('location').split('/').pop();
  let inv = await (await get('/factures/' + a)).text(); assert.match(inv, /DG-F-2026-0001|DG-F-\d{4}-0001/); assert.match(inv, /6\u202f480,00/);
  await post(`/factures/${a}/paiements`, { amount: '6480', date: '2026-10-02', method: 'Virement' });
  inv = await (await get('/factures/' + a)).text(); assert.match(inv, /Payée/);
  r = await post(`/devis/${qid}/facturer`, { kind: 'solde' }); const s = r.headers.get('location').split('/').pop();
  inv = await (await get('/factures/' + s)).text(); assert.match(inv, /Acompte déjà facturé/); assert.match(inv, /6\u202f480,00/);
  const dash = await (await get('/')).text(); assert.match(dash, /Reste à encaisser/);
  const csv = await (await get('/export/factures.csv')).text(); assert.match(csv, /Facture d’acompte/);
});

test('demande reçue depuis le site', async () => {
  const r = await fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Karim', phone: '0600000000', need: 'Site web' }) });
  assert.deepStrictEqual((await r.json()).ok, true);
  const page = await (await get('/demandes')).text(); assert.match(page, /Karim/);
});

test('projet ouvert à l’acceptation, dépenses et rapports', async () => {
  const projets = await (await get('/projets')).text();
  assert.match(projets, /Clinique Azur/);
  const r = await post('/depenses', { date: '2026-10-03', supplier: 'Hostinger', category: 'Hébergement', label: 'Hébergement annuel', amount_ttc: '1200', tva: '200', method: 'Carte' });
  assert.strictEqual(r.status, 302);
  const dep = await (await get('/depenses?mois=2026-10')).text(); assert.match(dep, /Hostinger/);
  const rap = await (await get('/rapports?annee=2026')).text();
  assert.match(rap, /1\u202f200,00/); assert.match(rap, /TVA à reverser/);
  const cat = await (await get('/prestations')).text();
  assert.match(cat, /Nom de domaine offert/); assert.match(cat, /Optimisation GEO/); assert.match(cat, /Code optimisé/);
});

test('brief client et superviseur', async () => {
  const pr = await (await get('/projets/1')).text();
  assert.match(pr, /Informations à réunir/);
  const tok = pr.match(/\/brief\/([A-Za-z0-9_-]+)/)[1];
  const page = await (await fetch(base + '/brief/' + tok)).text(); assert.match(page, /votre site/);
  const r = await fetch(base + '/brief/' + tok, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ company: 'Clinique Azur', city: 'Casablanca', address: '12 boulevard d’Anfa', phone: '0612345678', i_horaires: '9 h à 19 h' }).toString() });
  assert.match(r.headers.get('location'), /merci=1/);
  const dash = await (await get('/')).text();
  assert.match(dash, /allumer tout le Maroc/); assert.match(dash, /Casablanca · 1/); assert.match(dash, /Régions allumées/);
});
