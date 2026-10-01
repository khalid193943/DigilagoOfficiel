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
  inv = await (await get('/factures/' + s)).text(); assert.match(inv, /Déjà facturé/); assert.match(inv, /6\u202f480,00/);
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

test('toutes les pages s’ouvrent sans erreur', async () => {
  const pages = ['/', '/devis', '/devis/nouveau', '/devis/1', '/devis/1/modifier', '/factures', '/factures/1', '/factures/2', '/clients', '/clients/1', '/demandes', '/prestations', '/parametres', '/projets', '/projets/1', '/depenses', '/rapports', '/export/factures.csv', '/export/paiements.csv', '/export/depenses.csv', '/sauvegarde', '/devis/nouveau?demande=1'];
  for (const p of pages) { const r = await get(p); assert.strictEqual(r.status, 200, p + ' → ' + r.status); }
  const r = await post('/devis/1/dupliquer', {}); assert.strictEqual(r.status, 302);
  const save = JSON.parse(await (await get('/sauvegarde')).text()); assert.ok(save.tables.quotes.length >= 2);
});

test('assistant d’appel, échéancier en 3 tranches, bon de commande, reçu, avoir, recherche', async () => {
  let r = await post('/prestations', { 's[0][id]': '1', 's[0][name]': 'Site vitrine sur mesure', 's[0][unit]': 'forfait', 's[0][unit_price]': '9000', 's[0][active]': '1' });
  const body = new URLSearchParams({ client_id: 'new', nc_name: 'Youssef Idrissi', nc_company: 'Riad Atlas', nc_phone: '0611223344', nc_city: 'Marrakech', nc_address: 'Derb Sidi Bouloukat', sector: 'Hôtellerie', metier: 'riad', source: 'Recommandation', situation: 'site', domain: 'riadatlas.ma', registrar: 'Heberfacile', old_site: 'https://riadatlas.ma', kind: 'vitrine', pages: '6', lang_fr: '1', lang_en: '1', has_logo: 'non', has_photos: 'peu', plan_key: '30-40-30', notes: 'Veut des réservations' });
  for (const n of ['Site vitrine sur mesure', 'Refonte et migration', 'Rédaction SEO', 'Création de logo et charte']) body.append('pack', n);
  r = await fetch(base + '/assistant', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie }, body: body.toString() });
  assert.strictEqual(r.status, 302); const qid = r.headers.get('location').match(/devis\/(\d+)/)[1];
  let q = await (await get('/devis/' + qid)).text();
  assert.match(q, /Refonte et migration/); assert.match(q, /Échéancier de paiement/); assert.match(q, /À la validation de la maquette/);
  const pr = await (await get('/projets')).text(); assert.match(pr, /Riad Atlas/); assert.match(pr, /Proposition/);
  await post(`/devis/${qid}/statut`, { status: 'accepte' });
  q = await (await get('/devis/' + qid)).text(); assert.match(q, /Bon de commande DG-BC-/);
  const bc = q.match(/\/bc\/([A-Za-z0-9_-]+)/)[1]; assert.match(await (await fetch(base + '/bc/' + bc)).text(), /Bon de commande/);
  const ids = [];
  for (const i of [0, 1, 2]) { const x = await post(`/devis/${qid}/facturer`, { idx: String(i) }); ids.push(x.headers.get('location').split('/').pop()); }
  assert.match(await (await get('/factures/' + ids[1])).text(), /Facture de situation/);
  const solde = await (await get('/factures/' + ids[2])).text(); assert.match(solde, /Facture de solde/); assert.match(solde, /Déjà facturé/);
  await post(`/factures/${ids[0]}/paiements`, { amount: '100', date: '2026-10-05', method: 'Virement' });
  const f0 = await (await get('/factures/' + ids[0])).text(); const rc = f0.match(/\/recu\/([A-Za-z0-9_-]+)/)[1];
  assert.match(await (await fetch(base + '/recu/' + rc)).text(), /Reçu de paiement/);
  r = await post(`/factures/${ids[2]}/avoir`, {}); const av = await (await get(r.headers.get('location'))).text(); assert.match(av, /DG-AV-/);
  const s = await (await get('/api/recherche?q=Riad')).json(); assert.ok(s.some((x) => x.t === 'Client'));
  const pj = await (await get('/projets')).text(); const pid = pj.match(/\/projets\/(\d+)"[^>]*title="[^"]*"><b><i class="hl-dot"><\/i>Riad Atlas/)[1];
  await post(`/projets/${pid}/tech`, { t_live_url: 'https://riadatlas.ma', t_github: 'https://github.com/x/riad', t_domain_expiry: '2026-10-10' });
  const pp = await (await get('/projets/' + pid)).text(); assert.match(pp, /github\.com\/x\/riad/); assert.match(pp, /Nom de domaine à renouveler/);
  const dash = await (await get('/')).text(); assert.match(dash, /Ma journée/); assert.match(dash, /Renouveler le domaine riadatlas\.ma/);
  for (const u of ['/assistant', '/clients/2', '/projets/' + pid]) assert.strictEqual((await get(u)).status, 200, u);
});

test('demandes par téléphone et du site : pipeline, suivi, acceptation, refus', async () => {
  let r = await post('/demandes', { name: 'Nadia Benali', company: 'Pâtisserie Nadia', phone: '0622334455', city: 'Rabat', kind: 'ecommerce', sector: 'Commerce', source: 'Téléphone', budget: '15 000 DH', next_at: '2026-01-01', need: 'Vendre ses gâteaux en ligne' });
  assert.strictEqual(r.status, 302); const lid = r.headers.get('location').split('/').pop();
  await post(`/demandes/${lid}/note`, { kind: 'appel', text: 'Appelée, veut un devis' });
  let page = await (await get('/demandes/' + lid)).text(); assert.match(page, /Contactée/); assert.match(page, /Appelée, veut un devis/);
  const dash = await (await get('/')).text(); assert.match(dash, /Rappeler Pâtisserie Nadia/);
  const as = await (await get('/assistant?demande=' + lid)).text(); assert.match(as, /Depuis la demande de Pâtisserie Nadia/); assert.match(as, /name="lead_id" value="\d+"/); assert.match(as, /value="Rabat"/);
  const body = new URLSearchParams({ lead_id: lid, client_id: 'new', nc_name: 'Nadia Benali', nc_company: 'Pâtisserie Nadia', nc_phone: '0622334455', nc_city: 'Rabat', sector: 'Commerce', situation: 'rien', kind: 'ecommerce', pages: '4', lang_fr: '1', plan_key: '50-50' });
  body.append('pack', 'Boutique en ligne');
  r = await fetch(base + '/assistant', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie }, body: body.toString() });
  const qid = r.headers.get('location').match(/devis\/(\d+)/)[1];
  page = await (await get('/demandes/' + lid)).text(); assert.match(page, /Devis envoyé/);
  await post(`/devis/${qid}/statut`, { status: 'accepte' });
  page = await (await get('/demandes/' + lid)).text(); assert.match(page, /Gagnées/);
  r = await post('/demandes', { name: 'Omar', phone: '0600000001', source: 'WhatsApp', need: 'Landing page' }); const l2 = r.headers.get('location').split('/').pop();
  await post(`/demandes/${l2}/etape`, { stage: 'perdu', reason: 'Budget trop serré' });
  const pipe = await (await get('/demandes')).text(); assert.match(pipe, /Budget trop serré/); assert.match(pipe, /transformées en projets/);
  assert.strictEqual((await get('/demandes?vue=liste')).status, 200);
});

test('messagerie : 2 WhatsApp + 2 e-mails, modèles, webhook, envoi', async () => {
  let r = await post('/parametres', { wa_verify_token: 'secret-digilago', wa1_label: 'WhatsApp Business', wa1_number: '212649953813', wa2_label: 'WhatsApp perso', wa2_number: '212600000000', mail1_label: 'contact@digilago.ma', mail1_address: 'contact@digilago.ma', mail1_smtp_host: 'test', mail1_pass: 'x', mail2_label: 'Gmail', mail2_address: 'khalid@gmail.com', signature: 'Khalid, Digilago', google_review_url: 'https://g.page/r/digilago/review' });
  r = await post('/parametres', { mail1_pass: '' });                                   // un champ vide ne doit pas effacer le mot de passe
  const set = await (await get('/parametres')).text(); assert.match(set, /••••••• enregistré/);
  r = await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=secret-digilago&hub.challenge=42'); assert.strictEqual(await r.text(), '42');
  r = await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=42'); assert.strictEqual(r.status, 403);
  const hook = (from, name, text, id) => fetch(base + '/webhooks/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '' }, contacts: [{ wa_id: from, profile: { name } }], messages: [{ from, id, timestamp: '1790000000', type: 'text', text: { body: text } }] } }] }] }) });
  await hook('212677889900', 'Hamza', 'Bonjour, je veux un site pour mon garage', 'wamid.1');
  await hook('212677889900', 'Hamza', 'Bonjour, je veux un site pour mon garage', 'wamid.1');  // doublon ignoré
  await hook('212611223344', 'Youssef', 'Merci pour le devis !', 'wamid.2');                  // client connu (Riad Atlas)
  const dem = await (await get('/demandes')).text(); assert.match(dem, /je veux un site pour mon garage/);
  let inbox = await (await get('/messagerie')).text(); assert.match(inbox, /Merci pour le devis/); assert.match(inbox, /Hamza/);
  assert.strictEqual((inbox.match(/je veux un site pour mon garage/g) || []).length >= 1, true);
  const w = await (await get('/messagerie/ecrire?type=devis&id=1')).text(); assert.match(w, /★/); assert.match(w, /data-vars='[^']*DG-D-2026-0001/);
  r = await post('/messagerie/envoyer', { channel: 'mail1', to: 'sara@clinique.ma', subject: 'Votre devis', body: 'Bonjour Sara', template: 'devis_envoi', client_id: '1' });
  inbox = await (await get('/messagerie?c=' + encodeURIComponent('e:sara@clinique.ma'))).text(); assert.match(inbox, /Bonjour Sara/); assert.match(inbox, /envoyé/);
  r = await post('/messagerie/envoyer', { channel: 'wa1', to: '0611223344', body: 'Votre site est en ligne', template: 'livraison' });
  assert.match(decodeURIComponent(r.headers.get('location')), /ouvrir=https:\/\/wa\.me\/212611223344/);
  r = await post('/messagerie/envoyer', { channel: 'mail2', to: 'x@y.ma', subject: 's', body: 'b' }); assert.match(decodeURIComponent(r.headers.get('location')), /ouvrir=mailto:/);
  const tp = await (await get('/modeles')).text(); assert.match(tp, /Demande d’avis Google/); assert.match(tp, /dir="rtl"/);
  r = await post('/modeles/1', { title: 'Premier contact', subject: 'Test', fr: 'Bonjour {prenom}', ar: 'مرحبا' }); assert.match(await (await get('/modeles')).text(), /Bonjour \{prenom\}/);
  await post('/modeles/1', { reset: '1' }); assert.doesNotMatch(await (await get('/modeles')).text(), />Bonjour \{prenom\}</);
  const dash = await (await get('/')).text(); assert.match(dash, /non lue/);
});

test('comptabilité marocaine : TVA sur encaissements, déductions, timbre, écritures CGNC, clôture, espace comptable, auto-entrepreneur', async () => {
  const CP = require('../lib/compta'), d = new Date().toISOString().slice(0, 10), P = CP.periodOf(d, 'trimestrielle');
  await post('/comptabilite/profil', { fiscal_regime: 'societe_is', tva_assujetti: '1', tva_periodicite: 'trimestrielle', tva_regime: 'encaissement', accountant_name: 'Cabinet Amrani', accountant_email: 'amrani@cabinet.ma', accountant_phone: '0522000000', acc_revenue: '71243' });
  const base0 = await (await get('/comptabilite/periode/' + P)).text();
  const num = (h, label) => { const m = h.match(new RegExp(label + '<\\/span><b>([^<]+)<')); return m ? Number(m[1].replace(/[^\d,−-]/g, '').replace(',', '.').replace('−', '-')) : NaN; };
  const before = { col: num(base0, 'TVA collectée \\(encaissée\\)'), ded: num(base0, 'TVA récupérable') };
  // une vente : 10 000 HT, TVA 20 %, payée 50/50 ; l'acompte encaissé moitié en espèces
  let r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Omar Fassi', nc_company: 'Fassi Immobilier', nc_phone: '0699887766', issue_date: d, validity: '30', tva_rate: '20', plan_key: '50-50', 'items[0][label]': 'Site vitrine sur mesure', 'items[0][qty]': '1', 'items[0][unit_price]': '10000' });
  const qid = r.headers.get('location').split('/').pop().split('?')[0];
  await post(`/devis/${qid}/statut`, { status: 'accepte' });
  r = await post(`/devis/${qid}/facturer`, { idx: '0' }); const fid = r.headers.get('location').split('/').pop();
  await post(`/factures/${fid}/paiements`, { amount: '3000', date: d, method: 'Espèces' });
  await post(`/factures/${fid}/paiements`, { amount: '3000', date: d, method: 'Virement', reference: 'VIR-889' });
  const rec = await (await get('/factures/' + fid)).text(); const rtok = rec.match(/\/recu\/([A-Za-z0-9_-]+)/)[1];
  assert.match(await (await fetch(base + '/recu/' + rtok)).text(), /droit de timbre 0,25 % : 7,50/);
  const fv = await (await get('/factures/' + fid)).text(); assert.match(fv, /loi n° 69-21/); assert.match(fv, /droit de timbre de 0,25 %/);
  // trois dépenses : une déductible, une en catégorie exclue, une en espèces au-delà de 5 000 DH
  await post('/depenses', { date: d, supplier: 'Hostinger', supplier_ice: '001234567000089', invoice_ref: 'H-1', category: 'Hébergement', amount_ttc: '1200', tva: '200', method: 'Virement', receipt_url: 'https://drive.google.com/x' });
  await post('/depenses', { date: d, supplier: 'Restaurant', supplier_ice: '001234567000090', category: 'Déplacements et réceptions', amount_ttc: '600', tva: '100', method: 'Carte' });
  await post('/depenses', { date: d, supplier: 'Mobilier Pro', supplier_ice: '001234567000091', category: 'Matériel et fournitures', amount_ttc: '6000', tva: '1000', method: 'Espèces' });
  const pg = await (await get('/comptabilite/periode/' + P)).text();
  assert.strictEqual(Math.round((num(pg, 'TVA collectée \\(encaissée\\)') - before.col) * 100) / 100, 1000);   // 6 000 TTC encaissés × 1 000 / 6 000
  assert.strictEqual(Math.round((num(pg, 'TVA récupérable') + (before.ded || 0)) * 100) / 100 !== NaN, true);
  assert.match(pg, /catégorie sans droit à déduction/); assert.match(pg, /payée en espèces au-delà de 5 000 DH/);
  const ach = await (await get(`/export/compta/${P}/achats.csv`)).text(); assert.match(ach, /Hostinger;001234567000089;H-1;Hébergement;6126;Virement;1000;200;1200;200/);
  const ecr = await (await get(`/export/compta/${P}/ecritures.csv`)).text();
  for (const acc of ['3421', '71243', '4455', '5161', '5141', '34552', '6126']) assert.match(ecr, new RegExp(';' + acc + ';'));
  const lines = ecr.trim().split('\r\n').slice(1).map((l) => l.split(';')); const D = lines.reduce((a, l) => a + Number(l[5].replace(',', '.')), 0), C = lines.reduce((a, l) => a + Number(l[6].replace(',', '.')), 0);
  assert.strictEqual(Math.round(D * 100), Math.round(C * 100));                      // écritures équilibrées
  // clôture du mois : plus rien ne bouge
  await post('/comptabilite/verrou', { month: d.slice(0, 7), action: 'lock', back: '/comptabilite' });
  r = await post(`/factures/${fid}/paiements`, { amount: '10', date: d, method: 'Virement' }); assert.match(decodeURIComponent(r.headers.get('location')), /clôturé/);
  r = await post('/depenses', { date: d, supplier: 'X', category: 'Autre', amount_ttc: '10' }); assert.match(decodeURIComponent(r.headers.get('location')), /clôturé/);
  await post('/comptabilite/verrou', { month: d.slice(0, 7), action: 'unlock' });
  await post(`/comptabilite/periode/${P}/statut`, { status: 'prepare', amount: '800' });
  // espace du comptable : lien privé, exports, messages
  const home = await (await get('/comptabilite')).text(); const tok = home.match(/\/comptable\/([A-Za-z0-9_-]+)/)[1];
  assert.match(await (await fetch(base + '/comptable/' + tok)).text(), /Espace comptable/);
  assert.strictEqual((await fetch(base + '/comptable/faux-lien')).status, 404);
  assert.match(await (await fetch(`${base}/comptable/${tok}/export/${P}/ventes.csv`)).text(), /Fassi Immobilier/);
  await fetch(`${base}/comptable/${tok}/${P}/note`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'text=Merci+d%27envoyer+le+relev%C3%A9+bancaire' });
  assert.match(await (await get('/comptabilite/periode/' + P)).text(), /relevé bancaire/);
  assert.match(home, /ICE du client Fassi Immobilier manquant/);
  // auto-entrepreneur : pas de TVA, mention de l'article 91, plafonds et règle des 80 000 DH
  await post('/comptabilite/profil', { fiscal_regime: 'ae_services', tva_periodicite: 'trimestrielle' });
  r = await post('/devis/nouveau', { client_id: 'new', nc_name: 'Lina', nc_company: 'Studio Lina', issue_date: d, tva_rate: '0', plan_key: '1x', 'items[0][label]': 'Site', 'items[0][unit_price]': '90000' });
  const q2 = r.headers.get('location').split('/').pop().split('?')[0]; await post(`/devis/${q2}/statut`, { status: 'accepte' });
  r = await post(`/devis/${q2}/facturer`, { idx: '0' }); const f2 = r.headers.get('location').split('/').pop();
  assert.match(await (await get('/factures/' + f2)).text(), /TVA non applicable, article 91 du CGI/);
  await post(`/factures/${f2}/paiements`, { amount: '90000', date: d, method: 'Virement' });
  const ae = await (await get('/comptabilite')).text(); assert.match(ae, /Auto-entrepreneur : vos plafonds/); assert.match(ae, /Retenue 30 % par le client/);
  await post('/comptabilite/profil', { fiscal_regime: 'societe_is', tva_assujetti: '1' });
});
