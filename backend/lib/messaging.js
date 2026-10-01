'use strict';
/* Canaux : deux numéros WhatsApp et deux adresses e-mail, réunis dans une seule messagerie. */
const nodemailer = require('nodemailer');
const CH = ['wa1', 'wa2', 'mail1', 'mail2'];
const isWa = (c) => c.startsWith('wa');
function channels(s) {
  return CH.map((c) => {
    const g = (k) => String(s[`${c}_${k}`] || process.env[`${c.toUpperCase()}_${k.toUpperCase()}`] || '').trim();
    const o = { id: c, wa: isWa(c), label: g('label') || (isWa(c) ? (c === 'wa1' ? 'WhatsApp 1' : 'WhatsApp 2') : (c === 'mail1' ? 'E-mail 1' : 'E-mail 2')), on: false };
    if (o.wa) { o.number = g('number'); o.phone_id = g('phone_id'); o.token = g('token'); o.api = !!(o.phone_id && o.token); o.on = !!(o.number || o.api); }
    else { o.address = g('address'); o.smtp_host = g('smtp_host'); o.smtp_port = Number(g('smtp_port') || 465); o.user = g('user') || o.address; o.pass = g('pass'); o.imap_host = g('imap_host'); o.imap_port = Number(g('imap_port') || 993); o.smtp = !!(o.smtp_host && o.pass); o.imap = !!(o.imap_host && o.pass); o.on = !!o.address; }
    return o;
  });
}
const digits = (p) => String(p || '').replace(/\D/g, '').replace(/^0/, '212');
/* WhatsApp : envoi par l'API officielle (Cloud API de Meta) si elle est configurée, sinon lien wa.me */
async function sendWhatsApp(ch, to, body) {
  const num = digits(to);
  if (!ch.api) return { status: 'lien', link: `https://wa.me/${num}?text=${encodeURIComponent(body)}` };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${ch.phone_id}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${ch.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: num, type: 'text', text: { body, preview_url: true } }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { status: 'envoye', ext: (j.messages && j.messages[0] && j.messages[0].id) || '' };
    const code = j.error && j.error.code, msg = (j.error && j.error.message) || 'Erreur WhatsApp';
    /* hors de la fenêtre de 24 heures : il faut un modèle approuvé, on bascule sur le lien */
    return { status: 'lien', link: `https://wa.me/${num}?text=${encodeURIComponent(body)}`, error: code === 131047 || /24/.test(msg) ? 'Le client n’a pas écrit depuis plus de 24 heures : WhatsApp impose un modèle approuvé. Le message s’ouvre dans votre application.' : msg };
  } catch (e) { return { status: 'lien', link: `https://wa.me/${num}?text=${encodeURIComponent(body)}`, error: e.message }; }
}
/* E-mail : envoi SMTP (ou lien mailto si l'adresse n'a pas de mot de passe enregistré) */
async function sendMail(ch, to, subject, body, sig) {
  if (!ch.smtp) return { status: 'lien', link: `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
  const tr = ch.smtp_host === 'test' ? nodemailer.createTransport({ jsonTransport: true }) : nodemailer.createTransport({ host: ch.smtp_host, port: ch.smtp_port, secure: ch.smtp_port === 465, auth: { user: ch.user, pass: ch.pass } });
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0E214E">${String(body).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1F57C7">$1</a>').replace(/\n/g, '<br>')}</div>`;
  try { const info = await tr.sendMail({ from: `"${sig || ch.label}" <${ch.address}>`, to, subject, text: body, html }); return { status: 'envoye', ext: info.messageId || '' }; }
  catch (e) { return { status: 'echec', error: e.message, link: `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` }; }
}
/* E-mail : lecture des nouveaux messages (IMAP), à la demande depuis la messagerie */
async function fetchMail(ch, sinceUid, limit = 30) {
  if (!ch.imap) return { items: [], last: sinceUid };
  const { ImapFlow } = require('imapflow'); const { simpleParser } = require('mailparser');
  const cl = new ImapFlow({ host: ch.imap_host, port: ch.imap_port, secure: ch.imap_port === 993, auth: { user: ch.user, pass: ch.pass }, logger: false, socketTimeout: 15000 });
  const items = []; let last = Number(sinceUid) || 0;
  await cl.connect();
  try {
    const lock = await cl.getMailboxLock('INBOX');
    try {
      const range = last ? `${last + 1}:*` : `${Math.max(1, (cl.mailbox.exists || 1) - limit + 1)}:*`;
      for await (const m of cl.fetch(range, { uid: true, source: true }, { uid: !!last })) {
        if (m.uid <= last) continue;
        const p = await simpleParser(m.source);
        items.push({ uid: m.uid, from: (p.from && p.from.value && p.from.value[0] && p.from.value[0].address) || '', name: (p.from && p.from.value && p.from.value[0] && p.from.value[0].name) || '', subject: p.subject || '', body: String(p.text || '').slice(0, 8000), date: (p.date || new Date()).toISOString() });
        last = Math.max(last, m.uid);
      }
    } finally { lock.release(); }
  } finally { await cl.logout().catch(() => {}); }
  return { items, last };
}
/* WhatsApp : lecture d'une notification de Meta (webhook) */
function parseWebhook(body) {
  const out = [];
  for (const e of body.entry || []) for (const c of e.changes || []) {
    const v = c.value || {}, pid = v.metadata && v.metadata.phone_number_id, names = {};
    for (const ct of v.contacts || []) names[ct.wa_id] = ct.profile && ct.profile.name;
    for (const m of v.messages || []) out.push({ phone_id: pid, from: m.from, name: names[m.from] || '', id: m.id, body: m.text ? m.text.body : m.type === 'button' ? m.button.text : `[${m.type}]`, ts: Number(m.timestamp || 0) });
  }
  return out;
}
module.exports = { CH, channels, sendWhatsApp, sendMail, fetchMail, parseWebhook, digits };
