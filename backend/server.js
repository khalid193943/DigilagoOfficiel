'use strict';
/* Digilago Gestion : devis, acomptes, factures et paiements. */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const { db, settings, saveSettings, nextNumber, DB_PATH, STEPS } = require('./db');
const { esc, round2, num, money, pct, today, addDays, dateFr, token, totals } = require('./lib/fmt');
const { renderDoc, KIND, LOGO } = require('./lib/doc');
const { layout, badge, Q_STATUS, I_STATUS, P_STATUS, ICONS } = require('./lib/ui');
const { supervise } = require('./lib/maroc');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' }); next(); });
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

/* ---------------- Authentification : un compte administrateur ---------------- */
const getS = (k) => (db.prepare('SELECT value FROM settings WHERE key = ?').get(k) || {}).value;
const setS = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
if (!getS('_secret')) setS('_secret', crypto.randomBytes(32).toString('hex'));
const SECRET = process.env.SESSION_SECRET || getS('_secret');
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const checkPw = (pw, stored) => { if (!stored) return false; const [salt, h] = stored.split(':'); const x = crypto.scryptSync(pw, salt, 32); return crypto.timingSafeEqual(x, Buffer.from(h, 'hex')); };
if (process.env.ADMIN_PASSWORD && !getS('_pw_env_applied')) { setS('_pw', hashPw(process.env.ADMIN_PASSWORD)); setS('_pw_env_applied', '1'); }
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function readCookie(req, name) { const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '=')); return m ? decodeURIComponent(m.slice(name.length + 1)) : ''; }
function isAuthed(req) { const c = readCookie(req, 'dg'); const [exp, sig] = c.split('.'); return exp && sig && sign(exp) === sig && Number(exp) > Date.now(); }
function setSession(res) { const exp = String(Date.now() + 1000 * 60 * 60 * 24 * 14); res.setHeader('Set-Cookie', `dg=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 14}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); }
const tries = new Map();
function authPage(title, inner) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | Digilago Gestion</title><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Instrument+Sans:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/static/app.css"></head><body class="auth"><form method="post" class="auth-card"><span class="auth-logo">${LOGO}</span><h1>${title}</h1>${inner}</form></body></html>`;
}
app.get('/installation', (req, res) => { if (getS('_pw')) return res.redirect('/connexion'); res.send(authPage('Bienvenue', '<p>Choisissez le mot de passe de votre espace de gestion.</p><label>Mot de passe<input type="password" name="pw" minlength="8" required autofocus></label><label>Confirmer<input type="password" name="pw2" minlength="8" required></label><button>Créer mon espace</button>')); });
app.post('/installation', (req, res) => {
  if (getS('_pw')) return res.redirect('/connexion');
  const { pw = '', pw2 = '' } = req.body;
  if (pw.length < 8 || pw !== pw2) return res.send(authPage('Bienvenue', '<p class="err">Les mots de passe doivent être identiques et faire au moins 8 caractères.</p><label>Mot de passe<input type="password" name="pw" minlength="8" required></label><label>Confirmer<input type="password" name="pw2" minlength="8" required></label><button>Créer mon espace</button>'));
  setS('_pw', hashPw(pw)); setSession(res); res.redirect('/parametres?bienvenue=1');
});
app.get('/connexion', (req, res) => { if (!getS('_pw')) return res.redirect('/installation'); res.send(authPage('Connexion', '<label>Mot de passe<input type="password" name="pw" required autofocus></label><button>Se connecter</button>')); });
app.post('/connexion', (req, res) => {
  const ip = req.ip, t = tries.get(ip) || { n: 0, at: Date.now() };
  if (Date.now() - t.at > 15 * 60e3) { t.n = 0; t.at = Date.now(); }
  if (t.n >= 8) return res.status(429).send(authPage('Connexion', '<p class="err">Trop de tentatives. Réessayez dans 15 minutes.</p>'));
  if (checkPw(String(req.body.pw || ''), getS('_pw'))) { tries.delete(ip); setSession(res); return res.redirect('/'); }
  t.n++; tries.set(ip, t);
  res.status(401).send(authPage('Connexion', '<p class="err">Mot de passe incorrect.</p><label>Mot de passe<input type="password" name="pw" required autofocus></label><button>Se connecter</button>'));
});
app.post('/deconnexion', (req, res) => { res.setHeader('Set-Cookie', 'dg=; Path=/; Max-Age=0'); res.redirect('/connexion'); });

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
const paidOf = (id) => round2(Q.paid.get(id).s);
function qStatus(q) { if ((q.status === 'envoye' || q.status === 'vu') && q.valid_until && q.valid_until < today()) return 'expire'; return q.status; }
function iStatus(inv, paid = paidOf(inv.id)) {
  if (inv.cancelled) return 'annulee';
  if (paid >= num(inv.total_ttc) - 0.009) return 'payee';
  if (inv.due_date && inv.due_date < today()) return 'retard';
  return paid > 0 ? 'partielle' : 'impayee';
}
const baseUrl = (req) => (settings().public_url || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
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

/* Un devis accepté ouvre automatiquement son projet */
function ensureProject(qid) {
  const q = Q.quote.get(qid); if (!q) return null;
  const ex = db.prepare('SELECT id FROM projects WHERE quote_id = ?').get(q.id); if (ex) return ex.id;
  const s = settings();
  return Number(db.prepare('INSERT INTO projects (quote_id, client_id, title, status, due_date, steps, info, token) VALUES (?,?,?,?,?,?,?,?)').run(q.id, q.client_id, q.title || q.number, 'a_demarrer', addDays(today(), 7), JSON.stringify(STEPS.map((t) => ({ t, d: 0 }))), '{}', token()).lastInsertRowid);
}

/* ---------------- Formulaire public du site : les demandes arrivent ici ---------------- */
app.options('/api/leads', (req, res) => { res.set({ 'Access-Control-Allow-Origin': process.env.SITE_ORIGIN || '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }).sendStatus(204); });
app.post('/api/leads', (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.SITE_ORIGIN || '*');
  const b = req.body || {}, s = (v, n = 300) => String(v || '').slice(0, n).trim();
  if (!s(b.name) && !s(b.phone) && !s(b.email)) return res.status(400).json({ ok: false });
  const r = db.prepare('INSERT INTO leads (name, company, phone, email, need, message, source) VALUES (?, ?, ?, ?, ?, ?, ?)').run(s(b.name, 120), s(b.company, 160), s(b.phone, 40), s(b.email, 160), s(b.need, 300), s(b.message, 3000), s(b.source, 80) || 'site');
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});

/* ---------------- Lien client : consulter, télécharger, accepter ---------------- */
function publicPage(title, body) {
  const s = settings();
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | ${esc(s.company_name)}</title><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital@1&display=swap" rel="stylesheet"><link rel="stylesheet" href="/static/app.css"></head><body class="pub">${body}<script src="/static/app.js" defer></script></body></html>`;
}
app.get('/d/:token', (req, res) => {
  const q = Q.quoteByToken.get(req.params.token); if (!q) return res.status(404).send(publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>'));
  if (q.status === 'envoye' && !isAuthed(req)) db.prepare("UPDATE quotes SET status = 'vu', viewed_at = datetime('now') WHERE id = ?").run(q.id);
  const s = settings(), st = qStatus(q), cl = Q.client.get(q.client_id) || {};
  const canAccept = ['envoye', 'vu', 'brouillon'].includes(st) && !q.accepted_at;
  const wa = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(`Bonjour ${s.company_name}, j’ai une question sur le devis ${q.number}.`)}`;
  const deposit = round2(q.total_ttc * num(q.deposit_pct) / 100);
  const bar = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Devis ${esc(q.number)}</span><b>${money(q.total_ttc)} TTC</b></div><div class="pub-a">
<button type="button" class="btn ghost" data-print>Télécharger en PDF</button><a class="btn ghost" href="${wa}" target="_blank" rel="noopener">Une question ?</a>
${canAccept ? '<a class="btn" href="#accepter">Accepter le devis</a>' : q.accepted_at ? '<span class="bdg bdg-green">Devis accepté</span>' : st === 'expire' ? '<span class="bdg bdg-amber">Devis expiré</span>' : ''}</div></div></div>`;
  const accept = canAccept ? `<form method="post" action="/d/${esc(q.token)}/accepter" class="pub-accept" id="accepter"><h2>Accepter ce devis</h2><p>En acceptant, vous validez la commande. Nous vous contactons pour l’acompte de <b>${money(deposit)}</b> et le démarrage.</p><label>Votre nom complet<input name="name" required maxlength="120" value="${esc(cl.name || '')}"></label><label class="chk"><input type="checkbox" name="ok" value="1" required> J’accepte le devis ${esc(q.number)} et ses conditions.</label><button class="btn">Je confirme et j’accepte</button></form>` : '';
  const thanks = req.query.merci ? `<div class="pub-thanks"><b>Merci, votre devis est accepté.</b><p>Nous vous contactons très vite pour l’acompte et le démarrage.${s.bank_rib ? ` Vous pouvez aussi régler l’acompte par virement (RIB ci-dessous, référence ${esc(q.number)}).` : ''}</p><a class="btn" href="${wa}" target="_blank" rel="noopener">Nous écrire sur WhatsApp</a></div>` : '';
  res.send(publicPage('Devis ' + q.number, bar + `<main class="pub-main">${thanks}${renderDoc({ type: 'devis', doc: q, items: Q.qItems.all(q.id), client: cl, s })}${accept}</main>`));
});
app.post('/d/:token/accepter', (req, res) => {
  const q = Q.quoteByToken.get(req.params.token); if (!q) return res.sendStatus(404);
  const name = String(req.body.name || '').trim().slice(0, 120);
  if (name && req.body.ok && !q.accepted_at && qStatus(q) !== 'expire') { db.prepare("UPDATE quotes SET status = 'accepte', accepted_at = datetime('now'), accepted_name = ? WHERE id = ?").run(name, q.id); ensureProject(q.id); }
  res.redirect(`/d/${q.token}?merci=1`);
});
app.get('/f/:token', (req, res) => {
  const inv = Q.invByToken.get(req.params.token); if (!inv) return res.status(404).send(publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>'));
  const s = settings(), paid = paidOf(inv.id), quote = inv.quote_id ? Q.quote.get(inv.quote_id) : null;
  const bar = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">${esc(KIND[inv.kind] || 'Facture')} ${esc(inv.number)}</span><b>${money(inv.total_ttc)} TTC</b></div><div class="pub-a"><button type="button" class="btn ghost" data-print>Télécharger en PDF</button>${badge(I_STATUS, iStatus(inv, paid))}</div></div></div>`;
  res.send(publicPage(inv.number, bar + `<main class="pub-main">${renderDoc({ type: 'facture', doc: inv, items: Q.iItems.all(inv.id), client: Q.client.get(inv.client_id), s, paid, quote })}</main>`));
});


/* ---------------- Brief client : le client complète lui-même ses informations ---------------- */
app.get('/brief/:token', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE token = ?').get(req.params.token); if (!p) return res.status(404).send(publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>'));
  const cl = Q.client.get(p.client_id) || {}, inf = pinfo(p), s = settings(), c = completeness(p, cl);
  const f = (k, l, v, ta) => `<label>${l}${ta ? `<textarea name="${k}" rows="3">${esc(v || '')}</textarea>` : `<input name="${k}" value="${esc(v || '')}">`}</label>`;
  const body = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Votre projet avec ${esc(s.company_name)}</span><b>${esc(p.title || '')}</b></div><div class="pub-a"><span class="bdg bdg-blue">${c.pct} % complété</span></div></div></div>
<main class="pub-main">${req.query.merci ? '<div class="pub-thanks"><b>Merci, c’est bien reçu.</b><p>Nous avançons sur votre site avec ces informations. Vous pouvez revenir compléter à tout moment avec ce même lien.</p></div>' : ''}
<form method="post" class="brief"><h1>Quelques informations pour <em>votre site</em></h1><p>Elles nous permettent de créer un site qui vous ressemble, et votre fiche Google. Remplissez ce que vous avez : vous pourrez revenir compléter plus tard.</p>
<section><h2>Votre entreprise</h2><div class="row">${f('company', 'Nom de l’entreprise', cl.company || cl.name)}${f('city', 'Ville', cl.city)}</div>${f('address', 'Adresse complète', cl.address)}<div class="row">${f('phone', 'Téléphone', cl.phone)}${f('whatsapp', 'WhatsApp', cl.whatsapp)}</div><div class="row">${f('email', 'E-mail', cl.email)}${f('ice', 'ICE (si société)', cl.ice)}</div></section>
<section><h2>Votre site</h2>${INFO_FIELDS.map(([k, l]) => f('i_' + k, l, inf[k], k === 'activite')).join('')}</section>
<button class="btn">Envoyer mes informations</button></form></main>`;
  res.send(publicPage('Votre projet', body));
});
app.post('/brief/:token', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE token = ?').get(req.params.token); if (!p) return res.sendStatus(404);
  const b = req.body, cl = Q.client.get(p.client_id) || {}, cut = (v, n = 400) => String(v || '').trim().slice(0, n);
  db.prepare('UPDATE clients SET company = ?, city = ?, address = ?, phone = ?, whatsapp = ?, email = ?, ice = ? WHERE id = ?').run(cut(b.company, 160) || cl.company, cut(b.city, 80), cut(b.address, 240), cut(b.phone, 40), cut(b.whatsapp, 40), cut(b.email, 160), cut(b.ice, 40), p.client_id);
  const inf = pinfo(p); for (const [k] of INFO_FIELDS) if (('i_' + k) in b) inf[k] = cut(b['i_' + k], 3000);
  db.prepare('UPDATE projects SET info = ? WHERE id = ?').run(JSON.stringify(inf), p.id);
  res.redirect(`/brief/${p.token}?merci=1`);
});

/* ---------------- Tout le reste demande d'être connecté ---------------- */
app.use((req, res, next) => { if (!getS('_pw')) return res.redirect('/installation'); if (!isAuthed(req)) return res.redirect('/connexion'); next(); });

/* ---------------- Tableau de bord ---------------- */
app.get('/', (req, res) => {
  const m = today().slice(0, 7), s = settings();
  const qMonth = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total_ttc),0) t FROM quotes WHERE substr(issue_date,1,7) = ?").get(m);
  const dec = db.prepare("SELECT SUM(status IN ('accepte','facture')) w, SUM(status IN ('envoye','vu','accepte','refuse','facture')) d FROM quotes").get();
  const rate = dec.d ? Math.round(100 * dec.w / dec.d) : 0;
  const invs = db.prepare('SELECT * FROM invoices WHERE cancelled = 0').all();
  let billedMonth = 0, due = 0, late = [];
  for (const i of invs) { const p = paidOf(i.id); if ((i.issue_date || '').startsWith(m)) billedMonth += i.total_ttc; const r = i.total_ttc - p; if (r > 0.009) { due += r; if (i.due_date < today()) late.push({ ...i, rest: r }); } }
  const cashMonth = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE substr(date,1,7) = ?").get(m).s;
  const pipeline = db.prepare("SELECT COALESCE(SUM(total_ttc),0) s, COUNT(*) n FROM quotes WHERE status IN ('envoye','vu')").get();
  const months = []; for (let k = 5; k >= 0; k--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); const key = d.toISOString().slice(0, 7); months.push([key, db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE substr(date,1,7) = ?").get(key).s]); }
  const maxM = Math.max(1, ...months.map((x) => x[1]));
  const follow = db.prepare("SELECT q.*, c.name cname, c.company ccomp, c.phone cphone FROM quotes q LEFT JOIN clients c ON c.id = q.client_id WHERE q.status IN ('envoye','vu') AND (q.sent_at IS NULL OR q.sent_at <= datetime('now','-3 days')) ORDER BY q.issue_date LIMIT 6").all();
  const leads = db.prepare("SELECT * FROM leads WHERE status = 'nouveau' ORDER BY id DESC LIMIT 5").all();
  const projs = db.prepare("SELECT p.*, c.name cname, c.company ccomp FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.status != 'livre' ORDER BY COALESCE(p.due_date, p.created_at) LIMIT 6").all();
  const expMonth = db.prepare("SELECT COALESCE(SUM(amount_ttc),0) s FROM expenses WHERE substr(date,1,7) = ?").get(m).s;
  const kpi = (l, v, sub, cls = '') => `<div class="kpi ${cls}"><span>${l}</span><b>${v}</b><small>${sub}</small></div>`;
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  /* ---- Superviseur : la carte, l'objectif, la lecture intelligente ---- */
  const allClients = db.prepare("SELECT c.* FROM clients c WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.client_id = c.id AND q.status IN ('accepte','facture')) OR EXISTS (SELECT 1 FROM projects p WHERE p.client_id = c.id)").all();
  const sv = supervise(allClients);
  const prevM = (() => { const d = new Date(m + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const cashPrev = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE substr(date,1,7) = ?").get(prevM).s;
  const rateOf = (a, b) => { const r = db.prepare(`SELECT SUM(status IN ('accepte','facture')) w, SUM(status IN ('envoye','vu','accepte','refuse','facture')) d FROM quotes WHERE issue_date > date('now', ?) AND issue_date <= date('now', ?)`).get(a, b); return r.d ? Math.round(100 * r.w / r.d) : null; };
  const r30 = rateOf('-30 days', '+0 days'), r60 = rateOf('-60 days', '-30 days');
  const allProj = db.prepare("SELECT * FROM projects WHERE status != 'livre'").all();
  const lateP = allProj.filter((p) => p.due_date && p.due_date < today());
  const incomplete = allProj.map((p) => ({ p, c: completeness(p, Q.client.get(p.client_id)) })).filter((x) => x.c.pct < 100);
  const missCount = {}; incomplete.forEach((x) => x.c.missing.forEach((k) => { missCount[k] = (missCount[k] || 0) + 1; }));
  const topMiss = Object.entries(missCount).sort((a, b) => b[1] - a[1])[0];
  const ORDER = ['CS', 'RSK', 'MS', 'FM', 'TTA', 'SM', 'OR', 'BMK', 'DT', 'GON', 'LSH', 'DOD'];
  const nextRegion = ORDER.map((k) => sv.regions.find((r) => r.k === k)).find((r) => r && !r.lit);
  const bestCity = Object.entries(sv.byCity).sort((a, b) => b[1].length - a[1].length)[0];
  const live = db.prepare("SELECT p.*, c.name cname, c.company ccomp, c.city ccity FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.site_url IS NOT NULL AND p.site_url != '' ORDER BY COALESCE(p.delivered_at, p.created_at) DESC LIMIT 8").all();
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
  const hero = `<section class="sup"><div class="sup-l"><span class="sup-k"><i></i>Superviseur Digilago</span><h2>Objectif : <em>allumer tout le Maroc.</em></h2>
<div class="sup-goal"><div class="sup-gh"><span>Régions allumées</span><b>${sv.litRegions}<small> / ${sv.totalRegions}</small></b></div><div class="prog big gold"><i style="width:${Math.round(100 * sv.litRegions / sv.totalRegions)}%"></i></div></div>
<div class="sup-n"><div><b>${sv.litCities}</b><span>villes allumées</span></div><div><b>${allClients.length}</b><span>clients</span></div><div><b>${live.length}</b><span>sites en ligne</span></div><div><b>${allProj.length}</b><span>projets en cours</span></div></div>
<div class="sup-reg">${sv.regions.map((r) => `<span class="${r.lit ? 'on' : ''}" title="${esc(r.n)}${r.count ? ' : ' + r.count + ' client' + (r.count > 1 ? 's' : '') : ''}">${esc(r.n)}</span>`).join('')}</div>
<ul class="sup-ins">${ins.slice(0, 6).map(([k, t]) => `<li class="${k}"><i></i>${esc(t)}</li>`).join('')}</ul></div>
<div class="sup-map">${sv.svg}</div></section>
<section class="card"><div class="card-h"><h2>Le travail fait</h2><a href="${esc(siteUrl)}" target="_blank" rel="noopener">Voir ${esc(siteUrl.replace('https://', ''))}</a></div><div class="sites"><a class="site me" href="${esc(siteUrl)}" target="_blank" rel="noopener"><span class="site-f"><iframe src="${esc(siteUrl)}" loading="lazy" tabindex="-1" title="Votre site" sandbox></iframe></span><b>Votre site</b><small>${esc(siteUrl.replace('https://', ''))}</small></a>${live.map((p) => `<a class="site" href="${esc(p.site_url)}" target="_blank" rel="noopener"><span class="site-f"><iframe src="${esc(p.site_url)}" loading="lazy" tabindex="-1" title="${esc(p.ccomp || p.cname || '')}" sandbox></iframe></span><b>${esc(p.ccomp || p.cname || '')}</b><small>${esc(p.ccity || '')}</small></a>`).join('') || '<p class="empty">Les sites livrés apparaîtront ici : ajoutez leur adresse dans chaque projet.</p>'}</div></section>`;
  const body = hero + `<section class="kpis">${kpi('Encaissé ce mois', money(cashMonth), 'paiements reçus', 'hl')}${kpi('Reste à encaisser', money(due), `${late.length} facture${late.length > 1 ? 's' : ''} en retard`, late.length ? 'warn' : '')}${kpi('Devis en attente', money(pipeline.s), `${pipeline.n} devis envoyés`)}${kpi('Taux d’acceptation', rate + ' %', `${qMonth.n} devis ce mois, ${money(qMonth.t)}`)}${kpi('Résultat du mois', money(cashMonth - expMonth), `${money(expMonth)} de dépenses`, cashMonth - expMonth < 0 ? 'warn' : '')}</section>
<section class="grid2"><div class="card"><div class="card-h"><h2>Encaissements</h2><span>6 derniers mois</span></div><div class="bars">${months.map(([k, v]) => `<div class="bar"><i style="height:${Math.max(3, Math.round(100 * v / maxM))}%"></i><b>${v ? money(v, '') : ''}</b><span>${MOIS[Number(k.slice(5)) - 1]}</span></div>`).join('')}</div></div>
<div class="card"><div class="card-h"><h2>À relancer</h2><span>Devis envoyés depuis plus de 3 jours</span></div>${follow.length ? `<ul class="lst">${follow.map((q) => `<li><a href="/devis/${q.id}"><b>${esc(q.number)}</b><span>${esc(q.ccomp || q.cname || '')}</span></a><em>${money(q.total_ttc)}</em>${q.cphone ? `<a class="mini" target="_blank" rel="noopener" href="https://wa.me/${digits(q.cphone)}?text=${encodeURIComponent(`Bonjour ${q.cname || ''}, avez-vous pu consulter notre devis ${q.number} ? ${baseUrl(req)}/d/${q.token}`)}">Relancer</a>` : ''}</li>`).join('')}</ul>` : '<p class="empty">Rien à relancer pour l’instant.</p>'}</div></section>
<section class="card"><div class="card-h"><h2>Projets en cours</h2><a href="/projets">Tout voir</a></div>${projs.length ? `<div class="pj-row">${projs.map((p) => { const st = (() => { try { return JSON.parse(p.steps || '[]'); } catch (e) { return []; } })(), d = st.filter((x) => x.d).length; return `<a class="kb-card" href="/projets/${p.id}"><b>${esc(p.ccomp || p.cname || '')}</b><span>${esc(p.title || '')}</span><div class="prog"><i style="width:${st.length ? Math.round(100 * d / st.length) : 0}%"></i></div><small>${badge(P_STATUS, p.status)} ${p.due_date ? 'livraison ' + dateFr(p.due_date) : ''}</small></a>`; }).join('')}</div>` : '<p class="empty">Aucun projet en cours. Ils s’ouvrent dès qu’un devis est accepté.</p>'}</section>
<section class="grid2"><div class="card"><div class="card-h"><h2>Factures en retard</h2></div>${late.length ? `<ul class="lst">${late.slice(0, 6).map((i) => `<li><a href="/factures/${i.id}"><b>${esc(i.number)}</b><span>échéance ${dateFr(i.due_date)}</span></a><em class="red">${money(i.rest)}</em></li>`).join('')}</ul>` : '<p class="empty">Aucune facture en retard.</p>'}</div>
<div class="card"><div class="card-h"><h2>Nouvelles demandes du site</h2><a href="/demandes">Tout voir</a></div>${leads.length ? `<ul class="lst">${leads.map((l) => `<li><a href="/demandes"><b>${esc(l.company || l.name || 'Demande')}</b><span>${esc(l.need || l.message || '').slice(0, 60)}</span></a><a class="mini" href="/devis/nouveau?demande=${l.id}">Faire le devis</a></li>`).join('')}</ul>` : '<p class="empty">Aucune nouvelle demande.</p>'}</div></section>`;
  res.send(layout({ title: 'Tableau de bord', active: '/', body, actions: '<a class="btn" href="/devis/nouveau">Nouveau devis</a>' }));
});

/* ---------------- Devis ---------------- */
function quoteForm({ q = {}, items = [], client = null, lead = null, errors = '' }) {
  const s = settings();
  const clients = db.prepare('SELECT id, name, company FROM clients ORDER BY COALESCE(company, name) COLLATE NOCASE').all();
  const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id').all();
  if (!items.length) items = [{ label: '', description: '', qty: 1, unit: 'forfait', unit_price: '' }];
  const cid = q.client_id || (client && client.id) || (lead ? 'new' : (clients.length ? '' : 'new'));
  const row = (it, i) => `<tr class="it"><td class="drag">${i + 1}</td><td><input name="items[${i}][label]" value="${esc(it.label)}" list="svc" placeholder="Prestation" class="it-l"><textarea name="items[${i}][description]" rows="1" placeholder="Détail (facultatif)">${esc(it.description || '')}</textarea></td><td><input name="items[${i}][qty]" value="${esc(it.qty ?? 1)}" inputmode="decimal" class="it-q"></td><td><input name="items[${i}][unit]" value="${esc(it.unit || '')}" class="it-u"></td><td><input name="items[${i}][unit_price]" value="${esc(it.unit_price ?? '')}" inputmode="decimal" class="it-p" placeholder="0,00"></td><td class="it-t">0,00</td><td><button type="button" class="x" data-del aria-label="Supprimer la ligne">×</button></td></tr>`;
  const v = (k, d = '') => esc(q[k] ?? d);
  const nl = lead || {};
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
<div class="row r2"><label>Remise (%)<input name="discount_pct" id="disc" inputmode="decimal" value="${v('discount_pct', 0)}"></label><label>Acompte (%)<input name="deposit_pct" id="dep" inputmode="decimal" value="${v('deposit_pct', s.default_deposit)}"></label></div>
<dl class="sum"><dt>Sous-total HT</dt><dd id="sSub">0,00</dd><dt>Remise</dt><dd id="sDisc">0,00</dd><dt>Total HT</dt><dd id="sHt">0,00</dd><dt>TVA</dt><dd id="sTva">0,00</dd><dt class="big">Total TTC</dt><dd class="big" id="sTtc">0,00</dd><dt>Acompte</dt><dd id="sDep">0,00</dd><dt>Solde</dt><dd id="sSol">0,00</dd></dl>
<button class="btn wide" name="then" value="voir">Enregistrer le devis</button><button class="btn ghost wide" name="then" value="envoyer">Enregistrer et envoyer</button></div></aside></form>`;
}
function readItems(body) {
  const raw = body.items ? (Array.isArray(body.items) ? body.items : Object.values(body.items)) : [];
  return raw.map((it) => ({ label: String(it.label || '').trim().slice(0, 200), description: String(it.description || '').trim().slice(0, 1000), qty: num(it.qty, 1) || 1, unit: String(it.unit || '').trim().slice(0, 30), unit_price: round2(num(it.unit_price)) })).filter((it) => it.label);
}
function resolveClient(body) {
  if (body.client_id && body.client_id !== 'new') return Number(body.client_id);
  const name = String(body.nc_name || '').trim(), company = String(body.nc_company || '').trim();
  if (!name && !company) return null;
  return Number(db.prepare('INSERT INTO clients (name, company, phone, email, city, ice) VALUES (?, ?, ?, ?, ?, ?)').run(name || company, company, String(body.nc_phone || '').trim(), String(body.nc_email || '').trim(), String(body.nc_city || '').trim(), String(body.nc_ice || '').trim()).lastInsertRowid);
}
function saveQuote(body, id = null) {
  const items = readItems(body);
  const clientId = resolveClient(body);
  if (!clientId) throw new Error('Choisissez un client ou créez-en un.');
  if (!items.length) throw new Error('Ajoutez au moins une prestation.');
  const s = settings(), issue = body.issue_date || today();
  const tva = num(body.tva_rate, num(s.default_tva)), disc = Math.min(100, Math.max(0, num(body.discount_pct))), dep = Math.min(100, Math.max(0, num(body.deposit_pct)));
  const t = totals(items, tva, disc), valid = addDays(issue, num(body.validity, num(s.default_validity)));
  const f = [clientId, String(body.title || '').trim(), issue, valid, tva, disc, dep, String(body.delay || ''), String(body.notes || ''), String(body.conditions || ''), t.ht, t.tva, t.ttc];
  db.exec('BEGIN');
  try {
    if (id) db.prepare("UPDATE quotes SET client_id=?, title=?, issue_date=?, valid_until=?, tva_rate=?, discount_pct=?, deposit_pct=?, delay=?, notes=?, conditions=?, total_ht=?, total_tva=?, total_ttc=?, updated_at=datetime('now') WHERE id=?").run(...f, id);
    else id = Number(db.prepare('INSERT INTO quotes (client_id, title, issue_date, valid_until, tva_rate, discount_pct, deposit_pct, delay, notes, conditions, total_ht, total_tva, total_ttc, token) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...f, token()).lastInsertRowid);
    db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(id);
    const ins = db.prepare('INSERT INTO quote_items (quote_id, position, label, description, qty, unit, unit_price) VALUES (?,?,?,?,?,?,?)');
    items.forEach((it, i) => ins.run(id, i, it.label, it.description, it.qty, it.unit, it.unit_price));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  const q = Q.quote.get(id);
  if (!q.number) db.prepare('UPDATE quotes SET number = ? WHERE id = ?').run(nextNumber('quote', s.quote_prefix, issue), id);
  if (body.lead_id) db.prepare("UPDATE leads SET status = 'devis', quote_id = ? WHERE id = ?").run(id, Number(body.lead_id));
  return id;
}
app.get('/devis', (req, res) => {
  const f = String(req.query.statut || ''), term = String(req.query.q || '').trim();
  let rows = db.prepare('SELECT q.*, c.name cname, c.company ccomp FROM quotes q LEFT JOIN clients c ON c.id = q.client_id ORDER BY q.id DESC').all().map((q) => ({ ...q, st: qStatus(q) }));
  if (f) rows = rows.filter((q) => q.st === f);
  if (term) { const t = term.toLowerCase(); rows = rows.filter((q) => [q.number, q.title, q.cname, q.ccomp].join(' ').toLowerCase().includes(t)); }
  const tabs = ['', 'brouillon', 'envoye', 'vu', 'accepte', 'facture', 'refuse', 'expire'].map((k) => `<a href="/devis${k ? '?statut=' + k : ''}" class="${f === k ? 'on' : ''}">${k ? Q_STATUS[k][0] : 'Tous'}</a>`).join('');
  const body = `<div class="tools"><nav class="tabs">${tabs}</nav><form class="search"><input name="q" value="${esc(term)}" placeholder="Rechercher un devis, un client…">${f ? `<input type="hidden" name="statut" value="${esc(f)}">` : ''}</form></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Numéro</th><th>Client</th><th>Objet</th><th>Date</th><th class="r">Total TTC</th><th>Statut</th></tr></thead><tbody>${rows.map((q) => `<tr data-href="/devis/${q.id}"><td><a href="/devis/${q.id}"><b>${esc(q.number)}</b></a></td><td>${esc(q.ccomp || q.cname || '')}</td><td class="mut">${esc(q.title || '')}</td><td>${dateFr(q.issue_date)}</td><td class="r">${money(q.total_ttc)}</td><td>${badge(Q_STATUS, q.st)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucun devis pour l’instant. <a href="/devis/nouveau">Créer le premier</a></td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Devis', active: '/devis', body, actions: '<a class="btn" href="/devis/nouveau">Nouveau devis</a>' }));
});
app.get('/devis/nouveau', (req, res) => {
  const lead = req.query.demande ? db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(req.query.demande)) : null;
  const client = req.query.client ? Q.client.get(Number(req.query.client)) : null;
  res.send(layout({ title: 'Nouveau devis', active: '/devis', body: quoteForm({ lead, client }) }));
});
app.post('/devis/nouveau', (req, res) => {
  try { const id = saveQuote(req.body); if (req.body.then === 'envoyer') db.prepare("UPDATE quotes SET status = 'envoye', sent_at = datetime('now') WHERE id = ?").run(id); res.redirect(`/devis/${id}${req.body.then === 'envoyer' ? '?envoyer=1' : ''}`); }
  catch (e) { res.status(400).send(layout({ title: 'Nouveau devis', active: '/devis', body: quoteForm({ q: req.body, items: readItems(req.body), errors: e.message }) })); }
});
app.get('/devis/:id/modifier', (req, res) => {
  const q = Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  res.send(layout({ title: 'Modifier ' + q.number, active: '/devis', body: quoteForm({ q, items: Q.qItems.all(q.id) }) }));
});
app.post('/devis/:id/modifier', (req, res) => {
  const id = Number(req.params.id);
  try { saveQuote(req.body, id); if (req.body.then === 'envoyer') db.prepare("UPDATE quotes SET status = 'envoye', sent_at = datetime('now') WHERE id = ?").run(id); res.redirect(`/devis/${id}${req.body.then === 'envoyer' ? '?envoyer=1' : ''}`); }
  catch (e) { res.status(400).send(layout({ title: 'Modifier le devis', active: '/devis', body: quoteForm({ q: { ...req.body, id }, items: readItems(req.body), errors: e.message }) })); }
});
app.get('/devis/:id', (req, res) => {
  const q = Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  const s = settings(), cl = Q.client.get(q.client_id) || {}, st = qStatus(q), link = `${baseUrl(req)}/d/${q.token}`;
  const invs = Q.quoteInvoices.all(q.id);
  const depBilled = invs.some((i) => i.kind === 'acompte'), closed = invs.some((i) => i.kind !== 'acompte');
  const msg = `Bonjour ${cl.name || ''}, voici votre devis ${q.number} de ${money(q.total_ttc)} TTC : ${link}\nVous pouvez le consulter, le télécharger et l’accepter en ligne.`;
  const wa = cl.phone ? `https://wa.me/${digits(cl.phone)}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:${esc(cl.email || '')}?subject=${encodeURIComponent('Devis ' + q.number + ' - ' + s.company_name)}&body=${encodeURIComponent(msg)}`;
  const timeline = [['Créé', q.created_at], ['Envoyé', q.sent_at], ['Consulté par le client', q.viewed_at], ['Accepté' + (q.accepted_name ? ' par ' + q.accepted_name : ''), q.accepted_at]].filter((x) => x[1]).map(([t, d]) => `<li><i></i><b>${esc(t)}</b><span>${dateFr(d)}</span></li>`).join('');
  const side = `<div class="card"><div class="card-h"><h2>Statut</h2>${badge(Q_STATUS, st)}</div><ul class="tl">${timeline}</ul>
<form method="post" action="/devis/${q.id}/statut" class="st-btns">${['envoye', 'accepte', 'refuse'].filter((k) => k !== q.status && q.status !== 'facture').map((k) => `<button class="btn ghost sm" name="status" value="${k}">${k === 'envoye' ? 'Marquer envoyé' : k === 'accepte' ? 'Marquer accepté' : 'Marquer refusé'}</button>`).join('')}</form></div>
<div class="card"><div class="card-h"><h2>Envoyer au client</h2></div><div class="copy"><input readonly value="${esc(link)}" id="lnk"><button type="button" class="btn ghost sm" data-copy="#lnk">Copier</button></div>
<div class="send"><a class="btn wa" href="${wa}" target="_blank" rel="noopener" data-mark="/devis/${q.id}/envoye">WhatsApp</a><a class="btn ghost" href="${mail}" data-mark="/devis/${q.id}/envoye">E-mail</a><a class="btn ghost" href="/d/${q.token}" target="_blank" rel="noopener">Voir comme le client</a></div></div>
${(() => { const pr = db.prepare('SELECT * FROM projects WHERE quote_id = ?').get(q.id); return pr ? `<div class="card"><div class="card-h"><h2>Projet</h2>${badge(P_STATUS, pr.status)}</div><a href="/projets/${pr.id}">Suivre le projet</a></div>` : ''; })()}
<div class="card"><div class="card-h"><h2>Facturation</h2></div>${invs.length ? `<ul class="lst">${invs.map((i) => `<li><a href="/factures/${i.id}"><b>${esc(i.number)}</b><span>${esc(KIND[i.kind])}</span></a><em>${money(i.total_ttc)}</em>${badge(I_STATUS, iStatus(i))}</li>`).join('')}</ul>` : '<p class="empty">Pas encore de facture.</p>'}
${closed ? '' : `<form method="post" action="/devis/${q.id}/facturer" class="st-btns">${!depBilled && num(q.deposit_pct) > 0 ? `<button class="btn sm" name="kind" value="acompte">Facture d’acompte (${pct(q.deposit_pct)})</button>` : ''}${depBilled ? '<button class="btn sm" name="kind" value="solde">Facture de solde</button>' : '<button class="btn ghost sm" name="kind" value="totale">Facture totale</button>'}</form>`}</div>`;
  const actions = `${q.status !== 'facture' ? `<a class="btn ghost" href="/devis/${q.id}/modifier">Modifier</a>` : ''}<form method="post" action="/devis/${q.id}/dupliquer" class="inl"><button class="btn ghost">Dupliquer</button></form><button type="button" class="btn ghost" data-print>PDF</button>`;
  const flash = req.query.envoyer ? 'Devis enregistré. Envoyez-le maintenant par WhatsApp ou par e-mail.' : '';
  res.send(layout({ title: `Devis ${q.number}`, active: '/devis', flash, actions, body: `<div class="docview"><div class="paper">${renderDoc({ type: 'devis', doc: q, items: Q.qItems.all(q.id), client: cl, s })}</div><aside class="dv-side">${side}</aside></div>` }));
});
app.post('/devis/:id/envoye', (req, res) => { db.prepare("UPDATE quotes SET status = 'envoye', sent_at = COALESCE(sent_at, datetime('now')) WHERE id = ? AND status = 'brouillon'").run(Number(req.params.id)); res.sendStatus(204); });
app.post('/devis/:id/statut', (req, res) => {
  const id = Number(req.params.id), st = String(req.body.status);
  if (st === 'envoye') db.prepare("UPDATE quotes SET status = 'envoye', sent_at = COALESCE(sent_at, datetime('now')) WHERE id = ?").run(id);
  else if (st === 'accepte') { db.prepare("UPDATE quotes SET status = 'accepte', accepted_at = COALESCE(accepted_at, datetime('now')), accepted_name = COALESCE(accepted_name, '') WHERE id = ?").run(id); ensureProject(id); }
  else if (st === 'refuse') db.prepare("UPDATE quotes SET status = 'refuse' WHERE id = ?").run(id);
  res.redirect('/devis/' + id);
});
app.post('/devis/:id/dupliquer', (req, res) => {
  const q = Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  const id = saveQuote({ client_id: q.client_id, title: q.title, issue_date: today(), validity: settings().default_validity, tva_rate: q.tva_rate, discount_pct: q.discount_pct, deposit_pct: q.deposit_pct, delay: q.delay, notes: q.notes, conditions: q.conditions, items: Q.qItems.all(q.id) });
  res.redirect(`/devis/${id}/modifier`);
});
function createInvoice(q, kind) {
  const s = settings(), items = Q.qItems.all(q.id), issue = today();
  let lines = [];
  if (kind === 'acompte') lines = [{ label: `Acompte de ${pct(q.deposit_pct)} sur le devis ${q.number}`, description: q.title || '', qty: 1, unit: 'forfait', unit_price: round2(q.total_ht * num(q.deposit_pct) / 100) }];
  else {
    lines = items.map((it) => ({ label: it.label, description: it.description, qty: it.qty, unit: it.unit, unit_price: it.unit_price }));
    const sub = items.reduce((a, it) => a + num(it.qty, 1) * num(it.unit_price), 0);
    if (num(q.discount_pct) > 0) lines.push({ label: `Remise ${pct(q.discount_pct)}`, description: '', qty: 1, unit: '', unit_price: -round2(sub - q.total_ht) });
    if (kind === 'solde') for (const a of Q.quoteInvoices.all(q.id).filter((i) => i.kind === 'acompte')) lines.push({ label: `Acompte déjà facturé (${a.number})`, description: '', qty: 1, unit: '', unit_price: -round2(a.total_ht) });
  }
  const t = totals(lines, q.tva_rate, 0);
  const number = nextNumber('invoice', s.invoice_prefix, issue);
  const id = Number(db.prepare('INSERT INTO invoices (number, quote_id, client_id, kind, title, issue_date, due_date, tva_rate, total_ht, total_tva, total_ttc, notes, token) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(number, q.id, q.client_id, kind, q.title, issue, addDays(issue, num(s.default_due_days, 15)), q.tva_rate, t.ht, t.tva, t.ttc, '', token()).lastInsertRowid);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, position, label, description, qty, unit, unit_price) VALUES (?,?,?,?,?,?,?)');
  lines.forEach((l, i) => ins.run(id, i, l.label, l.description || '', l.qty, l.unit || '', l.unit_price));
  ensureProject(q.id);
  if (kind !== 'acompte') db.prepare("UPDATE quotes SET status = 'facture' WHERE id = ?").run(q.id);
  else if (!['accepte', 'facture'].includes(q.status)) db.prepare("UPDATE quotes SET status = 'accepte', accepted_at = COALESCE(accepted_at, datetime('now')) WHERE id = ?").run(q.id);
  return id;
}
app.post('/devis/:id/facturer', (req, res) => {
  const q = Q.quote.get(Number(req.params.id)); if (!q) return res.sendStatus(404);
  const kind = ['acompte', 'solde', 'totale'].includes(req.body.kind) ? req.body.kind : 'totale';
  res.redirect('/factures/' + createInvoice(q, kind));
});

/* ---------------- Factures et paiements ---------------- */
app.get('/factures', (req, res) => {
  const f = String(req.query.statut || '');
  let rows = db.prepare('SELECT i.*, c.name cname, c.company ccomp FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.id DESC').all().map((i) => { const p = paidOf(i.id); return { ...i, paid: p, st: iStatus(i, p) }; });
  if (f) rows = rows.filter((i) => i.st === f);
  const tabs = ['', 'impayee', 'partielle', 'retard', 'payee', 'annulee'].map((k) => `<a href="/factures${k ? '?statut=' + k : ''}" class="${f === k ? 'on' : ''}">${k ? I_STATUS[k][0] : 'Toutes'}</a>`).join('');
  const body = `<div class="tools"><nav class="tabs">${tabs}</nav><a class="btn ghost sm" href="/export/factures.csv">Exporter (CSV)</a></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Numéro</th><th>Type</th><th>Client</th><th>Échéance</th><th class="r">TTC</th><th class="r">Reste</th><th>Statut</th></tr></thead><tbody>${rows.map((i) => `<tr data-href="/factures/${i.id}"><td><a href="/factures/${i.id}"><b>${esc(i.number)}</b></a></td><td class="mut">${esc(KIND[i.kind])}</td><td>${esc(i.ccomp || i.cname || '')}</td><td>${dateFr(i.due_date)}</td><td class="r">${money(i.total_ttc)}</td><td class="r">${money(Math.max(0, i.total_ttc - i.paid))}</td><td>${badge(I_STATUS, i.st)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Les factures se créent depuis un devis accepté.</td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Factures', active: '/factures', body }));
});
app.get('/factures/:id', (req, res) => {
  const inv = Q.invoice.get(Number(req.params.id)); if (!inv) return res.sendStatus(404);
  const s = settings(), cl = Q.client.get(inv.client_id) || {}, paid = paidOf(inv.id), rest = round2(inv.total_ttc - paid), st = iStatus(inv, paid);
  const quote = inv.quote_id ? Q.quote.get(inv.quote_id) : null, link = `${baseUrl(req)}/f/${inv.token}`;
  const pays = Q.payments.all(inv.id);
  const METHODS = ['Virement', 'Espèces', 'Chèque', 'Carte (CMI)', 'Versement', 'Autre'];
  const msg = rest > 0 ? `Bonjour ${cl.name || ''}, voici votre facture ${inv.number}. Reste à régler : ${money(rest)}. ${link}` : `Bonjour ${cl.name || ''}, voici votre facture ${inv.number}, réglée. Merci ! ${link}`;
  const side = `<div class="card"><div class="card-h"><h2>Paiements</h2>${badge(I_STATUS, st)}</div>
<div class="pay-sum"><div><span>Total TTC</span><b>${money(inv.total_ttc)}</b></div><div><span>Réglé</span><b>${money(paid)}</b></div><div class="${rest > 0.009 ? 'due' : 'ok'}"><span>Reste</span><b>${money(Math.max(0, rest))}</b></div></div>
${pays.length ? `<ul class="lst">${pays.map((p) => `<li><span><b>${money(p.amount)}</b><small>${dateFr(p.date)}, ${esc(p.method)}${p.reference ? ', ' + esc(p.reference) : ''}</small></span><form method="post" action="/paiements/${p.id}/supprimer" data-confirm="Supprimer ce paiement ?"><button class="x" aria-label="Supprimer">×</button></form></li>`).join('')}</ul>` : ''}
${rest > 0.009 && !inv.cancelled ? `<form method="post" action="/factures/${inv.id}/paiements" class="payf"><div class="row r2"><label>Montant<input name="amount" inputmode="decimal" value="${String(rest).replace('.', ',')}" required></label><label>Date<input type="date" name="date" value="${today()}" required></label></div><div class="row r2"><label>Mode<select name="method">${METHODS.map((m) => `<option>${m}</option>`).join('')}</select></label><label>Référence<input name="reference" placeholder="N° de virement…"></label></div><button class="btn wide">Enregistrer le paiement</button></form>` : ''}</div>
<div class="card"><div class="card-h"><h2>Envoyer</h2></div><div class="copy"><input readonly value="${esc(link)}" id="lnk"><button type="button" class="btn ghost sm" data-copy="#lnk">Copier</button></div><div class="send"><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/${digits(cl.phone)}?text=${encodeURIComponent(msg)}">WhatsApp</a><a class="btn ghost" href="mailto:${esc(cl.email || '')}?subject=${encodeURIComponent('Facture ' + inv.number)}&body=${encodeURIComponent(msg)}">E-mail</a></div></div>
${quote ? `<div class="card"><div class="card-h"><h2>Devis d’origine</h2></div><a href="/devis/${quote.id}"><b>${esc(quote.number)}</b> ${money(quote.total_ttc)} TTC</a></div>` : ''}
${!inv.cancelled && !paid ? `<form method="post" action="/factures/${inv.id}/annuler" data-confirm="Annuler cette facture ? Son numéro reste réservé."><button class="btn ghost sm danger">Annuler la facture</button></form>` : ''}`;
  res.send(layout({ title: `${KIND[inv.kind] || 'Facture'} ${inv.number}`, active: '/factures', actions: '<button type="button" class="btn ghost" data-print>PDF</button>', body: `<div class="docview"><div class="paper">${renderDoc({ type: 'facture', doc: inv, items: Q.iItems.all(inv.id), client: cl, s, paid, quote })}</div><aside class="dv-side">${side}</aside></div>` }));
});
app.post('/factures/:id/paiements', (req, res) => {
  const inv = Q.invoice.get(Number(req.params.id)); if (!inv) return res.sendStatus(404);
  const amount = round2(num(req.body.amount));
  if (amount > 0) db.prepare('INSERT INTO payments (invoice_id, date, amount, method, reference) VALUES (?,?,?,?,?)').run(inv.id, req.body.date || today(), amount, String(req.body.method || 'Virement'), String(req.body.reference || '').slice(0, 80));
  res.redirect('/factures/' + inv.id);
});
app.post('/paiements/:id/supprimer', (req, res) => { const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(req.params.id)); if (p) db.prepare('DELETE FROM payments WHERE id = ?').run(p.id); res.redirect(p ? '/factures/' + p.invoice_id : '/factures'); });
app.post('/factures/:id/annuler', (req, res) => { db.prepare('UPDATE invoices SET cancelled = 1 WHERE id = ?').run(Number(req.params.id)); res.redirect('/factures/' + req.params.id); });

/* ---------------- Clients ---------------- */
app.get('/clients', (req, res) => {
  const rows = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM quotes q WHERE q.client_id = c.id) nq,
    (SELECT COALESCE(SUM(total_ttc),0) FROM invoices i WHERE i.client_id = c.id AND i.cancelled = 0) billed,
    (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.client_id = c.id AND i.cancelled = 0) paid
    FROM clients c ORDER BY COALESCE(c.company, c.name) COLLATE NOCASE`).all();
  const body = `<div class="card flush"><table class="tbl"><thead><tr><th>Client</th><th>Contact</th><th>Ville</th><th class="r">Devis</th><th class="r">Facturé</th><th class="r">Reste dû</th></tr></thead><tbody>${rows.map((c) => `<tr data-href="/clients/${c.id}"><td><a href="/clients/${c.id}"><b>${esc(c.company || c.name)}</b></a>${c.company ? `<small class="mut"> ${esc(c.name)}</small>` : ''}</td><td class="mut">${esc(c.phone || c.email || '')}</td><td>${esc(c.city || '')}</td><td class="r">${c.nq}</td><td class="r">${money(c.billed)}</td><td class="r">${money(Math.max(0, c.billed - c.paid))}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Les clients se créent en même temps qu’un devis.</td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Clients', active: '/clients', body }));
});
app.get('/clients/:id', (req, res) => {
  const c = Q.client.get(Number(req.params.id)); if (!c) return res.sendStatus(404);
  const qs = db.prepare('SELECT * FROM quotes WHERE client_id = ? ORDER BY id DESC').all(c.id);
  const is = db.prepare('SELECT * FROM invoices WHERE client_id = ? ORDER BY id DESC').all(c.id);
  const f = (k, l, t = 'text') => `<label>${l}<input type="${t}" name="${k}" value="${esc(c[k] || '')}"></label>`;
  const body = `<div class="grid2"><form method="post" class="card"><div class="card-h"><h2>Coordonnées</h2></div><div class="row">${f('name', 'Nom et prénom')}${f('company', 'Entreprise')}</div><div class="row">${f('phone', 'Téléphone')}${f('email', 'E-mail', 'email')}</div><div class="row">${f('address', 'Adresse')}${f('city', 'Ville')}</div><div class="row">${f('ice', 'ICE')}</div><label>Notes<textarea name="notes" rows="3">${esc(c.notes || '')}</textarea></label><button class="btn">Enregistrer</button></form>
<div><div class="card"><div class="card-h"><h2>Devis</h2><a href="/devis/nouveau?client=${c.id}">Nouveau devis</a></div>${qs.length ? `<ul class="lst">${qs.map((q) => `<li><a href="/devis/${q.id}"><b>${esc(q.number)}</b><span>${esc(q.title || '')}</span></a><em>${money(q.total_ttc)}</em>${badge(Q_STATUS, qStatus(q))}</li>`).join('')}</ul>` : '<p class="empty">Aucun devis.</p>'}</div>
<div class="card"><div class="card-h"><h2>Factures</h2></div>${is.length ? `<ul class="lst">${is.map((i) => `<li><a href="/factures/${i.id}"><b>${esc(i.number)}</b><span>${esc(KIND[i.kind])}</span></a><em>${money(i.total_ttc)}</em>${badge(I_STATUS, iStatus(i))}</li>`).join('')}</ul>` : '<p class="empty">Aucune facture.</p>'}</div></div></div>`;
  res.send(layout({ title: c.company || c.name, active: '/clients', body, flash: req.query.ok ? 'Client enregistré.' : '' }));
});
app.post('/clients/:id', (req, res) => {
  const b = req.body, id = Number(req.params.id);
  db.prepare('UPDATE clients SET name=?, company=?, phone=?, email=?, address=?, city=?, ice=?, notes=? WHERE id=?').run(...['name', 'company', 'phone', 'email', 'address', 'city', 'ice', 'notes'].map((k) => String(b[k] || '').trim()), id);
  res.redirect(`/clients/${id}?ok=1`);
});

/* ---------------- Demandes du site ---------------- */
app.get('/demandes', (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 300').all();
  const body = `<div class="card flush"><table class="tbl"><thead><tr><th>Reçue</th><th>Contact</th><th>Besoin</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map((l) => `<tr><td>${dateFr(l.created_at)}</td><td><b>${esc(l.company || l.name || '')}</b><small class="mut"> ${esc([l.name !== l.company ? l.name : '', l.phone, l.email].filter(Boolean).join(', '))}</small></td><td class="mut">${esc((l.need || '') + (l.message ? ' : ' + l.message : '')).slice(0, 140)}</td><td>${l.status === 'nouveau' ? '<span class="bdg bdg-blue">Nouvelle</span>' : l.quote_id ? `<a href="/devis/${l.quote_id}" class="bdg bdg-green">Devis fait</a>` : '<span class="bdg bdg-grey">Traitée</span>'}</td><td class="r">${l.status === 'nouveau' ? `<a class="btn sm" href="/devis/nouveau?demande=${l.id}">Faire le devis</a> <form method="post" action="/demandes/${l.id}/traitee" class="inl"><button class="btn ghost sm">Traitée</button></form>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Les demandes envoyées depuis le site apparaîtront ici.</td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Demandes du site', active: '/demandes', body }));
});
app.post('/demandes/:id/traitee', (req, res) => { db.prepare("UPDATE leads SET status = 'traitee' WHERE id = ?").run(Number(req.params.id)); res.redirect('/demandes'); });

/* ---------------- Prestations (catalogue) ---------------- */
app.get('/prestations', (req, res) => {
  const rows = db.prepare('SELECT * FROM services ORDER BY sort, id').all();
  const r = (x, i) => `<tr><td><input name="s[${i}][name]" value="${esc(x.name || '')}" placeholder="Nouvelle prestation"><input type="hidden" name="s[${i}][id]" value="${x.id || ''}"></td><td><input name="s[${i}][description]" value="${esc(x.description || '')}"></td><td><input name="s[${i}][unit]" value="${esc(x.unit || 'forfait')}" class="it-u"></td><td><input name="s[${i}][unit_price]" value="${x.unit_price ? String(x.unit_price).replace('.', ',') : ''}" inputmode="decimal" class="it-p" placeholder="0,00"></td><td class="c"><input type="checkbox" name="s[${i}][active]" value="1"${x.active === 0 ? '' : ' checked'}></td></tr>`;
  const body = `<p class="hint">Vos prestations et vos prix habituels. Ils se remplissent tout seuls dans les devis, et restent modifiables ligne par ligne.</p><form method="post" class="card flush"><table class="tbl edit"><thead><tr><th>Prestation</th><th>Description</th><th>Unité</th><th>Prix HT</th><th class="c">Active</th></tr></thead><tbody>${rows.map(r).join('')}${r({}, rows.length)}${r({}, rows.length + 1)}</tbody></table><div class="pad"><button class="btn">Enregistrer le catalogue</button></div></form>`;
  res.send(layout({ title: 'Prestations', active: '/prestations', body, flash: req.query.ok ? 'Catalogue enregistré.' : '' }));
});
app.post('/prestations', (req, res) => {
  const list = req.body.s ? Object.values(req.body.s) : [];
  list.forEach((x, i) => {
    const name = String(x.name || '').trim(), active = x.active ? 1 : 0, f = [name, String(x.description || ''), String(x.unit || 'forfait'), round2(num(x.unit_price)), active, i];
    if (x.id) { if (name) db.prepare('UPDATE services SET name=?, description=?, unit=?, unit_price=?, active=?, sort=? WHERE id=?').run(...f, Number(x.id)); else db.prepare('DELETE FROM services WHERE id = ?').run(Number(x.id)); }
    else if (name) db.prepare('INSERT INTO services (name, description, unit, unit_price, active, sort) VALUES (?,?,?,?,?,?)').run(...f);
  });
  res.redirect('/prestations?ok=1');
});

/* ---------------- Paramètres ---------------- */
app.get('/parametres', (req, res) => {
  const s = settings();
  const f = (k, l, ph = '') => `<label>${l}<input name="${k}" value="${esc(s[k])}" placeholder="${esc(ph)}"></label>`;
  const body = `<form method="post" class="settings">
<section class="card"><div class="card-h"><h2>Votre entreprise</h2><span>Apparaît sur tous les devis et factures</span></div><div class="row">${f('company_name', 'Nom')}${f('company_tagline', 'Activité')}</div><div class="row">${f('company_address', 'Adresse')}${f('company_site', 'Site web')}</div><div class="row">${f('company_phone', 'Téléphone')}${f('company_email', 'E-mail')}</div><div class="row">${f('whatsapp', 'WhatsApp (format international, sans +)', '2126…')}${f('public_url', 'Adresse de cet espace en ligne', 'https://gestion.digilago.ma')}</div></section>
<section class="card"><div class="card-h"><h2>Mentions légales</h2><span>Obligatoires sur les factures au Maroc</span></div><div class="row">${f('company_legal', 'Forme juridique et capital', 'SARL au capital de …')}${f('company_ice', 'ICE')}</div><div class="row">${f('company_if', 'Identifiant fiscal (IF)')}${f('company_rc', 'Registre du commerce (RC)')}</div><div class="row">${f('company_patente', 'Patente')}${f('company_cnss', 'CNSS')}</div></section>
<section class="card"><div class="card-h"><h2>Banque</h2></div><div class="row">${f('bank_name', 'Banque')}${f('bank_rib', 'RIB (24 chiffres)')}</div><div class="row">${f('bank_swift', 'SWIFT (facultatif)')}</div></section>
<section class="card"><div class="card-h"><h2>Valeurs par défaut</h2></div><div class="row r4">${f('default_tva', 'TVA (%)')}${f('default_deposit', 'Acompte (%)')}${f('default_validity', 'Validité des devis (jours)')}${f('default_due_days', 'Échéance des factures (jours)')}</div><div class="row">${f('default_delay', 'Délai affiché')}${f('quote_prefix', 'Préfixe des devis')}${f('invoice_prefix', 'Préfixe des factures')}</div><label>Conditions par défaut<textarea name="default_conditions" rows="4">${esc(s.default_conditions)}</textarea></label></section>
<button class="btn">Enregistrer les paramètres</button></form>
<form method="post" action="/parametres/mot-de-passe" class="card"><div class="card-h"><h2>Mot de passe</h2></div><div class="row"><label>Nouveau mot de passe<input type="password" name="pw" minlength="8" required></label><label>Confirmer<input type="password" name="pw2" minlength="8" required></label></div><button class="btn ghost">Changer le mot de passe</button></form>
<div class="card"><div class="card-h"><h2>Sauvegarde et export</h2></div><div class="send"><a class="btn ghost" href="/sauvegarde">Télécharger la sauvegarde complète</a><a class="btn ghost" href="/export/factures.csv">Factures (CSV)</a><a class="btn ghost" href="/export/paiements.csv">Paiements (CSV)</a></div></div>`;
  const flash = req.query.bienvenue ? 'Bienvenue ! Complétez vos informations : elles apparaîtront sur vos devis et factures.' : req.query.ok ? 'Paramètres enregistrés.' : req.query.pw ? 'Mot de passe changé.' : '';
  res.send(layout({ title: 'Paramètres', active: '/parametres', body, flash }));
});
app.post('/parametres', (req, res) => { saveSettings(req.body); res.redirect('/parametres?ok=1'); });
app.post('/parametres/mot-de-passe', (req, res) => { const { pw = '', pw2 = '' } = req.body; if (pw.length >= 8 && pw === pw2) setS('_pw', hashPw(pw)); res.redirect('/parametres?pw=1'); });


/* ---------------- Projets : du devis accepté à la mise en ligne ---------------- */
const steps = (p) => { try { return JSON.parse(p.steps || '[]'); } catch (e) { return []; } };
app.get('/projets', (req, res) => {
  const rows = db.prepare('SELECT p.*, c.name cname, c.company ccomp FROM projects p LEFT JOIN clients c ON c.id = p.client_id ORDER BY COALESCE(p.due_date, p.created_at)').all();
  const col = (k) => { const list = rows.filter((p) => p.status === k); return `<section class="kb-col"><header>${badge(P_STATUS, k)}<span>${list.length}</span></header>${list.map((p) => { const st = steps(p), d = st.filter((x) => x.d).length, late = k !== 'livre' && p.due_date && p.due_date < today(); return `<a class="kb-card" href="/projets/${p.id}"><b>${esc(p.ccomp || p.cname || '')}</b><span>${esc(p.title || '')}</span><div class="prog"><i style="width:${st.length ? Math.round(100 * d / st.length) : 0}%"></i></div><small class="${late ? 'red' : ''}">${d}/${st.length} étapes${p.due_date ? ' · livraison ' + dateFr(p.due_date) : ''}</small>${(() => { const c = completeness(p, Q.client.get(p.client_id)); return `<em class="kb-inf ${c.pct === 100 ? 'ok' : ''}">Infos ${c.pct} %</em>`; })()}</a>`; }).join('') || '<p class="empty">Aucun projet.</p>'}</section>`; };
  res.send(layout({ title: 'Projets', active: '/projets', body: `<p class="hint">Chaque devis accepté ouvre un projet. Suivez chaque étape jusqu’à la mise en ligne.</p><div class="kanban">${['a_demarrer', 'en_cours', 'validation', 'livre'].map(col).join('')}</div>` }));
});
app.get('/projets/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const cl = Q.client.get(p.client_id) || {}, q = p.quote_id ? Q.quote.get(p.quote_id) : null, st = steps(p);
  const invs = q ? Q.quoteInvoices.all(q.id) : [];
  if (!p.token) { p.token = token(); db.prepare('UPDATE projects SET token = ? WHERE id = ?').run(p.token, p.id); }
  const inf = pinfo(p), cp = completeness(p, cl), blink = `${baseUrl(req)}/brief/${p.token}`;
  const bmsg = `Bonjour ${cl.name || ''}, pour avancer sur votre site, pouvez-vous compléter ces informations (2 minutes) ? ${blink}`;
  const infoCard = `<form method="post" action="/projets/${p.id}/infos" class="card"><div class="card-h"><h2>Informations à réunir</h2><span class="pc ${cp.pct === 100 ? 'ok' : ''}">${cp.pct} %</span></div><div class="prog big"><i style="width:${cp.pct}%"></i></div>
${cp.missing.length ? `<p class="miss"><b>Il manque :</b> ${cp.missing.map(esc).join(', ')}.</p>` : '<p class="miss ok">Tout est réuni. Vous avez tout pour livrer.</p>'}
<div class="brief-l"><span>Le client peut tout remplir lui-même :</span><div class="copy"><input readonly value="${esc(blink)}" id="blnk"><button type="button" class="btn ghost sm" data-copy="#blnk">Copier</button>${cl.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${digits(cl.whatsapp || cl.phone)}?text=${encodeURIComponent(bmsg)}">Envoyer</a>` : ''}</div></div>
<details class="inf"><summary>Compléter moi-même</summary><div class="row">${CLIENT_FIELDS.slice(0, 2).map(([k, l]) => `<label>${l}<input name="c_${k}" value="${esc(cl[k] || '')}"></label>`).join('')}</div><div class="row">${CLIENT_FIELDS.slice(2, 4).map(([k, l]) => `<label>${l}<input name="c_${k}" value="${esc(cl[k] || '')}"></label>`).join('')}</div><div class="row">${CLIENT_FIELDS.slice(4).map(([k, l]) => `<label>${l}<input name="c_${k}" value="${esc(cl[k] || '')}"></label>`).join('')}</div>${INFO_FIELDS.map(([k, l]) => `<label>${l}<input name="i_${k}" value="${esc(inf[k] || '')}"></label>`).join('')}<button class="btn sm">Enregistrer les informations</button></details></form>`;
  const body = infoCard + `<div class="grid2"><form method="post" class="card"><div class="card-h"><h2>Avancement</h2>${badge(P_STATUS, p.status)}</div>
<ul class="steps">${st.map((x, i) => `<li><label class="chk"><input type="checkbox" name="d${i}" value="1"${x.d ? ' checked' : ''}> ${esc(x.t)}</label></li>`).join('')}</ul>
<div class="row"><label>Statut<select name="status">${Object.keys(P_STATUS).map((k) => `<option value="${k}"${p.status === k ? ' selected' : ''}>${P_STATUS[k][0]}</option>`).join('')}</select></label><label>Livraison prévue<input type="date" name="due_date" value="${esc(p.due_date || '')}"></label></div>
<label>Adresse du site livré<input name="site_url" value="${esc(p.site_url || '')}" placeholder="https://…"></label><label>Notes internes<textarea name="notes" rows="4">${esc(p.notes || '')}</textarea></label><button class="btn">Enregistrer</button></form>
<div><div class="card"><div class="card-h"><h2>Client</h2></div><a href="/clients/${cl.id}"><b>${esc(cl.company || cl.name || '')}</b></a><p class="mut">${esc([cl.name, cl.phone, cl.email].filter(Boolean).join(' · '))}</p>${cl.phone ? `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${digits(cl.phone)}">WhatsApp</a>` : ''}</div>
${q ? `<div class="card"><div class="card-h"><h2>Devis et factures</h2></div><ul class="lst"><li><a href="/devis/${q.id}"><b>${esc(q.number)}</b><span>Devis</span></a><em>${money(q.total_ttc)}</em></li>${invs.map((i) => `<li><a href="/factures/${i.id}"><b>${esc(i.number)}</b><span>${esc(KIND[i.kind])}</span></a><em>${money(i.total_ttc)}</em>${badge(I_STATUS, iStatus(i))}</li>`).join('')}</ul></div>` : ''}</div></div>`;
  res.send(layout({ title: p.title || 'Projet', active: '/projets', body, flash: req.query.ok ? 'Projet mis à jour.' : '' }));
});

app.post('/projets/:id/infos', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const b = req.body, cl = Q.client.get(p.client_id) || {};
  const v = (k) => String(b['c_' + k] ?? cl[k] ?? '').trim();
  db.prepare('UPDATE clients SET company = ?, address = ?, city = ?, phone = ?, email = ?, ice = ? WHERE id = ?').run(v('company'), v('address'), v('city'), v('phone'), v('email'), v('ice'), p.client_id);
  const inf = pinfo(p); for (const [k] of INFO_FIELDS) if (('i_' + k) in b) inf[k] = String(b['i_' + k] || '').trim();
  db.prepare('UPDATE projects SET info = ? WHERE id = ?').run(JSON.stringify(inf), p.id);
  res.redirect(`/projets/${p.id}?ok=1`);
});
app.post('/projets/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); if (!p) return res.sendStatus(404);
  const st = steps(p).map((x, i) => ({ t: x.t, d: req.body['d' + i] ? 1 : 0 }));
  const status = P_STATUS[req.body.status] ? req.body.status : p.status;
  db.prepare("UPDATE projects SET steps = ?, status = ?, due_date = ?, site_url = ?, notes = ?, delivered_at = CASE WHEN ? = 'livre' THEN COALESCE(delivered_at, datetime('now')) ELSE NULL END WHERE id = ?").run(JSON.stringify(st), status, req.body.due_date || null, String(req.body.site_url || ''), String(req.body.notes || ''), status, p.id);
  res.redirect(`/projets/${p.id}?ok=1`);
});

/* ---------------- Dépenses ---------------- */
const CATS = ['Hébergement', 'Noms de domaine', 'Logiciels et abonnements', 'Publicité', 'Sous-traitance', 'Matériel', 'Déplacements', 'Télécom', 'Impôts et taxes', 'Autre'];
app.get('/depenses', (req, res) => {
  const m = String(req.query.mois || today().slice(0, 7));
  const rows = db.prepare('SELECT * FROM expenses WHERE substr(date,1,7) = ? ORDER BY date DESC, id DESC').all(m);
  const tot = rows.reduce((a, e) => a + e.amount_ttc, 0), tva = rows.reduce((a, e) => a + e.tva, 0);
  const body = `<form method="post" class="card"><div class="card-h"><h2>Ajouter une dépense</h2></div><div class="row r4"><label>Date<input type="date" name="date" value="${today()}" required></label><label>Fournisseur<input name="supplier" placeholder="Ex. : Hostinger" required></label><label>Catégorie<select name="category">${CATS.map((c) => `<option>${c}</option>`).join('')}</select></label><label>Libellé<input name="label" placeholder="Ex. : hébergement annuel"></label></div><div class="row r4"><label>Montant TTC<input name="amount_ttc" inputmode="decimal" required></label><label>Dont TVA<input name="tva" inputmode="decimal" placeholder="0,00"></label><label>Mode<select name="method"><option>Carte</option><option>Virement</option><option>Espèces</option><option>Chèque</option></select></label><label>&nbsp;<button class="btn">Ajouter</button></label></div></form>
<div class="tools"><form class="search"><input type="month" name="mois" value="${esc(m)}" onchange="this.form.submit()"></form><div><b>${money(tot)}</b> <span class="mut">TTC ce mois, dont ${money(tva)} de TVA</span> <a class="btn ghost sm" href="/export/depenses.csv">Exporter (CSV)</a></div></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Date</th><th>Fournisseur</th><th>Catégorie</th><th>Libellé</th><th class="r">TTC</th><th class="r">TVA</th><th></th></tr></thead><tbody>${rows.map((e) => `<tr><td>${dateFr(e.date)}</td><td><b>${esc(e.supplier)}</b></td><td><span class="bdg bdg-grey">${esc(e.category)}</span></td><td class="mut">${esc(e.label || '')}</td><td class="r">${money(e.amount_ttc)}</td><td class="r">${money(e.tva)}</td><td class="r"><form method="post" action="/depenses/${e.id}/supprimer" data-confirm="Supprimer cette dépense ?"><button class="x" aria-label="Supprimer">×</button></form></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucune dépense ce mois.</td></tr>'}</tbody></table></div>`;
  res.send(layout({ title: 'Dépenses', active: '/depenses', body }));
});
app.post('/depenses', (req, res) => {
  const b = req.body, amt = round2(num(b.amount_ttc));
  if (amt > 0) db.prepare('INSERT INTO expenses (date, supplier, category, label, amount_ttc, tva, method) VALUES (?,?,?,?,?,?,?)').run(b.date || today(), String(b.supplier || '').slice(0, 120), CATS.includes(b.category) ? b.category : 'Autre', String(b.label || '').slice(0, 200), amt, round2(num(b.tva)), String(b.method || ''));
  res.redirect('/depenses?mois=' + String(b.date || today()).slice(0, 7));
});
app.post('/depenses/:id/supprimer', (req, res) => { const e = db.prepare('SELECT date FROM expenses WHERE id = ?').get(Number(req.params.id)); db.prepare('DELETE FROM expenses WHERE id = ?').run(Number(req.params.id)); res.redirect('/depenses' + (e ? '?mois=' + e.date.slice(0, 7) : '')); });

/* ---------------- Rapports : chiffre d'affaires, encaissements, dépenses, TVA ---------------- */
app.get('/rapports', (req, res) => {
  const y = String(Number(req.query.annee) || Number(today().slice(0, 4)));
  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const rows = MOIS.map((nm, i) => {
    const k = `${y}-${String(i + 1).padStart(2, '0')}`;
    const inv = db.prepare("SELECT COALESCE(SUM(total_ht),0) ht, COALESCE(SUM(total_tva),0) tva FROM invoices WHERE cancelled = 0 AND substr(issue_date,1,7) = ?").get(k);
    const cash = db.prepare("SELECT COALESCE(SUM(p.amount),0) s FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.cancelled = 0 AND substr(p.date,1,7) = ?").get(k).s;
    const exp = db.prepare("SELECT COALESCE(SUM(amount_ttc),0) t, COALESCE(SUM(tva),0) tva FROM expenses WHERE substr(date,1,7) = ?").get(k);
    return { nm, ht: inv.ht, tvaC: inv.tva, cash, exp: exp.t, tvaD: exp.tva };
  });
  const T = rows.reduce((a, r) => { for (const k of ['ht', 'tvaC', 'cash', 'exp', 'tvaD']) a[k] += r[k]; return a; }, { ht: 0, tvaC: 0, cash: 0, exp: 0, tvaD: 0 });
  const mx = Math.max(1, ...rows.map((r) => Math.max(r.cash, r.exp)));
  const body = `<div class="tools"><nav class="tabs">${[Number(y) - 1, Number(y), Number(y) + 1].map((a) => `<a href="/rapports?annee=${a}" class="${String(a) === y ? 'on' : ''}">${a}</a>`).join('')}</nav></div>
<section class="kpis">${[['Chiffre d’affaires HT', money(T.ht), 'factures émises', 'hl'], ['Encaissé', money(T.cash), 'paiements reçus'], ['Dépenses', money(T.exp), 'TTC'], ['Résultat de trésorerie', money(T.cash - T.exp), 'encaissé − dépenses', T.cash - T.exp < 0 ? 'warn' : ''], ['TVA à reverser (estimation)', money(T.tvaC - T.tvaD), 'collectée − déductible']].map(([l, v, s, c]) => `<div class="kpi ${c || ''}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('')}</section>
<div class="card"><div class="card-h"><h2>Encaissements et dépenses</h2><span><i class="lg-c"></i> encaissé <i class="lg-d"></i> dépenses</span></div><div class="bars dual">${rows.map((r) => `<div class="bar"><div class="bb"><i style="height:${Math.max(2, Math.round(100 * r.cash / mx))}%"></i><i class="d" style="height:${Math.max(2, Math.round(100 * r.exp / mx))}%"></i></div><span>${r.nm.slice(0, 4)}.</span></div>`).join('')}</div></div>
<div class="card flush"><table class="tbl"><thead><tr><th>Mois</th><th class="r">CA HT</th><th class="r">TVA collectée</th><th class="r">Encaissé</th><th class="r">Dépenses</th><th class="r">TVA déductible</th><th class="r">Résultat</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.nm}</td><td class="r">${money(r.ht)}</td><td class="r">${money(r.tvaC)}</td><td class="r">${money(r.cash)}</td><td class="r">${money(r.exp)}</td><td class="r">${money(r.tvaD)}</td><td class="r"><b class="${r.cash - r.exp < 0 ? 'red' : ''}">${money(r.cash - r.exp)}</b></td></tr>`).join('')}<tr class="tot"><td>Total ${y}</td><td class="r">${money(T.ht)}</td><td class="r">${money(T.tvaC)}</td><td class="r">${money(T.cash)}</td><td class="r">${money(T.exp)}</td><td class="r">${money(T.tvaD)}</td><td class="r">${money(T.cash - T.exp)}</td></tr></tbody></table></div>
<p class="hint">Ces chiffres sont des indicateurs de gestion. Faites valider vos déclarations (TVA, impôts) par votre comptable.</p>`;
  res.send(layout({ title: 'Rapports ' + y, active: '/rapports', body }));
});

/* ---------------- Exports et sauvegarde ---------------- */
const csv = (rows) => '\ufeff' + rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
const dec = (n) => String(round2(n)).replace('.', ',');
app.get('/export/factures.csv', (req, res) => {
  const rows = db.prepare('SELECT i.*, c.name cname, c.company ccomp, c.ice cice FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ORDER BY i.number').all();
  const out = [['Numéro', 'Type', 'Date', 'Échéance', 'Client', 'ICE client', 'Total HT', 'TVA', 'Total TTC', 'Réglé', 'Reste', 'Statut']];
  for (const i of rows) { const p = paidOf(i.id); out.push([i.number, KIND[i.kind], i.issue_date, i.due_date, i.ccomp || i.cname, i.cice, dec(i.total_ht), dec(i.total_tva), dec(i.total_ttc), dec(p), dec(Math.max(0, i.total_ttc - p)), I_STATUS[iStatus(i, p)][0]]); }
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="factures.csv"' }).send(csv(out));
});
app.get('/export/paiements.csv', (req, res) => {
  const rows = db.prepare('SELECT p.*, i.number inum, c.name cname, c.company ccomp FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN clients c ON c.id = i.client_id ORDER BY p.date').all();
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="paiements.csv"' }).send(csv([['Date', 'Facture', 'Client', 'Montant', 'Mode', 'Référence'], ...rows.map((p) => [p.date, p.inum, p.ccomp || p.cname, dec(p.amount), p.method, p.reference])]));
});
app.get('/export/depenses.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses ORDER BY date').all();
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="depenses.csv"' }).send(csv([['Date', 'Fournisseur', 'Catégorie', 'Libellé', 'TTC', 'TVA', 'Mode'], ...rows.map((e) => [e.date, e.supplier, e.category, e.label, dec(e.amount_ttc), dec(e.tva), e.method])]));
});
app.get('/sauvegarde', (req, res) => {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  res.download(DB_PATH, `digilago-sauvegarde-${today()}.db`);
});

app.use((req, res) => res.status(404).send(layout({ title: 'Page introuvable', body: '<div class="card"><p>Cette page n’existe pas. <a href="/">Retour au tableau de bord</a></p></div>' })));
app.use((err, req, res, next) => { console.error(err); res.status(500).send(layout({ title: 'Erreur', body: `<div class="card"><p>Une erreur est survenue : ${esc(err.message)}</p></div>` })); });

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) app.listen(PORT, () => console.log(`Digilago Gestion : http://localhost:${PORT}`));
module.exports = app;
