'use strict';
/* Espace client « Suivi de projet ».
   Côté client (lien privé /suivi/<jeton>, sans mot de passe) : avancement en direct, « À faire de votre côté »
   (réservé aux projets en cours), fichiers, validation de maquette, messages, puis la remise du site livré.
   Côté Digilago : la carte « Espace client » de la fiche projet (tâches, réponses, fichiers, messages).
   Les fichiers sont gardés dans la base (Turso), 4 Mo au plus chacun : aucune configuration en plus. */
const express = require('express');

const MAX_FILE = 4 * 1024 * 1024;          // la limite de Vercel pour un envoi est de 4,5 Mo
const MAX_FILES = 30, MAX_TOTAL = 60 * 1024 * 1024;
const ACTIVE = ['a_demarrer', 'en_cours', 'validation'];   // l'espace de travail du client n'existe que pendant la réalisation
const KINDS = { texte: 'Une réponse écrite', fichier: 'Un ou plusieurs fichiers', validation: 'Une validation (maquette, site)', confirmer: 'Une action à confirmer' };
const STEP_TXT = {
  'Brief et identité': 'Nous réunissons vos informations, votre logo et vos couleurs.',
  'Maquette validée': 'Vous découvrez le design de votre site et nous le validons ensemble.',
  'Développement': 'Nous construisons votre site : rapide, adapté au téléphone, en trois langues.',
  'Textes SEO et GEO': 'Nous rédigeons les textes pour que Google et les assistants IA vous recommandent.',
  'Fiche Google': 'Nous créons ou optimisons votre fiche Google Business.',
  'Mise en ligne': 'Votre site est publié, testé et remis avec ses accès.',
};
const STATE_TXT = {
  proposition: ['Proposition envoyée', 'Nous attendons votre accord pour démarrer.'],
  a_demarrer: ['Démarrage', 'Votre projet est lancé : réunissons les premiers éléments.'],
  en_cours: ['En cours de réalisation', 'Nous construisons votre site.'],
  validation: ['À votre validation', 'Votre site est prêt à être relu : dites-nous ce que vous en pensez.'],
  livre: ['Livré', 'Votre site est en ligne.'],
};
/* tâches prêtes à l'emploi dans la gestion : [clé, bouton, type, titre, consigne, étape cochée à la validation] */
const PRESETS = [
  ['logo', 'Logo', 'fichier', 'Envoyer votre logo', 'Idéalement en PNG transparent, SVG ou PDF. Si vous n’en avez pas, dites-le nous dans un message : nous pouvons en créer un.', null],
  ['photos', 'Photos', 'fichier', 'Envoyer vos photos', 'Façade, équipe, réalisations, produits : tout ce qui montre votre activité. Photos nettes, en format paysage de préférence.', null],
  ['docs', 'Documents', 'fichier', 'Envoyer vos documents', 'Registre de commerce, catalogue, tarifs, brochure… ce qui peut nous aider à rédiger vos pages.', null],
  ['horaires', 'Horaires', 'texte', 'Indiquer vos horaires d’ouverture', 'Jour par jour, avec les pauses et les jours de fermeture.', null],
  ['services', 'Services', 'texte', 'Décrire vos services', 'Listez ce que vous proposez, avec quelques mots pour chaque service. Nous nous occupons de la rédaction.', null],
  ['maquette', 'Maquette', 'validation', 'Valider la maquette de votre site', 'Regardez le design, puis validez-le ou dites-nous ce que vous voulez changer.', 1],
  ['relecture', 'Relecture', 'validation', 'Relire le site avant la mise en ligne', 'Parcourez toutes les pages, sur téléphone et sur ordinateur, puis donnez-nous votre accord.', 5],
  ['google', 'Fiche Google', 'confirmer', 'Nous donner accès à votre fiche Google', 'Ajoutez contact@digilago.ma comme gestionnaire de votre fiche Google Business, puis confirmez ici.', null],
];
const EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' };
const OTHER_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'zip', 'ai', 'eps', 'svg', 'psd', 'heic'];
const ZIPLIKE = ['docx', 'xlsx', 'pptx', 'zip', 'odt', 'ods'];
const ACCEPT = Object.keys(EXT).concat(OTHER_EXT).map((e) => '.' + e).join(',');
const extOf = (n) => (String(n).toLowerCase().match(/\.([a-z0-9]{2,5})$/) || [])[1] || '';
function magicOk(ext, b) {
  if (['jpg', 'jpeg'].includes(ext)) return b[0] === 0xff && b[1] === 0xd8;
  if (ext === 'png') return b.length > 4 && b.subarray(0, 4).toString('hex') === '89504e47';
  if (ext === 'gif') return b.subarray(0, 3).toString() === 'GIF';
  if (ext === 'pdf') return b.subarray(0, 4).toString() === '%PDF';
  if (ext === 'webp') return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  if (ZIPLIKE.includes(ext)) return b[0] === 0x50 && b[1] === 0x4b;
  return true;
}
const cleanName = (n) => String(n || 'fichier').replace(/[\\/]/g, '_').replace(/[\u0000-\u001f<>:"|?*]/g, '').trim().slice(-120) || 'fichier';
const link = (v) => { const s = String(v || '').trim(); return /^https?:\/\/[^\s<>"']{4,300}$/i.test(s) ? s : ''; };
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko');

module.exports = function suivi(K) {
  const { db, settings, esc, token, today, dateFr, publicPage, hit, log, digits, steps, pinfo, ptech, completeness, CLIENT_FIELDS, INFO_FIELDS, saveBrief, Q, withPaid, iStatus, I_STATUS, KIND, money, baseUrl } = K;
  const cut = (v, n) => String(v || '').trim().slice(0, n);
  const isId = (v) => /^\d{1,12}$/.test(String(v));
  const left = (d) => (d ? Math.round((new Date(d + 'T12:00:00Z') - new Date(today() + 'T12:00:00Z')) / 864e5) : null);
  const when = (ts) => (ts ? dateFr(String(ts).slice(0, 10)) : '');
  const projectByToken = async (t) => (String(t).length >= 10 ? db.prepare('SELECT * FROM projects WHERE token = ?').get(String(t)) : null);
  const filesOf = (pid) => db.prepare('SELECT id, project_id, task_id, author, name, mime, size, shared, seen, created_at FROM project_files WHERE project_id = ? ORDER BY id').all(pid);
  const tasksOf = (pid) => db.prepare('SELECT * FROM project_tasks WHERE project_id = ? ORDER BY position, id').all(pid);
  const gone = async () => publicPage('Introuvable', '<div class="pub-msg"><h1>Ce lien n’est plus valide.</h1></div>');
  const nostore = (res) => res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });

  /* ---------- stockage des fichiers ---------- */
  async function saveFile(p, { author, taskId, shared, name, body }) {
    if (!Buffer.isBuffer(body) || !body.length) return { err: 'Le fichier est vide.' };
    if (body.length > MAX_FILE) return { err: 'Fichier trop lourd : 4 Mo au maximum.' };
    const nm = cleanName(name), ext = extOf(nm);
    if (!EXT[ext] && !OTHER_EXT.includes(ext)) return { err: 'Ce type de fichier n’est pas accepté. Envoyez une image, un PDF ou un document Office.' };
    if (!magicOk(ext, body)) return { err: 'Ce fichier ne correspond pas à son extension.' };
    const st = await db.prepare('SELECT COUNT(*) n, COALESCE(SUM(size),0) s FROM project_files WHERE project_id = ?').get(p.id);
    if (st.n >= MAX_FILES || st.s + body.length > MAX_TOTAL) return { err: 'Vous avez atteint la limite de fichiers pour ce projet. Écrivez-nous : nous vous ouvrirons plus de place.' };
    const r = await db.prepare('INSERT INTO project_files (project_id, task_id, author, name, mime, size, data, shared, seen) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(p.id, taskId || null, author, nm, EXT[ext] || 'application/octet-stream', body.length, body, shared ? 1 : 0, author === 'digilago' ? 1 : 0);
    return { id: r.lastInsertRowid, name: nm };
  }
  async function sendFile(res, f) {
    const row = await db.prepare('SELECT name, mime, data FROM project_files WHERE id = ?').get(f.id);
    if (!row) return res.sendStatus(404);
    const inline = !!EXT[extOf(row.name)];
    res.set({ 'Content-Type': inline ? row.mime : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.name)}`, 'Content-Security-Policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'", 'Cache-Control': 'private, no-store' });
    res.send(Buffer.from(row.data));
  }
  const rawParser = express.raw({ type: () => true, limit: '4.6mb' });
  /* sur Vercel, le corps est parfois déjà lu (Buffer) avant Express : on le reprend tel quel au lieu de relire un flux épuisé */
  const raw = (req, res, next) => (Buffer.isBuffer(req.body) && req.body.length ? next() : rawParser(req, res, next));
  const rawErr = (err, req, res, next) => res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Fichier trop lourd : 4 Mo au maximum.' : 'Envoi impossible.' });

  /* une réponse du client met à jour la tâche (ce que Digilago doit voir : seen = 0) */
  async function markStep(p, idx) {
    if (idx === null || idx === undefined || idx === '') return;
    const st = steps(p); const i = Number(idx); if (!st[i]) return;
    st[i].d = 1; await db.prepare('UPDATE projects SET steps = ? WHERE id = ?').run(JSON.stringify(st), p.id);
  }

  /* ================== côté client ================== */
  function mountPublic(app) {
    const back = (p, q = '', h = '') => `/suivi/${p.token}${q}${h}`;

    app.get('/suivi/:token', async (req, res) => {
      nostore(res);
      const p = await projectByToken(req.params.token); if (!p) return res.status(404).send(await gone());
      res.send(await publicPage('Suivi de votre projet', await clientBody(p, req)));
    });
    app.post('/suivi/:token/infos', async (req, res) => {
      const p = await projectByToken(req.params.token); if (!p) return res.sendStatus(404);
      if (!ACTIVE.includes(p.status) && p.status !== 'livre') return res.redirect(back(p));
      if (await hit('suivi:' + req.ip, 600000, 60)) return res.status(429).send('Trop de demandes. Réessayez dans quelques minutes.');
      await saveBrief(p, req.body); await log('suivi', p.id, 'Le client a complété ses informations');
      res.redirect(back(p, '?ok=infos', '#infos'));
    });
    app.post('/suivi/:token/tache/:tid', async (req, res) => {
      const p = await projectByToken(req.params.token); if (!p || !isId(req.params.tid)) return res.sendStatus(404);
      if (!ACTIVE.includes(p.status)) return res.redirect(back(p));
      if (await hit('suivi:' + req.ip, 600000, 60)) return res.status(429).send('Trop de demandes. Réessayez dans quelques minutes.');
      const t = await db.prepare('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?').get(Number(req.params.tid), p.id); if (!t) return res.sendStatus(404);
      const h = '#t' + t.id, b = req.body || {};
      if (t.status === 'done') return res.redirect(back(p, '', h));
      let status = null, answer = null;
      if (t.kind === 'texte') { answer = cut(b.answer, 3000); if (!answer) return res.redirect(back(p, '?e=vide', h)); status = 'review'; }
      else if (t.kind === 'validation') {
        if (b.decision === 'ok') { status = 'done'; answer = 'Validé' + (cut(b.comment, 1000) ? ' : ' + cut(b.comment, 1000) : ''); await markStep(p, t.step_idx); }
        else { const c = cut(b.comment, 2000); if (!c) return res.redirect(back(p, '?e=modif', h)); status = 'review'; answer = 'Modifications demandées : ' + c; }
      } else if (t.kind === 'confirmer') { status = 'done'; answer = 'Fait'; }
      else return res.redirect(back(p, '', h));
      await db.prepare("UPDATE project_tasks SET status = ?, answer = ?, seen = 0, feedback = NULL, done_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END WHERE id = ?").run(status, answer, status, t.id);
      await log('suivi', p.id, `${t.title} : ${answer}`.slice(0, 280));
      res.redirect(back(p, '?ok=tache', h));
    });
    app.post('/suivi/:token/tache/:tid/fichier', raw, async (req, res) => {
      const p = await projectByToken(req.params.token); if (!p || !isId(req.params.tid)) return res.status(404).json({ error: 'Lien invalide.' });
      if (!ACTIVE.includes(p.status)) return res.status(403).json({ error: 'Cet envoi n’est pas ouvert pour le moment.' });
      if (await hit('suivi-up:' + p.id, 3600000, 40)) return res.status(429).json({ error: 'Trop d’envois. Réessayez dans une heure.' });
      const t = await db.prepare('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?').get(Number(req.params.tid), p.id);
      if (!t || t.kind !== 'fichier') return res.status(404).json({ error: 'Cette demande n’existe plus.' });
      if (t.status === 'done') return res.status(403).json({ error: 'Cette demande est déjà terminée.' });
      const r = await saveFile(p, { author: 'client', taskId: t.id, name: req.query.name, body: req.body });
      if (r.err) return res.status(400).json({ error: r.err });
      await db.prepare("UPDATE project_tasks SET status = 'review', seen = 0, feedback = NULL, done_at = NULL WHERE id = ?").run(t.id);
      await log('suivi', p.id, `Fichier reçu pour « ${t.title} » : ${r.name}`);
      res.json({ ok: true, id: r.id, name: r.name });
    }, rawErr);
    app.get('/suivi/:token/fichier/:fid', async (req, res) => {
      const p = await projectByToken(req.params.token); if (!p || !isId(req.params.fid)) return res.sendStatus(404);
      const f = await db.prepare("SELECT id FROM project_files WHERE id = ? AND project_id = ? AND (author = 'client' OR shared = 1)").get(Number(req.params.fid), p.id);
      if (!f) return res.sendStatus(404);
      await sendFile(res, f);
    });
    app.post('/suivi/:token/message', async (req, res) => {
      const p = await projectByToken(req.params.token); if (!p) return res.sendStatus(404);
      if (await hit('suivi-msg:' + req.ip, 600000, 20)) return res.status(429).send('Trop de messages. Réessayez dans quelques minutes.');
      const body = cut(req.body && req.body.body, 2000); if (!body) return res.redirect(back(p, '?e=msg', '#messages'));
      await db.prepare("INSERT INTO project_msgs (project_id, author, body) VALUES (?, 'client', ?)").run(p.id, body);
      await log('suivi', p.id, 'Message du client : ' + body.slice(0, 200));
      res.redirect(back(p, '?ok=msg', '#messages'));
    });
  }

  async function clientBody(p, req) {
    const s = await settings(), cl = (await Q.client.get(p.client_id)) || {}, inf = pinfo(p), t = ptech(p);
    const st = steps(p), done = st.filter((x) => x.d).length, pct = p.status === 'livre' ? 100 : st.length ? Math.round(100 * done / st.length) : 0;
    const active = ACTIVE.includes(p.status), q = req.query || {};
    const tasks = await tasksOf(p.id), files = await filesOf(p.id), msgs = await db.prepare('SELECT * FROM project_msgs WHERE project_id = ? ORDER BY id DESC LIMIT 60').all(p.id);
    const sv = STATE_TXT[p.status] || ['En cours', ''], T = p.token;
    const wa = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(`Bonjour ${s.company_name}, je vous écris au sujet de mon projet « ${p.title || ''} ».`)}`;
    const cur = st.findIndex((x) => !x.d);
    const flash = q.ok === 'tache' ? 'Merci, c’est bien reçu.' : q.ok === 'infos' ? 'Merci, vos informations sont enregistrées.' : q.ok === 'msg' ? 'Message envoyé. Nous vous répondons ici et sur WhatsApp.' : q.e === 'vide' ? 'Écrivez votre réponse avant d’envoyer.' : q.e === 'modif' ? 'Dites-nous ce que vous voulez modifier.' : q.e === 'msg' ? 'Écrivez votre message avant d’envoyer.' : '';
    const flashErr = !!q.e;

    const bar = `<div class="pub-bar"><div class="pub-in"><div><span class="pub-k">Suivi de votre projet</span><b>${esc(p.title || 'Votre projet')}</b></div><div class="pub-a"><a class="btn ghost" href="#messages">Nous écrire</a><a class="btn wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a></div></div></div>`;
    const hero = `<header class="sv-hero"><div><span class="sv-kick">${esc(cl.company || cl.name || '')}</span><h1>${esc(sv[0])}</h1><p>${esc(sv[1])}</p></div><div class="sv-ring" style="--p:${pct}"><b>${pct}<small>%</small></b><span>${done}/${st.length} étapes</span></div></header>`;
    const meta = [p.due_date && p.status !== 'livre' ? `Livraison prévue le <b>${esc(dateFr(p.due_date))}</b>` : '', p.status === 'livre' && p.delivered_at ? `Livré le <b>${esc(when(p.delivered_at))}</b>` : ''].filter(Boolean).join(' · ');
    const stepper = `<section class="sv-card" id="avancement"><h2>Avancement</h2>${meta ? `<p class="sv-meta">${meta}</p>` : ''}<ol class="sv-steps">${st.map((x, i) => `<li class="${x.d ? 'done' : i === cur && active ? 'now' : ''}"><i>${x.d ? '✓' : i + 1}</i><div><b>${esc(x.t)}</b><small>${esc(STEP_TXT[x.t] || '')}</small></div>${x.d ? '<em>Terminé</em>' : i === cur && active ? '<em class="now">En cours</em>' : ''}</li>`).join('')}</ol></section>`;

    /* À faire de votre côté : seulement pendant la réalisation */
    let todo = '';
    if (p.status === 'proposition') {
      const qt = p.quote_id ? await Q.quote.get(p.quote_id) : null;
      todo = `<section class="sv-card sv-wait"><h2>Votre accord</h2><p>Votre proposition est prête. Dès que vous l’acceptez, votre espace s’ouvre : vos demandes, l’envoi de vos fichiers, la validation de la maquette.</p>${qt && qt.token ? `<p><a class="btn" href="/d/${esc(qt.token)}">Voir ma proposition</a></p>` : ''}</section>`;
    } else if (active) {
      const open = tasks.filter((x) => x.status === 'todo').length;
      todo = `<section class="sv-card" id="afaire"><div class="sv-h"><h2>À faire de votre côté</h2>${open ? `<span class="sv-n">${open} à faire</span>` : '<span class="sv-n ok">Rien à faire</span>'}</div>${tasks.length ? tasks.map((x) => taskCard(p, x, files)).join('') : '<p class="sv-empty">Rien à faire pour l’instant : nous travaillons sur votre site. Si nous avons besoin de quelque chose, vous le trouverez ici et nous vous prévenons.</p>'}</section>`;
    } else if (p.status === 'livre' && tasks.length) {
      todo = `<section class="sv-card"><h2>Ce que vous nous avez confié</h2>${tasks.filter((x) => x.status !== 'todo').map((x) => `<div class="sv-task done"><b>${esc(x.title)}</b><small>${esc(cut(x.answer, 160) || 'Reçu')}</small></div>`).join('') || '<p class="sv-empty">Tout est en place.</p>'}</section>`;
    }

    /* Vos informations (le brief) */
    const c = completeness(p, cl), f = (k, l, v, ta) => `<label>${esc(l)}${ta ? `<textarea name="${k}" rows="3" maxlength="3000">${esc(v || '')}</textarea>` : `<input name="${k}" value="${esc(v || '')}" maxlength="400">`}</label>`;
    const infosCard = active ? `<section class="sv-card" id="infos"><div class="sv-h"><h2>Vos informations</h2><span class="sv-n ${c.pct === 100 ? 'ok' : ''}">${c.pct} % complété</span></div><details${c.pct < 100 ? ' open' : ''}><summary>${c.pct === 100 ? 'Tout est réuni. Modifier mes informations' : 'Compléter mes informations (2 minutes)'}</summary><form method="post" action="/suivi/${esc(T)}/infos" class="sv-form"><div class="row">${f('company', 'Nom de l’entreprise', cl.company || cl.name)}${f('city', 'Ville', cl.city)}</div>${f('address', 'Adresse complète', cl.address)}<div class="row">${f('phone', 'Téléphone', cl.phone)}${f('whatsapp', 'WhatsApp', cl.whatsapp)}</div><div class="row">${f('email', 'E-mail', cl.email)}${f('ice', 'ICE (si société)', cl.ice)}</div>${INFO_FIELDS.map(([k, l]) => f('i_' + k, l, inf[k], k === 'activite')).join('')}<button class="btn">Enregistrer</button></form></details></section>` : '';

    /* Remise du site */
    let delivery = '';
    if (p.status === 'livre') {
      const url = link(t.live_url || p.site_url), dom = cut(t.domain, 120), de = left(t.domain_expiry), he = left(t.hosting_expiry);
      const docs = files.filter((x) => x.shared);
      const row = (k, v) => (v ? `<li><span>${esc(k)}</span><b>${v}</b></li>` : '');
      const exp = (d, n) => (d ? `${esc(dateFr(d))} <small class="${n !== null && n < 30 ? 'warn' : ''}">${n !== null ? (n < 0 ? 'échu' : 'dans ' + n + ' jours') : ''}</small>` : '');
      delivery = `<section class="sv-card sv-live" id="livraison"><h2>Votre site est en ligne</h2>${url ? `<a class="sv-site" href="${esc(url)}" target="_blank" rel="noopener"><span>${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span><i>Ouvrir mon site ↗</i></a>` : '<p class="sv-empty">L’adresse de votre site apparaîtra ici.</p>'}
<ul class="sv-kv">${row('Nom de domaine', dom ? esc(dom) : '')}${row('Domaine valable jusqu’au', exp(t.domain_expiry, de))}${row('Hébergement', t.hosting ? esc(t.hosting) : '')}${row('Hébergement valable jusqu’au', exp(t.hosting_expiry, he))}${row('Fiche Google', link(t.gbp_url) ? `<a href="${esc(link(t.gbp_url))}" target="_blank" rel="noopener">Voir ma fiche</a>` : '')}</ul>
<p class="sv-note">Nous suivons ces échéances pour vous et vous prévenons avant chaque renouvellement.</p>
${link(s.google_review_url) ? `<div class="sv-review"><div><b>Votre avis compte</b><small>Un avis Google nous aide beaucoup. Cela prend une minute.</small></div><a class="btn" href="${esc(link(s.google_review_url))}" target="_blank" rel="noopener">Laisser un avis</a></div>` : ''}
${docs.length ? `<h3>Vos documents</h3><ul class="sv-files">${docs.map((d) => fileRow(T, d)).join('')}</ul>` : ''}</section>`;
    } else {
      const docs = files.filter((x) => x.shared);
      if (docs.length) delivery = `<section class="sv-card"><h2>Documents pour vous</h2><ul class="sv-files">${docs.map((d) => fileRow(T, d)).join('')}</ul></section>`;
    }

    /* Devis et factures */
    let money_ = '';
    const qt = p.quote_id ? await Q.quote.get(p.quote_id) : null;
    if (qt) {
      const invs = await withPaid(await Q.quoteInvoices.all(qt.id));
      money_ = `<section class="sv-card" id="documents"><h2>Devis et factures</h2><ul class="sv-docs">${qt.token ? `<li><a href="/d/${esc(qt.token)}"><b>${esc(qt.number)}</b><span>Devis</span></a><em>${esc(money(qt.total_ttc))}</em></li>` : ''}${invs.filter((i) => i.token).map((i) => `<li><a href="/f/${esc(i.token)}"><b>${esc(i.number)}</b><span>${esc(KIND[i.kind] || 'Facture')}</span></a><em>${esc(money(i.total_ttc))}</em><span class="sv-b ${iStatus(i) === 'payee' ? 'ok' : ''}">${esc((I_STATUS[iStatus(i)] || [''])[0])}</span></li>`).join('')}</ul></section>`;
    }

    const msgCard = `<section class="sv-card" id="messages"><h2>Messages</h2>${msgs.length ? `<div class="sv-thread">${msgs.slice().reverse().map((m) => `<div class="sv-m ${m.author === 'client' ? 'me' : ''}"><small>${m.author === 'client' ? 'Vous' : esc(s.company_name)} · ${esc(when(m.created_at))}</small><p>${esc(m.body).replace(/\n/g, '<br>')}</p></div>`).join('')}</div>` : '<p class="sv-empty">Une question, une idée, un changement ? Écrivez-nous ici : nous vous répondons ici et sur WhatsApp.</p>'}
<form method="post" action="/suivi/${esc(T)}/message" class="sv-form"><label>Votre message<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="btn">Envoyer</button></form></section>`;

    return `${bar}<main class="pub-main sv">${flash ? `<div class="sv-flash ${flashErr ? 'err' : ''}" role="status">${esc(flash)}</div>` : ''}${hero}${p.status === 'livre' ? delivery : ''}${todo}${stepper}${infosCard}${p.status === 'livre' ? '' : delivery}${money_}${msgCard}<p class="sv-foot">Ce lien est privé : ne le partagez qu’avec les personnes de votre équipe. ${esc(s.company_name)}${s.company_phone ? ' · ' + esc(s.company_phone) : ''}</p></main>`;
  }

  const fileRow = (T, d) => `<li><a href="/suivi/${esc(T)}/fichier/${d.id}" target="_blank" rel="noopener"><b>${esc(d.name)}</b><small>${esc(kb(d.size))} · ${esc(when(d.created_at))}</small></a></li>`;
  function taskCard(p, x, files) {
    const T = p.token, mine = files.filter((f) => f.task_id === x.id);
    const state = x.status === 'done' ? '<span class="sv-b ok">Terminé</span>' : x.status === 'review' ? '<span class="sv-b rv">Reçu, nous vérifions</span>' : '<span class="sv-b td">À faire</span>';
    let inner = '';
    const fb = x.feedback ? `<div class="sv-fb"><b>À reprendre</b><p>${esc(x.feedback).replace(/\n/g, '<br>')}</p></div>` : '';
    const open = x.status !== 'done';
    if (x.kind === 'texte') {
      inner = open ? `<form method="post" action="/suivi/${esc(T)}/tache/${x.id}" class="sv-form"><label>Votre réponse<textarea name="answer" rows="4" maxlength="3000" required>${esc(x.answer || '')}</textarea></label><button class="btn">${x.status === 'review' ? 'Mettre à jour' : 'Envoyer'}</button></form>` : `<p class="sv-ans">${esc(x.answer || '').replace(/\n/g, '<br>')}</p>`;
    } else if (x.kind === 'fichier') {
      inner = `${mine.length ? `<ul class="sv-files">${mine.map((d) => fileRow(T, d)).join('')}</ul>` : ''}${open ? `<label class="sv-up"><span class="btn">${mine.length ? 'Ajouter un autre fichier' : 'Choisir un fichier'}</span><input type="file" multiple accept="${ACCEPT}" data-upload="/suivi/${esc(T)}/tache/${x.id}/fichier"><small class="up-s" aria-live="polite">Images, PDF ou documents Office · 4 Mo au maximum par fichier</small></label>` : ''}`;
    } else if (x.kind === 'validation') {
      const lk = link(x.link);
      inner = `${lk ? `<p><a class="btn ghost" href="${esc(lk)}" target="_blank" rel="noopener">Ouvrir pour voir ↗</a></p>` : ''}${x.status === 'done' ? `<p class="sv-ans">${esc(x.answer || '')}</p>` : `${x.status === 'review' ? `<p class="sv-ans">${esc(x.answer || '')}</p>` : ''}<form method="post" action="/suivi/${esc(T)}/tache/${x.id}" class="sv-form"><div class="sv-two"><button class="btn" name="decision" value="ok">Je valide</button></div><details><summary>Je souhaite des modifications</summary><label>Que voulez-vous changer ?<textarea name="comment" rows="3" maxlength="2000"></textarea></label><button class="btn ghost" name="decision" value="changes">Envoyer mes modifications</button></details></form>`}`;
    } else if (x.kind === 'confirmer') {
      inner = open ? `<form method="post" action="/suivi/${esc(T)}/tache/${x.id}" class="sv-form"><button class="btn">C’est fait</button></form>` : '';
    }
    return `<article class="sv-task ${x.status}" id="t${x.id}"><div class="sv-th"><b>${esc(x.title)}</b>${state}</div>${x.due_date && x.status === 'todo' ? `<small class="sv-due">Pour le ${esc(dateFr(x.due_date))}</small>` : ''}${x.detail ? `<p>${esc(x.detail).replace(/\n/g, '<br>')}</p>` : ''}${fb}${inner}</article>`;
  }

  /* ================== côté Digilago ================== */
  async function unseen() {
    const out = {};
    const add = (rows) => { for (const r of rows) out[r.project_id] = (out[r.project_id] || 0) + r.n; };
    add(await db.prepare("SELECT project_id, COUNT(*) n FROM project_tasks WHERE seen = 0 AND status IN ('review','done') GROUP BY project_id").all());
    add(await db.prepare("SELECT project_id, COUNT(*) n FROM project_files WHERE seen = 0 AND author = 'client' GROUP BY project_id").all());
    add(await db.prepare("SELECT project_id, COUNT(*) n FROM project_msgs WHERE seen = 0 AND author = 'client' GROUP BY project_id").all());
    return out;
  }

  async function adminCard(p, cl, req) {
    const B = baseUrl(req), url = `${B}/suivi/${p.token}`, s = await settings();
    const tasks = await tasksOf(p.id), files = await filesOf(p.id), msgs = await db.prepare('SELECT * FROM project_msgs WHERE project_id = ? ORDER BY id DESC LIMIT 40').all(p.id);
    const newT = new Set(tasks.filter((x) => !x.seen && ['review', 'done'].includes(x.status)).map((x) => x.id)), newF = new Set(files.filter((x) => !x.seen && x.author === 'client').map((x) => x.id)), newM = new Set(msgs.filter((x) => !x.seen && x.author === 'client').map((x) => x.id));
    const nNew = newT.size + newF.size + newM.size;
    const A = `/projets/${p.id}/suivi`;
    const msg = `Bonjour ${cl.name || ''}, voici votre espace de suivi : vous y voyez l’avancement de votre site, ce que nous attendons de vous, et vous pouvez nous écrire. ${url}`;
    const ping = (t) => (cl.phone || cl.whatsapp ? `<a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${digits(cl.whatsapp || cl.phone)}?text=${encodeURIComponent(t)}">Prévenir sur WhatsApp</a>` : '');
    const open = ACTIVE.includes(p.status);
    const taskRow = (x) => {
      const mine = files.filter((f) => f.task_id === x.id);
      const st = { todo: ['À faire', 'amber'], review: ['À vérifier', 'blue'], done: ['Terminé', 'green'] }[x.status] || ['', 'grey'];
      return `<li class="svt ${x.status}" id="st${x.id}"><div class="svt-h"><b>${esc(x.title)}</b>${newT.has(x.id) ? '<em class="svt-new">Nouveau</em>' : ''}<span class="bdg bdg-${st[1]}">${st[0]}</span><small>${esc(KINDS[x.kind] || '')}</small></div>
${x.answer ? `<p class="svt-a">${esc(x.answer).replace(/\n/g, '<br>')}</p>` : ''}${mine.length ? `<ul class="svt-f">${mine.map((f) => `<li><a href="${A}/fichier/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a> <small>${esc(kb(f.size))} · ${esc(when(f.created_at))}</small>${newF.has(f.id) ? ' <em class="svt-new">Nouveau</em>' : ''}<form method="post" action="${A}/fichier/${f.id}/supprimer" class="inl"><button class="x" title="Supprimer">×</button></form></li>`).join('')}</ul>` : ''}
${x.feedback ? `<p class="svt-fb">Demandé de reprendre : ${esc(x.feedback)}</p>` : ''}
<div class="svt-act">${x.status !== 'done' ? `<form method="post" action="${A}/tache/${x.id}/accepter" class="inl"><button class="btn sm">${x.status === 'review' ? 'C’est bon' : 'Marquer comme fait'}</button></form>` : `<form method="post" action="${A}/tache/${x.id}/rouvrir" class="inl"><button class="btn ghost sm">Rouvrir</button></form>`}
<details class="inl"><summary class="btn ghost sm">Demander de reprendre</summary><form method="post" action="${A}/tache/${x.id}/reprendre" class="svt-re"><textarea name="feedback" rows="2" placeholder="Ce qu’il faut reprendre" required></textarea><button class="btn sm">Renvoyer au client</button></form></details>
<form method="post" action="${A}/tache/${x.id}/supprimer" class="inl" onsubmit="return confirm('Supprimer cette demande ?')"><button class="btn ghost sm danger">Supprimer</button></form></div></li>`;
    };
    const card = `<div class="card sv-admin" id="suivi"><div class="card-h"><h2>Espace client</h2>${nNew ? `<span class="svt-new big">${nNew} nouveau${nNew > 1 ? 'x' : ''}</span>` : `<span class="mut">${open ? 'Ouvert' : p.status === 'livre' ? 'Remise du site' : 'Ouvre à l’acceptation du devis'}</span>`}</div>
<div class="brief-l"><span>Lien privé du client (avancement, demandes, fichiers, messages) :</span><div class="copy"><input readonly value="${esc(url)}" id="slnk"><button type="button" class="btn ghost sm" data-copy="#slnk">Copier</button><a class="btn ghost sm" target="_blank" rel="noopener" href="${esc(url)}">Voir ce que voit le client</a>${ping(msg)}</div></div>
<h3 class="svt-t">À faire de son côté</h3>${tasks.length ? `<ul class="svt-l">${tasks.map(taskRow).join('')}</ul>` : `<p class="mut">${open ? 'Aucune demande pour le moment.' : 'Les demandes s’affichent chez le client quand le projet est à démarrer, en cours ou en validation.'}</p>`}
<div class="svt-add"><span>Ajouter une demande :</span><div class="svt-chips">${PRESETS.map((x) => `<form method="post" action="${A}/tache" class="inl"><input type="hidden" name="preset" value="${x[0]}"><button class="chip">${esc(x[1])}</button></form>`).join('')}</div>
<details><summary>Une autre demande</summary><form method="post" action="${A}/tache" class="svt-new-f"><div class="row"><label>Type<select name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label><label>Pour le<input type="date" name="due_date"></label></div><label>Titre (ce que le client lit)<input name="title" maxlength="140" required></label><label>Consigne<textarea name="detail" rows="2" maxlength="1000"></textarea></label><div class="row"><label>Lien à voir (maquette…)<input name="link" placeholder="https://…" maxlength="300"></label><label>Étape cochée à la validation<select name="step_idx"><option value="">Aucune</option>${steps(p).map((x, i) => `<option value="${i}">${esc(x.t)}</option>`).join('')}</select></label></div><button class="btn sm">Ajouter</button></form></details></div>
<h3 class="svt-t">Fichiers pour le client</h3>${(() => { const sh = files.filter((f) => f.shared); return `${sh.length ? `<ul class="svt-f">${sh.map((f) => `<li><a href="${A}/fichier/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a> <small>${esc(kb(f.size))}</small><form method="post" action="${A}/fichier/${f.id}/supprimer" class="inl"><button class="x" title="Retirer">×</button></form></li>`).join('')}</ul>` : '<p class="mut">Contrats, guides, accès, livrables : ils apparaissent chez le client.</p>'}<label class="sv-up"><span class="btn ghost sm">Ajouter un fichier pour le client</span><input type="file" accept="${ACCEPT}" data-upload="${A}/fichier"><small class="up-s" aria-live="polite">4 Mo au maximum</small></label>`; })()}
<h3 class="svt-t" id="msgs">Messages</h3>${msgs.length ? `<div class="svt-th">${msgs.slice().reverse().map((m) => `<div class="svt-m ${m.author === 'client' ? 'cl' : ''}"><small>${m.author === 'client' ? esc(cl.name || 'Client') : 'Vous'} · ${esc(when(m.created_at))}${newM.has(m.id) ? ' <em class="svt-new">Nouveau</em>' : ''}</small><p>${esc(m.body).replace(/\n/g, '<br>')}</p></div>`).join('')}</div>` : '<p class="mut">Aucun message.</p>'}
<form method="post" action="${A}/message" class="svt-re"><textarea name="body" rows="2" maxlength="2000" placeholder="Votre réponse au client" required></textarea><div class="row"><button class="btn sm">Répondre dans son espace</button>${ping('Bonjour ' + (cl.name || '') + ', nous vous avons répondu dans votre espace de suivi : ' + url)}</div></form>
${s.google_review_url ? '' : p.status === 'livre' ? '<p class="mut">Astuce : ajoutez le lien de votre avis Google dans Paramètres pour qu’il apparaisse chez le client à la livraison.</p>' : ''}</div>`;
    /* tout ce qui était nouveau est maintenant vu */
    if (nNew) {
      await db.prepare("UPDATE project_tasks SET seen = 1 WHERE project_id = ? AND seen = 0").run(p.id);
      await db.prepare("UPDATE project_files SET seen = 1 WHERE project_id = ? AND seen = 0").run(p.id);
      await db.prepare("UPDATE project_msgs SET seen = 1 WHERE project_id = ? AND seen = 0").run(p.id);
    }
    return card;
  }

  function mountAdmin(app) {
    const own = async (req) => { if (!isId(req.params.id)) return null; return db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id)); };
    const back = (p, h = '#suivi') => `/projets/${p.id}?ok=1${h}`;
    app.post('/projets/:id/suivi/tache', async (req, res) => {
      const p = await own(req); if (!p) return res.sendStatus(404);
      const b = req.body || {}, pre = PRESETS.find((x) => x[0] === b.preset);
      const kind = pre ? pre[2] : (KINDS[b.kind] ? b.kind : 'texte'), title = pre ? pre[3] : cut(b.title, 140);
      if (!title) return res.redirect(back(p));
      const pos = (await db.prepare('SELECT COALESCE(MAX(position),0)+1 n FROM project_tasks WHERE project_id = ?').get(p.id)).n;
      const stepIdx = pre ? pre[5] : (b.step_idx !== '' && b.step_idx !== undefined && steps(p)[Number(b.step_idx)] ? Number(b.step_idx) : null);
      await db.prepare('INSERT INTO project_tasks (project_id, kind, title, detail, link, step_idx, due_date, position, seen) VALUES (?,?,?,?,?,?,?,?,1)')
        .run(p.id, kind, title, pre ? pre[4] : cut(b.detail, 1000), link(b.link), stepIdx, /^\d{4}-\d{2}-\d{2}$/.test(b.due_date || '') ? b.due_date : null, pos);
      res.redirect(back(p));
    });
    const T = async (req) => { const p = await own(req); if (!p || !isId(req.params.tid)) return []; const t = await db.prepare('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?').get(Number(req.params.tid), p.id); return [p, t]; };
    app.post('/projets/:id/suivi/tache/:tid/accepter', async (req, res) => { const [p, t] = await T(req); if (!t) return res.sendStatus(404); await db.prepare("UPDATE project_tasks SET status = 'done', feedback = NULL, seen = 1, done_at = COALESCE(done_at, datetime('now')) WHERE id = ?").run(t.id); await markStep(p, t.step_idx); res.redirect(back(p)); });
    app.post('/projets/:id/suivi/tache/:tid/rouvrir', async (req, res) => { const [p, t] = await T(req); if (!t) return res.sendStatus(404); await db.prepare("UPDATE project_tasks SET status = 'todo', seen = 1, done_at = NULL WHERE id = ?").run(t.id); res.redirect(back(p)); });
    app.post('/projets/:id/suivi/tache/:tid/reprendre', async (req, res) => { const [p, t] = await T(req); if (!t) return res.sendStatus(404); await db.prepare("UPDATE project_tasks SET status = 'todo', feedback = ?, seen = 1, done_at = NULL WHERE id = ?").run(cut(req.body.feedback, 1000) || null, t.id); res.redirect(back(p)); });
    app.post('/projets/:id/suivi/tache/:tid/supprimer', async (req, res) => { const [p, t] = await T(req); if (!t) return res.sendStatus(404); await db.prepare('DELETE FROM project_files WHERE task_id = ?').run(t.id); await db.prepare('DELETE FROM project_tasks WHERE id = ?').run(t.id); res.redirect(back(p)); });
    app.post('/projets/:id/suivi/message', async (req, res) => {
      const p = await own(req); if (!p) return res.sendStatus(404);
      const body = cut(req.body && req.body.body, 2000); if (body) await db.prepare("INSERT INTO project_msgs (project_id, author, body, seen) VALUES (?, 'digilago', ?, 1)").run(p.id, body);
      res.redirect(back(p, '#msgs'));
    });
    app.post('/projets/:id/suivi/fichier', raw, async (req, res) => {
      const p = await own(req); if (!p) return res.status(404).json({ error: 'Projet introuvable.' });
      const r = await saveFile(p, { author: 'digilago', shared: true, name: req.query.name, body: req.body });
      if (r.err) return res.status(400).json({ error: r.err });
      res.json({ ok: true, id: r.id });
    }, rawErr);
    app.get('/projets/:id/suivi/fichier/:fid', async (req, res) => {
      const p = await own(req); if (!p || !isId(req.params.fid)) return res.sendStatus(404);
      const f = await db.prepare('SELECT id FROM project_files WHERE id = ? AND project_id = ?').get(Number(req.params.fid), p.id); if (!f) return res.sendStatus(404);
      await sendFile(res, f);
    });
    app.post('/projets/:id/suivi/fichier/:fid/supprimer', async (req, res) => {
      const p = await own(req); if (!p || !isId(req.params.fid)) return res.sendStatus(404);
      await db.prepare('DELETE FROM project_files WHERE id = ? AND project_id = ?').run(Number(req.params.fid), p.id); res.redirect(back(p));
    });
  }

  return { mountPublic, mountAdmin, adminCard, unseen, PRESETS, ACTIVE };
};
