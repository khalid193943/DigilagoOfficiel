'use strict';
/*
 * Publicité : d'où vient chaque demande (Meta, Google Ads, réseaux, Google, assistants IA…), ce qu'elle a rapporté,
 * et les conversions renvoyées aux régies pour qu'elles trouvent d'autres clients comme ceux qui signent.
 *
 *  - Le site joint à chaque demande la provenance de la visite (utm_*, identifiants de clic gclid / fbclid) et le choix
 *    du visiteur sur la publicité (bandeau des cookies).
 *  - Meta (API Conversions) : « Lead » à la demande, « Purchase » au devis accepté, avec le même identifiant que le pixel
 *    (la même demande n'est comptée qu'une fois). Seulement si le visiteur a accepté la publicité.
 *    Variables : META_PIXEL_ID, META_CAPI_TOKEN (et META_TEST_EVENT_CODE pour essayer dans le gestionnaire d'événements).
 *  - Google Ads : export CSV des clients signés venus d'un clic Google (gclid), à importer dans Google Ads
 *    (Outils › Conversions › Importer).
 */
const crypto = require('node:crypto');

let FETCH = (...a) => fetch(...a);
const setFetch = (fn) => { FETCH = fn || ((...a) => fetch(...a)); };

/* ---------------- provenance ---------------- */
const CHANNELS = {
  'meta-ads': ['Meta Ads (Facebook, Instagram)', 'blue'], 'google-ads': ['Google Ads', 'green'], 'autre-pub': ['Autre publicité', 'violet'],
  reseaux: ['Réseaux sociaux', 'blue'], google: ['Google (naturel)', 'green'], ia: ['Assistants IA (ChatGPT…)', 'navy'], site: ['Autre site', 'grey'],
};
const clean = (v, n = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const ATT_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'referrer', 'landing', 'at'];

/** Ce que le site envoie (objet « att ») : seulement les champs connus, nettoyés. */
function attFrom(b) {
  const a = b && typeof b.att === 'object' && b.att ? b.att : {}, out = {};
  for (const k of ATT_KEYS) if (a[k]) out[k] = clean(a[k], k === 'landing' ? 160 : 200);
  if (b && b.page) out.page = clean(b.page, 300);
  return out;
}
const META_RE = /facebook|instagram|^fb$|^ig$|^meta|messenger|whatsapp/i, GOOGLE_RE = /google|adwords|gads|youtube/i;
const IA_RE = /chatgpt|openai|perplexity|gemini|copilot|claude|bard|mistral|deepseek/i;
const PAID_RE = /cpc|ppc|paid|ads?$|ads?[-_]|display|retarget|sponsor|boost/i;
/** Canal de la demande, d'après la visite qui l'a amenée. Identifiant de clic Google (gclid…) : Google Ads.
    fbclid (ajouté par Facebook et Instagram) : publicité Meta, sauf si l'UTM dit « publication » (social, organic, post). */
function channelOf(att = {}) {
  const src = String(att.utm_source || ''), med = String(att.utm_medium || ''), ref = String(att.referrer || '');
  const paid = PAID_RE.test(med), organic = /social|organic|post|bio|story/i.test(med) && !paid;
  if (att.ctwa_clid || ((att.fbclid || META_RE.test(src)) && paid) || (att.fbclid && !organic)) return 'meta-ads';
  if (att.gclid || att.gbraid || att.wbraid || (GOOGLE_RE.test(src) && paid)) return 'google-ads';
  if (src && paid) return 'autre-pub';
  if (att.fbclid || META_RE.test(src) || META_RE.test(ref) || /linkedin|tiktok|twitter|^t\.co$|x\.com|snapchat|pinterest/i.test(src + ' ' + ref)) return 'reseaux';
  if (IA_RE.test(src) || IA_RE.test(ref)) return 'ia';
  if (GOOGLE_RE.test(src) || /(^|\.)google\./i.test(ref) || /bing\.|duckduckgo|yahoo\./i.test(ref)) return 'google';
  if (ref || src) return 'site';
  return null;
}
const campaignOf = (att = {}) => clean(att.utm_campaign || att.headline || att.ad_id || '', 120) || null;
const channelLabel = (k) => (CHANNELS[k] || [k || 'Direct ou inconnu'])[0];
/** Pastille de provenance (liste et fiche des demandes). */
function channelChip(l, esc) {
  if (!l.channel) return '';
  const [t, c] = CHANNELS[l.channel] || [l.channel, 'grey'];
  return `<span class="bdg bdg-${c}" title="${esc(campaignOf(parse(l.att) || {}) || '')}">${esc(t)}</span>`;
}
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

/* ---------------- Meta : API Conversions ---------------- */
const metaConf = () => ({ pixel: String(process.env.META_PIXEL_ID || '').trim(), token: String(process.env.META_CAPI_TOKEN || '').trim(), test: String(process.env.META_TEST_EVENT_CODE || '').trim() });
const metaReady = () => { const c = metaConf(); return /^\d{10,20}$/.test(c.pixel) && c.token.length > 20; };
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
/** Téléphone au format attendu par Meta : chiffres seulement, avec l'indicatif (Maroc par défaut). */
function phoneDigits(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.length === 10 && d.startsWith('0')) d = '212' + d.slice(1);
  else if (d.length === 9 && /^[5-7]/.test(d)) d = '212' + d;
  return d.length >= 10 ? d : '';
}
/** fbc reconstitué depuis l'identifiant de clic quand le cookie n'existe pas (format documenté par Meta). */
const fbcOf = (att) => (att.fbc ? att.fbc : att.fbclid ? `fb.1.${Date.parse(att.at || '') || Date.now()}.${att.fbclid}` : '');

/**
 * Envoie un événement à Meta. Données personnelles seulement hachées (SHA-256), comme l'exige Meta.
 * Retourne { ok } ou { ok: false, error } ; ne lève jamais (la demande du client passe avant tout).
 */
async function sendMeta(name, { eventId, time, url, phone, email, att = {}, value = null, source = 'website' }) {
  if (!metaReady()) return { ok: false, error: 'non configuré' };
  const c = metaConf(), ud = { country: [sha('ma')] };
  const ph = phoneDigits(phone), em = String(email || '').trim().toLowerCase();
  if (ph) ud.ph = [sha(ph)];
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(em)) ud.em = [sha(em)];
  const fbc = fbcOf(att);
  if (fbc) ud.fbc = fbc;
  if (att.fbp) ud.fbp = att.fbp;
  if (att.ip) ud.client_ip_address = att.ip;
  if (att.ua) ud.client_user_agent = att.ua;
  const ev = { event_name: name, event_time: Math.floor((time ? Date.parse(time) || Date.now() : Date.now()) / 1000), action_source: source, user_data: ud };
  if (eventId) ev.event_id = String(eventId).slice(0, 100);
  if (url) ev.event_source_url = url;
  if (value != null) ev.custom_data = { currency: 'MAD', value: Math.round(Number(value) * 100) / 100 };
  const body = { data: [ev] };
  if (c.test) body.test_event_code = c.test;
  try {
    const r = await FETCH(`https://graph.facebook.com/v21.0/${c.pixel}/events?access_token=${encodeURIComponent(c.token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) });
    const j = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (j && j.error && j.error.message) || `HTTP ${r.status}` };
    return { ok: true, received: j && j.events_received };
  } catch (e) { return { ok: false, error: e && e.name === 'TimeoutError' ? 'délai dépassé' : 'réseau' }; }
}

/* ---------------- Google Ads : conversions hors ligne (CSV à importer) ---------------- */
function googleCsv(rows, conversionName) {
  const fmt = (d) => String(d || '').replace('T', ' ').slice(0, 19);
  const q = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return ['Parameters:TimeZone=Africa/Casablanca', 'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
    ...rows.map((r) => [r.gclid, conversionName, fmt(r.at), (Math.round(Number(r.value || 0) * 100) / 100).toFixed(2), 'MAD'].map(q).join(','))].join('\n') + '\n';
}

module.exports = { CHANNELS, attFrom, channelOf, campaignOf, channelLabel, channelChip, parse, metaReady, sendMeta, phoneDigits, googleCsv, setFetch };
