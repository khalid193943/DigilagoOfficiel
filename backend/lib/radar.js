'use strict';
/*
 * Liaison avec le Radar Digilago (radar.digilago.ma), de serveur à serveur.
 *
 * Chaque appel est un POST JSON signé, dans les deux sens :
 *   X-Digilago-Timestamp : l'heure de l'envoi (secondes)
 *   X-Digilago-Signature : sha256=HMAC-SHA256(secret, "<timestamp>.<corps brut>")
 * Appel de plus de 5 minutes ou mal signé : refusé. Même secret des deux côtés (RADAR_SECRET ici,
 * GESTION_SECRET dans le Radar), 24 caractères au moins, réglé dans les variables d'hébergement.
 *
 * Radar → gestion : « Préparer le devis » crée ou met à jour la demande (route /webhooks/radar/demande).
 * Gestion → Radar : recherche d'une demande reçue, liaison, ajout au Radar, et chaque étape du devis
 *                   (envoyé, accepté, refusé, demande perdue) pour que le Radar affiche le bon statut et le bon montant.
 */
const crypto = require('node:crypto');

const MAX_SKEW_S = 300;
let FETCH = (...a) => fetch(...a);
/** pour les tests : remplacer l'accès réseau */
const setFetch = (fn) => { FETCH = fn || ((...a) => fetch(...a)); };

const conf = () => ({ url: String(process.env.RADAR_URL || '').trim().replace(/\/+$/, ''), secret: String(process.env.RADAR_SECRET || '').trim() });
const ready = () => { const c = conf(); return !!(c.url && c.secret.length >= 24); };

function sign(body, ts = Math.floor(Date.now() / 1000), secret = conf().secret) {
  return { ts: String(ts), sig: 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex') };
}
function verify(raw, tsHeader, sigHeader, secret = conf().secret, nowMs = Date.now()) {
  if (!secret || secret.length < 24 || typeof tsHeader !== 'string' || typeof sigHeader !== 'string') return false;
  const ts = Number(tsHeader);
  if (!Number.isInteger(ts) || Math.abs(nowMs / 1000 - ts) > MAX_SKEW_S) return false;
  const want = Buffer.from(sign(raw, ts, secret).sig), got = Buffer.from(sigHeader);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Appel signé vers le Radar. Délai court : la gestion ne reste jamais bloquée si le Radar dort. */
async function call(path, body = {}, { timeout = 4000 } = {}) {
  const c = conf();
  if (!ready()) throw new Error('Radar non relié (RADAR_URL, RADAR_SECRET)');
  const raw = JSON.stringify(body), { ts, sig } = sign(raw);
  let r;
  try {
    r = await FETCH(`${c.url}/api/integrations/gestion/${path}`, { method: 'POST', body: raw, signal: AbortSignal.timeout(timeout),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'DigilagoGestion/1.0', 'X-Digilago-Timestamp': ts, 'X-Digilago-Signature': sig } });
  } catch (e) { throw new Error(e && e.name === 'TimeoutError' ? 'le Radar ne répond pas (délai dépassé)' : 'le Radar est injoignable'); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok === false) throw new Error(j && j.error ? j.error : `réponse ${r.status} du Radar`);
  return j;
}

/* ---------------- présentation : ce que le Radar sait de l'entreprise ---------------- */
const { esc } = require('./fmt');
const SEG_TONE = { no_site: 'amber', social_or_generated: 'blue', weak_site: 'navy', good_site: 'green', unknown: 'grey' };
const MATCH = { telephone: 'même téléphone', email: 'même e-mail', site: 'même site', nom: 'nom proche' };
/** Ce qu'il faut proposer, d'après la case du Radar : type de demande (codes de la gestion) et besoin en clair. */
const KIND_FOR = { no_site: 'vitrine', social_or_generated: 'vitrine', weak_site: 'refonte', good_site: 'google' };
const NEED_FOR = { no_site: 'Création du site', social_or_generated: 'Création du site (aujourd’hui : réseaux seulement)', weak_site: 'Refonte du site', good_site: 'Référencement Google et visibilité IA' };
/** Secteurs du Radar → secteurs de l'assistant de la gestion. */
const SECTOR_FOR = [[/santé/i, 'Santé et médical'], [/éducation/i, 'Éducation'], [/restauration/i, 'Restauration'], [/hôtellerie/i, 'Hôtellerie'],
  [/commerce/i, 'Commerce'], [/immobilier/i, 'Immobilier'], [/beauté/i, 'Beauté et bien-être'], [/industrie/i, 'Industrie'], [/tourisme/i, 'Tourisme'],
  [/services pro|conseil|juridique/i, 'Juridique et conseil'], [/construction|transport|artisanat|association/i, 'Services']];
const sectorFor = (label) => { const m = SECTOR_FOR.find(([re]) => re.test(String(label || ''))); return m ? m[1] : (label ? 'Autre' : null); };
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const host = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

/** Résumé lisible d'une fiche du Radar (carte de la demande, liste des propositions). */
function companyBlock(c, { compact = false } = {}) {
  if (!c) return '';
  const tone = SEG_TONE[c.segment] || 'grey';
  const facts = [
    c.website ? `Site : <a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(host(c.website))}</a>` : 'Aucun site trouvé',
    c.googleLabel ? esc(c.googleLabel) : '',
    (c.socials || []).length ? `Réseaux : ${c.socials.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.platform)}</a>`).join(', ')}` : '',
    (c.whatsapp || []).length ? 'WhatsApp publié par l’entreprise' : '',
  ].filter(Boolean);
  return `<div class="rd-co rd-${tone}"><div class="rd-co-h"><span class="rd-score" title="Score d’opportunité du Radar">${c.score == null ? '–' : esc(c.score)}</span>
<div><b>${esc(c.name)}</b><span>${esc([c.sector, c.city].filter(Boolean).join(' · '))}</span></div><span class="bdg bdg-${tone}">${esc(c.segmentLabel || '')}</span></div>
${compact ? '' : `<p class="rd-pitch">${esc(c.pitch || '')}</p>${(c.reasons || []).length ? `<ul class="rd-why">${c.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`}
<p class="rd-facts">${facts.join('<i>·</i>')}</p></div>`;
}

/** La carte « Radar » d'une demande : reliée, propositions à confirmer, ou rien de trouvé. */
function leadCard(l) {
  if (!ready()) return '';
  const data = parse(l.radar_data), raw = parse(l.radar_matches), failed = raw && !Array.isArray(raw) && raw.error, matches = Array.isArray(raw) ? raw : [];
  const act = (path, label, cls = 'btn ghost sm', extra = '') => `<form method="post" action="/demandes/${l.id}/radar/${path}" class="inl">${extra}<button class="${cls}">${label}</button></form>`;
  let inner;
  if (l.radar_id && data) {
    inner = `${companyBlock(data)}<div class="rd-a"><a class="btn sm" href="${esc(data.url)}" target="_blank" rel="noopener">Ouvrir dans le Radar</a>${act('actualiser', 'Actualiser')}<span class="mut">${data.statusLabel ? `Radar : ${esc(data.statusLabel)}` : ''}</span></div>`;
  } else if (failed) {
    inner = `<p class="mut">Le Radar n’a pas répondu (${esc(raw.error)}). La demande reste traitée normalement.</p><div class="rd-a">${act('chercher', 'Réessayer', 'btn sm')}</div>`;
  } else if (matches.length) {
    inner = `<p class="mut">Le Radar connaît peut-être cette entreprise. Confirmez la bonne fiche : son diagnostic s’affichera ici et le Radar suivra le devis.</p>
${matches.map((m) => `<div class="rd-m">${companyBlock(m.company, { compact: true })}<div class="rd-a"><span class="bdg bdg-${m.strong ? 'green' : 'grey'}">${esc(MATCH[m.match] || m.match)}</span>${act('relier', 'C’est cette entreprise', 'btn sm', `<input type="hidden" name="radar_id" value="${esc(m.company.radarId)}">`)}</div></div>`).join('')}
<div class="rd-a">${act('ajouter', 'Aucune : l’ajouter au Radar')}${act('ignorer', 'Ne pas relier', 'btn ghost sm')}</div>`;
  } else {
    const named = !!String(l.company || '').trim();
    inner = `<p class="mut">${l.radar_at ? 'Le Radar ne connaît pas encore cette entreprise.' : 'Pas encore cherchée dans le Radar.'} ${named ? 'Ajoutez-la : le Radar analyse son site, sa fiche Google et ses réseaux, et le diagnostic s’affiche ici.' : 'Indiquez le nom de l’entreprise (Informations) pour l’ajouter au Radar.'}</p>
<div class="rd-a">${named ? act('ajouter', 'Ajouter au Radar et analyser', 'btn sm') : ''}${act('chercher', 'Chercher à nouveau')}</div>`;
  }
  return `<div class="card rd-card"><div class="card-h"><h2>Radar</h2><span class="mut">${l.radar_at ? 'vu ' + esc(String(l.radar_at).slice(0, 10).split('-').reverse().join('/')) : ''}</span></div>${inner}</div>`;
}

module.exports = { ready, conf, sign, verify, call, setFetch, companyBlock, leadCard, KIND_FOR, NEED_FOR, sectorFor, parse };
