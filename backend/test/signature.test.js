'use strict';
/* Signature électronique des devis : code de vérification, signature, dossier de preuve, certificat, intégrité du document. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto'), zlib = require('node:zlib');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dg-sign-')), 'test.db');
/* une adresse e-mail d'envoi réglée : le code de vérification part par e-mail */
process.env.MAIL1_ADDRESS = 'devis@agence.test'; process.env.MAIL1_SMTP_HOST = 'test'; process.env.MAIL1_PASS = 'mot-de-passe-de-test';
const MSG = require('../lib/messaging');
const SIG = require('../lib/sign');
const app = require('../server');
const { db } = require('../db');
const mails = [];
MSG.sendMail = async (ch, to, subject, body) => { mails.push({ to, subject, body }); return { status: 'envoye' }; };
let server, base, cookie = '';
before(() => new Promise((r) => { server = app.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); }); server.unref(); }));
after(() => server.close());
const post = async (p, data) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams(data).toString() });
const get = async (p) => fetch(base + p, { redirect: 'manual', headers: { cookie } });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const api = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': IPHONE }, body: JSON.stringify(body) }); return { status: r.status, j: await r.json() }; };
/* une vraie image PNG (bruit), comme celle qu'envoie la zone de signature */
function png(w = 120, h = 40) {
  const chunk = (type, data) => { const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]); len.writeUInt32BE(data.length); crc.writeUInt32BE(zlib.crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = crypto.randomBytes((w * 4 + 1) * h); for (let y = 0; y < h; y++) raw[y * (w * 4 + 1)] = 0;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
async function newQuote(name, email = '') {
  const r = await post('/devis/nouveau', { client_id: 'new', nc_name: name, nc_company: 'Clinique Azur', nc_email: email, nc_phone: '0612345678', title: 'Site vitrine', issue_date: new Date().toISOString().slice(0, 10), validity: '30', tva_rate: '20', deposit_pct: '50', 'items[0][label]': 'Site vitrine sur mesure', 'items[0][qty]': '1', 'items[0][unit_price]': '9000' });
  const id = Number(r.headers.get('location').split('/').pop().split('?')[0]);
  return { id, tok: (await db.prepare('SELECT token FROM quotes WHERE id = ?').get(id)).token };
}
const codeOf = (m) => m.subject.match(/(\d{6})/)[1];

test('outils : empreinte stable du document, contact masqué, appareil, image', () => {
  const q = { number: 'DG-D-1', issue_date: '2026-11-03', total_ttc: 1200, tva_rate: 20 }, items = [{ label: 'Site', qty: 1, unit_price: 1000 }];
  const h1 = SIG.hashOf(SIG.canonicalQuote(q, items, { name: 'Sara' }));
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.strictEqual(SIG.hashOf(SIG.canonicalQuote({ tva_rate: 20, total_ttc: 1200, issue_date: '2026-11-03', number: 'DG-D-1', status: 'vu', viewed_at: 'x' }, items, { name: 'Sara' })), h1, 'l’ordre des champs et le statut ne changent pas l’empreinte');
  assert.notStrictEqual(SIG.hashOf(SIG.canonicalQuote(q, [{ label: 'Site', qty: 1, unit_price: 1001 }], { name: 'Sara' })), h1, 'un prix modifié change l’empreinte');
  assert.strictEqual(SIG.mask('sara@clinique.ma'), 's•••@clinique.ma');
  assert.strictEqual(SIG.mask('06 12 34 56 78'), '+2126 •• •• 78');
  assert.strictEqual(SIG.device(IPHONE), 'Safari sur iPhone / iPad');
  assert.ok(SIG.validImage(png())); assert.ok(!SIG.validImage('data:image/png;base64,AAAA')); assert.ok(!SIG.validImage('data:image/svg+xml;base64,' + 'A'.repeat(4000)));
  assert.match(SIG.newCode(), /^\d{6}$/);
});

test('signature avec code par e-mail : devis accepté, bon de commande, dossier de preuve et certificat', async () => {
  const r = await post('/installation', { pw: 'motdepasse123', pw2: 'motdepasse123' }); cookie = r.headers.get('set-cookie').split(';')[0];
  const { id, tok } = await newQuote('Sara Alami', 'sara@clinique.ma');
  const page = await (await fetch(base + '/d/' + tok)).text();
  assert.match(page, /Signer le devis/); assert.match(page, /data-code="1"/); assert.match(page, /Code de vérification/); assert.match(page, /\/static\/sign\.js/);
  assert.match(page, /data-via="mail"/); assert.match(page, /s•••@clinique\.ma/); assert.doesNotMatch(page.slice(page.indexOf('id="accepter"')), /sara@clinique\.ma/, 'le panneau de signature n’écrit pas l’adresse en entier');
  const shown = page.match(/data-hash="([0-9a-f]{64})"/)[1];
  const sig = { name: 'Sara Alami', role: 'Gérante', image: png(), method: 'draw', hash: shown, ok: true };
  let x = await api(`/d/${tok}/signer`, sig);
  assert.strictEqual(x.status, 400); assert.match(x.j.error, /code de vérification/);
  /* le code part aux coordonnées du dossier, jamais à une adresse choisie sur la page */
  x = await api(`/d/${tok}/code`, { via: 'mail', contact: 'quelquun@ailleurs.ma' });
  assert.deepStrictEqual([x.status, x.j.via, x.j.to], [200, 'e-mail', 's•••@clinique.ma']);
  const m = mails.pop(); assert.strictEqual(m.to, 'sara@clinique.ma'); assert.match(m.body, /Valable 10 minutes/); assert.strictEqual(mails.length, 0);
  const code = codeOf(m), wrong = code === '000000' ? '111111' : '000000';
  x = await api(`/d/${tok}/signer`, { ...sig, code, ok: false });
  assert.strictEqual(x.status, 400); assert.match(x.j.error, /case d’engagement/);
  x = await api(`/d/${tok}/signer`, { ...sig, code: wrong });
  assert.strictEqual(x.status, 400); assert.match(x.j.error, /Code incorrect \(4 essais restants\)/);
  /* le client signe la version affichée : une autre empreinte est refusée */
  x = await api(`/d/${tok}/signer`, { ...sig, code, hash: 'f'.repeat(64) });
  assert.strictEqual(x.status, 409); assert.match(x.j.error, /vient d’être mis à jour/);
  x = await api(`/d/${tok}/signer`, { ...sig, code });
  assert.strictEqual(x.status, 200); assert.strictEqual(x.j.redirect, `/d/${tok}?merci=1`);
  const q = await db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
  assert.deepStrictEqual([q.status, q.accepted_name], ['accepte', 'Sara Alami']);
  const s = await db.prepare("SELECT * FROM signatures WHERE doc_type = 'devis' AND doc_id = ?").get(id);
  assert.deepStrictEqual([s.signer_name, s.signer_role, s.signer_company, s.verified_by, s.contact, s.method, s.ua], ['Sara Alami', 'Gérante', 'Clinique Azur', 'e-mail', 'sara@clinique.ma', 'signature tracée', IPHONE]);
  assert.strictEqual(s.doc_hash, shown); assert.ok(s.ip); assert.strictEqual(s.consent, SIG.CONSENT); assert.strictEqual(x.j.certificate, `/signature/${s.token}`);
  assert.ok((await db.prepare("SELECT used_at FROM sign_codes WHERE doc_id = ?").get(id)).used_at, 'le code ne sert qu’une fois');
  const o = await db.prepare('SELECT * FROM orders WHERE quote_id = ?').get(id); assert.ok(o, 'le bon de commande est créé');
  /* une seule signature : une seconde tentative est refusée */
  x = await api(`/d/${tok}/signer`, { ...sig, code });
  assert.strictEqual(x.status, 409);
  /* le document montre la signature ; le client a son certificat */
  const signed = await (await fetch(base + '/d/' + tok + '?merci=1')).text();
  assert.match(signed, /Merci, votre devis est signé/); assert.match(signed, /Signé par <b>Sara Alami<\/b>, Gérante \(Clinique Azur\)/); assert.match(signed, /code vérifié par e-mail/);
  assert.doesNotMatch(signed, /data-sign/); assert.match(signed, /heure du Maroc/);
  const bc = await (await fetch(base + '/bc/' + o.token)).text(); assert.match(bc, /Commande signée · signature électronique/);
  const cert = await (await fetch(base + '/signature/' + s.token)).text();
  assert.match(cert, /Certificat de signature/); assert.match(cert, /code à usage unique envoyé par e-mail à s•••@clinique\.ma/);
  assert.match(cert, new RegExp(s.doc_hash)); assert.match(cert, /Le devis est identique à celui qui a été signé/); assert.match(cert, /Safari sur iPhone \/ iPad/);
  assert.match(cert, /loi n° 43-20/); assert.match(cert, /Code vérifié/); assert.match(cert, /Signature par Sara Alami/);
  const admin = await (await get('/devis/' + id)).text();
  assert.match(admin, /Signé électroniquement par Sara Alami/); assert.match(admin, new RegExp(`/signature/${s.token}`));
  /* le devis change après la signature : le certificat le dit */
  await db.prepare('UPDATE quote_items SET unit_price = unit_price + 100 WHERE quote_id = ?').run(id);
  assert.match(await (await fetch(base + '/signature/' + s.token)).text(), /Le devis a été modifié depuis la signature/);
  assert.strictEqual((await fetch(base + '/signature/inconnu')).status, 404);
});

test('code expiré, essais limités, ancien bouton « J’accepte » renvoyé vers la signature', async () => {
  /* dossier sans e-mail : le client indique où recevoir le code */
  const { id, tok } = await newQuote('Omar Benali');
  assert.match(await (await fetch(base + '/d/' + tok)).text(), /<input name="contact"/);
  let r = await fetch(base + '/d/' + tok + '/accepter', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Omar&ok=1' });
  assert.strictEqual(r.headers.get('location'), `/d/${tok}#accepter`);
  assert.strictEqual((await db.prepare('SELECT accepted_at FROM quotes WHERE id = ?').get(id)).accepted_at, null, 'sans code, pas d’acceptation');
  const sig = { name: 'Omar Benali', contact: 'omar@exemple.ma', image: png(), method: 'type', ok: true };
  let x = await api(`/d/${tok}/code`, { contact: 'omar@exemple' });
  assert.strictEqual(x.status, 400);
  x = await api(`/d/${tok}/code`, { contact: 'omar@exemple.ma' }); assert.strictEqual(x.status, 200);
  let code = codeOf(mails.pop());
  await db.prepare("UPDATE sign_codes SET expires_at = datetime('now', '-1 minute') WHERE doc_id = ?").run(id);
  x = await api(`/d/${tok}/signer`, { ...sig, code }); assert.strictEqual(x.status, 400); assert.match(x.j.error, /expiré/);
  x = await api(`/d/${tok}/code`, { contact: 'omar@exemple.ma' }); code = codeOf(mails.pop());
  const wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < SIG.CODE_MAX_TRIES; i++) { x = await api(`/d/${tok}/signer`, { ...sig, code: wrong }); assert.strictEqual(x.status, 400); }
  x = await api(`/d/${tok}/signer`, { ...sig, code }); assert.strictEqual(x.status, 400); assert.match(x.j.error, /Trop d’essais/);
  x = await api(`/d/${tok}/code`, { contact: 'omar@exemple.ma' }); code = codeOf(mails.pop());
  x = await api(`/d/${tok}/signer`, { ...sig, code }); assert.strictEqual(x.status, 200);
  assert.strictEqual((await db.prepare("SELECT method FROM signatures WHERE doc_id = ?").get(id)).method, 'nom tapé');
});

test('sans e-mail ni WhatsApp réglés : signature sur le lien personnel, sans code', async () => {
  const saved = process.env.MAIL1_SMTP_HOST; delete process.env.MAIL1_SMTP_HOST;
  try {
    const { id, tok } = await newQuote('Nadia Tazi', 'nadia@exemple.ma');
    const page = await (await fetch(base + '/d/' + tok)).text();
    assert.match(page, /data-code=""/); assert.doesNotMatch(page, /Code de vérification/);
    assert.strictEqual((await api(`/d/${tok}/code`, { contact: 'nadia@exemple.ma' })).status, 400);
    const x = await api(`/d/${tok}/signer`, { name: 'Nadia Tazi', image: png(), method: 'draw', ok: true });
    assert.strictEqual(x.status, 200);
    const s = await db.prepare("SELECT * FROM signatures WHERE doc_id = ?").get(id);
    assert.strictEqual(s.verified_by, null);
    assert.match(await (await fetch(base + x.j.certificate)).text(), /lien personnel du devis \(sans code\)/);
  } finally { process.env.MAIL1_SMTP_HOST = saved; }
});
