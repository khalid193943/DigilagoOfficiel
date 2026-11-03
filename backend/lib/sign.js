'use strict';
/*
 * Signature électronique des devis (et donc du bon de commande qui en découle).
 *
 * Le client signe depuis son téléphone ou son ordinateur : il dit qui il est, reçoit un code de vérification
 * (e-mail, ou WhatsApp si l'API est reliée), trace sa signature (ou la tape), et accepte le texte d'engagement.
 * Le dossier de preuve garde : identité déclarée, moyen de vérification et son heure, adresse IP, appareil,
 * horodatage, image de la signature, et l'empreinte SHA-256 du document tel qu'il a été signé.
 * Le certificat (lien privé) permet de vérifier à tout moment que le document n'a pas changé depuis.
 *
 * Cadre : signature électronique simple au sens de la loi 43-20 (services de confiance pour les transactions
 * électroniques) et de la loi 53-05 (échange électronique de données juridiques) : un écrit électronique a la même
 * force probante que l'écrit papier si son auteur est identifié et son intégrité garantie (art. 417-1 du DOC).
 */
const crypto = require('node:crypto');

const CONSENT = 'J’ai lu ce devis et les conditions générales de vente. Je l’accepte au nom de l’entreprise indiquée et je reconnais que ma signature électronique m’engage comme ma signature manuscrite.';
const CODE_TTL_MIN = 10, CODE_MAX_TRIES = 5, CODES_PER_HOUR = 5;

/** Contenu du document qui fait foi : tout ce qui engage (lignes, prix, conditions), dans un ordre fixe. */
function canonicalQuote(q, items, client) {
  const n = (v) => (v == null || v === '' ? null : Number(v));
  return JSON.stringify({
    type: 'devis', number: q.number || null, issue_date: q.issue_date || null, valid_until: q.valid_until || null, title: q.title || null,
    client: { name: (client && client.name) || null, company: (client && client.company) || null, ice: (client && client.ice) || null },
    items: (items || []).map((i) => ({ label: i.label || '', description: i.description || '', qty: n(i.qty), unit: i.unit || '', unit_price: n(i.unit_price) })),
    tva_rate: n(q.tva_rate), discount_pct: n(q.discount_pct), deposit_pct: n(q.deposit_pct), prices_ttc: n(q.prices_ttc),
    total_ht: n(q.total_ht), total_tva: n(q.total_tva), total_ttc: n(q.total_ttc),
    delay: q.delay || null, conditions: q.conditions || null, notes: q.notes || null, plan: q.plan || null,
  });
}
const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex');
const newCode = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');
const codeHash = (code, salt) => crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(v || '').trim());
const phoneDigits = (v) => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 10 && d.startsWith('0')) d = '212' + d.slice(1); return d.length >= 10 ? d : ''; };
/** Contact masqué pour l'affichage : s***@domaine.ma, +212 6•• •• •• 33 */
function mask(contact) {
  const c = String(contact || '');
  if (isEmail(c)) { const [u, d] = c.split('@'); return `${u.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, u.length - 1)))}@${d}`; }
  const d = phoneDigits(c);
  return d ? `+${d.slice(0, 4)} •• •• ${d.slice(-2)}` : '';
}
/** Appareil, en clair (journal de preuve) */
function device(ua) {
  const u = String(ua || '');
  const os = /iPhone|iPad/.test(u) ? 'iPhone / iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X|Macintosh/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Appareil inconnu';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'navigateur';
  return `${br} sur ${os}`;
}
/** Image de signature acceptée : PNG en data URL, ni vide ni démesurée */
const validImage = (v) => typeof v === 'string' && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(v) && v.length > 1500 && v.length < 150000;

module.exports = { CONSENT, CODE_TTL_MIN, CODE_MAX_TRIES, CODES_PER_HOUR, canonicalQuote, hashOf, newCode, codeHash, isEmail, phoneDigits, mask, device, validImage };
