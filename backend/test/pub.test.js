'use strict';
/* Publicité : provenance des demandes, conversions Meta (avec l'accord du visiteur), export Google Ads, rentabilité par canal. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dg-pub-')), 'test.db');
process.env.META_PIXEL_ID = '123456789012345';
process.env.META_CAPI_TOKEN = 'jeton-de-test-meta-api-conversions-0123456789';
const ADS = require('../lib/ads');
const app = require('../server');
const { db } = require('../db');
let server, base, cookie = '';
before(() => new Promise((r) => { server = app.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); }); server.unref(); }));
after(() => { ADS.setFetch(null); server.close(); });
const post = async (p, data) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams(data).toString() });
const get = async (p) => fetch(base + p, { redirect: 'manual', headers: { cookie } });
const lead = (b) => fetch(base + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (test)' }, body: JSON.stringify(b) }).then((r) => r.json());
const sent = [];
ADS.setFetch(async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ events_received: 1 }), { status: 200 }); });
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');

test('demande venue d’une publicité Meta, avec l’accord du visiteur : provenance gardée, « Lead » transmis à Meta (haché)', async () => {
  const r = await post('/installation', { pw: 'motdepasse123', pw2: 'motdepasse123' }); cookie = r.headers.get('set-cookie').split(';')[0];
  const { id } = await lead({ name: 'Salma', company: 'Institut Jasmin', phone: '0661 11 22 33', email: 'Salma@Jasmin.ma', source: 'Démarrer un projet', event_id: 'evt-123', consent_ads: true, fbp: 'fb.1.1700000000000.111',
    att: { utm_source: 'ig', utm_medium: 'paid', utm_campaign: 'Instituts El Jadida', utm_content: 'Carrousel avant/après', fbclid: 'IwAR0abc', landing: '/demarrer.html', at: '2026-11-03T10:00:00Z' }, page: 'https://www.digilago.ma/demarrer.html' });
  const l = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  assert.deepStrictEqual([l.channel, l.campaign, l.ads_ok], ['meta-ads', 'Instituts El Jadida', 1]);
  const att = JSON.parse(l.att);
  assert.strictEqual(att.ua, 'Mozilla/5.0 (test)'); assert.ok(att.ip);
  const ev = sent.pop().body.data[0];
  assert.deepStrictEqual([ev.event_name, ev.event_id, ev.action_source, ev.event_source_url], ['Lead', 'evt-123', 'website', 'https://www.digilago.ma/demarrer.html']);
  assert.deepStrictEqual(ev.user_data.ph, [sha('212661112233')]);
  assert.deepStrictEqual(ev.user_data.em, [sha('salma@jasmin.ma')]);
  assert.strictEqual(ev.user_data.fbp, 'fb.1.1700000000000.111');
  assert.match(ev.user_data.fbc, /^fb\.1\.\d+\.IwAR0abc$/);
  const page = await (await get(`/demandes/${id}`)).text();
  assert.match(page, /Provenance/); assert.match(page, /Instituts El Jadida/); assert.match(page, /Carrousel avant\/après/);
});

test('sans l’accord publicité : rien n’est transmis à Meta, ni adresse ni navigateur gardés', async () => {
  const before = sent.length;
  const { id } = await lead({ name: 'Omar', phone: '0662 00 00 00', consent_ads: false, event_id: 'evt-456', att: { fbclid: 'IwAR0zzz', utm_campaign: 'Garages' } });
  const l = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  assert.deepStrictEqual([l.channel, l.ads_ok], ['meta-ads', 0]);
  const att = JSON.parse(l.att); assert.ok(!att.ip && !att.ua && !att.fbp);
  assert.strictEqual(sent.length, before);
});

test('client signé : « Purchase » transmis à Meta avec le montant ; clic Google exporté pour Google Ads ; rentabilité par canal', async () => {
  const meta = await db.prepare("SELECT id FROM leads WHERE campaign = 'Instituts El Jadida'").get();
  let r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Salma', nc_company: 'Institut Jasmin', nc_phone: '0661112233', title: 'Site vitrine', issue_date: '2026-11-03', validity: '30', tva_rate: '20', discount_pct: '0', deposit_pct: '50', lead_id: String(meta.id), 'items[0][label]': 'Site vitrine', 'items[0][qty]': '1', 'items[0][unit_price]': '8000' });
  const qid = r.headers.get('location').split('/').pop().split('?')[0];
  await post(`/devis/${qid}/statut`, { status: 'accepte' });
  const ev = sent.pop().body.data[0];
  assert.deepStrictEqual([ev.event_name, ev.event_id, ev.action_source, ev.custom_data], ['Purchase', `devis-${qid}`, 'system_generated', { currency: 'MAD', value: 9600 }]);
  /* une demande Google Ads signée */
  const { id: g } = await lead({ name: 'Karim', company: 'Garage Atlas', phone: '0522 11 11 11', consent_ads: false, att: { gclid: 'Cj0KCQ-test', utm_source: 'google', utm_medium: 'cpc', utm_campaign: '1234567' } });
  r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Karim', nc_company: 'Garage Atlas', nc_phone: '0522111111', title: 'Site', issue_date: '2026-11-03', validity: '30', tva_rate: '20', discount_pct: '0', deposit_pct: '50', lead_id: String(g), 'items[0][label]': 'Site', 'items[0][qty]': '1', 'items[0][unit_price]': '5000' });
  await post(`/devis/${r.headers.get('location').split('/').pop().split('?')[0]}/statut`, { status: 'accepte' });
  const csv = await (await get('/export/google-ads.csv?periode=30')).text();
  assert.match(csv, /^Parameters:TimeZone=Africa\/Casablanca/);
  assert.match(csv, /Cj0KCQ-test,Client signé \(Digilago\),\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,6000\.00,MAD/);
  await post('/depenses', { date: new Date().toISOString().slice(0, 10), supplier: 'Meta Platforms', category: 'Publicité', label: 'Campagne Instituts', amount_ttc: '1200', tva: '0', method: 'Carte' });
  const page = await (await get('/publicite?periode=30')).text();
  assert.match(page, /Meta Ads/); assert.match(page, /Google Ads/); assert.match(page, /Instituts El Jadida/);
  assert.match(page, /8,0 ×/); // 9 600 DH signés pour 1 200 DH dépensés
});

test('publicité « Cliquer pour WhatsApp » : l’annonce d’origine est reconnue', async () => {
  await fetch(base + '/webhooks/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '1' }, contacts: [{ wa_id: '212677777777', profile: { name: 'Nadia' } }],
    messages: [{ from: '212677777777', id: 'wamid.1', timestamp: '1762160000', type: 'text', text: { body: 'Bonjour, je veux un site' }, referral: { source_type: 'ad', source_id: '120000001', headline: 'Votre site en 7 jours', ctwa_clid: 'ARAk-clid' } }] } }] }] }) });
  const l = await db.prepare("SELECT * FROM leads WHERE phone = '+212677777777'").get();
  assert.deepStrictEqual([l.channel, l.campaign, l.source], ['meta-ads', 'Votre site en 7 jours', 'WhatsApp (publicité Meta)']);
});
