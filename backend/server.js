'use strict';
/* Digilago Gestion : devis, acomptes, factures et paiements. */
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { db, init, settings, saveSettings, nextNumber, STEPS } = require('./db');
const { esc, round2, num, money, pct, today, addDays, dateFr, token, totals } = require('./lib/fmt');
const { renderDoc, KIND, LOGO } = require('./lib/doc');
const { layout, badge, Q_STATUS, I_STATUS, P_STATUS, ICONS } = require('./lib/ui');
const { supervise, findCity } = require('./lib/maroc');
const { PLANS, planFromBody, planOf, planKey } = require('./lib/plans');
const assistant = require('./lib/assistant');
const CP = require('./lib/compta');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '200kb' }));
/* Les gestionnaires asynchrones transmettent leurs erreurs à Express */
for (const m of ['get', 'post', 'options']) { const orig = app[m].bind(app); app[m] = (p, ...hs) => (hs.length ? orig(p, ...hs.map((h) => (typeof h === 'function' ? (req, res, next) => Promise.resolve(h(req, res, next)).catch(next) : h))) : orig(p)); }
app.use(async (req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' }); next(); });
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
/* La base est prête avant toute requête (tables, réglages, secret de session, mot de passe initial) */
let SECRET = process.env.SESSION_SECRET || '';
let PUBLIC_URL = '';
app.use((req, res, next) => { boot().then(() => next(), next); });

/* ---------------- Authentification : un compte administrateur ---------------- */
const getS = async (k) => ((await db.prepare('SELECT value FROM settings WHERE key = ?').get(k)) || {}).value;
const setS = async (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const checkPw = (pw, stored) => { if (!stored) return false; const [salt, h] = stored.split(':'); const x = crypto.scryptSync(pw, salt, 32); return crypto.timingSafeEqual(x, Buffer.from(h, 'hex')); };
let booted = null;
function boot() {
  if (booted) return booted;
  booted = (async () => {
    await init();
    if (!SECRET) { if (!(await getS('_secret'))) await setS('_secret', crypto.randomBytes(32).toString('hex')); SECRET = await getS('_secret'); }
    PUBLIC_URL = (await getS('public_url')) || '';
    if (process.env.ADMIN_PASSWORD && !(await getS('_pw_env_applied'))) { await setS('_pw', hashPw(process.env.ADMIN_PASSWORD)); await setS('_pw_env_applied', '1'); }
  })().catch((e) => { booted = null; throw e; });
  return booted;
}
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function readCookie(req, name) { const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '=')); return m ? decodeURIComponent(m.slice(name.length + 1)) : ''; }
function isAuthed(req) { const c = readCookie(req, 'dg'); const [exp, sig] = c.split('.'); return exp && sig && sign(exp) === sig && Number(exp) > Date.now(); }
function setSession(res) { const exp = String(Date.now() + 1000 * 60 * 60 * 24 * 14); res.setHeader('Set-Cookie', `dg=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 14}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); }
const tries = new Map();
function authPage(title, inner) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | Digilago Gestion</title><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Instrument+Sans:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/static/app.css"></head><body class="auth"><form method="post" class="auth-card"><span class="auth-logo">${LOGO}</span><h1>${title}</h1>${inner}</form></body></html>`;
}
app.get('/installation', async (req, res) => { if (await getS('_pw')) return res.redirect('/connexion'); res.send(authPage('Bienvenue', '<p>Choisissez le mot de passe de votre espace de gestion.</p><label>Mot de passe<input type="password" name="pw" minlength="8" required autofocus></label><label>Confirmer<input type="password" name="pw2" minlength="8" required></label><button>Créer mon espace</button>')); });
app.post('/installation', async (req, res) => {
  if (await getS('_pw')) return res.redirect('/connexion');
  const { pw = '', pw2 = '' } = req.body;
  if (pw.length < 8 || pw !== pw2) return res.send(authPage('Bienvenue', '<p class="err">Les mots de passe doivent être identiques et faire au moins 8 caractères.</p><label>Mot de passe<input type="password" name="pw" minlength="8" required></label><label>Confirmer<input type="password" name="pw2" minlength="8" required></label><button>Créer mon espace</button>'));
  await setS('_pw', hashPw(pw)); setSession(res); res.redirect('/parametres?bienvenue=1');
});
app.get('/connexion', async (req, res) => { if (!await getS('_pw')) return res.redirect('/installation'); res.send(authPage('Connexion', '<label>Mot de passe<input type="password" name="pw" required autofocus></label><button>Se connecter</button>')); });
app.post('/connexion', async (req, res) => {
  const ip = req.ip, t = tries.get(ip) || { n: 0, at: Date.now() };
  if (Date.now() - t.at > 15 * 60e3) { t.n = 0; t.at = Date.now(); }
  if (t.n >= 8) return res.status(429).send(authPage('Connexion', '<p class="err">Trop de tentatives. Réessayez dans 15 minutes.</p>'));
  if (checkPw(String(req.body.pw || ''), await getS('_pw'))) { tries.delete(ip); setSession(res); return res.redirect('/'); }
  t.n++; tries.set(ip, t);
  res.status(401).send(authPage('Connexion', '<p class="err">Mot de passe incorrect.</p><label>Mot de passe<input type="password" name="pw" required autofocus></label><button>Se connecter</button>'));
});
app.post('/deconnexion', async (req, res) => { res.setHeader('Set-Cookie', 'dg=; Path=/; Max-Age=0'); res.redirect('/connexion'); });

/* ---------------- Données ---------------- */
const Q = {
  client: db.prepare('SELECT * FROM clients WHERE id = ?'),
  quote: db.prepare('SELECT * FROM quotes WHERE id = ?'),
  quoteByToken: db.prepare('SELECT * FROM quotes WHERE token = ?'),
  qItems: db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY position'),
  invoice: db.prepare('SELECT * FROM invoices WHERE id = ?'),
  invByToken: db.prepare('SELECT * FROM invoices WHERE token = ?'),
  iItems: db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position'),
  paid: db.prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE invoice_id = ?'),
  payments: db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY date, id'),
  quoteInvoices: db.prepare('SELECT * FROM invoices WHERE quote_id = ? AND cancelled = 0 ORDER BY id'),
};
const paidOf = async (id) => round2((await Q.paid.get(id)).s);
/* ajoute .paid à chaque facture d'une liste */
const clientMap = async () => { const o = {}; for (const c of await db.prepare('SELECT * FROM clients').all()) o[c.id] = c; return o; };
const withPaid = async (list) => {
  if (!list.length) return list;
  const ids = list.map((i) => Number(i.id)).filter(Boolean), m = {};
  for (const r of await db.prepare(`SELECT invoice_id, COALESCE(SUM(amount),0) s FROM payments WHERE invoice_id IN (${ids.map(() => '?').join(',')}) GROUP BY invoice_id`).all(...ids)) m[r.invoice_id] = round2(r.s);
  for (const i of list) i.paid = m[i.id] || 0;
  return list;
};
function qStatus(q) { if ((q.status === 'envoye' || q.status === 'vu') && q.valid_until && q.valid_until < today()) return 'expire'; return q.status; }
function iStatus(inv, paid = inv.paid || 0) {
  if (inv.kind === 'avoir') return 'avoir';
  if (inv.cancelled) return 'annulee';
  if (paid >= num(inv.total_ttc) - 0.009) return 'payee';
  if (inv.due_date && inv.due_date < today()) return 'retard';
  return paid > 0 ? 'partielle' : 'impayee';
}
/* adresse publique de l'espace : gardée en mémoire, mise à jour au démarrage et à l'enregistrement des paramètres */
const baseUrl = (req) => (PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const digits = (p) => String(p || '').replace(/\D/g, '').replace(/^0/, '212');



/* Ce qu'il faut réunir pour chaque projet : coordonnées du client et éléments du site */
const CLIENT_FIELDS = [['company', 'Nom de l’entreprise'], ['address', 'Adresse'], ['city', 'Ville'], ['phone', 'Téléphone'], ['email', 'E-mail'], ['ice', 'ICE (si société)']];
const INFO_FIELDS = [['logo', 'Logo (fichier ou lien de partage)'], ['couleurs', 'Couleurs de la marque'], ['activite', 'Présentation de l’activité et des services'], ['photos', 'Photos (lien Google Drive, WeTransfer…)'], ['horaires', 'Horaires d’ouverture'], ['domaine', 'Nom de domaine souhaité'], ['reseaux', 'Réseaux sociaux'], ['google', 'Accès à la fiche Google (e-mail du compte)']];
const pinfo = (p) => { try { return JSON.parse(p.info || '{}'); } catch (e) { return {}; } };
function completeness(p, cl) {
  const inf = pinfo(p), missing = [];
  for (const [k, l] of CLIENT_FIELDS) if (!String((cl || {})[k] || '').trim()) missing.push(l);
  for (const [k, l] of INFO_FIELDS) if (!String(inf[k] || '').trim()) missing.push(l);
  const total = CLIENT_FIELDS.length + INFO_FIELDS.length;
  return { pct: Math.round(100 * (total - missing.length) / total), missing };
}


/* ---------------- Présence en ligne d'un projet : tout ce qu'il faut retrouver dans un an ---------------- */
const TECH_FIELDS = [['live_url', 'Site en ligne', 'https://…'], ['domain', 'Nom de domaine', 'exemple.ma'], ['registrar', 'Registrar', 'Heberfacile, OVH…'], ['domain_expiry', 'Échéance du domaine', 'date'], ['hosting', 'Hébergement', 'Vercel, Hostinger…'], ['hosting_expiry', 'Échéance de l’hébergement', 'date'], ['github', 'Dépôt GitHub', 'https://github.com/…'], ['vercel', 'Projet Vercel', 'https://vercel.com/…'], ['gbp_url', 'Fiche Google', 'https://maps.google.com/…'], ['ga_id', 'Google Analytics', 'G-XXXXXXX'], ['instagram', 'Instagram', 'https://instagram.com/…'], ['facebook', 'Facebook', 'https://facebook.com/…'], ['emails', 'E-mails professionnels', 'contact@…'], ['access', 'Où sont les accès', 'Coffre, gestionnaire de mots de passe…']];
const LAUNCH = ['HTTPS actif (certificat SSL)', 'Redirection www et http vers https', 'Site rapide (Lighthouse 90 et plus)', 'Adapté au téléphone vérifié', 'Titres et descriptions SEO', 'Balisage Schema.org', 'Fichier llms.txt (GEO)', 'sitemap.xml et robots.txt', 'Google Search Console vérifiée', 'Google Analytics installé', 'Fiche Google à jour et liée', 'Formulaires et WhatsApp testés', 'Trois langues vérifiées', 'Sauvegarde et accès remis au client'];
const ptech = (p) => { try { return JSON.parse(p.tech || '{}'); } catch (e) { return {}; } };
const plaunch = (p) => { try { return JSON.parse(p.launch || '{}'); } catch (e) { return {}; } };
const daysTo = (d) => (d ? Math.round((new Date(d + 'T12:00:00Z') - new Date(today() + 'T12:00:00Z')) / 864e5) : null);
/* santé d'un projet : vert, orange ou rouge, avec la raison */
function health(p, cl, unpaidLate = 0) {
  const why = [], t = ptech(p);
  if (p.status !== 'livre' && p.due_date && p.due_date < today()) why.push(['r', 'Livraison dépassée']);
  if (unpaidLate) why.push(['r', 'Facture en retard']);
  const c = completeness(p, cl); if (['en_cours', 'validation'].includes(p.status) && c.pct < 60) why.push(['o', 'Informations manquantes']);
  const ssl = daysTo(t.ssl_valid_to); if (ssl !== null && ssl < 20) why.push([ssl < 0 ? 'r' : 'o', 'Certificat SSL bientôt expiré']);
  const dom = daysTo(t.domain_expiry); if (dom !== null && dom < 30) why.push([dom < 0 ? 'r' : 'o', 'Nom de domaine à renouveler']);
  if (t.http_status && Number(t.http_status) >= 400) why.push(['r', 'Site hors ligne au dernier contrôle']);
  if (p.status === 'proposition' && daysTo(String(p.created_at || '').slice(0, 10)) < -7) why.push(['o', 'Proposition sans réponse depuis 7 jours']);
  const lvl = why.some((w) => w[0] === 'r') ? 'risk' : why.length ? 'warn' : 'ok';
  return { lvl, why: why.map((w) => w[1]) };
}
/* contrôle d'un site : réponse, temps et certificat */
async function checkSite(url) {
  const out = { check_at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : 'https://' + url);
    const t0 = Date.now(); const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(u.href, { redirect: 'follow', signal: ctl.signal }); clearTimeout(to);
    out.http_status = r.status; out.ms = Date.now() - t0;
    if (u.protocol === 'https:' || r.url.startsWith('https:')) {
      const host = new URL(r.url).hostname;
      await new Promise((ok) => { const sock = require('node:tls').connect({ host, port: 443, servername: host, timeout: 6000 }, () => { const c = sock.getPeerCertificate(); if (c && c.valid_to) { out.ssl_valid_to = new Date(c.valid_to).toISOString().slice(0, 10); out.ssl_ok = sock.authorized ? 1 : 0; out.ssl_issuer = (c.issuer && (c.issuer.O || c.issuer.CN)) || ''; } sock.end(); ok(); }); sock.on('error', () => ok()); sock.on('timeout', () => { sock.destroy(); ok(); }); });
    } else out.ssl_ok = 0;
  } catch (e) { out.http_status = 0; out.error = String(e.message || e).slice(0, 120); }
  return out;
}

/* Clôture mensuelle : un mois envoyé au comptable ne bouge plus */
const isLocked = async (date) => !!(date && (await db.prepare('SELECT 1 FROM locks WHERE month = ?').get(String(date).slice(0, 7))));
const lockedMsg = (date) => `Le mois de ${CP.PNAME(String(date).slice(0, 7))} est clôturé : déverrouillez-le dans Comptabilité pour le modifier.`;

/* Journal d'activité : tout ce qui se passe est tracé */
const log = async (kind, ref, text) => { try { await db.prepare('INSERT INTO activity (kind, ref_id, text) VALUES (?, ?, ?)').run(kind, ref, String(text).slice(0, 300)); } catch (e) {} };

/* La demande d'origine suit le devis : gagnée à l'acceptation, perdue au refus */
async function leadFromQuote(qid, stage, reason = '') {
  for (const l of await db.prepare("SELECT id FROM leads WHERE quote_id = ? AND COALESCE(stage, '') != ?").all(qid, stage)) { await leadStage(l.id, stage, reason); if (reason) await db.prepare('UPDATE leads SET lost_reason = ? WHERE id = ?').run(reason, l.id); }
}

/* Bon de commande : créé dès que le devis est accepté */
async function ensureOrder(qid) {
  const q = await Q.quote.get(qid); if (!q) return null;
  const ex = await db.prepare('SELECT id FROM orders WHERE quote_id = ?').get(q.id); if (ex) return ex.id;
  const s = await settings();
  const number = await nextNumber('order', 'DG-BC', today());
  const id = (await db.prepare('INSERT INTO orders (number, quote_id, client_id, issue_date, total_ttc, token) VALUES (?,?,?,?,?,?)').run(number, q.id, q.client_id, today(), q.total_ttc, token())).lastInsertRowid;
  await log('commande', q.id, `Bon de commande ${number} créé pour le devis ${q.number}`);
  return id;
}

/* Un devis accepté ouvre automatiquement son projet */
async function ensureProject(qid) {
  const q = await Q.quote.get(qid); if (!q) return null;
  const ex = await db.prepare('SELECT id, status FROM projects WHERE quote_id = ?').get(q.id); if (ex) { if (ex.status === 'proposition' && ['accepte', 'facture'].includes((await Q.quote.get(q.id)).status)) await db.prepare("UPDATE projects SET status = 'a_demarrer' WHERE id = ?").run(ex.id); return ex.id; }
  const s = (await settings());
  return Number((await db.prepare('INSERT INTO projects (quote_id, client_id, title, status, due_date, steps, info, token) VALUES (?,?,?,?,?,?,?,?)').run(q.id, q.client_id, q.title || q.number, 'a_demarrer', addDays(today(), 7), JSON.stringify(STEPS.map((t) => ({ t, d: 0 }))), '{}', token())).lastInsertRowid);
}

/* ---------------- Formulaire public du site : les demandes arrivent ici ---------------- */
app.options('/api/leads', async (req, res) => { res.set({ 'Access-Control-Allow-Origin': process.env.SITE_ORIGIN || '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }).sendStatus(204); });
app.post('/api/leads', async (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.SITE_ORIGIN || '*');
  const b = req.body || {}, s = (v, n = 300) => String(v || '').slice(0, n).trim();
  if (!s(b.name) && !s(b.phone) && !s(b.email)) return res.status(400).json({ ok: false });
  const r = await db.prepare("INSERT INTO leads (name, company, phone, email, need, message, source, stage, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'nouveau', datetime('now'))").run(s(b.name, 120), s(b.company, 160), s(b.phone, 40), s(b.email, 160), s(b.need, 300), s(b.message, 3000), s(b.source, 80) || 'site');
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});

/* ---------------- Lien client : consulter, télécharger, accepter ---------------- */
async function publicPage(title, body) {
  const s = (await settings());
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | ${esc(s.company_name)}</title><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital@1&display=swap" rel="stylesheet"><link rel="stylesheet" href="/static/app.css"></head><body class="pub">${body}<script src="/static/app.js" defer></script></body></html>`;
}
app.get('/d/:token', async (req, res) => {
  const q = await Q.quoteByToken.get(req.params.token); if (!q) return res.status(404).send(await publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>'));
  if (q.status === 'envoye' && !isAuthed(req)) await db.prepare("UPDATE quotes SET status = 'vu', viewed_at = datetime('now') WHERE id = ?").run(q.id);
  const s = (await settings()), st = qStatus(q), cl = await Q.client.get(q.client_id) || {};
  const canAccept = ['envoye', 'vu', 'brouillon'].includes(st) && !q.accepted_at;
  const wa = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(`Bonjour ${s.company_name}, j’ai une question sur le devis ${q.number}.`)}`;
  const deposit = round2(q.total_ttc * num(q.deposit_pct) / 100);
  const bar = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Devis ${esc(q.number)}</span><b>${money(q.total_ttc)} TTC</b></div><div class="pub-a">
<button type="button" class="btn ghost" data-print>Télécharger en PDF</button><a class="btn ghost" href="${wa}" target="_blank" rel="noopener">Une question ?</a>
${canAccept ? '<a class="btn" href="#accepter">Accepter le devis</a>' : q.accepted_at ? '<span class="bdg bdg-green">Devis accepté</span>' : st === 'expire' ? '<span class="bdg bdg-amber">Devis expiré</span>' : ''}</div></div></div>`;
  const accept = canAccept ? `<form method="post" action="/d/${esc(q.token)}/accepter" class="pub-accept" id="accepter"><h2>Accepter ce devis</h2><p>En acceptant, vous validez la commande. Nous vous contactons pour l’acompte de <b>${money(deposit)}</b> et le démarrage.</p><label>Votre nom complet<input name="name" required maxlength="120" value="${esc(cl.name || '')}"></label><label class="chk"><input type="checkbox" name="ok" value="1" required> J’accepte le devis ${esc(q.number)} et ses conditions.</label><button class="btn">Je confirme et j’accepte</button></form>` : '';
  const thanks = req.query.merci ? `<div class="pub-thanks"><b>Merci, votre devis est accepté.</b><p>Nous vous contactons très vite pour l’acompte et le démarrage.${s.bank_rib ? ` Vous pouvez aussi régler l’acompte par virement (RIB ci-dessous, référence ${esc(q.number)}).` : ''}</p><a class="btn" href="${wa}" target="_blank" rel="noopener">Nous écrire sur WhatsApp</a></div>` : '';
  res.send(await publicPage('Devis ' + q.number, bar + `<main class="pub-main">${thanks}${renderDoc({ type: 'devis', doc: q, items: await Q.qItems.all(q.id), client: cl, s })}${accept}</main>`));
});
app.post('/d/:token/accepter', async (req, res) => {
  const q = await Q.quoteByToken.get(req.params.token); if (!q) return res.sendStatus(404);
  const name = String(req.body.name || '').trim().slice(0, 120);
  if (name && req.body.ok && !q.accepted_at && qStatus(q) !== 'expire') { await db.prepare("UPDATE quotes SET status = 'accepte', accepted_at = datetime('now'), accepted_name = ? WHERE id = ?").run(name, q.id); await ensureProject(q.id); await ensureOrder(q.id); await log('devis', q.id, `Devis ${q.number} accepté en ligne par ${name}`); await leadFromQuote(q.id, 'gagne'); }
  res.redirect(`/d/${q.token}?merci=1`);
});
app.get('/f/:token', async (req, res) => {
  const inv = await Q.invByToken.get(req.params.token); if (!inv) return res.status(404).send(await publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>'));
  const s = (await settings()), paid = await paidOf(inv.id), quote = inv.quote_id ? await Q.quote.get(inv.quote_id) : null;
  const bar = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">${esc(KIND[inv.kind] || 'Facture')} ${esc(inv.number)}</span><b>${money(inv.total_ttc)} TTC</b></div><div class="pub-a"><button type="button" class="btn ghost" data-print>Télécharger en PDF</button>${badge(I_STATUS, iStatus(inv, paid))}</div></div></div>`;
  res.send(await publicPage(inv.number, bar + `<main class="pub-main">${renderDoc({ type: 'facture', doc: inv, items: await Q.iItems.all(inv.id), client: await Q.client.get(inv.client_id), s, paid, quote })}</main>`));
});



app.get('/bc/:token', async (req, res) => {
  const o = await db.prepare('SELECT * FROM orders WHERE token = ?').get(req.params.token); if (!o) return res.status(404).send(await publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>'));
  const q = await Q.quote.get(o.quote_id), s = await settings();
  const bar = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Bon de commande ${esc(o.number)}</span><b>${money(o.total_ttc)} TTC</b></div><div class="pub-a"><button type="button" class="btn ghost" data-print>Télécharger en PDF</button></div></div></div>`;
  res.send(await publicPage('Bon de commande ' + o.number, bar + `<main class="pub-main">${renderDoc({ type: 'bdc', doc: { ...q, order_number: o.number, order_date: o.issue_date, quote_number: q.number }, items: await Q.qItems.all(q.id), client: await Q.client.get(q.client_id), s })}</main>`));
});
app.get('/recu/:token', async (req, res) => {
  const p = await db.prepare('SELECT * FROM payments WHERE token = ?').get(req.params.token); if (!p) return res.sendStatus(404);
  const inv = await Q.invoice.get(p.invoice_id), cl = (await Q.client.get(inv.client_id)) || {}, s = await settings(), paid = await paidOf(inv.id);
  const body = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Reçu ${esc(p.number || '')}</span><b>${money(p.amount)}</b></div><div class="pub-a"><button type="button" class="btn ghost" data-print>Télécharger en PDF</button></div></div></div>
<main class="pub-main"><article class="doc rcpt"><header class="d-head"><div class="d-brand"><span class="d-logo">${LOGO}</span><div><b>${esc(s.company_name)}</b><small>${esc(s.company_tagline)}</small></div></div><div class="d-id"><span class="d-type">Reçu de paiement</span><b class="d-num">${esc(p.number || '')}</b><dl><dt>Date</dt><dd>${dateFr(p.date)}</dd><dt>Facture</dt><dd>${esc(inv.number)}</dd></dl></div></header>
<div class="rc-big"><span>Montant reçu</span><b>${money(p.amount)}</b><p>${esc(p.method)}${p.reference ? ' · réf. ' + esc(p.reference) : ''}${p.stamp ? ` · dont droit de timbre 0,25 % : ${money(p.stamp)}` : ''}</p></div>
<section class="d-parties"><div><span class="d-lab">Reçu de</span><b>${esc(cl.company || cl.name || '')}</b><p>${esc(cl.name && cl.company ? cl.name : '')}</p></div><div class="d-to"><span class="d-lab">Situation de la facture</span><p>Total TTC : <b>${money(inv.total_ttc)}</b><br>Total réglé : <b>${money(paid)}</b><br>Reste à payer : <b>${money(Math.max(0, inv.total_ttc - paid))}</b></p></div></section>
<p class="rc-thanks">Merci pour votre confiance.</p><footer class="d-legal">${esc(s.company_name)} · ${esc(s.company_address)} · ${esc(s.company_site)}</footer></article></main>`;
  res.send(await publicPage('Reçu ' + (p.number || ''), body));
});


/* ======================= Messagerie : 2 WhatsApp + 2 e-mails, une seule boîte ======================= */
const MSG = require('./lib/messaging');
const TPL = require('./lib/templates');
const ckeyOf = (contact) => (/@/.test(contact) ? 'e:' + String(contact).trim().toLowerCase() : 'p:' + MSG.digits(contact).slice(-9));
const CH_COLOR = { wa1: 'wa1', wa2: 'wa2', mail1: 'm1', mail2: 'm2' };
/* retrouve le client ou la demande derrière un numéro ou une adresse */
async function findContact(contact) {
  if (/@/.test(contact)) {
    const e = String(contact).trim().toLowerCase();
    const c = await db.prepare('SELECT * FROM clients WHERE lower(email) = ? LIMIT 1').get(e); if (c) return { client: c };
    const l = await db.prepare('SELECT * FROM leads WHERE lower(email) = ? ORDER BY id DESC LIMIT 1').get(e); return l ? { lead: l } : {};
  }
  const d = MSG.digits(contact).slice(-9); if (d.length < 8) return {};
  for (const c of await db.prepare('SELECT * FROM clients WHERE phone IS NOT NULL OR whatsapp IS NOT NULL').all()) if (MSG.digits(c.phone).slice(-9) === d || MSG.digits(c.whatsapp).slice(-9) === d) return { client: c };
  for (const l of await db.prepare('SELECT * FROM leads WHERE phone IS NOT NULL ORDER BY id DESC').all()) if (MSG.digits(l.phone).slice(-9) === d) return { lead: l };
  return {};
}
async function storeMsg(m) {
  const f = await findContact(m.contact);
  await db.prepare('INSERT INTO messages (channel, direction, ckey, contact, name, client_id, lead_id, subject, body, status, template, ext_id, is_read, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, COALESCE(?, datetime(\'now\')))').run(m.channel, m.direction, ckeyOf(m.contact), m.contact, m.name || (f.client ? f.client.company || f.client.name : f.lead ? f.lead.company || f.lead.name : ''), m.client_id || (f.client && f.client.id) || null, m.lead_id || (f.lead && f.lead.id) || null, m.subject || '', m.body || '', m.status || '', m.template || '', m.ext_id || '', m.direction === 'out' ? 1 : 0, m.at || null);
  return f;
}
/* contexte d'un message : qui, quel document, quelles variables, quel message conseillé */
async function msgContext(type, id, req) {
  const s = await settings(), B = baseUrl(req), v = { signature: s.signature || s.company_name, lien_avis: s.google_review_url || '' };
  let client = null, lead = null, quote = null, invoice = null, project = null, ctx = {};
  if (type === 'demande') { lead = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id); if (lead) { v.prenom = (lead.name || '').split(' ')[0]; v.entreprise = lead.company || lead.name; v.besoin = lead.need || ''; } }
  if (type === 'client') client = await Q.client.get(id);
  if (type === 'devis') { quote = await Q.quote.get(id); if (quote) { client = await Q.client.get(quote.client_id); v.numero = quote.number; v.montant = money(quote.total_ttc); v.lien = `${B}/d/${quote.token}`; const pr = await db.prepare('SELECT * FROM projects WHERE quote_id = ?').get(quote.id); if (pr && pr.token) v.lien_brief = `${B}/brief/${pr.token}`; if (['accepte', 'facture'].includes(quote.status)) { const pl = planOf(quote); v.montant = money(round2(quote.total_ttc * pl[0].p / 100)); const inv0 = await db.prepare("SELECT token FROM invoices WHERE quote_id = ? AND sched_idx = 0 AND kind != 'avoir'").get(quote.id); if (inv0) v.lien = `${B}/f/${inv0.token}`; } } }
  if (type === 'facture') { invoice = await Q.invoice.get(id); if (invoice) { client = await Q.client.get(invoice.client_id); const paid = await paidOf(invoice.id); v.numero = invoice.number; v.montant = money(invoice.total_ttc); v.reste = money(Math.max(0, invoice.total_ttc - paid)); v.echeance = dateFr(invoice.due_date); v.lien = `${B}/f/${invoice.token}`; ctx.rest = round2(invoice.total_ttc - paid); ctx.reminders = (await db.prepare('SELECT COUNT(*) n FROM reminders WHERE invoice_id = ?').get(invoice.id)).n; if (ctx.rest <= 0.009) { const p = await db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY id DESC').get(invoice.id); if (p && p.token) { v.lien = `${B}/recu/${p.token}`; v.montant = money(p.amount); } } } }
  if (type === 'projet') { project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(id); if (project) { client = await Q.client.get(project.client_id); const t = ptech(project), c = completeness(project, client); v.site = t.live_url || project.site_url || ''; v.domaine = t.domain || ''; v.echeance = dateFr(t.domain_expiry || t.hosting_expiry || ''); v.lien_brief = `${B}/brief/${project.token}`; v.manque = c.missing.slice(0, 5).join(', ').toLowerCase(); ctx.missing = c.pct < 100; ctx.briefSent = !!(await db.prepare("SELECT 1 FROM messages WHERE client_id = ? AND template IN ('brief','infos_rappel')").get(project.client_id)); ctx.reviewAsked = !!(await db.prepare("SELECT 1 FROM messages WHERE client_id = ? AND template = 'avis'").get(project.client_id)); v.conseil = 'publier une photo par semaine sur votre fiche Google'; } }
  if (client) { v.prenom = v.prenom || (client.name || '').split(' ')[0]; v.entreprise = v.entreprise || client.company || client.name; }
  const who = client || lead || {};
  return { v, phone: who.whatsapp || who.phone || '', email: who.email || '', name: who.company || who.name || '', client, lead, rec: TPL.recommend({ lead, quote, invoice, project, ...ctx }) };
}
/* ---- WhatsApp Cloud API : vérification et réception (public) ---- */
app.get('/webhooks/whatsapp', async (req, res) => {
  const s = await settings();
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] && req.query['hub.verify_token'] === (s.wa_verify_token || process.env.WA_VERIFY_TOKEN)) return res.send(String(req.query['hub.challenge'] || ''));
  res.sendStatus(403);
});
app.post('/webhooks/whatsapp', async (req, res) => {
  const s = await settings(), chs = MSG.channels(s);
  for (const m of MSG.parseWebhook(req.body || {})) {
    const ch = chs.find((c) => c.wa && c.phone_id && c.phone_id === m.phone_id) || chs[0];
    if (await db.prepare('SELECT 1 FROM messages WHERE ext_id = ?').get(m.id)) continue;
    const f = await storeMsg({ channel: ch.id, direction: 'in', contact: m.from, name: m.name, body: m.body, status: 'recu', ext_id: m.id, at: m.ts ? new Date(m.ts * 1000).toISOString().slice(0, 19).replace('T', ' ') : null });
    /* un numéro inconnu devient automatiquement une nouvelle demande */
    if (!f.client && !f.lead) {
      const lid = (await db.prepare("INSERT INTO leads (name, phone, need, message, source, stage, status, updated_at) VALUES (?, ?, ?, ?, 'WhatsApp', 'nouveau', 'nouveau', datetime('now'))").run(m.name || '', '+' + m.from, String(m.body).slice(0, 140), m.body)).lastInsertRowid;
      await db.prepare('UPDATE messages SET lead_id = ? WHERE ext_id = ?').run(lid, m.id);
      await db.prepare('INSERT INTO lead_notes (lead_id, kind, text) VALUES (?, ?, ?)').run(lid, 'whatsapp', `Premier message reçu sur ${ch.label}`);
    }
  }
  res.sendStatus(200);
});


/* ---------------- Espace du comptable : lien privé, lecture seule ---------------- */
async function accGuard(req, res) { const s = await settings(); if (!s.accountant_token || req.params.token !== s.accountant_token) { res.status(404).send(await publicPage('Lien expiré', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>')); return null; } return s; }
app.get('/comptable/:token', async (req, res) => {
  const s = await accGuard(req, res); if (!s) return;
  const y = Number(req.query.annee) || Number(today().slice(0, 4)), reg = CP.REGIMES[s.fiscal_regime] || {}, per = reg.ae ? 'trimestrielle' : s.tva_periodicite === 'mensuelle' ? 'mensuelle' : 'trimestrielle';
  const periods = reg.ae ? await Promise.all(CP.periodsOfYear(y, per).map((p) => CP.computePeriod(db, s, p))) : await CP.yearTva(db, { ...s, tva_periodicite: per }, y);
  const kind = reg.ae ? 'ae' : 'tva', pre = `/comptable/${req.params.token}`;
  const rows = []; for (const c of periods) { const st = await taxStatus(kind, c.p); rows.push(`<tr><td><a href="${pre}/${c.p}"><b>${fmtP(c.p)}</b></a></td><td class="r">${money(c.T.ca_ht)}</td><td class="r">${money(c.T.enc_ttc)}</td><td class="r">${money(c.T.dep_ttc)}</td><td class="r">${money(reg.ae ? c.T.ae_tax : c.T.credit_out ? -c.T.credit_out : c.T.tva_due || 0)}</td><td>${badge(ST_TAX, st.status)}</td><td>${dateFr(c.deadline)}</td></tr>`); }
  const body = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Espace comptable · ${esc(s.company_name)}</span><b>Exercice ${y}</b></div><div class="pub-a">${[y - 1, y].map((a) => `<a class="btn ${a === y ? '' : 'ghost'} sm" href="${pre}?annee=${a}">${a}</a>`).join('')}</div></div></div>
<main class="pub-main wide"><section class="acc-id card"><h1>${esc(s.company_name)}</h1><p>${esc([s.company_legal, s.company_address].filter(Boolean).join(' · '))}</p><p class="mut">ICE ${esc(s.company_ice || '—')} · IF ${esc(s.company_if || '—')} · RC ${esc(s.company_rc || '—')} · TP ${esc(s.company_patente || '—')}</p><p><b>${esc(reg.n || 'Régime à préciser')}</b> · ${reg.ae ? 'impôt libératoire sur l’encaissé' : s.tva_assujetti === '1' ? `TVA ${per}, ${s.tva_regime === 'debit' ? 'sur les débits' : 'sur les encaissements'}` : 'non assujetti à la TVA'}</p></section>
<div class="card flush"><table class="tbl"><thead><tr><th>Période</th><th class="r">Facturé HT</th><th class="r">Encaissé TTC</th><th class="r">Dépenses TTC</th><th class="r">${reg.ae ? 'Impôt' : 'TVA (− = crédit)'}</th><th>Statut</th><th>Échéance</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
<div class="card"><h2>Exports de l’exercice</h2><div class="send">${exportLinks(pre + '/export', y)}</div><p class="mut">CSV, séparateur point-virgule. Les écritures suivent le plan comptable CGNC (comptes proposés, à ajuster si besoin).</p></div></main>`;
  res.send(await publicPage('Espace comptable', body));
});
app.get('/comptable/:token/export/:p/:kind.csv', async (req, res) => { const s = await accGuard(req, res); if (!s) return; const k = String(req.params.kind); if (!['ventes', 'encaissements', 'achats', 'ecritures'].includes(k)) return res.sendStatus(404); res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${k}-${req.params.p}.csv"` }).send(await comptaCsv(String(req.params.p), k)); });
app.get('/comptable/:token/:p', async (req, res) => {
  const s = await accGuard(req, res); if (!s) return;
  const p = String(req.params.p); if (!/^\d{4}-(T[1-4]|\d{2})$/.test(p)) return res.sendStatus(404);
  const c = await periodCtx(s, p), t = periodTables(c, s, baseUrl(req)), pre = `/comptable/${req.params.token}`;
  const notes = await db.prepare('SELECT * FROM acc_notes WHERE period = ? ORDER BY id').all(p);
  const body = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k"><a href="${pre}">← Toutes les périodes</a></span><b>${fmtP(p)}</b></div><div class="pub-a">${exportLinks(pre + '/export', p)}</div></div></div><main class="pub-main wide">${t.sum}
<div class="card flush"><div class="card-h pad"><h2>Journal des ventes</h2></div>${t.ventes}</div><div class="card flush"><div class="card-h pad"><h2>Encaissements</h2></div>${t.enc}</div><div class="card flush"><div class="card-h pad"><h2>Achats et relevé des déductions</h2></div>${t.achats}</div>
<div class="card"><h2>Échanges</h2>${notes.map((n) => `<p class="note ${n.author}"><b>${n.author === 'comptable' ? 'Comptable' : esc(s.company_name)}</b> ${esc(n.text)} <small class="mut">${dateFr(n.created_at)}</small></p>`).join('') || '<p class="mut">Aucun échange.</p>'}<form method="post" action="${pre}/${p}/note" class="note-f2"><input name="text" placeholder="Une question, une pièce manquante, une remarque…" required><button class="btn sm">Envoyer</button></form></div></main>`;
  res.send(await publicPage('Comptabilité ' + fmtP(p), body));
});
app.post('/comptable/:token/:p/note', async (req, res) => { const s = await accGuard(req, res); if (!s) return; const p = String(req.params.p); await db.prepare('INSERT INTO acc_notes (period, author, text) VALUES (?,?,?)').run(p, 'comptable', String(req.body.text || '').slice(0, 2000)); await log('compta', 0, `Message du comptable sur ${fmtP(p)}`); res.redirect(`/comptable/${req.params.token}/${p}`); });

/* ---------------- Brief client : le client complète lui-même ses informations ---------------- */
app.get('/brief/:token', async (req, res) => {
  const p = await db.prepare('SELECT * FROM projects WHERE token = ?').get(req.params.token); if (!p) return res.status(404).send(await publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>'));
  const cl = await Q.client.get(p.client_id) || {}, inf = pinfo(p), s = (await settings()), c = completeness(p, cl);
  const f = (k, l, v, ta) => `<label>${l}${ta ? `<textarea name="${k}" rows="3">${esc(v || '')}</textarea>` : `<input name="${k}" value="${esc(v || '')}">`}</label>`;
  const body = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Votre projet avec ${esc(s.company_name)}</span><b>${esc(p.title || '')}</b></div><div class="pub-a"><span class="bdg bdg-blue">${c.pct} % complété</span></div></div></div>
<main class="pub-main">${req.query.merci ? '<div class="pub-thanks"><b>Merci, c’est bien reçu.</b><p>Nous avançons sur votre site avec ces informations. Vous pouvez revenir compléter à tout moment avec ce même lien.</p></div>' : ''}
<form method="post" class="brief"><h1>Quelques informations pour <em>votre site</em></h1><p>Elles nous permettent de créer un site qui vous ressemble, et votre fiche Google. Remplissez ce que vous avez : vous pourrez revenir compléter plus tard.</p>
<section><h2>Votre entreprise</h2><div class="row">${f('company', 'Nom de l’entreprise', cl.company || cl.name)}${f('city', 'Ville', cl.city)}</div>${f('address', 'Adresse complète', cl.address)}<div class="row">${f('phone', 'Téléphone', cl.phone)}${f('whatsapp', 'WhatsApp', cl.whatsapp)}</div><div class="row">${f('email', 'E-mail', cl.email)}${f('ice', 'ICE (si société)', cl.ice)}</div></section>
<section><h2>Votre site</h2>${INFO_FIELDS.map(([k, l]) => f('i_' + k, l, inf[k], k === 'activite')).join('')}</section>
<button class="btn">Envoyer mes informations</button></form></main>`;
  res.send(await publicPage('Votre projet', body));
});
app.post('/brief/:token', async (req, res) => {
  const p = await db.prepare('SELECT * FROM projects WHERE token = ?').get(req.params.token); if (!p) return res.sendStatus(404);
  const b = req.body, cl = await Q.client.get(p.client_id) || {}, cut = (v, n = 400) => String(v || '').trim().slice(0, n);
  await db.prepare('UPDATE clients SET company = ?, city = ?, address = ?, phone = ?, whatsapp = ?, email = ?, ice = ? WHERE id = ?').run(cut(b.company, 160) || cl.company, cut(b.city, 80), cut(b.address, 240), cut(b.phone, 40), cut(b.whatsapp, 40), cut(b.email, 160), cut(b.ice, 40), p.client_id);
  const inf = pinfo(p); for (const [k] of INFO_FIELDS) if (('i_' + k) in b) inf[k] = cut(b['i_' + k], 3000);
  await db.prepare('UPDATE projects SET info = ? WHERE id = ?').run(JSON.stringify(inf), p.id);
  res.redirect(`/brief/${p.token}?merci=1`);
});

/* ---------------- Tout le reste demande d'être connecté ---------------- */
app.use(async (req, res, next) => { if (!await getS('_pw')) return res.redirect('/installation'); if (!isAuthed(req)) return res.redirect('/connexion'); next(); });

/* ---------------- Tableau de bord ---------------- */
app.get('/', async (req, res) => {
  const m = today().slice(0, 7), s = (await settings());
  const qMonth = await db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total_ttc),0) t FROM quotes WHERE substr(issue_date,1,7) = ?").get(m);
  const dec = await db.prepare("SELECT SUM(status IN ('accepte','facture')) w, SUM(status IN ('envoye','vu','accepte','refuse','facture')) d FROM quotes").get();
  const rate = dec.d ? Math.round(100 * dec.w / dec.d) : 0;
  const invs = await withPaid(await db.prepare('SELECT * FROM invoices WHERE cancelled = 0').all());
  let billedMonth = 0, due = 0, late = [];
  for (const i of invs) { const p = i.paid; if ((i.issue_date || '').startsWith(m)) billedMonth += i.total_ttc; const r = i.total_ttc - p; if (r > 0.009) { due += r; if (i.due_date < today()) late.push({ ...i, rest: r }); } }
  const cashMonth = (await db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE substr(date,1,7) = ?").get(m)).s;
  const pipeline = await db.prepare("SELECT COALESCE(SUM(total_ttc),0) s, COUNT(*) n FROM quotes WHERE status IN ('envoye','vu')").get();
  const PM = {}; for (const r of await db.prepare("SELECT substr(date,1,7) m, COALESCE(SUM(amount),0) s FROM payments WHERE date >= date('now','-7 months') GROUP BY m").all()) PM[r.m] = r.s;
  const months = []; for (let k = 5; k >= 0; k--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); const key = d.toISOString().slice(0, 7); months.push([key, PM[key] || 0]); }
  const maxM = Math.max(1, ...months.map((x) => x[1]));
  const follow = await db.prepare("SELECT q.*, c.name cname, c.company ccomp, c.phone cphone FROM quotes q LEFT JOIN clients c ON c.id = q.client_id WHERE q.status IN ('envoye','vu') AND (q.sent_at IS NULL OR q.sent_at <= datetime('now','-3 days')) ORDER BY q.issue_date LIMIT 6").all();
  const leads = await db.prepare("SELECT * FROM leads WHERE COALESCE(stage, 'nouveau') = 'nouveau' ORDER BY id DESC LIMIT 5").all();
  const projs = await db.prepare("SELECT p.*, c.name cname, c.company ccomp FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.status != 'livre' ORDER BY COALESCE(p.due_date, p.created_at) LIMIT 6").all();
  const expMonth = (await db.prepare("SELECT COALESCE(SUM(amount_ttc),0) s FROM expenses WHERE substr(date,1,7) = ?").get(m)).s;
  const kpi = (l, v, sub, cls = '') => `<div class="kpi ${cls}"><span>${l}</span><b>${v}</b><small>${sub}</small></div>`;
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  /* ---- Superviseur : la carte, l'objectif, la lecture intelligente ---- */
  const allClients = await db.prepare("SELECT c.* FROM clients c WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.client_id = c.id AND q.status IN ('accepte','facture')) OR EXISTS (SELECT 1 FROM projects p WHERE p.client_id = c.id)").all();
  const sv = supervise(allClients);
  const prevM = (() => { const d = new Date(m + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const cashPrev = (await db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE substr(date,1,7) = ?").get(prevM)).s;
  const rateOf = async (a, b) => { const r = await db.prepare(`SELECT SUM(status IN ('accepte','facture')) w, SUM(status IN ('envoye','vu','accepte','refuse','facture')) d FROM quotes WHERE issue_date > date('now', ?) AND issue_date <= date('now', ?)`).get(a, b); return r.d ? Math.round(100 * r.w / r.d) : null; };
  const r30 = await rateOf('-30 days', '+0 days'), r60 = await rateOf('-60 days', '-30 days');
  const allProj = await db.prepare("SELECT * FROM projects WHERE status != 'livre'").all();
  const lateP = allProj.filter((p) => p.due_date && p.due_date < today());
  const CLM = await clientMap();
  const incomplete = allProj.map((p) => ({ p, c: completeness(p, CLM[p.client_id]) })).filter((x) => x.c.pct < 100);
  const missCount = {}; incomplete.forEach((x) => x.c.missing.forEach((k) => { missCount[k] = (missCount[k] || 0) + 1; }));
  const topMiss = Object.entries(missCount).sort((a, b) => b[1] - a[1])[0];
  const ORDER = ['CS', 'RSK', 'MS', 'FM', 'TTA', 'SM', 'OR', 'BMK', 'DT', 'GON', 'LSH', 'DOD'];
  const nextRegion = ORDER.map((k) => sv.regions.find((r) => r.k === k)).find((r) => r && !r.lit);
  const bestCity = Object.entries(sv.byCity).sort((a, b) => b[1].length - a[1].length)[0];
  const live = await db.prepare("SELECT p.*, c.name cname, c.company ccomp, c.city ccity FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.site_url IS NOT NULL AND p.site_url != '' ORDER BY COALESCE(p.delivered_at, p.created_at) DESC LIMIT 8").all();
  const ins = [];
  if (cashPrev || cashMonth) ins.push(cashMonth >= cashPrev ? ['up', `Encaissements en hausse : ${money(cashMonth)} ce mois${cashPrev ? `, soit ${Math.round(100 * (cashMonth - cashPrev) / Math.max(1, cashPrev))} % de plus que le mois dernier` : ''}.`] : ['down', `Encaissements en baisse : ${money(cashMonth)} ce mois contre ${money(cashPrev)} le mois dernier.`]);
  if (r30 !== null) ins.push([r60 !== null && r30 < r60 ? 'down' : 'up', `Taux d’acceptation des devis sur 30 jours : ${r30} %${r60 !== null ? ` (${r30 >= r60 ? '+' : ''}${r30 - r60} points)` : ''}.`]);
  if (lateP.length) ins.push(['warn', `${lateP.length} projet${lateP.length > 1 ? 's dépassent' : ' dépasse'} sa date de livraison.`]);
  if (incomplete.length) ins.push(['warn', `${incomplete.length} projet${incomplete.length > 1 ? 's attendent' : ' attend'} des informations du client${topMiss ? `, surtout : ${topMiss[0].toLowerCase()}` : ''}. Envoyez-leur le lien de brief.`]);
  if (follow.length) ins.push(['tip', `${follow.length} devis à relancer : un message WhatsApp suffit souvent.`]);
  if (late.length) ins.push(['warn', `${late.length} facture${late.length > 1 ? 's' : ''} en retard, ${money(late.reduce((a, i) => a + i.rest, 0))} à récupérer.`]);
  if (bestCity) ins.push(['up', `Ville la plus active : ${bestCity[0]}, ${bestCity[1].length} client${bestCity[1].length > 1 ? 's' : ''}.`]);
  if (nextRegion) ins.push(['tip', `Prochaine région à allumer : ${nextRegion.n}.`]);
  if (sv.unknown.length) ins.push(['tip', `${sv.unknown.length} client${sv.unknown.length > 1 ? 's' : ''} sans ville reconnue : complétez l’adresse pour les placer sur la carte.`]);
  if (!ins.length) ins.push(['tip', 'Créez votre premier devis : dès qu’il est accepté, votre premier client s’allume sur la carte.']);
  const siteUrl = 'https://' + String(s.company_site || 'digilago.ma').replace(/^https?:\/\//, '');
  /* ---- Ma journée : ce qu'il faut faire aujourd'hui, prêt en un clic ---- */
  const todo = [];
  for (const l of await db.prepare("SELECT * FROM leads WHERE COALESCE(stage, 'nouveau') = 'nouveau' ORDER BY id DESC LIMIT 5").all()) todo.push(['lead', `Nouvelle demande : ${l.company || l.name || 'sans nom'}`, [srcOf(l), l.need || l.phone || ''].filter(Boolean).join(' · ').slice(0, 80), `/demandes/${l.id}`, 'Traiter']);
  for (const l of await db.prepare("SELECT * FROM leads WHERE next_at IS NOT NULL AND next_at <= ? AND COALESCE(stage, 'nouveau') NOT IN ('gagne','perdu') ORDER BY next_at LIMIT 6").all(today())) todo.push(['relance', `Rappeler ${l.company || l.name || ''}`, `${l.phone || ''}${l.next_at < today() ? ' · prévu le ' + dateFr(l.next_at) : ' · aujourd’hui'}`, `/demandes/${l.id}`, 'Appeler']);
  for (const q of follow.slice(0, 5)) todo.push(['relance', `Relancer le devis ${q.number}`, `${q.ccomp || q.cname || ''} · ${money(q.total_ttc)}`, `/devis/${q.id}`, 'Relancer']);
  const openQ = await db.prepare("SELECT q.*, c.company ccomp, c.name cname FROM quotes q LEFT JOIN clients c ON c.id = q.client_id WHERE q.status IN ('accepte','facture')").all();
  const PRQ = {}; for (const pr of await db.prepare('SELECT * FROM projects WHERE quote_id IS NOT NULL').all()) PRQ[pr.quote_id] = pr;
  const BLQ = {}; for (const x of await db.prepare("SELECT quote_id, sched_idx FROM invoices WHERE kind != 'avoir' AND cancelled = 0 AND quote_id IS NOT NULL").all()) (BLQ[x.quote_id] = BLQ[x.quote_id] || []).push(Number(x.sched_idx));
  for (const q of openQ) {
    const pl = planOf(q), pr = PRQ[q.id], billed = BLQ[q.id] || [];
    const next = pl.findIndex((x, i) => !billed.includes(i)); if (next < 0) continue;
    const st = pr ? steps(pr) : [], maquette = st[1] && st[1].d, livre = pr && pr.status === 'livre';
    const due = next === 0 || (next === pl.length - 1 && livre) || (next > 0 && next < pl.length - 1 && maquette);
    if (due) todo.push(['facture', `Facturer : ${pl[next].l}`, `${q.ccomp || q.cname || ''} · ${q.number}`, `/devis/${q.id}`, 'Facturer']);
  }
  for (const i of late.slice(0, 5)) todo.push(['retard', `Facture en retard : ${i.number}`, `${money(i.rest)} à récupérer`, `/factures/${i.id}`, 'Relancer']);
  const soonInv = []; for (const i of invs) { if (i.cancelled || i.kind === 'avoir') continue; const d = daysTo(i.due_date); if (d !== null && d >= 0 && d <= 3) { if (i.total_ttc - i.paid > 0.009) soonInv.push(i); } }
  for (const i of soonInv.slice(0, 3)) todo.push(['echeance', `Échéance dans ${daysTo(i.due_date)} jour${daysTo(i.due_date) > 1 ? 's' : ''} : ${i.number}`, money(i.total_ttc), `/factures/${i.id}`, 'Rappel amical']);
  for (const p of await db.prepare("SELECT p.*, c.company ccomp, c.name cname FROM projects p LEFT JOIN clients c ON c.id = p.client_id").all()) {
    const t = ptech(p), dd = daysTo(t.domain_expiry), hh = daysTo(t.hosting_expiry), ss = daysTo(t.ssl_valid_to);
    if (dd !== null && dd <= 30) todo.push(['renouv', `Renouveler le domaine ${t.domain || ''}`, `${p.ccomp || p.cname || ''} · ${dd < 0 ? 'expiré' : 'dans ' + dd + ' jours'}`, `/projets/${p.id}`, 'Voir']);
    if (hh !== null && hh <= 30) todo.push(['renouv', 'Renouveler l’hébergement', `${p.ccomp || p.cname || ''} · ${hh < 0 ? 'expiré' : 'dans ' + hh + ' jours'}`, `/projets/${p.id}`, 'Voir']);
    if (ss !== null && ss <= 15) todo.push(['renouv', 'Certificat SSL à vérifier', `${p.ccomp || p.cname || ''} · ${ss < 0 ? 'expiré' : 'expire dans ' + ss + ' jours'}`, `/projets/${p.id}`, 'Voir']);
    if (p.status !== 'livre' && p.status !== 'proposition' && p.due_date && p.due_date < today()) todo.push(['retard', `Projet en retard : ${p.title}`, `livraison prévue le ${dateFr(p.due_date)}`, `/projets/${p.id}`, 'Ouvrir']);
  }
  const unreadN = (await db.prepare('SELECT COUNT(DISTINCT ckey) n FROM messages WHERE is_read = 0').get()).n; if (unreadN) todo.unshift(['lead', `${unreadN} conversation${unreadN > 1 ? 's' : ''} non lue${unreadN > 1 ? 's' : ''}`, 'WhatsApp et e-mails', '/messagerie', 'Lire']);
  { const reg = CP.REGIMES[s.fiscal_regime] || {}; if (s.fiscal_regime && (reg.ae || s.tva_assujetti === '1')) { const per = reg.ae ? 'trimestrielle' : s.tva_periodicite === 'mensuelle' ? 'mensuelle' : 'trimestrielle', y0 = Number(today().slice(0, 4)); for (const pp of [...CP.periodsOfYear(y0 - 1, per).slice(-1), ...CP.periodsOfYear(y0, per)]) { const dl = CP.deadline(pp), dd = daysTo(dl); if (dd !== null && dd >= -30 && dd <= 15) { const stx = await taxStatus(reg.ae ? 'ae' : 'tva', pp); if (!['declare', 'paye'].includes(stx.status)) todo.push(['echeance', `${reg.ae ? 'Déclaration auto-entrepreneur' : 'Déclaration de TVA'} · ${fmtP(pp)}`, dd < 0 ? `en retard depuis le ${dateFr(dl)}` : `avant le ${dateFr(dl)}`, `/comptabilite/periode/${pp}`, 'Préparer']); } } } }
  const TI = { lead: '✦', relance: '↻', facture: '€', retard: '!', echeance: '◷', renouv: '⟳' };
  const dayCard = `<section class="day"><div class="day-h"><div><span class="sup-k"><i></i>Ma journée</span><h2>${todo.length ? `${todo.length} action${todo.length > 1 ? 's' : ''} pour avancer aujourd’hui` : 'Rien d’urgent. Belle journée !'}</h2></div><a class="btn" href="/assistant">+ Nouveau projet</a></div>${todo.length ? `<ul class="day-l">${todo.slice(0, 12).map(([k, t, sub, u, a]) => `<li class="d-${k}"><i>${TI[k]}</i><span><b>${esc(t)}</b><small>${esc(sub)}</small></span><a class="btn sm${k === 'retard' ? '' : ' ghost'}" href="${u}">${a}</a></li>`).join('')}</ul>` : ''}</section>`;
  const hero = `<section class="sup"><div class="sup-l"><span class="sup-k"><i></i>Superviseur Digilago</span><h2>Objectif : <em>allumer tout le Maroc.</em></h2>
<div class="sup-goal"><div class="sup-gh"><span>Régions allumées</span><b>${sv.litRegions}<small> / ${sv.totalRegions}</small></b></div><div class="prog big gold"><i style="width:${Math.round(100 * sv.litRegions / sv.totalRegions)}%"></i></div></div>
<div class="sup-n"><div><b>${sv.litCities}</b><span>villes allumées</span></div><div><b>${allClients.length}</b><span>clients</span></div><div><b>${live.length}</b><span>sites en ligne</span></div><div><b>${allProj.length}</b><span>projets en cours</span></div></div>
<div class="sup-reg">${sv.regions.map((r) => `<span class="${r.lit ? 'on' : ''}" title="${esc(r.n)}${r.count ? ' : ' + r.count + ' client' + (r.count > 1 ? 's' : '') : ''}">${esc(r.n)}</span>`).join('')}</div>
<ul class="sup-ins">${ins.slice(0, 6).map(([k, t]) => `<li class="${k}"><i></i>${esc(t)}</li>`).join('')}</ul></div>
<div class="sup-map">${sv.svg}</div></section>
<section class="card"><div class="card-h"><h2>Le travail fait</h2><a href="${esc(siteUrl)}" target="_blank" rel="noopener">Voir ${esc(siteUrl.replace('https://', ''))}</a></div><div class="sites"><a class="site me" href="${esc(siteUrl)}" target="_blank" rel="noopener"><span class="site-f"><iframe src="${esc(siteUrl)}" loading="lazy" tabindex="-1" title="Votre site" sandbox></iframe></span><b>Votre site</b><small>${esc(siteUrl.replace('https://', ''))}</small></a>${live.map((p) => `<a class="site" href="${esc(p.site_url)}" target="_blank" rel="noopener"><span class="site-f"><iframe src="${esc(p.site_url)}" loading="lazy" tabindex="-1" title="${esc(p.ccomp || p.cname || '')}" sandbox></iframe></span><b>${esc(p.ccomp || p.cname || '')}</b><small>${esc(p.ccity || '')}</small></a>`).join('') || '<p class="empty">Les sites livrés apparaîtront ici : ajoutez leur adresse dans chaque projet.</p>'}</div></section>`;
  const body = dayCard + hero + `<section class="kpis">${kpi('Encaissé ce mois', money(cashMonth), 'paiements reçus', 'hl')}${kpi('Reste à encaisser', money(due), `${late.length} facture${late.length > 1 ? 's' : ''} en retard`, late.length ? 'warn' : '')}${kpi('Devis en attente', money(pipeline.s), `${pipeline.n} devis envoyés`)}${kpi('Taux d’acceptation', rate + ' %', `${qMonth.n} devis ce mois, ${money(qMonth.t)}`)}${kpi('Résultat du mois', money(cashMonth - expMonth), `${money(expMonth)} de dépenses`, cashMonth - expMonth < 0 ? 'warn' : '')}</section>
<section class="grid2"><div class="card"><div class="card-h"><h2>Encaissements</h2><span>6 derniers mois</span></div><div class="bars">${months.map(([k, v]) => `<div class="bar"><i style="height:${Math.max(3, Math.round(100 * v / maxM))}%"></i><b>${v ? money(v, '') : ''}</b><span>${MOIS[Number(k.slice(5)) - 1]}</span></div>`).join('')}</div></div>
<div class="card"><div class="card-h"><h2>À relancer</h2><span>Devis envoyés depuis plus de 3 jours</span></div>${follow.length ? `<ul class="lst">${follow.map((q) => `<li><a href="/devis/${q.id}"><b>${esc(q.number)}</b><span>${esc(q.ccomp || q.cname || '')}</span></a><em>${money(q.total_ttc)}</em>${q.cphone ? `<a class="mini" target="_blank" rel="noopener" href="https://wa.me/${digits(q.cphone)}?text=${encodeURIComponent(`Bonjour ${q.cname || ''}, avez-vous pu consulter notre devis ${q.number} ? ${baseUrl(req)}/d/${q.token}`)}">Relancer</a>` : ''}</li>`).join('')}</ul>` : '<p class="empty">Rien à relancer pour l’instant.</p>'}</div></section>
<section class="card"><div class="card-h"><h2>Projets en cours</h2><a href="/projets">Tout voir</a></div>${projs.length ? `<div class="pj-row">${projs.map((p) => { const st = (() => { try { return JSON.parse(p.steps || '[]'); } catch (e) { return []; } })(), d = st.filter((x) => x.d).length; const HL = health(p, CLM[p.client_id]); return `<a class="kb-card hl-${HL.lvl}" href="/projets/${p.id}" title="${esc(HL.why.join(', ') || 'Tout va bien')}"><b><i class="hl-dot"></i>${esc(p.ccomp || p.cname || '')}</b><span>${esc(p.title || '')}</span><div class="prog"><i style="width:${st.length ? Math.round(100 * d / st.length) : 0}%"></i></div><small>${badge(P_STATUS, p.status)} ${p.due_date ? 'livraison ' + dateFr(p.due_date) : ''}</small></a>`; }).join('')}</div>` : '<p class="empty">Aucun projet en cours. Ils s’ouvrent dès qu’un devis est accepté.</p>'}</section>
<section class="grid2"><div class="card"><div class="card-h"><h2>Factures en retard</h2></div>${late.length ? `<ul class="lst">${late.slice(0, 6).map((i) => `<li><a href="/factures/${i.id}"><b>${esc(i.number)}</b><span>échéance ${dateFr(i.due_date)}</span></a><em class="red">${money(i.rest)}</em></li>`).join('')}</ul>` : '<p class="empty">Aucune facture en retard.</p>'}</div>
<div class="card"><div class="card-h"><h2>Nouvelles demandes</h2><a href="/demandes">Tout voir</a></div>${leads.length ? `<ul class="lst">${leads.map((l) => `<li><a href="/demandes"><b>${esc(l.company || l.name || 'Demande')}</b><span>${esc(l.need || l.message || '').slice(0, 60)}</span></a><a class="mini" href="/assistant?demande=${l.id}">Préparer le projet</a></li>`).join('')}</ul>` : '<p class="empty">Aucune nouvelle demande.</p>'}</div></section>`;
  res.send(layout({ title: 'Tableau de bord', active: '/', body, actions: '<a class="btn" href="/devis/nouveau">Nouveau devis</a>' }));
});


/* ---------------- Assistant « Nouveau projet » : un appel, et tout est prêt ---------------- */
app.get('/assistant', async (req, res) => {
  const clients = await db.prepare('SELECT id, name, company FROM clients ORDER BY COALESCE(company, name) COLLATE NOCASE').all();
  const services = await db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id').all();
  const lead = req.query.demande ? await db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.query.demande)) : null;
  res.send(layout({ title: 'Nouveau projet', active: '/assistant', body: `<p class="hint">Pendant l’appel, remplissez au fil de la conversation : l’assistant vous dit quoi demander, propose le bon pack et prépare le devis.</p>${assistant.page({ clients, services, plans: PLANS, lead })}<script src="/static/assistant.js" defer></script>` }));
});
app.post('/assistant', async (req, res) => {
  const b = req.body, svc = await db.prepare('SELECT * FROM services').all(), byName = Object.fromEntries(svc.map((x) => [x.name, x]));
  const picked = [].concat(b.pack || []).filter((n) => byName[n]);
  const pages = Math.max(1, Math.min(60, Math.round(num(b.pages, 5))));
  const langs = ['lang_fr', 'lang_ar', 'lang_en'].filter((k) => b[k]).length || 1;
  const qtyOf = (n) => n === 'Rédaction SEO' ? pages : n === 'Traduction professionnelle' ? pages * Math.max(1, langs - 1) : n === 'Maintenance et support' || n === 'Rapport mensuel SEO' ? 12 : 1;
  const items = picked.map((n) => ({ label: n, description: byName[n].description || '', qty: qtyOf(n), unit: byName[n].unit, unit_price: byName[n].unit_price }));
  if (!items.length) items.push({ label: 'Site vitrine sur mesure', description: (byName['Site vitrine sur mesure'] || {}).description || '', qty: 1, unit: 'forfait', unit_price: (byName['Site vitrine sur mesure'] || {}).unit_price || 0 });
  const kindN = { vitrine: 'Site vitrine', ecommerce: 'Boutique en ligne', landing: 'Landing page', application: 'Application' }[b.kind] || 'Site';
  const sit = b.situation === 'site' ? ' (refonte)' : '';
  const company = String(b.nc_company || '').trim();
  const qbody = { ...b, title: `${kindN}${sit}${company ? ' ' + company : ''}${b.metier ? ', ' + b.metier : ''}`, issue_date: today(), items, nc_name: b.nc_name, nc_company: b.nc_company, nc_phone: b.nc_phone, nc_email: b.nc_email, nc_city: b.nc_city, pack: JSON.stringify(b) };
  let qid;
  try { qid = await saveQuote(qbody); } catch (e) { return res.status(400).send(layout({ title: 'Nouveau projet', body: `<div class="flash err">${esc(e.message)}</div><a class="btn" href="/assistant">Revenir</a>` })); }
  const q = await Q.quote.get(qid);
  await db.prepare('UPDATE clients SET address = COALESCE(NULLIF(?, \'\'), address), sector = ?, source = ?, website = COALESCE(NULLIF(?, \'\'), website) WHERE id = ?').run(String(b.nc_address || ''), String(b.sector || ''), String(b.source || ''), String(b.old_site || ''), q.client_id);
  const info = { logo: b.has_logo === 'oui' ? 'Fourni par le client' : '', couleurs: b.has_colors === 'oui' ? 'Existantes' : '', photos: b.has_photos === 'oui' ? 'Fournies par le client' : '', activite: b.has_texts === 'oui' ? 'Textes fournis par le client' : '', domaine: String(b.domain || ''), google: b.gbp_url ? String(b.gbp_url) : '' };
  const tech = { domain: String(b.domain || ''), registrar: String(b.registrar || ''), domain_access: String(b.domain_access || ''), old_site: String(b.old_site || ''), old_tech: String(b.old_tech || ''), old_keep: String(b.old_keep || ''), gbp_url: String(b.gbp_url || ''), langs: ['fr', 'ar', 'en'].filter((l) => b['lang_' + l]).join(','), pages, products: String(b.products || ''), budget: String(b.budget || '') };
  const pid = Number((await db.prepare('INSERT INTO projects (quote_id, client_id, title, status, due_date, steps, info, token, tech, situation, kind, sector, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(q.id, q.client_id, q.title, 'proposition', b.due_date || addDays(today(), 21), JSON.stringify(STEPS.map((t) => ({ t, d: 0 }))), JSON.stringify(info), token(), JSON.stringify(tech), String(b.situation || 'rien'), String(b.kind || 'vitrine'), String(b.sector || ''), String(b.notes || ''))).lastInsertRowid);
  if (b.lead_id) { await db.prepare("UPDATE leads SET status = 'devis', quote_id = ? WHERE id = ?").run(qid, Number(b.lead_id)); await leadStage(Number(b.lead_id), 'proposition', 'projet préparé avec l’assistant'); }
  await log('projet', pid, `Nouveau projet créé avec l’assistant : ${q.title}`);
  res.redirect(`/devis/${qid}?assistant=1`);
});

/* ---------------- Devis ---------------- */
async function quoteForm({ q = {}, items = [], client = null, lead = null, errors = '' }) {
  const s = (await settings());
  const clients = await db.prepare('SELECT id, name, company FROM clients ORDER BY COALESCE(company, name) COLLATE NOCASE').all();
  const services = await db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id').all();
  if (!items.length) items = [{ label: '', description: '', qty: 1, unit: 'forfait', unit_price: '' }];
  const cid = q.client_id || (client && client.id) || (lead ? 'new' : (clients.length ? '' : 'new'));
  const row = (it, i) => `<tr class="it"><td class="drag">${i + 1}</td><td><input name="items[${i}][label]" value="${esc(it.label)}" list="svc" placeholder="Prestation" class="it-l"><textarea name="items[${i}][description]" rows="1" placeholder="Détail (facultatif)">${esc(it.description || '')}</textarea></td><td><input name="items[${i}][qty]" value="${esc(it.qty ?? 1)}" inputmode="decimal" class="it-q"></td><td><input name="items[${i}][unit]" value="${esc(it.unit || '')}" class="it-u"></td><td><input name="items[${i}][unit_price]" value="${esc(it.unit_price ?? '')}" inputmode="decimal" class="it-p" placeholder="0,00"></td><td class="it-t">0,00</td><td><button type="button" class="x" data-del aria-label="Supprimer la ligne">×</button></td></tr>`;
  const v = (k, d = '') => esc(q[k] ?? d);
  const nl = lead || {};
  const curPlan = q.plan_key || (q.plan ? planKey(planOf(q)) : '50-50');
  return `${errors ? `<div class="flash err">${esc(errors)}</div>` : ''}<form method="post" class="qform" id="qform" data-services='${esc(JSON.stringify(services.map((x) => ({ n: x.name, d: x.description, u: x.unit, p: x.unit_price }))))}'>
${lead ? `<input type="hidden" name="lead_id" value="${lead.id}">` : ''}
<div class="qf-main"><section class="card"><div class="card-h"><h2>Client</h2></div>
<div class="row"><label class="grow">Client<select name="client_id" id="clientSel"><option value="">Choisir un client…</option><option value="new"${cid === 'new' ? ' selected' : ''}>+ Nouveau client</option>${clients.map((c) => `<option value="${c.id}"${String(cid) === String(c.id) ? ' selected' : ''}>${esc(c.company ? c.company + ' (' + c.name + ')' : c.name)}</option>`).join('')}</select></label></div>
<div class="newc" id="newClient"${cid === 'new' ? '' : ' hidden'}><div class="row"><label>Nom et prénom<input name="nc_name" value="${esc(nl.name || '')}"></label><label>Entreprise<input name="nc_company" value="${esc(nl.company || '')}"></label></div><div class="row"><label>Téléphone<input name="nc_phone" value="${esc(nl.phone || '')}"></label><label>E-mail<input name="nc_email" type="email" value="${esc(nl.email || '')}"></label></div><div class="row"><label>Ville<input name="nc_city"></label><label>ICE (facultatif)<input name="nc_ice"></label></div></div></section>
<section class="card"><div class="card-h"><h2>Le devis</h2></div><div class="row"><label class="grow">Objet<input name="title" value="${v('title', nl.need || '')}" placeholder="Ex. : Site vitrine trilingue et fiche Google"></label></div>
<div class="row r4"><label>Date<input type="date" name="issue_date" value="${v('issue_date', today())}"></label><label>Validité (jours)<input name="validity" inputmode="numeric" value="${esc(q.valid_until && q.issue_date ? Math.round((new Date(q.valid_until) - new Date(q.issue_date)) / 864e5) : s.default_validity)}"></label><label>TVA<select name="tva_rate" id="tva">${[20, 14, 10, 7, 0].map((r) => `<option value="${r}"${num(q.tva_rate ?? s.default_tva) === r ? ' selected' : ''}>${r ? r + ' %' : 'Non applicable'}</option>`).join('')}</select></label><label>Délai<input name="delay" value="${v('delay', s.default_delay)}"></label></div></section>
<section class="card"><div class="card-h"><h2>Prestations</h2><div class="chips">${services.slice(0, 8).map((x) => `<button type="button" class="chip" data-add="${esc(x.name)}">+ ${esc(x.name)}</button>`).join('')}</div></div>
<datalist id="svc">${services.map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>
<table class="items"><thead><tr><th></th><th>Désignation</th><th>Qté</th><th>Unité</th><th>Prix HT</th><th>Total HT</th><th></th></tr></thead><tbody id="itemsBody">${items.map(row).join('')}</tbody></table>
<button type="button" class="btn ghost sm" id="addRow">${ICONS.plus}Ajouter une ligne</button></section>
<section class="card"><div class="card-h"><h2>Notes et conditions</h2></div><label>Notes pour le client<textarea name="notes" rows="2" placeholder="Ex. : inclut 3 allers-retours de modifications">${v('notes')}</textarea></label><label>Conditions<textarea name="conditions" rows="4">${v('conditions', s.default_conditions)}</textarea></label></section></div>
<aside class="qf-side"><div class="card sticky"><h2>Récapitulatif</h2>
<div class="row r2"><label>Remise (%)<input name="discount_pct" id="disc" inputmode="decimal" value="${v('discount_pct', 0)}"></label><label>Paiement<select name="plan_key" id="planKey">${Object.entries(PLANS).map(([k, x]) => `<option value="${k}"${curPlan === k ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}<option value="custom"${curPlan === 'custom' ? ' selected' : ''}>Sur mesure…</option></select></label></div>
<label id="planCustomW"${curPlan === 'custom' ? '' : ' hidden'}>Échéancier sur mesure (une ligne par tranche : libellé ; %)<textarea name="plan_custom" rows="3" placeholder="Acompte ; 30&#10;Maquette validée ; 30&#10;Mise en ligne ; 40">${esc(curPlan === 'custom' ? planOf(q).map((x) => x.l + ' ; ' + x.p).join('\n') : '')}</textarea></label>
<input type="hidden" name="deposit_pct" id="dep" value="${v('deposit_pct', s.default_deposit)}">
<dl class="sum"><dt>Sous-total HT</dt><dd id="sSub">0,00</dd><dt>Remise</dt><dd id="sDisc">0,00</dd><dt>Total HT</dt><dd id="sHt">0,00</dd><dt>TVA</dt><dd id="sTva">0,00</dd><dt class="big">Total TTC</dt><dd class="big" id="sTtc">0,00</dd></dl>
<div class="plan-prev" id="planPrev" data-plans='${esc(JSON.stringify(Object.fromEntries(Object.entries(PLANS).map(([k, x]) => [k, x.t]))))}'></div>
<button class="btn wide" name="then" value="voir">Enregistrer le devis</button><button class="btn ghost wide" name="then" value="envoyer">Enregistrer et envoyer</button></div></aside></form>`;
}
function readItems(body) {
  const raw = body.items ? (Array.isArray(body.items) ? body.items : Object.values(body.items)) : [];
  return raw.map((it) => ({ label: String(it.label || '').trim().slice(0, 200), description: String(it.description || '').trim().slice(0, 1000), qty: num(it.qty, 1) || 1, unit: String(it.unit || '').trim().slice(0, 30), unit_price: round2(num(it.unit_price)) })).filter((it) => it.label);
}
async function resolveClient(body) {
  if (body.client_id && body.client_id !== 'new') return Number(body.client_id);
  const name = String(body.nc_name || '').trim(), company = String(body.nc_company || '').trim();
  if (!name && !company) return null;
  return Number((await db.prepare('INSERT INTO clients (name, company, phone, email, city, ice) VALUES (?, ?, ?, ?, ?, ?)').run(name || company, company, String(body.nc_phone || '').trim(), String(body.nc_email || '').trim(), String(body.nc_city || '').trim(), String(body.nc_ice || '').trim())).lastInsertRowid);
}
async function saveQuote(body, id = null) {
  const items = readItems(body);
  const clientId = await resolveClient(body);
  if (!clientId) throw new Error('Choisissez un client ou créez-en un.');
  if (!items.length) throw new Error('Ajoutez au moins une prestation.');
  const s = (await settings()), issue = body.issue_date || today();
  const tva = num(body.tva_rate, num(s.default_tva)), disc = Math.min(100, Math.max(0, num(body.discount_pct))), dep = Math.min(100, Math.max(0, num(body.deposit_pct)));
  const t = totals(items, tva, disc), valid = addDays(issue, num(body.validity, num(s.default_validity)));
  const f = [clientId, String(body.title || '').trim(), issue, valid, tva, disc, dep, String(body.delay || ''), String(body.notes || ''), String(body.conditions || ''), t.ht, t.tva, t.ttc];
  id = await db.tx(async (t) => {
    if (id) await t.prepare("UPDATE quotes SET client_id=?, title=?, issue_date=?, valid_until=?, tva_rate=?, discount_pct=?, deposit_pct=?, delay=?, notes=?, conditions=?, total_ht=?, total_tva=?, total_ttc=?, updated_at=datetime('now') WHERE id=?").run(...f, id);
    else id = Number((await t.prepare('INSERT INTO quotes (client_id, title, issue_date, valid_until, tva_rate, discount_pct, deposit_pct, delay, notes, conditions, total_ht, total_tva, total_ttc, token) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...f, token())).lastInsertRowid);
    await t.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(id);
    const ins = t.prepare('INSERT INTO quote_items (quote_id, position, label, description, qty, unit, unit_price) VALUES (?,?,?,?,?,?,?)');
    for (let i = 0; i < items.length; i++) { const it = items[i]; await ins.run(id, i, it.label, it.description, it.qty, it.unit, it.unit_price); }
    return id;
  });
  const plan = planFromBody(body);
  await db.prepare('UPDATE quotes SET plan = ?, deposit_pct = ?, pack = COALESCE(?, pack) WHERE id = ?').run(JSON.stringify(plan), plan.length > 1 ? plan[0].p : (/commande/.test(plan[0].l) ? 100 : 0), body.pack || null, id);
  const q = await Q.quote.get(id);
  if (!q.number) await db.prepare('UPDATE quotes SET number = ? WHERE id = ?').run(await nextNumber('quote', s.quote_prefix, issue), id);
  if (body.lead_id) await db.prepare("UPDATE leads SET status = 'devis', quote_id = ? WHERE id = ?").run(id, Number(body.lead_id));
  return id;
}
app.get('/devis', async (req, res) => {
  const f = String(req.query.statut || ''), term = String(req.query.q || '').trim();
  let rows = (await db.prepare('SELECT q.*, c.name cname, c.company ccomp FROM quotes q LEFT JOIN clients c ON c.id = q.client_id ORDER BY q.id DESC').all()).map((q) => ({ ...q, st: qStatus(q) }));
  if (f) rows = rows.filter((q) => q.st === f);
  if (term) { const t = term.toLowerCase(); rows = rows.filter((q) => [q.number, q.title, q.cname, q.ccomp].join(' ').toLowerCase().includes(t)); }
  const tabs = ['', 'brouillon', 'envoye', 'vu', 'accepte', 'facture', 'refuse', 'expire'].map((k) => `<a href="/devis${k ? '?statut=' + k : ''}" class="${f === k ? 'on' : ''}">${k ? Q_STATUS[k][0] : 'Tous'}</a>`).join('');
  const body = `<div class="tools"><nav class="tabs">${tabs}</nav><form class="search"><input name="q" value="${esc(term)}" placeholder="Rechercher un devis, un client…">${f ? `<input type="hidden" name="statut" value="${esc(f)}">` : ''}</form></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Numéro</th><th>Client</th><th>Objet</th><th>Date</th><th class="r">Total TTC</th><th>Statut</th></tr></thead><tbody>${rows.map((q) => `<tr data-href="/devis/${q.id}"><td><a href="/devis/${q.id}"><b>${esc(q.number)}</b></a></td><td>${esc(q.ccomp || q.cname || '')}</td><td class="mut">${esc(q.title || '')}</td><td>${dateFr(q.issue_date)}</td><td class="r">${money(q.total_ttc)}</td><td>${badge(Q_STATUS, q.st)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucun devis pour l’instant. <a href="/devis/nouveau">Créer le premier</a></td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Devis', active: '/devis', body, actions: '<a class="btn" href="/devis/nouveau">Nouveau devis</a>' }));
});
app.get('/devis/nouveau', async (req, res) => {
  const lead = req.query.demande ? await db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.query.demande)) : null;
  const client = req.query.client ? await Q.client.get(Number(req.query.client)) : null;
  res.send(layout({ title: 'Nouveau devis', active: '/devis', body: await quoteForm({ lead, client }) }));
});
app.post('/devis/nouveau', async (req, res) => {
  try { const id = await saveQuote(req.body); if (req.body.then === 'envoyer') await db.prepare("UPDATE quotes SET status = 'envoye', sent_at = datetime('now') WHERE id = ?").run(id); res.redirect(`/devis/${id}${req.body.then === 'envoyer' ? '?envoyer=1' : ''}`); }
  catch (e) { res.status(400).send(layout({ title: 'Nouveau devis', active: '/devis', body: await quoteForm({ q: req.body, items: readItems(req.body), errors: e.message }) })); }
});
app.get('/devis/:id/modifier', async (req, res) => {
  const q = await Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  res.send(layout({ title: 'Modifier ' + q.number, active: '/devis', body: await quoteForm({ q, items: await Q.qItems.all(q.id) }) }));
});
app.post('/devis/:id/modifier', async (req, res) => {
  const id = Number(req.params.id);
  try { await saveQuote(req.body, id); if (req.body.then === 'envoyer') await db.prepare("UPDATE quotes SET status = 'envoye', sent_at = datetime('now') WHERE id = ?").run(id); res.redirect(`/devis/${id}${req.body.then === 'envoyer' ? '?envoyer=1' : ''}`); }
  catch (e) { res.status(400).send(layout({ title: 'Modifier le devis', active: '/devis', body: await quoteForm({ q: { ...req.body, id }, items: readItems(req.body), errors: e.message }) })); }
});
app.get('/devis/:id', async (req, res) => {
  const q = await Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  const s = (await settings()), cl = await Q.client.get(q.client_id) || {}, st = qStatus(q), link = `${baseUrl(req)}/d/${q.token}`;
  const invs = await withPaid(await db.prepare('SELECT * FROM invoices WHERE quote_id = ? ORDER BY id').all(q.id));
  const PRJ = await db.prepare('SELECT * FROM projects WHERE quote_id = ?').get(q.id);
  const ORD = await db.prepare('SELECT * FROM orders WHERE quote_id = ?').get(q.id), PLAN = planOf(q);
  const depBilled = invs.some((i) => i.kind === 'acompte'), closed = invs.some((i) => i.kind !== 'acompte');
  const msg = `Bonjour ${cl.name || ''}, voici votre devis ${q.number} de ${money(q.total_ttc)} TTC : ${link}\nVous pouvez le consulter, le télécharger et l’accepter en ligne.`;
  const wa = cl.phone ? `https://wa.me/${digits(cl.phone)}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:${esc(cl.email || '')}?subject=${encodeURIComponent('Devis ' + q.number + ' - ' + s.company_name)}&body=${encodeURIComponent(msg)}`;
  const timeline = [['Créé', q.created_at], ['Envoyé', q.sent_at], ['Consulté par le client', q.viewed_at], ['Accepté' + (q.accepted_name ? ' par ' + q.accepted_name : ''), q.accepted_at]].filter((x) => x[1]).map(([t, d]) => `<li><i></i><b>${esc(t)}</b><span>${dateFr(d)}</span></li>`).join('');
  const side = `<div class="card"><div class="card-h"><h2>Statut</h2>${badge(Q_STATUS, st)}</div><ul class="tl">${timeline}</ul>
<form method="post" action="/devis/${q.id}/statut" class="st-btns">${['envoye', 'accepte', 'refuse'].filter((k) => k !== q.status && q.status !== 'facture').map((k) => `<button class="btn ghost sm" name="status" value="${k}">${k === 'envoye' ? 'Marquer envoyé' : k === 'accepte' ? 'Marquer accepté' : 'Marquer refusé'}</button>`).join('')}</form></div>
<div class="card"><div class="card-h"><h2>Envoyer au client</h2></div><div class="copy"><input readonly value="${esc(link)}" id="lnk"><button type="button" class="btn ghost sm" data-copy="#lnk">Copier</button></div>
<div class="send"><a class="btn wa" href="${wa}" target="_blank" rel="noopener" data-mark="/devis/${q.id}/envoye">WhatsApp</a><a class="btn ghost" href="${mail}" data-mark="/devis/${q.id}/envoye">E-mail</a><a class="btn ghost" href="/d/${q.token}" target="_blank" rel="noopener">Voir comme le client</a></div></div>
${(() => { const pr = PRJ; return pr ? `<div class="card"><div class="card-h"><h2>Projet</h2>${badge(P_STATUS, pr.status)}</div><a href="/projets/${pr.id}">Suivre le projet</a></div>` : ''; })()}
<div class="card"><div class="card-h"><h2>Échéancier et facturation</h2>${ORD ? `<a href="/bc/${ORD.token}" target="_blank" rel="noopener">Bon de commande ${esc(ORD.number)}</a>` : ''}</div><ul class="sched">${PLAN.map((x, i) => { const inv = invs.find((f) => Number(f.sched_idx) === i && f.kind !== 'avoir' && !f.cancelled); const amt = i === PLAN.length - 1 ? round2(q.total_ttc - PLAN.slice(0, -1).reduce((a, y) => a + round2(q.total_ttc * y.p / 100), 0)) : round2(q.total_ttc * x.p / 100); return `<li class="${inv ? (iStatus(inv) === 'payee' ? 'paid' : 'billed') : ''}"><span class="sc-i">${i + 1}</span><span class="sc-t"><b>${esc(x.l)}</b><small>${pct(x.p)} · ${money(amt)}</small></span>${inv ? `<a href="/factures/${inv.id}">${esc(inv.number)}</a>${badge(I_STATUS, iStatus(inv))}` : `<form method="post" action="/devis/${q.id}/facturer" class="inl"><input type="hidden" name="idx" value="${i}"><button class="btn sm${i === invs.filter((f) => f.kind !== 'avoir' && !f.cancelled).length ? '' : ' ghost'}">Facturer</button></form>`}</li>`; }).join('')}</ul>
${invs.filter((f) => f.kind === 'avoir' || f.cancelled).length ? `<p class="mut">Annulations : ${invs.filter((f) => f.kind === 'avoir').map((f) => `<a href="/factures/${f.id}">${esc(f.number)}</a>`).join(', ')}</p>` : ''}</div>`;
  const actions = `<a class="btn" href="/messagerie/ecrire?type=devis&id=${q.id}">Message</a>${q.status !== 'facture' ? `<a class="btn ghost" href="/devis/${q.id}/modifier">Modifier</a>` : ''}<form method="post" action="/devis/${q.id}/dupliquer" class="inl"><button class="btn ghost">Dupliquer</button></form><button type="button" class="btn ghost" data-print>PDF</button>`;
  const flash = req.query.err ? String(req.query.err) : req.query.assistant ? 'Tout est prêt : le client, le projet (en proposition) et ce devis. Vérifiez les prix, puis envoyez-le.' : req.query.envoyer ? 'Devis enregistré. Envoyez-le maintenant par WhatsApp ou par e-mail.' : '';
  res.send(layout({ title: `Devis ${q.number}`, active: '/devis', flash, actions, body: `<div class="docview"><div class="paper">${renderDoc({ type: 'devis', doc: q, items: await Q.qItems.all(q.id), client: cl, s })}</div><aside class="dv-side">${side}</aside></div>` }));
});
app.post('/devis/:id/envoye', async (req, res) => { await db.prepare("UPDATE quotes SET status = 'envoye', sent_at = COALESCE(sent_at, datetime('now')) WHERE id = ? AND status = 'brouillon'").run(Number(req.params.id)); res.sendStatus(204); });
app.post('/devis/:id/statut', async (req, res) => {
  const id = Number(req.params.id), st = String(req.body.status);
  if (st === 'envoye') await db.prepare("UPDATE quotes SET status = 'envoye', sent_at = COALESCE(sent_at, datetime('now')) WHERE id = ?").run(id);
  else if (st === 'accepte') { await db.prepare("UPDATE quotes SET status = 'accepte', accepted_at = COALESCE(accepted_at, datetime('now')), accepted_name = COALESCE(accepted_name, '') WHERE id = ?").run(id); await ensureProject(id); await ensureOrder(id); await log('devis', id, 'Devis marqué accepté'); await leadFromQuote(id, 'gagne'); }
  else if (st === 'refuse') { await db.prepare("UPDATE quotes SET status = 'refuse' WHERE id = ?").run(id); await leadFromQuote(id, 'perdu', 'Devis refusé'); }
  res.redirect('/devis/' + id);
});
app.post('/devis/:id/dupliquer', async (req, res) => {
  const q = await Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  const id = await saveQuote({ client_id: q.client_id, title: q.title, issue_date: today(), validity: (await settings()).default_validity, tva_rate: q.tva_rate, discount_pct: q.discount_pct, deposit_pct: q.deposit_pct, delay: q.delay, notes: q.notes, conditions: q.conditions, items: await Q.qItems.all(q.id) });
  res.redirect(`/devis/${id}/modifier`);
});
/* Facture d'une échéance : acompte, situation, solde ou facture unique */
async function createScheduleInvoice(q, idx) {
  if (await isLocked(today())) throw new Error(lockedMsg(today()));
  const plan = planOf(q), n = plan.length; idx = Math.max(0, Math.min(n - 1, idx));
  const prev = (await Q.quoteInvoices.all(q.id)).filter((i) => i.kind !== 'avoir');
  const same = prev.find((i) => Number(i.sched_idx) === idx); if (same) return same.id;
  const s = await settings(), items = await Q.qItems.all(q.id), issue = today();
  const kind = n === 1 ? 'totale' : idx === n - 1 ? 'solde' : idx === 0 ? 'acompte' : 'situation';
  let lines;
  if (kind === 'acompte' || kind === 'situation') lines = [{ label: `${plan[idx].l} : ${pct(plan[idx].p)} du devis ${q.number}`, description: q.title || '', qty: 1, unit: 'forfait', unit_price: round2(q.total_ht * plan[idx].p / 100) }];
  else {
    lines = items.map((it) => ({ label: it.label, description: it.description, qty: it.qty, unit: it.unit, unit_price: it.unit_price }));
    const sub = items.reduce((a, it) => a + num(it.qty, 1) * num(it.unit_price), 0);
    if (num(q.discount_pct) > 0) lines.push({ label: `Remise ${pct(q.discount_pct)}`, description: '', qty: 1, unit: '', unit_price: -round2(sub - q.total_ht) });
    for (const a of prev) lines.push({ label: `Déjà facturé : ${a.number}${a.label ? ' (' + a.label + ')' : ''}`, description: '', qty: 1, unit: '', unit_price: -round2(a.total_ht) });
  }
  const t = totals(lines, q.tva_rate, 0);
  const number = await nextNumber('invoice', s.invoice_prefix, issue);
  const id = Number((await db.prepare('INSERT INTO invoices (number, quote_id, client_id, kind, title, issue_date, due_date, tva_rate, total_ht, total_tva, total_ttc, notes, token, sched_idx, label) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(number, q.id, q.client_id, kind, q.title, issue, addDays(issue, num(s.default_due_days, 15)), q.tva_rate, t.ht, t.tva, t.ttc, '', token(), idx, plan[idx].l)).lastInsertRowid);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, position, label, description, qty, unit, unit_price) VALUES (?,?,?,?,?,?,?)');
  for (let i = 0; i < lines.length; i++) { const l = lines[i]; await ins.run(id, i, l.label, l.description || '', l.qty, l.unit || '', l.unit_price); }
  if (kind === 'solde' || kind === 'totale') await db.prepare("UPDATE quotes SET status = 'facture' WHERE id = ?").run(q.id);
  else if (!['accepte', 'facture'].includes(q.status)) await db.prepare("UPDATE quotes SET status = 'accepte', accepted_at = COALESCE(accepted_at, datetime('now')) WHERE id = ?").run(q.id);
  await ensureProject(q.id); await ensureOrder(q.id);
  await log('facture', id, `${KIND[kind]} ${number} émise (${plan[idx].l})`);
  return id;
}
async function createInvoice(q, kind) {
  const n = planOf(q).length;
  return createScheduleInvoice(q, kind === 'acompte' ? 0 : kind === 'solde' ? n - 1 : kind === 'totale' ? n - 1 : 0);
}
app.post('/devis/:id/facturer', async (req, res) => {
  const q = await Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  try { const id = req.body.idx !== undefined ? await createScheduleInvoice(q, Number(req.body.idx)) : await createInvoice(q, String(req.body.kind || 'totale')); res.redirect('/factures/' + id); }
  catch (e) { res.redirect(`/devis/${q.id}?err=` + encodeURIComponent(e.message)); }
});

/* ---------------- Factures et paiements ---------------- */
app.get('/factures', async (req, res) => {
  const f = String(req.query.statut || '');
  let rows = (await withPaid(await db.prepare('SELECT i.*, c.name cname, c.company ccomp FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.id DESC').all())).map((i) => ({ ...i, st: iStatus(i, i.paid) }));
  if (f) rows = rows.filter((i) => i.st === f);
  const tabs = ['', 'impayee', 'partielle', 'retard', 'payee', 'annulee'].map((k) => `<a href="/factures${k ? '?statut=' + k : ''}" class="${f === k ? 'on' : ''}">${k ? I_STATUS[k][0] : 'Toutes'}</a>`).join('');
  const body = `<div class="tools"><nav class="tabs">${tabs}</nav><a class="btn ghost sm" href="/export/factures.csv">Exporter (CSV)</a></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Numéro</th><th>Type</th><th>Client</th><th>Échéance</th><th class="r">TTC</th><th class="r">Reste</th><th>Statut</th></tr></thead><tbody>${rows.map((i) => `<tr data-href="/factures/${i.id}"><td><a href="/factures/${i.id}"><b>${esc(i.number)}</b></a></td><td class="mut">${esc(KIND[i.kind])}</td><td>${esc(i.ccomp || i.cname || '')}</td><td>${dateFr(i.due_date)}</td><td class="r">${money(i.total_ttc)}</td><td class="r">${money(Math.max(0, i.total_ttc - i.paid))}</td><td>${badge(I_STATUS, i.st)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Les factures se créent depuis un devis accepté.</td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Factures', active: '/factures', body }));
});
app.get('/factures/:id', async (req, res) => {
  const inv = await Q.invoice.get(Number(req.params.id)); if (!inv) return res.sendStatus(404);
  const s = (await settings()), cl = await Q.client.get(inv.client_id) || {}, paid = await paidOf(inv.id), rest = round2(inv.total_ttc - paid), st = iStatus(inv, paid);
  const quote = inv.quote_id ? await Q.quote.get(inv.quote_id) : null, link = `${baseUrl(req)}/f/${inv.token}`;
  const pays = await Q.payments.all(inv.id);
  const REM = await db.prepare('SELECT * FROM reminders WHERE invoice_id = ? ORDER BY id').all(inv.id);
  const METHODS = ['Virement', 'Espèces', 'Chèque', 'Carte (CMI)', 'Versement', 'Autre'];
  const msg = rest > 0 ? `Bonjour ${cl.name || ''}, voici votre facture ${inv.number}. Reste à régler : ${money(rest)}. ${link}` : `Bonjour ${cl.name || ''}, voici votre facture ${inv.number}, réglée. Merci ! ${link}`;
  const side = `<div class="card"><div class="card-h"><h2>Paiements</h2>${badge(I_STATUS, st)}</div>
<div class="pay-sum"><div><span>Total TTC</span><b>${money(inv.total_ttc)}</b></div><div><span>Réglé</span><b>${money(paid)}</b></div><div class="${rest > 0.009 ? 'due' : 'ok'}"><span>Reste</span><b>${money(Math.max(0, rest))}</b></div></div>
${pays.length ? `<ul class="lst">${pays.map((p) => `<li><span><b>${money(p.amount)}</b><small>${dateFr(p.date)}, ${esc(p.method)}${p.reference ? ', ' + esc(p.reference) : ''}</small></span>${p.token ? `<a class="mini" href="/recu/${p.token}" target="_blank" rel="noopener">Reçu ${esc(p.number || '')}</a>` : ''}<form method="post" action="/paiements/${p.id}/supprimer" data-confirm="Supprimer ce paiement ?"><button class="x" aria-label="Supprimer">×</button></form></li>`).join('')}</ul>` : ''}
${rest > 0.009 && !inv.cancelled ? `<form method="post" action="/factures/${inv.id}/paiements" class="payf"><div class="row r2"><label>Montant<input name="amount" inputmode="decimal" value="${String(rest).replace('.', ',')}" required></label><label>Date<input type="date" name="date" value="${today()}" required></label></div><div class="row r2"><label>Mode<select name="method">${METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label><label>Référence<input name="reference" placeholder="N° de virement…"></label></div><button class="btn wide">Enregistrer le paiement</button></form>` : ''}</div>
<div class="card"><div class="card-h"><h2>Envoyer</h2></div><div class="copy"><input readonly value="${esc(link)}" id="lnk"><button type="button" class="btn ghost sm" data-copy="#lnk">Copier</button></div><div class="send"><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${digits(cl.phone)}?text=${encodeURIComponent(msg)}">WhatsApp</a><a class="btn ghost" href="mailto:${esc(cl.email || '')}?subject=${encodeURIComponent('Facture ' + inv.number)}&body=${encodeURIComponent(msg)}">E-mail</a></div></div>
${quote ? `<div class="card"><div class="card-h"><h2>Devis d’origine</h2></div><a href="/devis/${quote.id}"><b>${esc(quote.number)}</b> ${money(quote.total_ttc)} TTC</a></div>` : ''}
${rest > 0.009 && !inv.cancelled && inv.kind !== 'avoir' ? `<div class="card"><div class="card-h"><h2>Relances</h2><span>${REM.length ? REM.length + ' envoyée' + (REM.length > 1 ? 's' : '') : 'aucune'}</span></div><div class="send">${[1, 2, 3].map((lv) => { const t = lv === 1 ? `Bonjour ${cl.name || ''}, petit rappel amical : la facture ${inv.number} de ${money(rest)} arrive à échéance${inv.due_date ? ' le ' + dateFr(inv.due_date) : ''}. Vous pouvez la consulter ici : ${link}. Merci !` : lv === 2 ? `Bonjour ${cl.name || ''}, sauf erreur de notre part, la facture ${inv.number} (${money(rest)}) reste à régler${inv.due_date ? ' depuis le ' + dateFr(inv.due_date) : ''}. Pourriez-vous nous confirmer la date du paiement ? ${link}` : `Bonjour ${cl.name || ''}, malgré nos rappels, la facture ${inv.number} (${money(rest)}) n’est toujours pas réglée. Merci de procéder au paiement sous 7 jours. ${link}`; return `<a class="btn ${lv === 1 ? 'ghost' : lv === 2 ? 'ghost' : 'ghost danger'} sm" target="_blank" rel="noopener" data-mark="/factures/${inv.id}/relance/${lv}" href="https://wa.me/${digits(cl.whatsapp || cl.phone)}?text=${encodeURIComponent(t)}">${lv === 1 ? 'Rappel amical' : lv === 2 ? 'Relance' : 'Dernière relance'}</a>`; }).join('')}</div>${REM.length ? `<ul class="tl">${REM.map((r) => `<li><i></i><b>${r.level === 1 ? 'Rappel amical' : r.level === 2 ? 'Relance' : 'Dernière relance'}</b><span>${dateFr(r.created_at)}</span></li>`).join('')}</ul>` : ''}</div>` : ''}
${!inv.cancelled && inv.kind !== 'avoir' ? `<form method="post" action="/factures/${inv.id}/avoir" data-confirm="Émettre un avoir qui annule cette facture ? La facture reste numérotée, l’avoir la compense.${paid ? ' Pensez à rembourser les paiements reçus.' : ''}"><button class="btn ghost sm danger">Annuler par un avoir</button></form>` : inv.credit_of ? `<p class="mut">Avoir de la facture <a href="/factures/${inv.credit_of}">d’origine</a>.</p>` : inv.cancelled ? '<p class="mut">Facture annulée par avoir.</p>' : ''}`;
  res.send(layout({ title: `${KIND[inv.kind] || 'Facture'} ${inv.number}`, active: '/factures', flash: req.query.err ? String(req.query.err) : '', actions: `<a class="btn" href="/messagerie/ecrire?type=facture&id=${inv.id}">Message</a><button type="button" class="btn ghost" data-print>PDF</button>`, body: `<div class="docview"><div class="paper">${renderDoc({ type: 'facture', doc: inv, items: await Q.iItems.all(inv.id), client: cl, s, paid, quote })}</div><aside class="dv-side">${side}</aside></div>` }));
});

app.post('/factures/:id/relance/:lv', async (req, res) => { const id = Number(req.params.id), lv = Math.max(1, Math.min(3, Number(req.params.lv))); await db.prepare('INSERT INTO reminders (invoice_id, level, channel) VALUES (?, ?, ?)').run(id, lv, 'whatsapp'); await log('relance', id, `Relance niveau ${lv} envoyée`); res.sendStatus(204); });
/* Avoir : annule une facture sans la supprimer */
app.post('/factures/:id/avoir', async (req, res) => {
  const inv = await Q.invoice.get(Number(req.params.id)); if (!inv || inv.cancelled || inv.kind === 'avoir') return res.redirect('/factures/' + req.params.id);
  if (await isLocked(today())) return res.redirect('/factures/' + inv.id + '?err=' + encodeURIComponent(lockedMsg(today())));
  const items = await Q.iItems.all(inv.id), number = await nextNumber('credit', 'DG-AV', today());
  const id = Number((await db.prepare('INSERT INTO invoices (number, quote_id, client_id, kind, title, issue_date, due_date, tva_rate, total_ht, total_tva, total_ttc, notes, token, credit_of, label) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(number, inv.quote_id, inv.client_id, 'avoir', inv.title, today(), today(), inv.tva_rate, -inv.total_ht, -inv.total_tva, -inv.total_ttc, `Avoir sur la facture ${inv.number}`, token(), inv.id, 'Avoir ' + inv.number)).lastInsertRowid);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, position, label, description, qty, unit, unit_price) VALUES (?,?,?,?,?,?,?)');
  for (let i = 0; i < items.length; i++) { const it = items[i]; await ins.run(id, i, it.label, it.description || '', it.qty, it.unit || '', -it.unit_price); }
  await db.prepare('UPDATE invoices SET cancelled = 1 WHERE id = ?').run(inv.id);
  if (inv.quote_id && ['solde', 'totale'].includes(inv.kind)) await db.prepare("UPDATE quotes SET status = 'accepte' WHERE id = ?").run(inv.quote_id);
  await log('avoir', id, `Avoir ${number} émis sur la facture ${inv.number}`);
  res.redirect('/factures/' + id);
});
app.post('/factures/:id/paiements', async (req, res) => {
  const inv = await Q.invoice.get(Number(req.params.id)); if (!inv) return res.sendStatus(404);
  const amount = round2(num(req.body.amount));
  if (await isLocked(req.body.date || today())) return res.redirect('/factures/' + inv.id + '?err=' + encodeURIComponent(lockedMsg(req.body.date || today())));
  if (amount > 0) {
    const rn = await nextNumber('receipt', 'DG-R', req.body.date || today());
    await db.prepare('INSERT INTO payments (invoice_id, date, amount, method, reference, number, token) VALUES (?,?,?,?,?,?,?)').run(inv.id, req.body.date || today(), amount, String(req.body.method || 'Virement'), String(req.body.reference || '').slice(0, 80), rn, token());
    const S0 = await settings(); if (/esp[eè]ce/i.test(req.body.method || '') && !(CP.REGIMES[S0.fiscal_regime] || {}).ae) await db.prepare('UPDATE payments SET stamp = ? WHERE number = ?').run(round2(amount * CP.STAMP_RATE / 100), rn);
    await log('paiement', inv.id, `Paiement de ${money(amount)} reçu sur ${inv.number} (reçu ${rn})`);
  }
  res.redirect('/factures/' + inv.id);
});
app.post('/paiements/:id/supprimer', async (req, res) => { const p = await db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(req.params.id)); if (p && await isLocked(p.date)) return res.redirect('/factures/' + p.invoice_id + '?err=' + encodeURIComponent(lockedMsg(p.date))); if (p) await db.prepare('DELETE FROM payments WHERE id = ?').run(p.id); res.redirect(p ? '/factures/' + p.invoice_id : '/factures'); });
app.post('/factures/:id/annuler', async (req, res) => { await db.prepare('UPDATE invoices SET cancelled = 1 WHERE id = ?').run(Number(req.params.id)); res.redirect('/factures/' + req.params.id); });

/* ---------------- Clients ---------------- */
app.get('/clients', async (req, res) => {
  const rows = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM quotes q WHERE q.client_id = c.id) nq,
    (SELECT COALESCE(SUM(total_ttc),0) FROM invoices i WHERE i.client_id = c.id AND i.cancelled = 0) billed,
    (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.client_id = c.id AND i.cancelled = 0) paid
    FROM clients c ORDER BY COALESCE(c.company, c.name) COLLATE NOCASE`).all();
  const body = `<div class="card flush"><table class="tbl"><thead><tr><th>Client</th><th>Contact</th><th>Ville</th><th class="r">Devis</th><th class="r">Facturé</th><th class="r">Reste dû</th></tr></thead><tbody>${rows.map((c) => `<tr data-href="/clients/${c.id}"><td><a href="/clients/${c.id}"><b>${esc(c.company || c.name)}</b></a>${c.company ? `<small class="mut"> ${esc(c.name)}</small>` : ''}</td><td class="mut">${esc(c.phone || c.email || '')}</td><td>${esc(c.city || '')}</td><td class="r">${c.nq}</td><td class="r">${money(c.billed)}</td><td class="r">${money(Math.max(0, c.billed - c.paid))}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Les clients se créent en même temps qu’un devis.</td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Clients', active: '/clients', body }));
});
app.get('/clients/:id', async (req, res) => {
  const c = await Q.client.get(Number(req.params.id)); if (!c) return res.sendStatus(404);
  const qs = await db.prepare('SELECT * FROM quotes WHERE client_id = ? ORDER BY id DESC').all(c.id);
  const is = await withPaid(await db.prepare('SELECT * FROM invoices WHERE client_id = ? ORDER BY id DESC').all(c.id));
  const ps = await db.prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY id DESC').all(c.id);
  const billed = is.filter((i) => !i.cancelled).reduce((a, i) => a + i.total_ttc, 0), paid = is.filter((i) => !i.cancelled && i.kind !== 'avoir').reduce((a, i) => a + i.paid, 0);
  const acts = await db.prepare(`SELECT * FROM activity WHERE (kind IN ('devis','commande') AND ref_id IN (SELECT id FROM quotes WHERE client_id = ?)) OR (kind IN ('facture','paiement','relance','avoir') AND ref_id IN (SELECT id FROM invoices WHERE client_id = ?)) OR (kind IN ('projet','controle') AND ref_id IN (SELECT id FROM projects WHERE client_id = ?)) ORDER BY id DESC LIMIT 20`).all(c.id, c.id, c.id);
  const f = (k, l, t = 'text') => `<label>${l}<input type="${t}" name="${k}" value="${esc(c[k] || '')}"></label>`;
  const addr = [c.address, c.city, 'Maroc'].filter(Boolean).join(', '), city = findCity(c.city);
  const map = c.address || c.city ? `<div class="c-map"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(addr)}&z=${c.address ? 15 : 12}&output=embed" title="Adresse du client"></iframe><a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}">Ouvrir dans Google Maps</a></div>` : '<p class="empty">Ajoutez l’adresse pour voir le client sur la carte.</p>';
  const head = `<section class="c360"><div class="c360-id"><span class="c360-av">${esc((c.company || c.name || '?').trim().slice(0, 2).toUpperCase())}</span><div><h2>${esc(c.company || c.name)}</h2><p>${esc([c.company ? c.name : '', c.sector, c.city].filter(Boolean).join(' · '))}</p><div class="c360-a"><a class="btn sm" href="/messagerie/ecrire?type=client&id=${c.id}">Message</a>${c.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${digits(c.whatsapp || c.phone)}">WhatsApp</a><a class="btn ghost sm" href="tel:${esc(c.phone)}">Appeler</a>` : ''}${c.email ? `<a class="btn ghost sm" href="mailto:${esc(c.email)}">E-mail</a>` : ''}<a class="btn sm" href="/assistant">Nouveau projet</a></div></div></div>
<div class="c360-k"><div><b>${ps.length}</b><span>projet${ps.length > 1 ? 's' : ''}</span></div><div><b>${money(billed)}</b><span>facturé</span></div><div><b>${money(paid)}</b><span>encaissé</span></div><div class="${billed - paid > 0.009 ? 'due' : ''}"><b>${money(Math.max(0, billed - paid))}</b><span>reste dû</span></div></div></section>`;
  const body = head + `<div class="grid2"><div><form method="post" class="card"><div class="card-h"><h2>Coordonnées</h2>${c.source ? `<span>Venu par : ${esc(c.source)}</span>` : ''}</div><div class="row">${f('name', 'Nom et prénom')}${f('company', 'Entreprise')}</div><div class="row">${f('phone', 'Téléphone')}${f('email', 'E-mail', 'email')}</div><div class="row">${f('address', 'Adresse')}${f('city', 'Ville')}</div><div class="row">${f('ice', 'ICE (15 chiffres)')}${f('if_num', 'Identifiant fiscal (IF)')}${f('website', 'Site actuel')}</div><label>Notes<textarea name="notes" rows="3">${esc(c.notes || '')}</textarea></label><button class="btn">Enregistrer</button></form>
<div class="card"><div class="card-h"><h2>Sur la carte</h2>${city ? `<span>${esc(city)} est allumée sur votre carte</span>` : ''}</div>${map}</div></div>
<div><div class="card"><div class="card-h"><h2>Projets et sites</h2></div>${ps.length ? `<ul class="lst">${ps.map((p) => { const t = ptech(p); return `<li><a href="/projets/${p.id}"><b>${esc(p.title || '')}</b><span>${t.live_url ? esc(t.live_url.replace(/^https?:\/\//, '')) : 'pas encore en ligne'}${t.github ? ' · GitHub' : ''}${t.vercel ? ' · Vercel' : ''}</span></a>${badge(P_STATUS, p.status)}</li>`; }).join('')}</ul>` : '<p class="empty">Aucun projet.</p>'}</div>
<div class="card"><div class="card-h"><h2>Devis</h2><a href="/devis/nouveau?client=${c.id}">Nouveau devis</a></div>${qs.length ? `<ul class="lst">${qs.map((q) => `<li><a href="/devis/${q.id}"><b>${esc(q.number)}</b><span>${esc(q.title || '')}</span></a><em>${money(q.total_ttc)}</em>${badge(Q_STATUS, qStatus(q))}</li>`).join('')}</ul>` : '<p class="empty">Aucun devis.</p>'}</div>
<div class="card"><div class="card-h"><h2>Factures et avoirs</h2></div>${is.length ? `<ul class="lst">${is.map((i) => `<li><a href="/factures/${i.id}"><b>${esc(i.number)}</b><span>${esc(KIND[i.kind])}</span></a><em>${money(i.total_ttc)}</em>${badge(I_STATUS, iStatus(i))}</li>`).join('')}</ul>` : '<p class="empty">Aucune facture.</p>'}</div>
<div class="card"><div class="card-h"><h2>Historique</h2></div>${acts.length ? `<ul class="tl">${acts.map((a) => `<li><i></i><b>${esc(a.text)}</b><span>${dateFr(a.created_at)}</span></li>`).join('')}</ul>` : '<p class="empty">L’historique se remplit au fil des devis, factures et paiements.</p>'}</div></div></div>`;
  res.send(layout({ title: c.company || c.name, active: '/clients', body, flash: req.query.ok ? 'Client enregistré.' : '' }));
});
app.post('/clients/:id', async (req, res) => {
  const b = req.body, id = Number(req.params.id);
  await db.prepare('UPDATE clients SET name=?, company=?, phone=?, email=?, address=?, city=?, ice=?, notes=?, website=?, if_num=? WHERE id=?').run(...['name', 'company', 'phone', 'email', 'address', 'city', 'ice', 'notes', 'website', 'if_num'].map((k) => String(b[k] || '').trim()), id);
  res.redirect(`/clients/${id}?ok=1`);
});

/* ---------------- Demandes du site ---------------- */
/* ---------------- Demandes : site, téléphone, WhatsApp… un seul pipeline, de la prise de contact au projet ---------------- */
const LSTAGES = [['nouveau', 'Nouvelles', 'blue'], ['contacte', 'Contactées', 'violet'], ['proposition', 'Devis envoyé', 'amber'], ['gagne', 'Gagnées', 'green'], ['perdu', 'Perdues', 'grey']];
const LSOURCES = ['Téléphone', 'Site web', 'WhatsApp', 'Recommandation', 'Instagram ou Facebook', 'Google', 'Passage ou rencontre', 'Client existant', 'Autre'];
const LOST = ['Budget trop serré', 'Délai', 'A choisi un concurrent', 'Pas de réponse', 'Projet reporté', 'Pas sérieux', 'Devis refusé', 'Autre'];
const LKINDS = [['vitrine', 'Site vitrine'], ['ecommerce', 'Boutique en ligne'], ['landing', 'Landing page'], ['application', 'Application'], ['refonte', 'Refonte d’un site'], ['google', 'Fiche Google / SEO'], ['autre', 'Autre']];
const srcOf = (l) => (/site|démarrer|contact/i.test(l.source || '') ? 'Site web' : l.source || 'Autre');
const NOTE_K = { appel: 'Appel', whatsapp: 'WhatsApp', rdv: 'Rendez-vous', note: 'Note', etape: 'Étape' };
const leadStage = async (id, stage, extra = '') => { await db.prepare("UPDATE leads SET stage = ?, status = CASE WHEN ? = 'nouveau' THEN 'nouveau' ELSE 'traitee' END, updated_at = datetime('now') WHERE id = ?").run(stage, stage, id); await db.prepare('INSERT INTO lead_notes (lead_id, kind, text) VALUES (?, ?, ?)').run(id, 'etape', `Passée en « ${(LSTAGES.find((x) => x[0] === stage) || [0, stage])[1]} »${extra ? ' : ' + extra : ''}`); };
const leadForm = (l = {}, action = '/demandes', submit = 'Enregistrer') => `<form method="post" action="${action}" class="lead-f"><div class="row"><label>Nom et prénom<input name="name" value="${esc(l.name || '')}" required autofocus></label><label>Entreprise<input name="company" value="${esc(l.company || '')}"></label></div>
<div class="row"><label>Téléphone<input name="phone" value="${esc(l.phone || '')}" inputmode="tel"></label><label>E-mail<input name="email" type="email" value="${esc(l.email || '')}"></label><label>Ville<input name="city" value="${esc(l.city || '')}"></label></div>
<div class="row"><label>Besoin<select name="kind">${LKINDS.map(([k, t]) => `<option value="${k}"${l.kind === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label><label>Secteur<select name="sector"><option value="">—</option>${assistant.SECTORS.map((x) => `<option${l.sector === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label><label>Source<select name="source">${LSOURCES.map((x) => `<option${(l.id ? srcOf(l) === x : x === 'Téléphone') ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div>
<div class="row"><label>Budget annoncé<input name="budget" value="${esc(l.budget || '')}" placeholder="Ex. : 10 000 DH"></label><label>À rappeler le<input type="date" name="next_at" value="${esc(l.next_at || '')}"></label></div>
<label>Ce qu’il veut, en quelques mots<textarea name="need" rows="2" placeholder="Ex. : refaire le site de sa clinique, avec rendez-vous en ligne">${esc(l.need || '')}</textarea></label>
<div class="lead-btns"><button class="btn" name="then" value="voir">${submit}</button>${l.id ? '' : '<button class="btn ghost" name="then" value="assistant">Enregistrer et préparer le projet</button>'}</div></form>`;
app.get('/demandes', async (req, res) => {
  const vue = req.query.vue === 'liste' ? 'liste' : 'pipeline', m = today().slice(0, 7);
  const rows = await db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 500').all();
  const st = (k) => rows.filter((l) => (l.stage || 'nouveau') === k);
  const monthRows = rows.filter((l) => (l.created_at || '').startsWith(m)), won = rows.filter((l) => l.stage === 'gagne').length, closed = rows.filter((l) => ['gagne', 'perdu'].includes(l.stage)).length;
  const bySrc = {}; rows.forEach((l) => { const k = srcOf(l); bySrc[k] = bySrc[k] || [0, 0]; bySrc[k][0]++; if (l.stage === 'gagne') bySrc[k][1]++; });
  const card = (l) => { const late = l.next_at && l.next_at <= today() && !['gagne', 'perdu'].includes(l.stage); return `<a class="ld ${late ? 'late' : ''}" href="/demandes/${l.id}"><b>${esc(l.company || l.name || 'Sans nom')}</b><span>${esc(l.need || l.message || '').slice(0, 70)}</span><div class="ld-m"><em class="src">${esc(srcOf(l))}</em>${l.city ? `<em>${esc(l.city)}</em>` : ''}${late ? '<em class="cb">À rappeler</em>' : l.next_at && !['gagne', 'perdu'].includes(l.stage) ? `<em>Rappel ${dateFr(l.next_at)}</em>` : ''}${l.stage === 'perdu' && l.lost_reason ? `<em>${esc(l.lost_reason)}</em>` : ''}</div><small>${dateFr(l.created_at)}</small></a>`; };
  const pipe = `<div class="pipe">${LSTAGES.map(([k, t, c]) => `<section class="kb-col"><header><span class="bdg bdg-${c}">${t}</span><span>${st(k).length}</span></header>${st(k).slice(0, 40).map(card).join('') || '<p class="empty">—</p>'}</section>`).join('')}</div>`;
  const list = `<div class="card flush"><table class="tbl"><thead><tr><th>Reçue</th><th>Contact</th><th>Besoin</th><th>Source</th><th>Étape</th><th>Rappel</th></tr></thead><tbody>${rows.map((l) => `<tr data-href="/demandes/${l.id}"><td>${dateFr(l.created_at)}</td><td><b>${esc(l.company || l.name || '')}</b><small class="mut"> ${esc(l.phone || '')}</small></td><td class="mut">${esc((l.need || l.message || '').slice(0, 80))}</td><td>${esc(srcOf(l))}</td><td>${(() => { const x = LSTAGES.find((y) => y[0] === (l.stage || 'nouveau')); return `<span class="bdg bdg-${x[2]}">${x[1]}</span>`; })()}</td><td>${l.next_at ? dateFr(l.next_at) : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucune demande.</td></tr>'}</tbody></table></div>`;
  const stats = `<section class="lead-k"><div><b>${st('nouveau').length}</b><span>à traiter</span></div><div><b>${rows.filter((l) => l.next_at && l.next_at <= today() && !['gagne', 'perdu'].includes(l.stage)).length}</b><span>à rappeler aujourd’hui</span></div><div><b>${monthRows.length}</b><span>reçues ce mois</span></div><div><b>${closed ? Math.round(100 * won / closed) : 0} %</b><span>transformées en projets</span></div><div class="srcs">${Object.entries(bySrc).sort((a, b) => b[1][0] - a[1][0]).slice(0, 4).map(([k, [n, w]]) => `<span>${esc(k)} <b>${n}</b>${w ? ` · ${w} gagnée${w > 1 ? 's' : ''}` : ''}</span>`).join('')}</div></section>`;
  const body = `${stats}<details class="card quick" ${req.query.nouvelle ? 'open' : ''}><summary><b>+ Nouvelle demande</b><span>reçue par téléphone, WhatsApp, en rendez-vous…</span></summary>${leadForm()}</details>
<div class="tools"><nav class="tabs"><a href="/demandes" class="${vue === 'pipeline' ? 'on' : ''}">Pipeline</a><a href="/demandes?vue=liste" class="${vue === 'liste' ? 'on' : ''}">Liste</a></nav></div>${vue === 'pipeline' ? pipe : list}`;
  res.send(layout({ title: 'Demandes', active: '/demandes', body, actions: '<a class="btn" href="/demandes?nouvelle=1">+ Demande par téléphone</a>' }));
});
const leadVals = (b) => ['name', 'company', 'phone', 'email', 'city', 'kind', 'sector', 'source', 'budget', 'next_at', 'need'].map((k) => String(b[k] || '').trim().slice(0, k === 'need' ? 2000 : 160));
app.post('/demandes', async (req, res) => {
  const v = leadVals(req.body);
  const id = (await db.prepare("INSERT INTO leads (name, company, phone, email, city, kind, sector, source, budget, next_at, need, stage, status, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'nouveau', 'nouveau', datetime('now'))").run(...v.slice(0, 9), v[9] || null, v[10])).lastInsertRowid;
  await db.prepare('INSERT INTO lead_notes (lead_id, kind, text) VALUES (?, ?, ?)').run(id, 'note', `Demande reçue (${v[7] || 'Téléphone'})`);
  res.redirect(req.body.then === 'assistant' ? `/assistant?demande=${id}` : `/demandes/${id}`);
});
app.get('/demandes/:id', async (req, res) => {
  const l = await db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.params.id)); if (!l) return res.sendStatus(404);
  const notes = await db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY id DESC').all(l.id);
  const q = l.quote_id ? await Q.quote.get(l.quote_id) : null, stage = l.stage || 'nouveau', x = LSTAGES.find((y) => y[0] === stage);
  const ph = digits(l.phone), wa = `https://wa.me/${ph}?text=${encodeURIComponent(`Bonjour ${l.name || ''}, ici Khalid de Digilago. Merci pour votre demande${l.need ? ' concernant ' + l.need.slice(0, 60) : ''}. Quand pouvons-nous en parler ?`)}`;
  const head = `<section class="c360"><div class="c360-id"><span class="c360-av">${esc((l.company || l.name || '?').trim().slice(0, 2).toUpperCase())}</span><div><h2>${esc(l.company || l.name || 'Demande')}</h2><p>${esc([l.company ? l.name : '', srcOf(l), l.city, 'reçue le ' + dateFr(l.created_at)].filter(Boolean).join(' · '))}</p><div class="c360-a"><a class="btn sm" href="/messagerie/ecrire?type=demande&id=${l.id}">Message</a>${l.phone ? `<a class="btn ghost sm" href="tel:${esc(l.phone)}">Appeler</a><a class="btn wa sm" target="_blank" rel="noopener" href="${wa}">WhatsApp</a>` : ''}${l.email ? `<a class="btn ghost sm" href="mailto:${esc(l.email)}">E-mail</a>` : ''}</div></div></div>
<div class="lead-act">${badge({ [stage]: [x[1], x[2]] }, stage)}${q ? `<a class="btn sm" href="/devis/${q.id}">Voir le devis ${esc(q.number)}</a>` : ''}${['nouveau', 'contacte'].includes(stage) ? `<a class="btn" href="/assistant?demande=${l.id}">Accepter et préparer le projet</a>` : ''}</div></section>`;
  const actions = `<div class="card"><div class="card-h"><h2>Décision</h2></div><div class="send">${stage === 'nouveau' ? `<form method="post" action="/demandes/${l.id}/etape" class="inl"><button class="btn ghost sm" name="stage" value="contacte">Marquer contactée</button></form>` : ''}${!['gagne', 'perdu'].includes(stage) ? `<a class="btn sm" href="/assistant?demande=${l.id}">Accepter : préparer le projet</a>` : ''}${stage !== 'nouveau' && !['gagne'].includes(stage) ? `<form method="post" action="/demandes/${l.id}/etape" class="inl"><button class="btn ghost sm" name="stage" value="nouveau">Remettre à traiter</button></form>` : ''}</div>
${stage !== 'perdu' && stage !== 'gagne' ? `<form method="post" action="/demandes/${l.id}/etape" class="lost"><input type="hidden" name="stage" value="perdu"><label>Refuser ou classer perdue<select name="reason">${LOST.map((r) => `<option>${r}</option>`).join('')}</select></label><button class="btn ghost sm danger">Classer perdue</button></form>` : ''}</div>`;
  const journal = `<div class="card"><div class="card-h"><h2>Suivi des échanges</h2></div><form method="post" action="/demandes/${l.id}/note" class="note-f"><select name="kind">${Object.entries(NOTE_K).filter(([k]) => k !== 'etape').map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select><input name="text" placeholder="Ex. : appelé, il veut un devis avant vendredi" required><input type="date" name="next_at" title="À rappeler le"><button class="btn sm">Ajouter</button></form>
${notes.length ? `<ul class="tl">${notes.map((n) => `<li><i class="k-${n.kind}"></i><b>${esc(NOTE_K[n.kind] || 'Note')} : ${esc(n.text)}</b><span>${dateFr(n.created_at)}</span></li>`).join('')}</ul>` : ''}${l.message ? `<p class="lead-msg"><b>Message reçu :</b><br>${esc(l.message).replace(/\n/g, '<br>')}</p>` : ''}</div>`;
  res.send(layout({ title: l.company || l.name || 'Demande', active: '/demandes', flash: req.query.ok ? 'Demande enregistrée.' : '', body: head + `<div class="grid2"><div class="card"><div class="card-h"><h2>Informations</h2></div>${leadForm(l, `/demandes/${l.id}`, 'Enregistrer')}</div><div>${actions}${journal}</div></div>` }));
});
app.post('/demandes/:id', async (req, res) => {
  const v = leadVals(req.body);
  await db.prepare("UPDATE leads SET name=?, company=?, phone=?, email=?, city=?, kind=?, sector=?, source=?, budget=?, next_at=?, need=?, updated_at=datetime('now') WHERE id=?").run(...v.slice(0, 9), v[9] || null, v[10], Number(req.params.id));
  res.redirect(`/demandes/${req.params.id}?ok=1`);
});
app.post('/demandes/:id/note', async (req, res) => {
  const id = Number(req.params.id), k = NOTE_K[req.body.kind] ? req.body.kind : 'note';
  await db.prepare('INSERT INTO lead_notes (lead_id, kind, text) VALUES (?, ?, ?)').run(id, k, String(req.body.text || '').slice(0, 1000));
  if (req.body.next_at) await db.prepare('UPDATE leads SET next_at = ? WHERE id = ?').run(req.body.next_at, id);
  const l = await db.prepare('SELECT stage FROM leads WHERE id = ?').get(id);
  if (l && (l.stage || 'nouveau') === 'nouveau' && ['appel', 'whatsapp', 'rdv'].includes(k)) await leadStage(id, 'contacte');
  res.redirect(`/demandes/${id}`);
});
app.post('/demandes/:id/etape', async (req, res) => {
  const id = Number(req.params.id), st = String(req.body.stage || '');
  if (!LSTAGES.some((x) => x[0] === st)) return res.redirect(`/demandes/${id}`);
  await leadStage(id, st, st === 'perdu' ? String(req.body.reason || '') : '');
  if (st === 'perdu') await db.prepare('UPDATE leads SET lost_reason = ? WHERE id = ?').run(String(req.body.reason || 'Autre'), id);
  res.redirect(`/demandes/${id}`);
});
app.post('/demandes/:id/traitee', async (req, res) => { await leadStage(Number(req.params.id), 'contacte'); res.redirect('/demandes'); });

/* ---------------- Prestations (catalogue) ---------------- */
app.get('/prestations', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM services ORDER BY sort, id').all();
  const r = (x, i) => `<tr><td><input name="s[${i}][name]" value="${esc(x.name || '')}" placeholder="Nouvelle prestation"><input type="hidden" name="s[${i}][id]" value="${x.id || ''}"></td><td><input name="s[${i}][description]" value="${esc(x.description || '')}"></td><td><input name="s[${i}][unit]" value="${esc(x.unit || 'forfait')}" class="it-u"></td><td><input name="s[${i}][unit_price]" value="${x.unit_price ? String(x.unit_price).replace('.', ',') : ''}" inputmode="decimal" class="it-p" placeholder="0,00"></td><td class="c"><input type="checkbox" name="s[${i}][active]" value="1"${x.active === 0 ? '' : ' checked'}></td></tr>`;
  const body = `<p class="hint">Vos prestations et vos prix habituels. Ils se remplissent tout seuls dans les devis, et restent modifiables ligne par ligne.</p><form method="post" class="card flush"><table class="tbl edit"><thead><tr><th>Prestation</th><th>Description</th><th>Unité</th><th>Prix HT</th><th class="c">Active</th></tr></thead><tbody>${rows.map(r).join('')}${r({}, rows.length)}${r({}, rows.length + 1)}</tbody></table><div class="pad"><button class="btn">Enregistrer le catalogue</button></div></form>`;
  res.send(layout({ title: 'Prestations', active: '/prestations', body, flash: req.query.ok ? 'Catalogue enregistré.' : '' }));
});
app.post('/prestations', async (req, res) => {
  const list = req.body.s ? Object.values(req.body.s) : [];
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    const name = String(x.name || '').trim(), active = x.active ? 1 : 0, f = [name, String(x.description || ''), String(x.unit || 'forfait'), round2(num(x.unit_price)), active, i];
    if (x.id) { if (name) await db.prepare('UPDATE services SET name=?, description=?, unit=?, unit_price=?, active=?, sort=? WHERE id=?').run(...f, Number(x.id)); else await db.prepare('DELETE FROM services WHERE id = ?').run(Number(x.id)); }
    else if (name) await db.prepare('INSERT INTO services (name, description, unit, unit_price, active, sort) VALUES (?,?,?,?,?,?)').run(...f);
  }
  res.redirect('/prestations?ok=1');
});

/* ---------------- Paramètres ---------------- */
app.get('/parametres', async (req, res) => {
  const s = (await settings());
  const f = (k, l, ph = '') => `<label>${l}<input name="${k}" value="${esc(s[k])}" placeholder="${esc(ph)}"></label>`;
  const body = `<form method="post" class="settings">
<section class="card"><div class="card-h"><h2>Votre entreprise</h2><span>Apparaît sur tous les devis et factures</span></div><div class="row">${f('company_name', 'Nom')}${f('company_tagline', 'Activité')}</div><div class="row">${f('company_address', 'Adresse')}${f('company_site', 'Site web')}</div><div class="row">${f('company_phone', 'Téléphone')}${f('company_email', 'E-mail')}</div><div class="row">${f('whatsapp', 'WhatsApp (format international, sans +)', '2126…')}${f('public_url', 'Adresse de cet espace en ligne', 'https://gestion.digilago.ma')}</div></section>
<section class="card"><div class="card-h"><h2>Canaux de communication</h2><span>Vos deux WhatsApp et vos deux e-mails, réunis dans la Messagerie</span></div>
${['wa1', 'wa2'].map((c) => `<div class="chan"><b>${c === 'wa1' ? 'WhatsApp 1' : 'WhatsApp 2'}</b><div class="row">${f(c + '_label', 'Nom affiché', 'WhatsApp Business')}${f(c + '_number', 'Numéro (format international)', '2126…')}</div><div class="row">${f(c + '_phone_id', 'Phone number ID (API Meta, facultatif)', 'Pour envoyer et recevoir automatiquement')}<label>Jeton d’accès (API Meta)<input type="password" name="${c}_token" placeholder="${s[c + '_token'] ? '••••••• enregistré' : 'Facultatif'}" autocomplete="off"></label></div></div>`).join('')}
${['mail1', 'mail2'].map((c) => `<div class="chan"><b>${c === 'mail1' ? 'E-mail 1' : 'E-mail 2'}</b><div class="row">${f(c + '_label', 'Nom affiché', 'contact@digilago.ma')}${f(c + '_address', 'Adresse e-mail', 'contact@digilago.ma')}</div><div class="row r4">${f(c + '_smtp_host', 'Serveur d’envoi (SMTP)', 'smtp.gmail.com')}${f(c + '_smtp_port', 'Port SMTP', '465')}${f(c + '_imap_host', 'Serveur de réception (IMAP)', 'imap.gmail.com')}${f(c + '_imap_port', 'Port IMAP', '993')}</div><div class="row">${f(c + '_user', 'Identifiant (souvent l’adresse)', '')}<label>Mot de passe (ou mot de passe d’application)<input type="password" name="${c}_pass" placeholder="${s[c + '_pass'] ? '••••••• enregistré' : ''}" autocomplete="new-password"></label></div></div>`).join('')}
<div class="row">${f('signature', 'Signature des messages', 'Khalid, Digilago')}${f('google_review_url', 'Lien pour laisser un avis Google', 'https://g.page/r/…/review')}${f('wa_verify_token', 'Jeton de vérification du webhook WhatsApp', 'une phrase secrète')}</div>
<p class="hint">Sans l’API Meta, WhatsApp fonctionne en « mode lien » : le message prêt s’ouvre dans votre application, et il est gardé dans l’historique. Adresse du webhook à donner à Meta : <code>${esc(baseUrl(req))}/webhooks/whatsapp</code></p></section>
<section class="card"><div class="card-h"><h2>Mentions légales</h2><span>Obligatoires sur les factures au Maroc</span></div><div class="row">${f('company_legal', 'Forme juridique et capital', 'SARL au capital de …')}${f('company_ice', 'ICE')}</div><div class="row">${f('company_if', 'Identifiant fiscal (IF)')}${f('company_rc', 'Registre du commerce (RC)')}</div><div class="row">${f('company_patente', 'Patente')}${f('company_cnss', 'CNSS')}</div></section>
<section class="card"><div class="card-h"><h2>Banque</h2></div><div class="row">${f('bank_name', 'Banque')}${f('bank_rib', 'RIB (24 chiffres)')}</div><div class="row">${f('bank_swift', 'SWIFT (facultatif)')}</div></section>
<section class="card"><div class="card-h"><h2>Valeurs par défaut</h2></div><div class="row r4">${f('default_tva', 'TVA (%)')}${f('default_deposit', 'Acompte (%)')}${f('default_validity', 'Validité des devis (jours)')}${f('default_due_days', 'Échéance des factures (jours)')}</div><div class="row">${f('default_delay', 'Délai affiché')}${f('quote_prefix', 'Préfixe des devis')}${f('invoice_prefix', 'Préfixe des factures')}</div><label>Conditions par défaut<textarea name="default_conditions" rows="4">${esc(s.default_conditions)}</textarea></label></section>
<button class="btn">Enregistrer les paramètres</button></form>
<form method="post" action="/parametres/mot-de-passe" class="card"><div class="card-h"><h2>Mot de passe</h2></div><div class="row"><label>Nouveau mot de passe<input type="password" name="pw" minlength="8" required></label><label>Confirmer<input type="password" name="pw2" minlength="8" required></label></div><button class="btn ghost">Changer le mot de passe</button></form>
<div class="card"><div class="card-h"><h2>Sauvegarde et export</h2></div><div class="send"><a class="btn ghost" href="/sauvegarde">Télécharger la sauvegarde complète</a><a class="btn ghost" href="/export/factures.csv">Factures (CSV)</a><a class="btn ghost" href="/export/paiements.csv">Paiements (CSV)</a></div></div>`;
  const flash = req.query.bienvenue ? 'Bienvenue ! Complétez vos informations : elles apparaîtront sur vos devis et factures.' : req.query.ok ? 'Paramètres enregistrés.' : req.query.pw ? 'Mot de passe changé.' : '';
  res.send(layout({ title: 'Paramètres', active: '/parametres', body, flash }));
});
app.post('/parametres', async (req, res) => { for (const k of ['wa1_token', 'wa2_token', 'mail1_pass', 'mail2_pass']) if (!req.body[k]) delete req.body[k]; await saveSettings(req.body); PUBLIC_URL = String(req.body.public_url || ''); res.redirect('/parametres?ok=1'); });
app.post('/parametres/mot-de-passe', async (req, res) => { const { pw = '', pw2 = '' } = req.body; if (pw.length >= 8 && pw === pw2) await setS('_pw', hashPw(pw)); res.redirect('/parametres?pw=1'); });


/* ---------------- Projets : du devis accepté à la mise en ligne ---------------- */
const steps = (p) => { try { return JSON.parse(p.steps || '[]'); } catch (e) { return []; } };
app.get('/projets', async (req, res) => {
  const rows = await db.prepare('SELECT p.*, c.name cname, c.company ccomp FROM projects p LEFT JOIN clients c ON c.id = p.client_id ORDER BY COALESCE(p.due_date, p.created_at)').all();
  const CLM = await clientMap();
  const col = (k) => { const list = rows.filter((p) => p.status === k); return `<section class="kb-col"><header>${badge(P_STATUS, k)}<span>${list.length}</span></header>${list.map((p) => { const st = steps(p), d = st.filter((x) => x.d).length, late = k !== 'livre' && p.due_date && p.due_date < today(); const HL = health(p, CLM[p.client_id]); return `<a class="kb-card hl-${HL.lvl}" href="/projets/${p.id}" title="${esc(HL.why.join(', ') || 'Tout va bien')}"><b><i class="hl-dot"></i>${esc(p.ccomp || p.cname || '')}</b><span>${esc(p.title || '')}</span><div class="prog"><i style="width:${st.length ? Math.round(100 * d / st.length) : 0}%"></i></div><small class="${late ? 'red' : ''}">${d}/${st.length} étapes${p.due_date ? ' · livraison ' + dateFr(p.due_date) : ''}</small>${(() => { const c = completeness(p, CLM[p.client_id]); return `<em class="kb-inf ${c.pct === 100 ? 'ok' : ''}">Infos ${c.pct} %</em>`; })()}</a>`; }).join('') || '<p class="empty">Aucun projet.</p>'}</section>`; };
  res.send(layout({ title: 'Projets', active: '/projets', body: `<p class="hint">Chaque devis accepté ouvre un projet. Suivez chaque étape jusqu’à la mise en ligne.</p><div class="kanban">${['proposition', 'a_demarrer', 'en_cours', 'validation', 'livre'].map(col).join('')}</div>` }));
});
app.get('/projets/:id', async (req, res) => {
  const p = await db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const cl = await Q.client.get(p.client_id) || {}, q = p.quote_id ? await Q.quote.get(p.quote_id) : null, st = steps(p);
  const invs = q ? await withPaid(await Q.quoteInvoices.all(q.id)) : [];
  if (!p.token) { p.token = token(); await db.prepare('UPDATE projects SET token = ? WHERE id = ?').run(p.token, p.id); }
  const inf = pinfo(p), cp = completeness(p, cl), blink = `${baseUrl(req)}/brief/${p.token}`;
  const bmsg = `Bonjour ${cl.name || ''}, pour avancer sur votre site, pouvez-vous compléter ces informations (2 minutes) ? ${blink}`;
  const infoCard = `<form method="post" action="/projets/${p.id}/infos" class="card"><div class="card-h"><h2>Informations à réunir</h2><span class="pc ${cp.pct === 100 ? 'ok' : ''}">${cp.pct} %</span></div><div class="prog big"><i style="width:${cp.pct}%"></i></div>
${cp.missing.length ? `<p class="miss"><b>Il manque :</b> ${cp.missing.map(esc).join(', ')}.</p>` : '<p class="miss ok">Tout est réuni. Vous avez tout pour livrer.</p>'}
<div class="brief-l"><span>Le client peut tout remplir lui-même :</span><div class="copy"><input readonly value="${esc(blink)}" id="blnk"><button type="button" class="btn ghost sm" data-copy="#blnk">Copier</button>${cl.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${digits(cl.whatsapp || cl.phone)}?text=${encodeURIComponent(bmsg)}">Envoyer</a>` : ''}</div></div>
<details class="inf"><summary>Compléter moi-même</summary><div class="row">${CLIENT_FIELDS.slice(0, 2).map(([k, l]) => `<label>${l}<input name="c_${k}" value="${esc(cl[k] || '')}"></label>`).join('')}</div><div class="row">${CLIENT_FIELDS.slice(2, 4).map(([k, l]) => `<label>${l}<input name="c_${k}" value="${esc(cl[k] || '')}"></label>`).join('')}</div><div class="row">${CLIENT_FIELDS.slice(4).map(([k, l]) => `<label>${l}<input name="c_${k}" value="${esc(cl[k] || '')}"></label>`).join('')}</div>${INFO_FIELDS.map(([k, l]) => `<label>${l}<input name="i_${k}" value="${esc(inf[k] || '')}"></label>`).join('')}<button class="btn sm">Enregistrer les informations</button></details></form>`;
  const T = ptech(p), LC = plaunch(p), H = health(p, cl, invs.filter((i) => iStatus(i) === 'retard').length), lcDone = LAUNCH.filter((x, i) => LC[i]).length;
  const link = (v) => (v && /^https?:\/\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, '').slice(0, 42))}</a>` : esc(v || ''));
  const techCard = `<div class="grid2"><form method="post" action="/projets/${p.id}/tech" class="card"><div class="card-h"><h2>Présence en ligne</h2><span class="hl-${H.lvl}">${H.lvl === 'ok' ? 'Tout va bien' : H.why.map(esc).join(' · ')}</span></div>
<div class="tech-live">${T.live_url ? `<div><b>${link(T.live_url)}</b><small>${T.check_at ? `Contrôlé le ${esc(T.check_at)} · ${T.http_status ? 'réponse ' + T.http_status + (T.ms ? ' en ' + T.ms + ' ms' : '') : 'injoignable'}${T.ssl_valid_to ? ' · SSL ' + (Number(T.ssl_ok) ? 'valide' : 'à vérifier') + ' jusqu’au ' + dateFr(T.ssl_valid_to) : ''}` : 'Pas encore contrôlé'}</small></div><button class="btn ghost sm" formaction="/projets/${p.id}/verifier">Vérifier maintenant</button>` : '<small>Ajoutez l’adresse du site en ligne pour le surveiller (réponse, vitesse, certificat SSL).</small>'}</div>
<div class="tech-grid">${TECH_FIELDS.map(([k, l, ph]) => `<label>${l}<input name="t_${k}" ${ph === 'date' ? 'type="date"' : `placeholder="${esc(ph)}"`} value="${esc(T[k] || '')}"></label>`).join('')}</div>
${T.old_site || T.registrar || T.pages ? `<p class="mut">Avant le projet : ${[T.old_site ? 'ancien site ' + link(T.old_site) + (T.old_tech ? ' (' + esc(T.old_tech) + ')' : '') : '', T.old_keep ? 'à garder : ' + esc(T.old_keep) : '', T.pages ? T.pages + ' pages' : '', T.langs ? 'langues : ' + esc(T.langs) : '', T.budget ? 'budget annoncé : ' + esc(T.budget) : ''].filter(Boolean).join(' · ')}</p>` : ''}
<button class="btn sm">Enregistrer</button></form>
<form method="post" action="/projets/${p.id}/lancement" class="card"><div class="card-h"><h2>Mise en ligne</h2><span class="pc ${lcDone === LAUNCH.length ? 'ok' : ''}">${lcDone}/${LAUNCH.length}</span></div><div class="prog big"><i style="width:${Math.round(100 * lcDone / LAUNCH.length)}%"></i></div>
<ul class="steps lc">${LAUNCH.map((x, i) => `<li><label class="chk"><input type="checkbox" name="l${i}" value="1"${LC[i] ? ' checked' : ''}> ${esc(x)}</label></li>`).join('')}</ul><button class="btn sm">Enregistrer</button></form></div>`;
  const body = infoCard + techCard + `<div class="grid2"><form method="post" class="card"><div class="card-h"><h2>Avancement</h2>${badge(P_STATUS, p.status)}</div>
<ul class="steps">${st.map((x, i) => `<li><label class="chk"><input type="checkbox" name="d${i}" value="1"${x.d ? ' checked' : ''}> ${esc(x.t)}</label></li>`).join('')}</ul>
<div class="row"><label>Statut<select name="status">${Object.keys(P_STATUS).map((k) => `<option value="${k}"${p.status === k ? ' selected' : ''}>${P_STATUS[k][0]}</option>`).join('')}</select></label><label>Livraison prévue<input type="date" name="due_date" value="${esc(p.due_date || '')}"></label></div>
<label>Adresse du site livré<input name="site_url" value="${esc(p.site_url || '')}" placeholder="https://…"></label><label>Notes internes<textarea name="notes" rows="4">${esc(p.notes || '')}</textarea></label><button class="btn">Enregistrer</button></form>
<div><div class="card"><div class="card-h"><h2>Client</h2></div><a href="/clients/${cl.id}"><b>${esc(cl.company || cl.name || '')}</b></a><p class="mut">${esc([cl.name, cl.phone, cl.email].filter(Boolean).join(' · '))}</p>${cl.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${digits(cl.phone)}">WhatsApp</a>` : ''}</div>
${q ? `<div class="card"><div class="card-h"><h2>Devis et factures</h2></div><ul class="lst"><li><a href="/devis/${q.id}"><b>${esc(q.number)}</b><span>Devis</span></a><em>${money(q.total_ttc)}</em></li>${invs.map((i) => `<li><a href="/factures/${i.id}"><b>${esc(i.number)}</b><span>${esc(KIND[i.kind])}</span></a><em>${money(i.total_ttc)}</em>${badge(I_STATUS, iStatus(i))}</li>`).join('')}</ul></div>` : ''}</div></div>`;
  res.send(layout({ title: p.title || 'Projet', active: '/projets', body, flash: req.query.ok ? 'Projet mis à jour.' : '', actions: `<a class="btn" href="/messagerie/ecrire?type=projet&id=${p.id}">Message au client</a>` }));
});


app.post('/projets/:id/tech', async (req, res) => {
  const p = await db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const t = ptech(p); for (const [k] of TECH_FIELDS) if (('t_' + k) in req.body) t[k] = String(req.body['t_' + k] || '').trim().slice(0, 300);
  await db.prepare('UPDATE projects SET tech = ?, site_url = COALESCE(NULLIF(?, \'\'), site_url) WHERE id = ?').run(JSON.stringify(t), t.live_url || '', p.id);
  res.redirect(`/projets/${p.id}?ok=1`);
});
app.post('/projets/:id/verifier', async (req, res) => {
  const p = await db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const t = ptech(p); for (const [k] of TECH_FIELDS) if (('t_' + k) in req.body) t[k] = String(req.body['t_' + k] || '').trim().slice(0, 300);
  if (t.live_url) Object.assign(t, await checkSite(t.live_url));
  await db.prepare('UPDATE projects SET tech = ?, site_url = COALESCE(NULLIF(?, \'\'), site_url) WHERE id = ?').run(JSON.stringify(t), t.live_url || '', p.id);
  await log('controle', p.id, `Site contrôlé : ${t.http_status || 'injoignable'}`);
  res.redirect(`/projets/${p.id}?ok=1`);
});
app.post('/projets/:id/lancement', async (req, res) => {
  const lc = {}; LAUNCH.forEach((x, i) => { if (req.body['l' + i]) lc[i] = 1; });
  await db.prepare('UPDATE projects SET launch = ? WHERE id = ?').run(JSON.stringify(lc), Number(req.params.id));
  res.redirect(`/projets/${req.params.id}?ok=1`);
});
/* ---------------- Recherche globale (⌘K) ---------------- */
app.get('/api/recherche', async (req, res) => {
  const q = '%' + String(req.query.q || '').trim().slice(0, 60) + '%'; if (q.length < 4) return res.json([]);
  const out = [];
  for (const c of await db.prepare('SELECT id, name, company, city, phone FROM clients WHERE name LIKE ? OR company LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ? LIMIT 6').all(q, q, q, q, q)) out.push({ t: 'Client', n: c.company || c.name, s: [c.name !== c.company ? c.name : '', c.city, c.phone].filter(Boolean).join(' · '), u: '/clients/' + c.id });
  for (const p of await db.prepare('SELECT p.id, p.title, c.company FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.title LIKE ? OR c.company LIKE ? OR p.tech LIKE ? LIMIT 6').all(q, q, q)) out.push({ t: 'Projet', n: p.title, s: p.company || '', u: '/projets/' + p.id });
  for (const d of await db.prepare('SELECT id, number, title, total_ttc FROM quotes WHERE number LIKE ? OR title LIKE ? LIMIT 5').all(q, q)) out.push({ t: 'Devis', n: d.number, s: (d.title || '') + ' · ' + money(d.total_ttc), u: '/devis/' + d.id });
  for (const i of await db.prepare('SELECT id, number, kind, total_ttc FROM invoices WHERE number LIKE ? LIMIT 5').all(q)) out.push({ t: KIND[i.kind] || 'Facture', n: i.number, s: money(i.total_ttc), u: '/factures/' + i.id });
  res.json(out);
});
app.post('/projets/:id/infos', async (req, res) => {
  const p = await db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const b = req.body, cl = await Q.client.get(p.client_id) || {};
  const v = (k) => String(b['c_' + k] ?? cl[k] ?? '').trim();
  await db.prepare('UPDATE clients SET company = ?, address = ?, city = ?, phone = ?, email = ?, ice = ? WHERE id = ?').run(v('company'), v('address'), v('city'), v('phone'), v('email'), v('ice'), p.client_id);
  const inf = pinfo(p); for (const [k] of INFO_FIELDS) if (('i_' + k) in b) inf[k] = String(b['i_' + k] || '').trim();
  await db.prepare('UPDATE projects SET info = ? WHERE id = ?').run(JSON.stringify(inf), p.id);
  res.redirect(`/projets/${p.id}?ok=1`);
});
app.post('/projets/:id', async (req, res) => {
  const p = await db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const st = steps(p).map((x, i) => ({ t: x.t, d: req.body['d' + i] ? 1 : 0 }));
  const status = P_STATUS[req.body.status] ? req.body.status : p.status;
  await db.prepare("UPDATE projects SET steps = ?, status = ?, due_date = ?, site_url = ?, notes = ?, delivered_at = CASE WHEN ? = 'livre' THEN COALESCE(delivered_at, datetime('now')) ELSE NULL END WHERE id = ?").run(JSON.stringify(st), status, req.body.due_date || null, String(req.body.site_url || ''), String(req.body.notes || ''), status, p.id);
  res.redirect(`/projets/${p.id}?ok=1`);
});

/* ---------------- Dépenses ---------------- */
const CATS = CP.CATS.map((c) => c[0]);
app.get('/depenses', async (req, res) => {
  const m = String(req.query.mois || today().slice(0, 7));
  const rows = await db.prepare('SELECT * FROM expenses WHERE substr(date,1,7) = ? ORDER BY date DESC, id DESC').all(m);
  const tot = rows.reduce((a, e) => a + e.amount_ttc, 0), tva = rows.reduce((a, e) => a + e.tva, 0), ded = rows.reduce((a, e) => a + CP.expenseTva(e).ded, 0), locked = await isLocked(m + '-01');
  const body = `${req.query.err ? `<div class="flash err">${esc(req.query.err)}</div>` : ''}<form method="post" class="card dep-f"><div class="card-h"><h2>Ajouter une dépense</h2><span>Une facture fournisseur conforme (avec son ICE) permet de récupérer la TVA</span></div>
<div class="row r4"><label>Date<input type="date" name="date" value="${today()}" required></label><label>Fournisseur<input name="supplier" placeholder="Ex. : Hostinger" required></label><label>ICE du fournisseur<input name="supplier_ice" inputmode="numeric" placeholder="15 chiffres"></label><label>N° de sa facture<input name="invoice_ref" placeholder="Ex. : F-2026-118"></label></div>
<div class="row r4"><label>Catégorie<select name="category">${CP.CATS.map(([c, acc, d]) => `<option value="${esc(c)}">${esc(c)} · ${acc}${d ? '' : ' · TVA non déductible'}</option>`).join('')}</select></label><label>Libellé<input name="label" placeholder="Ex. : hébergement annuel"></label><label>Montant TTC<input name="amount_ttc" inputmode="decimal" required id="depTtc"></label><label>Dont TVA<input name="tva" inputmode="decimal" placeholder="0,00" id="depTva"><small class="dep-help"><a href="#" data-tva="20">20 %</a> · <a href="#" data-tva="14">14 %</a> · <a href="#" data-tva="10">10 %</a> · <a href="#" data-tva="0">sans TVA</a></small></label></div>
<div class="row r4"><label>Mode<select name="method"><option>Virement</option><option>Carte</option><option>Chèque</option><option>Espèces</option><option>Prélèvement</option></select></label><label class="grow">Lien du justificatif (Drive, photo…)<input name="receipt_url" placeholder="https://drive.google.com/…"></label><label>&nbsp;<button class="btn"${locked ? ' disabled' : ''}>Ajouter</button></label></div></form>
<div class="tools"><form class="search"><input type="month" name="mois" value="${esc(m)}" onchange="this.form.submit()"></form><div><b>${money(tot)}</b> <span class="mut">TTC ce mois · TVA payée ${money(tva)} · <b>récupérable ${money(ded)}</b></span> ${locked ? '<span class="bdg bdg-grey">Mois clôturé</span>' : ''} <a class="btn ghost sm" href="/export/depenses.csv">Exporter (CSV)</a></div></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Date</th><th>Fournisseur</th><th>Catégorie</th><th>Pièce</th><th class="r">TTC</th><th class="r">TVA récupérable</th><th></th></tr></thead><tbody>${rows.map((e) => { const t = CP.expenseTva(e); return `<tr><td>${dateFr(e.date)}</td><td><b>${esc(e.supplier)}</b><small class="mut"> ${esc(e.label || '')}</small></td><td><span class="bdg bdg-grey">${esc(e.category)}</span> <small class="mut">${esc(e.account || CP.catOf(e.category)[1])}</small></td><td>${e.receipt_url ? `<a href="${esc(e.receipt_url)}" target="_blank" rel="noopener">Justificatif</a>` : '<span class="red">sans justificatif</span>'}${e.invoice_ref ? `<small class="mut"> · ${esc(e.invoice_ref)}</small>` : ''}</td><td class="r">${money(e.amount_ttc)}</td><td class="r">${money(t.ded)}${t.why.length && num(e.tva) ? `<small class="warn-t" title="${esc(t.why.join(', '))}"> ⚠</small>` : ''}</td><td class="r">${locked ? '' : `<form method="post" action="/depenses/${e.id}/supprimer" data-confirm="Supprimer cette dépense ?"><button class="x" aria-label="Supprimer">×</button></form>`}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Aucune dépense ce mois.</td></tr>'}</tbody></table></div><script>document.querySelectorAll('[data-tva]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var t=parseFloat((document.getElementById('depTtc').value||'0').replace(',','.'))||0,r=+a.dataset.tva;document.getElementById('depTva').value=r?(t-t/(1+r/100)).toFixed(2).replace('.',','):'0';});});</script>`;
  res.send(layout({ title: 'Dépenses', active: '/depenses', body }));
});
app.post('/depenses', async (req, res) => {
  const b = req.body, amt = round2(num(b.amount_ttc)), date = b.date || today();
  if (await isLocked(date)) return res.redirect('/depenses?mois=' + date.slice(0, 7) + '&err=' + encodeURIComponent(lockedMsg(date)));
  const cat = CP.catOf(b.category);
  if (amt > 0) await db.prepare('INSERT INTO expenses (date, supplier, category, label, amount_ttc, tva, method, supplier_ice, invoice_ref, receipt_url, account) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(date, String(b.supplier || '').slice(0, 120), cat[0], String(b.label || '').slice(0, 200), amt, Math.min(amt, round2(num(b.tva))), String(b.method || ''), String(b.supplier_ice || '').replace(/\D/g, '').slice(0, 15), String(b.invoice_ref || '').slice(0, 60), String(b.receipt_url || '').slice(0, 400), cat[1]);
  res.redirect('/depenses?mois=' + date.slice(0, 7));
});
app.post('/depenses/:id/supprimer', async (req, res) => { const e = await db.prepare('SELECT date FROM expenses WHERE id = ?').get(Number(req.params.id)); if (e && await isLocked(e.date)) return res.redirect('/depenses?mois=' + e.date.slice(0, 7) + '&err=' + encodeURIComponent(lockedMsg(e.date))); await db.prepare('DELETE FROM expenses WHERE id = ?').run(Number(req.params.id)); res.redirect('/depenses' + (e ? '?mois=' + e.date.slice(0, 7) : '')); });

/* ---------------- Rapports : chiffre d'affaires, encaissements, dépenses, TVA ---------------- */
app.get('/rapports', async (req, res) => {
  const y = String(Number(req.query.annee) || Number(today().slice(0, 4)));
  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const nm = MOIS[i];
    const k = `${y}-${String(i + 1).padStart(2, '0')}`;
    const inv = await db.prepare("SELECT COALESCE(SUM(total_ht),0) ht, COALESCE(SUM(total_tva),0) tva FROM invoices WHERE cancelled = 0 AND substr(issue_date,1,7) = ?").get(k);
    const cash = (await db.prepare("SELECT COALESCE(SUM(p.amount),0) s FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.cancelled = 0 AND substr(p.date,1,7) = ?").get(k)).s;
    const exp = await db.prepare("SELECT COALESCE(SUM(amount_ttc),0) t, COALESCE(SUM(tva),0) tva FROM expenses WHERE substr(date,1,7) = ?").get(k);
    rows.push({ nm, ht: inv.ht, tvaC: inv.tva, cash, exp: exp.t, tvaD: exp.tva });
  }
  const T = rows.reduce((a, r) => { for (const k of ['ht', 'tvaC', 'cash', 'exp', 'tvaD']) a[k] += r[k]; return a; }, { ht: 0, tvaC: 0, cash: 0, exp: 0, tvaD: 0 });
  const mx = Math.max(1, ...rows.map((r) => Math.max(r.cash, r.exp)));
  const body = `<div class="tools"><nav class="tabs">${[Number(y) - 1, Number(y), Number(y) + 1].map((a) => `<a href="/rapports?annee=${a}" class="${String(a) === y ? 'on' : ''}">${a}</a>`).join('')}</nav></div>
<section class="kpis">${[['Chiffre d’affaires HT', money(T.ht), 'factures émises', 'hl'], ['Encaissé', money(T.cash), 'paiements reçus'], ['Dépenses', money(T.exp), 'TTC'], ['Résultat de trésorerie', money(T.cash - T.exp), 'encaissé − dépenses', T.cash - T.exp < 0 ? 'warn' : ''], ['TVA à reverser (estimation)', money(T.tvaC - T.tvaD), 'collectée − déductible']].map(([l, v, s, c]) => `<div class="kpi ${c || ''}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('')}</section>
<div class="card"><div class="card-h"><h2>Encaissements et dépenses</h2><span><i class="lg-c"></i> encaissé <i class="lg-d"></i> dépenses</span></div><div class="bars dual">${rows.map((r) => `<div class="bar"><div class="bb"><i style="height:${Math.max(2, Math.round(100 * r.cash / mx))}%"></i><i class="d" style="height:${Math.max(2, Math.round(100 * r.exp / mx))}%"></i></div><span>${r.nm.slice(0, 4)}.</span></div>`).join('')}</div></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Mois</th><th class="r">CA HT</th><th class="r">TVA collectée</th><th class="r">Encaissé</th><th class="r">Dépenses</th><th class="r">TVA déductible</th><th class="r">Résultat</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.nm}</td><td class="r">${money(r.ht)}</td><td class="r">${money(r.tvaC)}</td><td class="r">${money(r.cash)}</td><td class="r">${money(r.exp)}</td><td class="r">${money(r.tvaD)}</td><td class="r"><b class="${r.cash - r.exp < 0 ? 'red' : ''}">${money(r.cash - r.exp)}</b></td></tr>`).join('')}<tr class="tot"><td>Total ${y}</td><td class="r">${money(T.ht)}</td><td class="r">${money(T.tvaC)}</td><td class="r">${money(T.cash)}</td><td class="r">${money(T.exp)}</td><td class="r">${money(T.tvaD)}</td><td class="r">${money(T.cash - T.exp)}</td></tr></tbody></table></div>
<p class="hint">Ces chiffres sont des indicateurs de gestion. Faites valider vos déclarations (TVA, impôts) par votre comptable.</p>`;
  res.send(layout({ title: 'Rapports ' + y, active: '/rapports', body }));
});


/* ---- Messagerie (connecté) ---- */
const chBadge = (chs, id) => { const c = chs.find((x) => x.id === id) || { label: id }; return `<em class="chb ch-${CH_COLOR[id] || 'x'}">${esc(c.label)}</em>`; };
app.get('/messagerie', async (req, res) => {
  const s = await settings(), chs = MSG.channels(s), f = String(req.query.canal || '');
  const conv = await db.prepare(`SELECT m.* FROM messages m JOIN (SELECT ckey, MAX(id) mid FROM messages ${f ? 'WHERE channel = ?' : ''} GROUP BY ckey) x ON x.mid = m.id ORDER BY m.id DESC LIMIT 200`).all(...(f ? [f] : []));
  const unread = {}; for (const r of await db.prepare('SELECT ckey, COUNT(*) n FROM messages WHERE is_read = 0 GROUP BY ckey').all()) unread[r.ckey] = r.n;
  const sel = String(req.query.c || (conv[0] && conv[0].ckey) || '');
  const thread = sel ? await db.prepare('SELECT * FROM messages WHERE ckey = ? ORDER BY id').all(sel) : [];
  if (sel) await db.prepare('UPDATE messages SET is_read = 1 WHERE ckey = ?').run(sel);
  const last = thread[thread.length - 1] || {}, contact = last.contact || '';
  const who = thread.find((m) => m.client_id) || thread.find((m) => m.lead_id) || {};
  const tpls = await db.prepare('SELECT * FROM templates ORDER BY sort').all();
  const lastCh = (thread.slice().reverse().find((m) => m.direction === 'in') || last).channel || (/@/.test(contact) ? 'mail1' : 'wa1');
  const list = conv.map((m) => `<a class="cv${m.ckey === sel ? ' on' : ''}" href="/messagerie?c=${encodeURIComponent(m.ckey)}${f ? '&canal=' + f : ''}"><span class="cv-av">${esc((m.name || m.contact || '?').trim().slice(0, 2).toUpperCase())}</span><span class="cv-t"><b>${esc(m.name || m.contact)}</b><small>${m.direction === 'out' ? 'Vous : ' : ''}${esc((m.subject ? m.subject + ' · ' : '') + m.body).slice(0, 70)}</small></span><span class="cv-m">${chBadge(chs, m.channel)}<small>${dateFr(m.created_at)}</small>${unread[m.ckey] ? `<i>${unread[m.ckey]}</i>` : ''}</span></a>`).join('') || '<p class="empty pad">Aucun message pour l’instant. Écrivez à un client depuis sa fiche, ou branchez vos canaux dans Paramètres.</p>';
  const bubbles = thread.map((m) => `<div class="bb ${m.direction}"><div>${m.subject ? `<b>${esc(m.subject)}</b><br>` : ''}${esc(m.body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>')}</div><small>${chBadge(chs, m.channel)} ${esc(m.created_at.slice(0, 16).replace('T', ' '))}${m.direction === 'out' ? ' · ' + (m.status === 'envoye' ? 'envoyé' : m.status === 'lien' ? 'ouvert dans l’application' : esc(m.status)) : ''}</small></div>`).join('');
  const composer = sel ? `<form method="post" action="/messagerie/envoyer" class="cmp" id="cmp" data-tpl='${esc(JSON.stringify(tpls.map((t) => ({ k: t.key, s: t.subject, fr: t.fr, ar: t.ar }))))}' data-vars='${esc(JSON.stringify({ prenom: (last.name || '').split(' ')[0], entreprise: last.name || '', signature: s.signature || s.company_name, lien_avis: s.google_review_url || '' }))}'>
<input type="hidden" name="to" value="${esc(contact)}"><input type="hidden" name="ckey" value="${esc(sel)}"><input type="hidden" name="client_id" value="${esc(who.client_id || '')}"><input type="hidden" name="lead_id" value="${esc(who.lead_id || '')}">
<div class="cmp-h"><select name="channel">${chs.filter((c) => c.on && (/@/.test(contact) ? !c.wa : c.wa)).map((c) => `<option value="${c.id}"${c.id === lastCh ? ' selected' : ''}>${esc(c.label)}${c.wa ? (c.api ? '' : ' (lien)') : c.smtp ? '' : ' (lien)'}</option>`).join('') || '<option value="">Aucun canal configuré</option>'}</select><select name="template" class="cmp-t"><option value="">Modèle de message…</option>${TPL.STEPS.map((st) => `<optgroup label="${st}">${tpls.filter((t) => t.step === st).map((t) => `<option value="${t.key}">${esc(t.title)}</option>`).join('')}</optgroup>`).join('')}</select><span class="lng"><label><input type="radio" name="lang" value="fr" checked><i>FR</i></label><label><input type="radio" name="lang" value="ar"><i>ع</i></label></span></div>
${/@/.test(contact) ? '<input name="subject" placeholder="Objet">' : ''}<textarea name="body" rows="4" placeholder="Votre message…" required></textarea><div class="cmp-f"><span class="mut">⌘ + Entrée pour envoyer</span><button class="btn">Envoyer</button></div></form>` : '';
  const flash = req.query.ouvrir ? `<div class="flash">Message prêt : <a href="${esc(req.query.ouvrir)}" target="_blank" rel="noopener" data-autoopen>ouvrez-le dans ${/^mailto/.test(req.query.ouvrir) ? 'votre messagerie' : 'WhatsApp'}</a>${req.query.err ? ' · ' + esc(req.query.err) : ''}</div>` : req.query.sync ? `<div class="flash">${esc(req.query.sync)}</div>` : '';
  const chips = chs.map((c) => `<a class="chc ch-${CH_COLOR[c.id]}${f === c.id ? ' on' : ''}" href="/messagerie${f === c.id ? '' : '?canal=' + c.id}"><b>${esc(c.label)}</b><small>${!c.on ? 'non configuré' : c.wa ? (c.api ? 'API connectée' : 'mode lien') : c.smtp && c.imap ? 'envoi et réception' : c.smtp ? 'envoi' : 'mode lien'}</small></a>`).join('');
  const body = `${flash}<div class="ch-row">${chips}<form method="post" action="/messagerie/actualiser" class="inl"><button class="btn ghost sm">Relever les e-mails</button></form><a class="btn ghost sm" href="/modeles">Modèles de messages</a></div>
<div class="inbox"><aside class="cvs">${list}</aside><section class="thr">${sel ? `<header class="thr-h"><b>${esc(last.name || contact)}</b><span>${esc(contact)}</span>${who.client_id ? `<a class="btn ghost sm" href="/clients/${who.client_id}">Fiche client</a>` : who.lead_id ? `<a class="btn ghost sm" href="/demandes/${who.lead_id}">Demande</a>` : ''}</header><div class="bbs" id="bbs">${bubbles}</div>${composer}` : '<p class="empty pad">Choisissez une conversation.</p>'}</section></div><script src="/static/messages.js" defer></script>`;
  res.send(layout({ title: 'Messagerie', active: '/messagerie', body, actions: '<a class="btn" href="/messagerie/ecrire">Nouveau message</a>' }));
});
/* Écrire depuis une fiche (demande, client, devis, facture, projet) : tout est prérempli */
app.get('/messagerie/ecrire', async (req, res) => {
  const s = await settings(), chs = MSG.channels(s), type = String(req.query.type || ''), id = Number(req.query.id || 0);
  const c = type && id ? await msgContext(type, id, req) : { v: { signature: s.signature || s.company_name }, phone: '', email: '', name: '', rec: 'lead_site' };
  const tpls = await db.prepare('SELECT * FROM templates ORDER BY sort').all();
  const rec = tpls.find((t) => t.key === (req.query.modele || c.rec)) || tpls[0];
  const hist = c.client ? await db.prepare('SELECT * FROM messages WHERE client_id = ? ORDER BY id DESC LIMIT 6').all(c.client.id) : c.lead ? await db.prepare('SELECT * FROM messages WHERE lead_id = ? ORDER BY id DESC LIMIT 6').all(c.lead.id) : [];
  const opt = chs.filter((x) => x.on).map((x) => `<option value="${x.id}" data-wa="${x.wa ? 1 : 0}"${(x.wa && c.phone && x.id === 'wa1') || (!c.phone && !x.wa && x.id === 'mail1') ? ' selected' : ''}>${esc(x.label)}${x.wa ? (x.api ? ' · API' : ' · lien') : x.smtp ? ' · SMTP' : ' · lien'}</option>`).join('');
  const body = `<form method="post" action="/messagerie/envoyer" class="wr" id="cmp" data-tpl='${esc(JSON.stringify(tpls.map((t) => ({ k: t.key, s: t.subject, fr: t.fr, ar: t.ar }))))}' data-vars='${esc(JSON.stringify(c.v))}' data-phone="${esc(c.phone)}" data-email="${esc(c.email)}">
<input type="hidden" name="client_id" value="${c.client ? c.client.id : ''}"><input type="hidden" name="lead_id" value="${c.lead ? c.lead.id : ''}"><input type="hidden" name="back" value="${esc(req.get('referer') || '')}">
<div class="wr-main card"><div class="row"><label>Canal<select name="channel" id="wrCh">${opt || '<option value="">Configurez vos canaux dans Paramètres</option>'}</select></label><label class="grow">Destinataire<input name="to" id="wrTo" value="${esc(c.phone || c.email)}" placeholder="Numéro ou e-mail" required></label></div>
<div class="row"><label class="grow">Modèle<select name="template" class="cmp-t">${TPL.STEPS.map((st) => `<optgroup label="${st}">${tpls.filter((t) => t.step === st).map((t) => `<option value="${t.key}"${t.key === rec.key ? ' selected' : ''}>${t.key === c.rec ? '★ ' : ''}${esc(t.title)}</option>`).join('')}</optgroup>`).join('')}</select></label><span class="lng"><label><input type="radio" name="lang" value="fr" checked><i>Français</i></label><label><input type="radio" name="lang" value="ar"><i>العربية</i></label></span></div>
<label class="wr-subj">Objet (e-mail)<input name="subject"></label><label>Message<textarea name="body" rows="12" required></textarea></label>
<div class="cmp-f"><span class="mut">Les champs entre crochets se remplissent tout seuls. Relisez, ajustez, envoyez.</span><button class="btn">Envoyer</button></div></div>
<aside class="wr-side"><div class="card"><div class="card-h"><h2>Conseillé maintenant</h2></div><p class="rec">★ ${esc(rec.title)}</p><p class="mut">${c.name ? 'Pour ' + esc(c.name) + '. ' : ''}Choisi selon l’étape où en est ${type === 'facture' ? 'la facture' : type === 'devis' ? 'le devis' : type === 'projet' ? 'le projet' : 'la demande'}.</p></div>
${hist.length ? `<div class="card"><div class="card-h"><h2>Derniers échanges</h2></div><ul class="tl">${hist.map((m) => `<li><i></i><b>${m.direction === 'in' ? 'Reçu' : 'Envoyé'} : ${esc((m.subject || m.body).slice(0, 60))}</b><span>${dateFr(m.created_at)}</span></li>`).join('')}</ul></div>` : ''}</aside></form><script src="/static/messages.js" defer></script>`;
  res.send(layout({ title: c.name ? 'Message à ' + c.name : 'Nouveau message', active: '/messagerie', body }));
});
app.post('/messagerie/envoyer', async (req, res) => {
  const s = await settings(), chs = MSG.channels(s), b = req.body, ch = chs.find((x) => x.id === b.channel) || chs.find((x) => x.on);
  const to = String(b.to || '').trim(), body = String(b.body || '').trim(), subject = String(b.subject || '').trim();
  if (!ch || !to || !body) return res.redirect('/messagerie');
  const r = ch.wa ? await MSG.sendWhatsApp(ch, to, body) : await MSG.sendMail(ch, to, subject || 'Digilago', body, s.signature);
  await storeMsg({ channel: ch.id, direction: 'out', contact: to, subject, body, status: r.status, template: String(b.template || ''), ext_id: r.ext || '', client_id: Number(b.client_id) || null, lead_id: Number(b.lead_id) || null });
  if (b.lead_id && ['lead_site', 'apres_appel'].includes(b.template)) { const l = await db.prepare('SELECT stage FROM leads WHERE id = ?').get(Number(b.lead_id)); if (l && (l.stage || 'nouveau') === 'nouveau') await leadStage(Number(b.lead_id), 'contacte', 'message envoyé'); }
  const q = new URLSearchParams({ c: ckeyOf(to) }); if (r.link) q.set('ouvrir', r.link); if (r.error) q.set('err', r.error);
  res.redirect('/messagerie?' + q.toString());
});
app.post('/messagerie/actualiser', async (req, res) => {
  const s = await settings(), out = [];
  for (const ch of MSG.channels(s).filter((c) => !c.wa && c.imap)) {
    try {
      const r = await MSG.fetchMail(ch, s[ch.id + '_last_uid']);
      for (const m of r.items) await storeMsg({ channel: ch.id, direction: 'in', contact: m.from, name: m.name, subject: m.subject, body: m.body, status: 'recu', at: m.date.slice(0, 19).replace('T', ' ') });
      await saveSettings({ [ch.id + '_last_uid']: String(r.last) }); out.push(`${ch.label} : ${r.items.length} nouveau${r.items.length > 1 ? 'x' : ''}`);
    } catch (e) { out.push(`${ch.label} : ${e.message}`); }
  }
  res.redirect('/messagerie?sync=' + encodeURIComponent(out.join(' · ') || 'Aucune adresse e-mail avec réception configurée (Paramètres → Canaux).'));
});
/* ---- Modèles de messages ---- */
app.get('/modeles', async (req, res) => {
  const tpls = await db.prepare('SELECT * FROM templates ORDER BY sort').all();
  const body = `<p class="hint">Un message prêt pour chaque étape, en français et en arabe. Les mots entre accolades se remplissent tout seuls : {prenom}, {entreprise}, {numero}, {montant}, {lien}, {echeance}, {reste}, {domaine}, {site}, {lien_brief}, {lien_avis}, {signature}.</p>
${TPL.STEPS.map((st) => `<h2 class="tp-st">${st}</h2><div class="tp-grid">${tpls.filter((t) => t.step === st).map((t) => `<details class="card tp"><summary><b>${esc(t.title)}</b><small>${esc(t.subject || '')}</small></summary><form method="post" action="/modeles/${t.id}"><label>Titre<input name="title" value="${esc(t.title)}"></label><label>Objet (e-mail)<input name="subject" value="${esc(t.subject || '')}"></label><div class="row"><label>Français<textarea name="fr" rows="9">${esc(t.fr || '')}</textarea></label><label>العربية<textarea name="ar" rows="9" dir="rtl">${esc(t.ar || '')}</textarea></label></div><div class="send"><button class="btn sm">Enregistrer</button><button class="btn ghost sm" name="reset" value="1">Revenir au modèle d’origine</button></div></form></details>`).join('')}</div>`).join('')}`;
  res.send(layout({ title: 'Modèles de messages', active: '/messagerie', body, flash: req.query.ok ? 'Modèle enregistré.' : '' }));
});
app.post('/modeles/:id', async (req, res) => {
  const t = await db.prepare('SELECT * FROM templates WHERE id = ?').get(Number(req.params.id)); if (!t) return res.redirect('/modeles');
  if (req.body.reset) { const d = TPL.DEFAULT.find((x) => x.key === t.key); if (d) await db.prepare('UPDATE templates SET title=?, subject=?, fr=?, ar=? WHERE id=?').run(d.title, d.subject, d.fr, d.ar, t.id); }
  else await db.prepare('UPDATE templates SET title=?, subject=?, fr=?, ar=? WHERE id=?').run(String(req.body.title || t.title), String(req.body.subject || ''), String(req.body.fr || ''), String(req.body.ar || ''), t.id);
  res.redirect('/modeles?ok=1');
});


/* ======================= Comptabilité marocaine ======================= */
const ST_TAX = { a_preparer: ['À préparer', 'grey'], prepare: ['Prêt pour le comptable', 'blue'], declare: ['Déclaré', 'violet'], paye: ['Payé', 'green'] };
async function taxStatus(kind, p) { return (await db.prepare('SELECT * FROM tax_periods WHERE kind = ? AND period = ?').get(kind, p)) || { status: 'a_preparer' }; }
async function accountantToken() { const s = await settings(); if (s.accountant_token) return s.accountant_token; const t = token(); await saveSettings({ accountant_token: t }); return t; }
/* contrôles : ce qui manque avant d'envoyer au comptable */
async function controls(s, y) {
  const out = [], reg = CP.REGIMES[s.fiscal_regime] || {};
  if (!s.fiscal_regime) out.push(['r', 'Profil fiscal à définir : régime, TVA, périodicité.', '/comptabilite#profil']);
  if (!s.company_ice) out.push(['r', 'Votre ICE n’est pas renseigné : il est obligatoire sur chaque facture (art. 145).', '/parametres']);
  if (!s.company_if) out.push(['r', 'Votre identifiant fiscal (IF) manque sur les factures.', '/parametres']);
  if (s.fiscal_regime && !reg.ae && !s.company_patente) out.push(['o', 'Numéro de taxe professionnelle (patente) à ajouter.', '/parametres']);
  if (s.fiscal_regime === 'societe_is' && !s.company_rc) out.push(['o', 'Numéro de registre du commerce (RC) à ajouter.', '/parametres']);
  for (const i of await db.prepare("SELECT i.id, i.number, c.company, c.ice FROM invoices i JOIN clients c ON c.id = i.client_id WHERE substr(i.issue_date,1,4) = ? AND i.kind != 'avoir' AND COALESCE(c.company,'') != '' AND COALESCE(c.ice,'') = ''").all(String(y))) out.push(['o', `Facture ${i.number} : ICE du client ${i.company} manquant (obligatoire entre professionnels).`, `/factures/${i.id}`]);
  for (const e of await db.prepare("SELECT * FROM expenses WHERE substr(date,1,4) = ?").all(String(y))) {
    if (!e.receipt_url) out.push(['o', `Dépense ${e.supplier} du ${dateFr(e.date)} : justificatif manquant.`, `/depenses?mois=${e.date.slice(0, 7)}`]);
    const t = CP.expenseTva(e); if (num(e.tva) && t.why.length) out.push(['o', `Dépense ${e.supplier} : TVA de ${money(e.tva)} non récupérable (${t.why.join(', ')}).`, `/depenses?mois=${e.date.slice(0, 7)}`]);
  }
  for (const i of await withPaid(await db.prepare("SELECT * FROM invoices WHERE cancelled = 0 AND kind != 'avoir' AND due_date < date('now', '-60 days')").all())) if (i.total_ttc - i.paid > 0.009) out.push(['r', `Facture ${i.number} impayée depuis plus de 60 jours après échéance : à relancer (loi 69-21).`, `/factures/${i.id}`]);
  return out;
}
const fmtP = (p) => CP.PNAME(p).replace(/^./, (c) => c.toUpperCase());
function periodTables(c, s, base) {
  const reg = CP.REGIMES[s.fiscal_regime] || {}, assu = s.tva_assujetti === '1' && !reg.ae, T = c.T;
  const sum = reg.ae ? `<div class="tx-sum"><div><span>CA encaissé</span><b>${money(T.enc_ttc)}</b></div><div><span>Taux libératoire</span><b>${String(reg.rate).replace('.', ',')} %</b></div><div class="hl"><span>Impôt à payer</span><b>${money(T.ae_tax)}</b></div><div><span>À déclarer avant le</span><b>${dateFr(c.deadline)}</b></div></div>`
    : `<div class="tx-sum"><div><span>TVA collectée ${s.tva_regime === 'debit' ? '(facturée)' : '(encaissée)'}</span><b>${money(T.tva_col)}</b></div><div><span>TVA récupérable</span><b>− ${money(assu ? T.tva_ded : 0)}</b></div>${T.credit_in ? `<div><span>Crédit reporté</span><b>− ${money(T.credit_in)}</b></div>` : ''}<div class="hl"><span>${T.credit_out ? 'Crédit de TVA à reporter' : 'TVA à payer'}</span><b>${money(T.credit_out || T.tva_due || 0)}</b></div><div><span>À télédéclarer avant le</span><b>${dateFr(c.deadline)}</b></div></div>`;
  const ventes = `<table class="tbl"><thead><tr><th>Date</th><th>N°</th><th>Client</th><th>ICE client</th><th class="r">HT</th><th class="r">TVA</th><th class="r">TTC</th></tr></thead><tbody>${c.sales.map((i) => `<tr><td>${dateFr(i.issue_date)}</td><td>${base ? `<a href="${base}/f/${i.token}" target="_blank" rel="noopener">${esc(i.number)}</a>` : `<a href="/factures/${i.id}">${esc(i.number)}</a>`}${i.kind === 'avoir' ? ' <span class="bdg bdg-violet">avoir</span>' : ''}</td><td>${esc(i.ccomp || i.cname || '')}</td><td>${i.cice ? esc(i.cice) : i.ccomp ? '<span class="red">manquant</span>' : '—'}</td><td class="r">${money(i.total_ht)}</td><td class="r">${money(i.total_tva)}</td><td class="r">${money(i.total_ttc)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucune facture.</td></tr>'}<tr class="tot"><td colspan="4">Total</td><td class="r">${money(T.ca_ht)}</td><td class="r">${money(T.tva_fact)}</td><td class="r">${money(T.ca_ttc)}</td></tr></tbody></table>`;
  const enc = `<table class="tbl"><thead><tr><th>Date</th><th>Reçu</th><th>Facture</th><th>Client</th><th>Mode</th><th class="r">Encaissé TTC</th><th class="r">dont TVA</th>${reg.ae ? '' : '<th class="r">Timbre 0,25 %</th>'}</tr></thead><tbody>${c.pays.map((p) => `<tr><td>${dateFr(p.date)}</td><td>${p.token && base !== null ? `<a href="${base || ''}/recu/${p.token}" target="_blank" rel="noopener">${esc(p.number || '')}</a>` : esc(p.number || '')}</td><td>${esc(p.inum)}</td><td>${esc(p.ccomp || p.cname || '')}</td><td>${esc(p.method)}</td><td class="r">${money(p.amount)}</td><td class="r">${money(p.tva)}</td>${reg.ae ? '' : `<td class="r">${p.stamp ? money(p.stamp) : '—'}</td>`}</tr>`).join('') || `<tr><td colspan="${reg.ae ? 7 : 8}" class="empty">Aucun encaissement.</td></tr>`}<tr class="tot"><td colspan="5">Total</td><td class="r">${money(T.enc_ttc)}</td><td class="r">${money(T.tva_enc)}</td>${reg.ae ? '' : `<td class="r">${money(T.stamp)}</td>`}</tr></tbody></table>`;
  const achats = `<table class="tbl"><thead><tr><th>Date</th><th>Fournisseur</th><th>ICE</th><th>N° facture</th><th>Compte</th><th>Mode</th><th class="r">TTC</th><th class="r">TVA</th><th class="r">Récupérable</th><th>Pièce</th></tr></thead><tbody>${c.exps.map((e) => `<tr><td>${dateFr(e.date)}</td><td>${esc(e.supplier)}<small class="mut"> ${esc(e.label || '')}</small></td><td>${e.supplier_ice ? esc(e.supplier_ice) : '<span class="red">—</span>'}</td><td>${esc(e.invoice_ref || '')}</td><td>${esc(e.acc)}</td><td>${esc(e.method || '')}</td><td class="r">${money(e.amount_ttc)}</td><td class="r">${money(e.tva)}</td><td class="r">${money(e.tva_ded)}${e.tva_why.length && num(e.tva) ? `<small class="warn-t" title="${esc(e.tva_why.join(', '))}"> ⚠</small>` : ''}</td><td>${e.receipt_url ? `<a href="${esc(e.receipt_url)}" target="_blank" rel="noopener">Voir</a>` : '<span class="red">manquante</span>'}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">Aucune dépense.</td></tr>'}<tr class="tot"><td colspan="6">Total</td><td class="r">${money(T.dep_ttc)}</td><td class="r">${money(T.tva_paid)}</td><td class="r">${money(T.tva_ded)}</td><td></td></tr></tbody></table>`;
  return { sum, ventes, enc, achats };
}
const exportLinks = (pre, p) => ['ventes', 'encaissements', 'achats', 'ecritures'].map((k) => `<a class="btn ghost sm" href="${pre}/${p}/${k}.csv">${{ ventes: 'Journal des ventes', encaissements: 'Encaissements', achats: 'Achats et déductions', ecritures: 'Écritures CGNC' }[k]}</a>`).join('');
app.get('/comptabilite', async (req, res) => {
  const s = await settings(), y = Number(req.query.annee) || Number(today().slice(0, 4)), reg = CP.REGIMES[s.fiscal_regime] || {};
  const per = reg.ae ? 'trimestrielle' : s.tva_periodicite === 'mensuelle' ? 'mensuelle' : 'trimestrielle';
  const periods = reg.ae ? await Promise.all(CP.periodsOfYear(y, 'trimestrielle').map((p) => CP.computePeriod(db, s, p))) : await CP.yearTva(db, { ...s, tva_periodicite: per }, y);
  const kind = reg.ae ? 'ae' : 'tva', stt = {}, TS = {}; for (const r of await db.prepare('SELECT * FROM tax_periods WHERE kind = ?').all(kind)) TS[r.period] = r; for (const c of periods) stt[c.p] = TS[c.p] || { status: 'a_preparer' };
  const ae = await CP.aeWatch(db, s, y), ctl = await controls(s, y), tok = await accountantToken(), portal = `${baseUrl(req)}/comptable/${tok}`;
  const locks = new Set((await db.prepare('SELECT month FROM locks').all()).map((r) => r.month));
  const nextP = periods.find((c) => !['declare', 'paye'].includes(stt[c.p].status) && c.deadline >= today()) || periods.find((c) => !['declare', 'paye'].includes(stt[c.p].status));
  const stampMonths = reg.ae ? [] : (await db.prepare('SELECT substr(date,1,7) m, SUM(stamp) s FROM payments WHERE substr(date,1,4) = ? AND stamp > 0 GROUP BY m ORDER BY m').all(String(y))).map((r) => [r.m, r.s]);
  const profil = `<form method="post" action="/comptabilite/profil" class="card${s.fiscal_regime ? '' : ' focus'}" id="profil"><div class="card-h"><h2>Profil fiscal</h2><span>Il règle les calculs, les mentions des factures et les déclarations</span></div>
<div class="row r4"><label>Régime<select name="fiscal_regime"><option value="">À définir…</option>${Object.entries(CP.REGIMES).map(([k, r]) => `<option value="${k}"${s.fiscal_regime === k ? ' selected' : ''}>${r.n}</option>`).join('')}</select></label><label>TVA<select name="tva_assujetti"><option value="1"${s.tva_assujetti === '1' ? ' selected' : ''}>Assujetti à la TVA</option><option value="0"${s.tva_assujetti !== '1' ? ' selected' : ''}>Non assujetti (TVA non applicable)</option></select></label><label>Déclaration de TVA<select name="tva_periodicite"><option value="trimestrielle"${s.tva_periodicite !== 'mensuelle' ? ' selected' : ''}>Trimestrielle (CA &lt; 1 000 000 DH)</option><option value="mensuelle"${s.tva_periodicite === 'mensuelle' ? ' selected' : ''}>Mensuelle (CA ≥ 1 000 000 DH)</option></select></label><label>Fait générateur<select name="tva_regime"><option value="encaissement"${s.tva_regime !== 'debit' ? ' selected' : ''}>Encaissement (droit commun)</option><option value="debit"${s.tva_regime === 'debit' ? ' selected' : ''}>Débit (sur option)</option></select></label></div>
<div class="row r4"><label>Votre comptable<input name="accountant_name" value="${esc(s.accountant_name)}" placeholder="Nom ou cabinet"></label><label>Son e-mail<input name="accountant_email" type="email" value="${esc(s.accountant_email)}"></label><label>Son téléphone<input name="accountant_phone" value="${esc(s.accountant_phone)}"></label><label>Compte de ventes (CGNC)<input name="acc_revenue" value="${esc(s.acc_revenue)}"></label></div>
<p class="hint">Auto-entrepreneur : pas de TVA, mention « TVA non applicable, article 91 du CGI » ajoutée sur les factures, impôt de ${'1 %'} (services) ou 0,5 % (commerce) sur l’encaissé. Les seuils et taux sont rappelés à titre indicatif : faites-les confirmer par votre comptable.</p><button class="btn">Enregistrer le profil</button></form>`;
  const head = `<section class="cpt-h"><div><span class="sup-k"><i></i>Comptabilité ${y}</span><h2>${reg.n ? esc(reg.n) : 'Définissez votre profil fiscal'}</h2><p>${reg.ae ? 'Impôt libératoire sur le chiffre d’affaires encaissé, déclaration trimestrielle.' : s.tva_assujetti === '1' ? `TVA ${s.tva_periodicite === 'mensuelle' ? 'mensuelle' : 'trimestrielle'}, sur ${s.tva_regime === 'debit' ? 'les débits' : 'les encaissements'}.` : 'Non assujetti à la TVA.'}${s.accountant_name ? ` · Comptable : ${esc(s.accountant_name)}` : ''}</p></div>
${nextP ? `<div class="cpt-next"><span>Prochaine échéance</span><b>${reg.ae ? 'Déclaration auto-entrepreneur' : 'Déclaration de TVA'} · ${fmtP(nextP.p)}</b><em>avant le ${dateFr(nextP.deadline)} · ${money(reg.ae ? nextP.T.ae_tax : nextP.T.tva_due || 0)}</em><a class="btn sm" href="/comptabilite/periode/${nextP.p}">Préparer</a></div>` : ''}</section>`;
  const grid = `<div class="cpt-grid">${periods.map((c) => { const st = stt[c.p], ms = CP.monthsOf(c.p), lk = ms.every((m) => locks.has(m)); return `<a class="cpt-p st-${st.status}" href="/comptabilite/periode/${c.p}"><header><b>${fmtP(c.p)}</b>${badge(ST_TAX, st.status)}</header><dl><dt>Facturé HT</dt><dd>${money(c.T.ca_ht)}</dd><dt>Encaissé TTC</dt><dd>${money(c.T.enc_ttc)}</dd><dt>Dépenses</dt><dd>${money(c.T.dep_ttc)}</dd><dt class="big">${reg.ae ? 'Impôt' : c.T.credit_out ? 'Crédit TVA' : 'TVA à payer'}</dt><dd class="big">${money(reg.ae ? c.T.ae_tax : c.T.credit_out || c.T.tva_due || 0)}</dd></dl><small>${lk ? '🔒 Clôturé · ' : ''}échéance ${dateFr(c.deadline)}</small></a>`; }).join('')}</div>`;
  const aeCard = ae ? `<div class="card"><div class="card-h"><h2>Auto-entrepreneur : vos plafonds ${y}</h2><span>${money(ae.total)} encaissés sur ${money(ae.cap)}</span></div><div class="prog big ${ae.pct >= 90 ? 'risk' : ''}"><i style="width:${Math.min(100, ae.pct)}%"></i></div><p class="hint">${ae.pct >= 100 ? 'Plafond dépassé : parlez à votre comptable du passage en société.' : ae.pct >= 80 ? 'Vous approchez du plafond annuel : anticipez avec votre comptable.' : `Encore ${money(ae.cap - ae.total)} avant le plafond annuel.`}</p>
<table class="tbl"><thead><tr><th>Client</th><th class="r">Encaissé ${y}</th><th class="r">Au-delà de 80 000 DH</th><th></th></tr></thead><tbody>${ae.clients.map((c) => `<tr><td>${esc(c.ccomp || c.cname || '')}</td><td class="r">${money(c.t)}</td><td class="r">${c.over ? `<b class="red">${money(c.over)}</b>` : '—'}</td><td>${c.over ? '<span class="bdg bdg-red">Retenue 30 % par le client</span>' : c.warn ? '<span class="bdg bdg-amber">Proche de 80 000 DH</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucun encaissement cette année.</td></tr>'}</tbody></table><p class="hint">Pour les prestations de services, la part encaissée au-delà de 80 000 DH par an avec un même client subit une retenue à la source de 30 %, opérée par ce client.</p></div>` : '';
  const ctlCard = `<div class="card"><div class="card-h"><h2>Contrôles avant envoi au comptable</h2><span>${ctl.length ? ctl.length + ' point' + (ctl.length > 1 ? 's' : '') + ' à vérifier' : 'Tout est en ordre'}</span></div>${ctl.length ? `<ul class="ctl">${ctl.slice(0, 14).map(([k, t, u]) => `<li class="c-${k}"><i></i><a href="${u}">${esc(t)}</a></li>`).join('')}</ul>` : '<p class="miss ok">Factures conformes, justificatifs présents, TVA récupérable vérifiée.</p>'}</div>`;
  const msgC = `Bonjour${s.accountant_name ? ' ' + s.accountant_name : ''}, voici l’espace comptable de Digilago, mis à jour : factures, encaissements, dépenses avec justificatifs, calcul de TVA et écritures CGNC, par période. ${portal}`;
  const accCard = `<div class="card acc"><div class="card-h"><h2>Votre comptable</h2><span>Un lien privé, toujours à jour, en lecture seule</span></div><div class="copy"><input readonly value="${esc(portal)}" id="accLnk"><button type="button" class="btn ghost sm" data-copy="#accLnk">Copier</button></div><div class="send">${s.accountant_phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${digits(s.accountant_phone)}?text=${encodeURIComponent(msgC)}">Envoyer sur WhatsApp</a>` : ''}${s.accountant_email ? `<a class="btn ghost sm" href="mailto:${esc(s.accountant_email)}?subject=${encodeURIComponent('Comptabilité Digilago')}&body=${encodeURIComponent(msgC)}">Envoyer par e-mail</a>` : ''}<a class="btn ghost sm" href="${esc(portal)}" target="_blank" rel="noopener">Voir comme le comptable</a><form method="post" action="/comptabilite/nouveau-lien" class="inl" data-confirm="Créer un nouveau lien ? L’ancien ne fonctionnera plus."><button class="btn ghost sm">Nouveau lien</button></form></div>
${(await db.prepare("SELECT * FROM acc_notes ORDER BY id DESC LIMIT 4").all()).map((n) => `<p class="note ${n.author}"><b>${n.author === 'comptable' ? 'Comptable' : 'Vous'} · ${esc(n.period ? fmtP(n.period) : '')}</b> ${esc(n.text)}</p>`).join('')}</div>`;
  const stampCard = stampMonths.length ? `<div class="card"><div class="card-h"><h2>Droit de timbre sur les espèces</h2><span>0,25 % des paiements reçus en espèces (art. 252), déclaré et payé le mois suivant</span></div><ul class="lst">${stampMonths.map(([m, v]) => `<li><span><b>${fmtP(m)}</b></span><em>${money(v)}</em></li>`).join('')}</ul></div>` : '';
  const body = `${head}${s.fiscal_regime ? '' : profil}${grid}<div class="grid2"><div>${ctlCard}${aeCard}${stampCard}</div><div>${accCard}<div class="card"><div class="card-h"><h2>Exports de l’année</h2></div><div class="send">${exportLinks('/export/compta', y)}</div><p class="hint">Fichiers CSV (séparateur point-virgule), lisibles dans Excel et importables dans les logiciels comptables.</p></div>${s.fiscal_regime ? profil : ''}</div></div>`;
  res.send(layout({ title: 'Comptabilité', active: '/comptabilite', body, flash: req.query.ok ? 'Enregistré.' : '', actions: `<nav class="tabs">${[y - 1, y, y + 1].map((a) => `<a href="/comptabilite?annee=${a}" class="${a === y ? 'on' : ''}">${a}</a>`).join('')}</nav>` }));
});
app.post('/comptabilite/profil', async (req, res) => { const b = req.body; const o = {}; for (const k of ['fiscal_regime', 'tva_assujetti', 'tva_periodicite', 'tva_regime', 'accountant_name', 'accountant_email', 'accountant_phone', 'acc_revenue']) if (k in b) o[k] = String(b[k] || ''); if ((CP.REGIMES[o.fiscal_regime] || {}).ae) { o.tva_assujetti = '0'; o.default_tva = '0'; } await saveSettings(o); res.redirect('/comptabilite?ok=1'); });
app.post('/comptabilite/nouveau-lien', async (req, res) => { await saveSettings({ accountant_token: token() }); res.redirect('/comptabilite?ok=1'); });
async function periodCtx(s, p) {
  const reg = CP.REGIMES[s.fiscal_regime] || {};
  if (reg.ae) return CP.computePeriod(db, s, p);
  const y = p.slice(0, 4), per = /T/.test(p) ? 'trimestrielle' : 'mensuelle';
  return (await CP.yearTva(db, { ...s, tva_periodicite: per }, y)).find((c) => c.p === p) || CP.computePeriod(db, s, p);
}
app.get('/comptabilite/periode/:p', async (req, res) => {
  const p = String(req.params.p); if (!/^\d{4}-(T[1-4]|\d{2})$/.test(p)) return res.sendStatus(404);
  const s = await settings(), reg = CP.REGIMES[s.fiscal_regime] || {}, c = await periodCtx(s, p), kind = reg.ae ? 'ae' : 'tva', st = await taxStatus(kind, p), t = periodTables(c, s, '');
  const ms = CP.monthsOf(p), locks = new Set((await db.prepare('SELECT month FROM locks').all()).map((r) => r.month));
  const notes = await db.prepare('SELECT * FROM acc_notes WHERE period = ? ORDER BY id').all(p);
  const body = `<section class="cpt-h"><div><span class="sup-k"><i></i>${reg.ae ? 'Déclaration auto-entrepreneur' : 'Déclaration de TVA'}</span><h2>${fmtP(p)}</h2><p>Du ${dateFr(c.a)} au ${dateFr(c.b)} · à déclarer avant le ${dateFr(c.deadline)}</p></div>${badge(ST_TAX, st.status)}</section>${t.sum}
<div class="grid2"><form method="post" action="/comptabilite/periode/${p}/statut" class="card"><div class="card-h"><h2>Suivi de la déclaration</h2></div><div class="row r4"><label>Statut<select name="status">${Object.entries(ST_TAX).map(([k, [n]]) => `<option value="${k}"${st.status === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label><label>Montant payé<input name="amount" inputmode="decimal" value="${st.amount != null ? String(st.amount).replace('.', ',') : String(reg.ae ? c.T.ae_tax : c.T.tva_due || 0).replace('.', ',')}"></label><label>Référence (SIMPL)<input name="reference" value="${esc(st.reference || '')}"></label><label>Date<input type="date" name="declared_at" value="${esc(st.declared_at || '')}"></label></div><button class="btn sm">Enregistrer</button></form>
<div class="card"><div class="card-h"><h2>Clôture</h2><span>Un mois clôturé ne peut plus être modifié (factures, paiements, dépenses)</span></div><div class="send">${ms.map((m) => `<form method="post" action="/comptabilite/verrou" class="inl"><input type="hidden" name="month" value="${m}"><input type="hidden" name="back" value="/comptabilite/periode/${p}"><button class="btn ${locks.has(m) ? 'ghost' : ''} sm" name="action" value="${locks.has(m) ? 'unlock' : 'lock'}"${locks.has(m) ? ' data-confirm="Rouvrir ce mois ?"' : ''}>${locks.has(m) ? '🔒 ' + fmtP(m) + ' · rouvrir' : 'Clôturer ' + fmtP(m)}</button></form>`).join('')}</div><div class="send" style="margin-top:12px">${exportLinks('/export/compta', p)}</div></div></div>
<div class="card flush"><div class="card-h pad"><h2>Journal des ventes</h2><span>${c.sales.length} pièce${c.sales.length > 1 ? 's' : ''}</span></div>${t.ventes}</div>
<div class="card flush"><div class="card-h pad"><h2>Encaissements</h2><span>${reg.ae ? 'Base de l’impôt' : s.tva_regime === 'debit' ? '' : 'Base de la TVA collectée (régime de l’encaissement)'}</span></div>${t.enc}</div>
<div class="card flush"><div class="card-h pad"><h2>Achats et relevé des déductions</h2><span>TVA récupérable si facture conforme, ICE fournisseur, et paiement hors espèces au-delà de 5 000 DH</span></div>${t.achats}</div>
<div class="card"><div class="card-h"><h2>Échanges avec le comptable</h2></div>${notes.map((n) => `<p class="note ${n.author}"><b>${n.author === 'comptable' ? 'Comptable' : 'Vous'}</b> ${esc(n.text)} <small class="mut">${dateFr(n.created_at)}</small></p>`).join('') || '<p class="empty">Aucun échange pour cette période.</p>'}<form method="post" action="/comptabilite/note" class="note-f2"><input type="hidden" name="period" value="${p}"><input name="text" placeholder="Une question ou une précision pour votre comptable…" required><button class="btn sm">Ajouter</button></form></div>`;
  res.send(layout({ title: 'Comptabilité ' + fmtP(p), active: '/comptabilite', body, flash: req.query.ok ? 'Enregistré.' : '' }));
});
app.post('/comptabilite/periode/:p/statut', async (req, res) => {
  const p = String(req.params.p), s = await settings(), kind = (CP.REGIMES[s.fiscal_regime] || {}).ae ? 'ae' : 'tva', st = ST_TAX[req.body.status] ? req.body.status : 'a_preparer';
  await db.prepare('INSERT INTO tax_periods (kind, period, status, amount, reference, declared_at) VALUES (?,?,?,?,?,?) ON CONFLICT(kind, period) DO UPDATE SET status = excluded.status, amount = excluded.amount, reference = excluded.reference, declared_at = excluded.declared_at').run(kind, p, st, round2(num(req.body.amount)), String(req.body.reference || ''), req.body.declared_at || null);
  await log('compta', 0, `Déclaration ${fmtP(p)} : ${ST_TAX[st][0]}`);
  res.redirect(`/comptabilite/periode/${p}?ok=1`);
});
app.post('/comptabilite/verrou', async (req, res) => {
  const m = String(req.body.month || ''); if (!/^\d{4}-\d{2}$/.test(m)) return res.redirect('/comptabilite');
  if (req.body.action === 'unlock') await db.prepare('DELETE FROM locks WHERE month = ?').run(m); else await db.prepare('INSERT OR IGNORE INTO locks (month) VALUES (?)').run(m);
  await log('compta', 0, `${req.body.action === 'unlock' ? 'Réouverture' : 'Clôture'} de ${fmtP(m)}`);
  res.redirect(String(req.body.back || '/comptabilite').startsWith('/') ? String(req.body.back || '/comptabilite') : '/comptabilite');
});
app.post('/comptabilite/note', async (req, res) => { const p = String(req.body.period || ''); await db.prepare('INSERT INTO acc_notes (period, author, text) VALUES (?,?,?)').run(p, 'moi', String(req.body.text || '').slice(0, 2000)); res.redirect(`/comptabilite/periode/${p}`); });
/* exports comptables */
async function comptaCsv(p, kind) {
  const s = await settings(); const per = /^\d{4}$/.test(p) ? null : p;
  const list = per ? [await periodCtx(s, per)] : await Promise.all(CP.periodsOfYear(p, 'mensuelle').map((m) => CP.computePeriod(db, s, m)));
  const rows = [];
  if (kind === 'ventes') { rows.push(['Date', 'Numéro', 'Type', 'Client', 'ICE client', 'IF client', 'HT', 'Taux TVA', 'TVA', 'TTC']); for (const c of list) for (const i of c.sales) rows.push([i.issue_date, i.number, KIND[i.kind] || 'Facture', i.ccomp || i.cname, i.cice, i.cif, dec(i.total_ht), dec(i.tva_rate), dec(i.total_tva), dec(i.total_ttc)]); }
  else if (kind === 'encaissements') { rows.push(['Date', 'Reçu', 'Facture', 'Client', 'Mode', 'Référence', 'Encaissé TTC', 'dont HT', 'dont TVA', 'Droit de timbre']); for (const c of list) for (const x of c.pays) rows.push([x.date, x.number, x.inum, x.ccomp || x.cname, x.method, x.reference, dec(x.amount), dec(x.ht), dec(x.tva), dec(x.stamp)]); }
  else if (kind === 'achats') { rows.push(['Date', 'Fournisseur', 'ICE fournisseur', 'N° facture', 'Catégorie', 'Compte', 'Mode', 'HT', 'TVA', 'TTC', 'TVA récupérable', 'Motif si non récupérable', 'Justificatif']); for (const c of list) for (const e of c.exps) rows.push([e.date, e.supplier, e.supplier_ice, e.invoice_ref, e.category, e.acc, e.method, dec(e.ht), dec(e.tva), dec(e.amount_ttc), dec(e.tva_ded), e.tva_why.join(', '), e.receipt_url]); }
  else { rows.push(['Journal', 'Date', 'Pièce', 'Compte', 'Libellé', 'Débit', 'Crédit']); for (const c of list) for (const l of CP.entries(c, s)) rows.push([l.j, l.date, l.piece, l.acc, l.lib, dec(l.d), dec(l.c)]); }
  return csv(rows);
}
app.get('/export/compta/:p/:kind.csv', async (req, res) => { const k = String(req.params.kind); if (!['ventes', 'encaissements', 'achats', 'ecritures'].includes(k)) return res.sendStatus(404); res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="digilago-${k}-${req.params.p}.csv"` }).send(await comptaCsv(String(req.params.p), k)); });

/* ---------------- Exports et sauvegarde ---------------- */
const csv = (rows) => '\ufeff' + rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
const dec = (n) => String(round2(n)).replace('.', ',');
app.get('/export/factures.csv', async (req, res) => {
  const rows = await db.prepare('SELECT i.*, c.name cname, c.company ccomp, c.ice cice FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.number').all();
  const out = [['Numéro', 'Type', 'Date', 'Échéance', 'Client', 'ICE client', 'Total HT', 'TVA', 'Total TTC', 'Réglé', 'Reste', 'Statut']];
  for (const i of rows) { const p = await paidOf(i.id); out.push([i.number, KIND[i.kind], i.issue_date, i.due_date, i.ccomp || i.cname, i.cice, dec(i.total_ht), dec(i.total_tva), dec(i.total_ttc), dec(p), dec(Math.max(0, i.total_ttc - p)), I_STATUS[iStatus(i, p)][0]]); }
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="factures.csv"' }).send(csv(out));
});
app.get('/export/paiements.csv', async (req, res) => {
  const rows = await db.prepare('SELECT p.*, i.number inum, c.name cname, c.company ccomp FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN clients c ON c.id = i.client_id ORDER BY p.date').all();
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="paiements.csv"' }).send(csv([['Date', 'Facture', 'Client', 'Montant', 'Mode', 'Référence'], ...rows.map((p) => [p.date, p.inum, p.ccomp || p.cname, dec(p.amount), p.method, p.reference])]));
});
app.get('/export/depenses.csv', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM expenses ORDER BY date').all();
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="depenses.csv"' }).send(csv([['Date', 'Fournisseur', 'Catégorie', 'Libellé', 'TTC', 'TVA', 'Mode'], ...rows.map((e) => [e.date, e.supplier, e.category, e.label, dec(e.amount_ttc), dec(e.tva), e.method])]));
});
app.get('/sauvegarde', async (req, res) => {
  const out = { app: 'Digilago Gestion', date: new Date().toISOString(), tables: {} };
  for (const t of ['settings', 'counters', 'clients', 'services', 'leads', 'quotes', 'quote_items', 'invoices', 'invoice_items', 'payments', 'projects', 'expenses']) out.tables[t] = await db.prepare(`SELECT * FROM ${t}`).all();
  out.tables.settings = out.tables.settings.filter((r) => !r.key.startsWith('_'));
  res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="digilago-sauvegarde-${today()}.json"` }).send(JSON.stringify(out, null, 1));
});

app.use(async (req, res) => res.status(404).send(layout({ title: 'Page introuvable', body: '<div class="card"><p>Cette page n’existe pas. <a href="/">Retour au tableau de bord</a></p></div>' })));
app.use((err, req, res, next) => { console.error(err); res.status(500).send(layout({ title: 'Erreur', body: `<div class="card"><p>Une erreur est survenue : ${esc(err.message)}</p></div>` })); });

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) app.listen(PORT, () => console.log(`Digilago Gestion : http://localhost:${PORT}`));
module.exports = app;
