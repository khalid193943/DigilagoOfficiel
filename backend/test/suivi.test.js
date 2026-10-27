'use strict';
/* Espace client « Suivi de projet » : du lien privé à la remise du site. */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dg-sv-')), 'test.db');
const app = require('../server');
let server, base, cookie = '', tok = '';
before(() => new Promise((r) => { server = app.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); }); server.unref(); }));
after(() => server.close());
const post = (p, data = {}) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie }, body: new URLSearchParams(data).toString() });
const get = (p) => fetch(base + p, { redirect: 'manual', headers: { cookie } });
const pub = (p) => fetch(base + p, { redirect: 'manual' });
const pubPost = (p, data = {}) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
const up = (p, body, name, c = '') => fetch(base + p + (p.includes('?') ? '&' : '?') + 'name=' + encodeURIComponent(name), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', cookie: c }, body });
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(200, 1)]);

test('mise en place : un projet accepté ouvre son espace', async () => {
  let r = await post('/installation', { pw: 'motdepasse123', pw2: 'motdepasse123' }); cookie = r.headers.get('set-cookie').split(';')[0];
  r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Sara Alami', nc_company: 'Clinique Azur', nc_phone: '0612345678', title: 'Site vitrine', issue_date: '2026-10-01', validity: '30', tva_rate: '20', discount_pct: '0', deposit_pct: '50', 'items[0][label]': 'Site vitrine', 'items[0][qty]': '1', 'items[0][unit_price]': '10000' });
  const qid = r.headers.get('location').split('/').pop().split('?')[0];
  const html = await (await get('/devis/' + qid)).text(); const dt = html.match(/\/d\/([A-Za-z0-9_-]+)/)[1];
  await fetch(base + '/d/' + dt + '/accepter', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Sara+Alami&ok=1' });
  const pr = await (await get('/projets/1')).text();
  assert.match(pr, /Espace client/); tok = pr.match(/\/suivi\/([A-Za-z0-9_-]+)/)[1];
  assert.ok(tok.length >= 20);
});

test('le lien privé : avancement, rien d’autre pour un lien inconnu ou sans mot de passe', async () => {
  const h = await (await pub('/suivi/' + tok)).text();
  assert.match(h, /Suivi de votre projet/); assert.match(h, /Avancement/); assert.match(h, /Brief et identité/); assert.match(h, /Rien à faire pour l’instant/);
  const r = await pub('/suivi/jetoninconnu1234567890'); assert.strictEqual(r.status, 404);
  assert.strictEqual((await pub('/suivi/abc')).status, 404);
  assert.match((await pub('/suivi/' + tok)).headers.get('cache-control'), /no-store/);
  assert.match((await pub('/suivi/' + tok)).headers.get('x-robots-tag'), /noindex/);
  // les actions de la gestion exigent la connexion
  for (const p of ['/projets/1/suivi/tache', '/projets/1/suivi/message']) assert.strictEqual((await pubPost(p, { preset: 'logo' })).headers.get('location'), '/connexion');
  assert.strictEqual((await pub('/projets/1/suivi/fichier/1')).headers.get('location'), '/connexion');
});

test('Digilago ajoute des demandes, le client y répond', async () => {
  for (const preset of ['logo', 'horaires', 'maquette', 'google']) assert.strictEqual((await post('/projets/1/suivi/tache', { preset })).status, 302);
  await post('/projets/1/suivi/tache', { kind: 'texte', title: '<script>alert(1)</script> Couleurs', detail: 'Dites-nous <b>tout</b>', link: 'javascript:alert(1)' });
  await post('/projets/1/suivi/tache', { kind: 'validation', title: 'Valider le logo', link: 'https://exemple.ma/maquette', step_idx: '1' });
  let h = await (await pub('/suivi/' + tok)).text();
  assert.match(h, /Envoyer votre logo/); assert.match(h, /Indiquer vos horaires/); assert.match(h, /5 à faire|6 à faire/);
  assert.ok(!h.includes('<script>alert(1)</script>')); assert.match(h, /&lt;script&gt;/); assert.ok(!h.includes('javascript:alert'));
  assert.match(h, /https:\/\/exemple\.ma\/maquette/);
  const ids = [...h.matchAll(/id="t(\d+)"/g)].map((m) => m[1]);
  const [logo, horaires, maquette, google] = ids;
  // réponse écrite
  let r = await pubPost(`/suivi/${tok}/tache/${horaires}`, { answer: '' }); assert.match(r.headers.get('location'), /e=vide/);
  r = await pubPost(`/suivi/${tok}/tache/${horaires}`, { answer: 'Lundi au samedi, 9 h à 19 h' }); assert.match(r.headers.get('location'), /ok=tache/);
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /Reçu, nous vérifions/); assert.match(h, /Lundi au samedi/);
  // confirmation simple
  await pubPost(`/suivi/${tok}/tache/${google}`, {});
  // validation de la maquette : coche l’étape liée
  r = await pubPost(`/suivi/${tok}/tache/${maquette}`, { decision: 'changes', comment: '' }); assert.match(r.headers.get('location'), /e=modif/);
  r = await pubPost(`/suivi/${tok}/tache/${maquette}`, { decision: 'changes', comment: 'Plus de bleu' });
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /Modifications demandées : Plus de bleu/);
  // ... Digilago relance avec une nouvelle version, le client valide
  await post(`/projets/1/suivi/tache/${maquette}/rouvrir`);
  await pubPost(`/suivi/${tok}/tache/${maquette}`, { decision: 'ok', comment: 'Parfait' });
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /Validé : Parfait/); assert.match(h, /Maquette validée/);
  assert.match(h, /<li class="done"><i>✓<\/i><div><b>Maquette validée/);
  // envoi de fichiers : accepté, refusé (type, contenu, taille)
  r = await up(`/suivi/${tok}/tache/${logo}/fichier`, PNG, 'logo.png'); assert.strictEqual(r.status, 200);
  assert.strictEqual((await up(`/suivi/${tok}/tache/${logo}/fichier`, PNG, 'virus.exe')).status, 400);
  assert.strictEqual((await up(`/suivi/${tok}/tache/${logo}/fichier`, Buffer.from('<html>x</html>'), 'faux.png')).status, 400);
  assert.strictEqual((await up(`/suivi/${tok}/tache/${logo}/fichier`, Buffer.alloc(0), 'vide.png')).status, 400);
  const big = await up(`/suivi/${tok}/tache/${logo}/fichier`, Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), 'gros.png'); assert.ok([400, 413].includes(big.status));
  assert.strictEqual((await up(`/suivi/${tok}/tache/${horaires}/fichier`, PNG, 'x.png')).status, 404);   // pas une demande de fichier
  assert.strictEqual((await up(`/suivi/autrejeton1234567890/tache/${logo}/fichier`, PNG, 'x.png')).status, 404);
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /logo\.png/);
  const fid = h.match(/\/suivi\/[^/]+\/fichier\/(\d+)/)[1];
  r = await pub(`/suivi/${tok}/fichier/${fid}`); assert.strictEqual(r.status, 200); assert.strictEqual(r.headers.get('content-type'), 'image/png'); assert.match(r.headers.get('content-security-policy'), /sandbox/);
  assert.strictEqual(Buffer.from(await r.arrayBuffer()).length, PNG.length);
});

test('Digilago voit ce qui est nouveau, valide ou fait reprendre', async () => {
  assert.match(await (await get('/')).text(), /Vos clients vous ont répondu/);
  let h = await (await get('/projets')).text(); assert.match(h, /nouveaux? du client/);
  h = await (await get('/projets/1')).text();
  assert.match(h, /Nouveau/); assert.match(h, /Lundi au samedi, 9 h à 19 h/); assert.match(h, /logo\.png/); assert.match(h, /Validé : Parfait/);
  h = await (await get('/projets')).text(); assert.ok(!/nouveaux? du client/.test(h), 'une fois consulté, plus de pastille');
  assert.ok(!(await (await get('/')).text()).includes('Vos clients vous ont répondu'));
  const logoT = (await (await pub('/suivi/' + tok)).text()).match(/id="t(\d+)"/)[1];
  await post(`/projets/1/suivi/tache/${logoT}/reprendre`, { feedback: 'Envoyez-le en SVG' });
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /À reprendre/); assert.match(h, /Envoyez-le en SVG/);
  const fid = (await (await get('/projets/1')).text()).match(/suivi\/fichier\/(\d+)/)[1];
  const r = await get(`/projets/1/suivi/fichier/${fid}`); assert.strictEqual(r.status, 200);
  await post(`/projets/1/suivi/tache/${logoT}/accepter`);
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /Terminé/);
});

test('messages dans les deux sens, limités', async () => {
  let r = await pubPost(`/suivi/${tok}/message`, { body: '' }); assert.match(r.headers.get('location'), /e=msg/);
  r = await pubPost(`/suivi/${tok}/message`, { body: 'Bonjour, quand est-ce prêt ?' }); assert.match(r.headers.get('location'), /ok=msg/);
  let h = await (await get('/projets/1')).text(); assert.match(h, /Bonjour, quand est-ce prêt/);
  await post('/projets/1/suivi/message', { body: 'Vendredi, sans faute.' });
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /Vendredi, sans faute/); assert.match(h, /Bonjour, quand est-ce prêt/);
});

test('informations du client depuis son espace', async () => {
  const r = await pubPost(`/suivi/${tok}/infos`, { company: 'Clinique Azur', city: 'Rabat', i_horaires: '9 h à 19 h' }); assert.match(r.headers.get('location'), /ok=infos/);
  const h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /Vos informations/); assert.match(h, /9 h à 19 h/);
});

test('l’espace de travail est réservé aux projets en cours ; la remise du site à la livraison', async () => {
  const setStatus = (status, extra = {}) => post('/projets/1', { status, due_date: '2026-12-01', site_url: extra.site_url || '', notes: '' });
  const tasks = (await (await pub('/suivi/' + tok)).text()).match(/id="t(\d+)"/g).map((x) => x.slice(5, -1));
  // proposition : pas de demandes, pas d’envoi
  await setStatus('proposition');
  let h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /Votre accord/); assert.ok(!h.includes('À faire de votre côté'));
  let r = await pubPost(`/suivi/${tok}/tache/${tasks[1]}`, { answer: 'x' }); assert.ok(r.headers.get('location').endsWith('/suivi/' + tok));
  assert.strictEqual((await up(`/suivi/${tok}/tache/${tasks[0]}/fichier`, PNG, 'x.png')).status, 403);
  // livré : remise du site
  await post('/projets/1/tech', { t_live_url: 'https://clinique-azur.ma', t_domain: 'clinique-azur.ma', t_domain_expiry: '2027-10-20', t_hosting: 'Vercel', t_gbp_url: 'https://maps.google.com/?cid=1' });
  await post('/parametres', { google_review_url: 'https://g.page/r/abc/review', public_url: '' });
  await setStatus('livre', { site_url: 'https://clinique-azur.ma' });
  h = await (await pub('/suivi/' + tok)).text();
  assert.match(h, /Votre site est en ligne/); assert.match(h, /clinique-azur\.ma/); assert.match(h, /Domaine valable jusqu’au/); assert.match(h, /Laisser un avis/); assert.match(h, /100/);
  assert.ok(!h.includes('À faire de votre côté'));
  assert.strictEqual((await up(`/suivi/${tok}/tache/${tasks[0]}/fichier`, PNG, 'x.png')).status, 403);
  // un document remis par Digilago apparaît chez le client
  r = await up('/projets/1/suivi/fichier', Buffer.from('%PDF-1.4 guide'), 'guide.pdf', cookie); assert.strictEqual(r.status, 200);
  assert.strictEqual((await up('/projets/1/suivi/fichier', Buffer.from('x'), 'guide.exe', cookie)).status, 400);
  h = await (await pub('/suivi/' + tok)).text(); assert.match(h, /guide\.pdf/); assert.match(h, /Vos documents/);
  assert.match(await (await get('/projets/1')).text(), /guide\.pdf/);
  // les messages restent possibles après la livraison
  r = await pubPost(`/suivi/${tok}/message`, { body: 'Merci, c’est superbe.' }); assert.match(r.headers.get('location'), /ok=msg/);
});

test('un lien ne donne jamais accès à un autre projet', async () => {
  // second projet
  let r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Omar', nc_company: 'Café Atlas', nc_phone: '0600000001', title: 'Site 2', issue_date: '2026-10-02', validity: '30', tva_rate: '20', discount_pct: '0', deposit_pct: '50', 'items[0][label]': 'Site vitrine', 'items[0][qty]': '1', 'items[0][unit_price]': '5000' });
  const qid = r.headers.get('location').split('/').pop().split('?')[0];
  const dt = (await (await get('/devis/' + qid)).text()).match(/\/d\/([A-Za-z0-9_-]+)/)[1];
  await fetch(base + '/d/' + dt + '/accepter', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Omar&ok=1' });
  const tok2 = (await (await get('/projets/2')).text()).match(/\/suivi\/([A-Za-z0-9_-]+)/)[1]; assert.notStrictEqual(tok, tok2);
  const adm = await (await get('/projets/1')).text(); const fid = adm.match(/suivi\/fichier\/(\d+)/)[1];
  assert.strictEqual((await pub(`/suivi/${tok2}/fichier/${fid}`)).status, 404);
  const h2 = await (await pub('/suivi/' + tok2)).text(); assert.ok(!h2.includes('Clinique Azur') && !h2.includes('logo.png'));
  assert.strictEqual((await get('/projets/2/suivi/fichier/' + fid)).status, 404);
});

test('sauvegarde : sans le contenu des fichiers', async () => {
  const j = JSON.parse(await (await get('/sauvegarde')).text());
  assert.ok(j.tables.project_tasks.length >= 5); assert.ok(j.tables.project_msgs.length >= 2); assert.ok(j.tables.project_files.length >= 2);
  assert.ok(!('data' in j.tables.project_files[0]));
});
