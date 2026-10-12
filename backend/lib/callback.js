'use strict';
/* Quand rappeler le client : le moment qu'il a choisi sur le site (« Maintenant », « Demain matin »…),
   écrit en clair pour l'équipe, avec la chaleur de la demande : plus il veut être appelé tôt, plus il est
   intéressé. Les heures sont celles du Maroc (Africa/Casablanca), quel que soit le serveur. */
const TZ = 'Africa/Casablanca';
const KEYS = ['now', 'hour', 'today', 'open', 'day'];
const SLOTS = { am: ['matin (9 h – 12 h)', 9], pm: ['après-midi (14 h – 18 h)', 14] };
const HEAT = [['froid', 'À planifier', 'grey'], ['tiede', 'Intéressé', 'blue'], ['chaud', 'Chaud', 'amber'], ['brulant', 'Très chaud', 'red']];

function parts(d) {
  const o = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).forEach((p) => { o[p.type] = p.value; });
  return o;
}
const localDate = (d) => { const o = parts(d); return `${o.year}-${o.month}-${o.day}`; };
/* l'instant UTC qui correspond à « date à hh h, heure du Maroc » */
function zoned(date, hh) {
  const g = new Date(`${date}T${String(hh).padStart(2, '0')}:00:00Z`);
  const p = parts(g), lh = Number(p.hour) + Number(p.minute) / 60;
  let diff = lh - hh; if (diff > 12) diff -= 24; if (diff < -12) diff += 24;
  return new Date(g.getTime() - diff * 3600e3);
}
function dayName(date, now) {
  if (date === localDate(now)) return 'aujourd’hui';
  if (date === localDate(new Date(now.getTime() + 864e5))) return 'demain';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(date + 'T12:00:00Z'));
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/* ce que le site envoie (callback, slot, date) → { key, at (UTC ISO), date (jour au Maroc), label, heat } */
function parse(b, now = new Date()) {
  const key = KEYS.includes(b && b.callback) ? b.callback : '';
  if (!key) return null;
  const slot = SLOTS[b.slot] ? b.slot : 'am';
  let date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? String(b.date) : '';
  const today = localDate(now), max = localDate(new Date(now.getTime() + 60 * 864e5));
  if (date && (date < today || date > max)) date = '';
  let at, label, heat;
  if (key === 'now') { at = new Date(now.getTime() + 15 * 60e3); label = 'Maintenant (sous 15 min)'; heat = 3; }
  else if (key === 'hour') { at = new Date(now.getTime() + 60 * 60e3); label = 'Dans l’heure'; heat = 3; }
  else if (key === 'today') { at = new Date(now.getTime() + 3 * 3600e3); label = 'Aujourd’hui, avant 19 h'; heat = 2; }
  else {
    if (!date) date = localDate(new Date(now.getTime() + 864e5));
    const tomorrow = date <= localDate(new Date(now.getTime() + 864e5));
    if (key === 'open') { at = zoned(date, 9); label = `Dès l’ouverture, ${dayName(date, now)} à 9 h`; heat = 2; }
    else { at = zoned(date, SLOTS[slot][1]); label = `${cap(dayName(date, now))}, ${SLOTS[slot][0]}`; heat = tomorrow ? 1 : 0; }
  }
  return { key, slot, at: at.toISOString(), date: localDate(at), label, heat };
}

/* la chaleur d'une demande enregistrée (le moment demandé, et l'écart entre la demande et ce moment) */
function heatOf(l) {
  if (!l || !l.callback) return null;
  if (['now', 'hour'].includes(l.callback)) return HEAT[3];
  if (['today', 'open'].includes(l.callback)) return HEAT[2];
  const gap = (new Date(l.callback_at) - new Date(String(l.created_at || '').replace(' ', 'T') + 'Z')) / 864e5;
  return isFinite(gap) && gap <= 1.6 ? HEAT[1] : HEAT[0];
}

/* « dans 12 min », « dans 3 h », « demain 9 h », ou « en retard de 20 min » */
function due(l, now = new Date()) {
  if (!l || !l.callback_at) return null;
  const at = new Date(l.callback_at), m = Math.round((at - now) / 60e3);
  if (!isFinite(m)) return null;
  if (m < -1) {
    const a = -m;
    return { late: true, text: a < 60 ? `en retard de ${a} min` : a < 24 * 60 ? `en retard de ${Math.round(a / 60)} h` : 'en retard' };
  }
  if (m <= 1) return { late: false, soon: true, text: 'maintenant' };
  if (m < 60) return { late: false, soon: true, text: `dans ${m} min` };
  if (m < 6 * 60) return { late: false, soon: m < 120, text: `dans ${Math.round(m / 60)} h` };
  const p = parts(at), d = localDate(at);
  return { late: false, soon: false, text: `${dayName(d, now)} ${Number(p.hour)} h${p.minute !== '00' ? p.minute : ''}` };
}

module.exports = { parse, heatOf, due, localDate, zoned, HEAT, TZ };
