'use strict';
/* Échéanciers de paiement : une fois, acompte et solde, par tranches, mensualités, sur mesure. */
const PLANS = {
  '50-50': { n: 'Acompte 50 % et solde 50 %', t: [['Acompte à la commande', 50], ['Solde à la mise en ligne', 50]] },
  '30-40-30': { n: 'En 3 tranches : 30 %, 40 %, 30 %', t: [['Acompte à la commande', 30], ['À la validation de la maquette', 40], ['Solde à la mise en ligne', 30]] },
  '40-60': { n: 'Acompte 40 % et solde 60 %', t: [['Acompte à la commande', 40], ['Solde à la mise en ligne', 60]] },
  '1x': { n: 'En une fois, à la commande', t: [['Paiement à la commande', 100]] },
  '1x-fin': { n: 'En une fois, à la mise en ligne', t: [['Paiement à la mise en ligne', 100]] },
  '3x': { n: 'En 3 mensualités', t: [['Mensualité 1, à la commande', 34], ['Mensualité 2', 33], ['Mensualité 3', 33]] },
  '6x': { n: 'En 6 mensualités', t: [['Mensualité 1, à la commande', 17], ['Mensualité 2', 17], ['Mensualité 3', 17], ['Mensualité 4', 17], ['Mensualité 5', 16], ['Mensualité 6', 16]] },
};
function planFromBody(b) {
  const key = String(b.plan_key || '');
  if (PLANS[key]) return PLANS[key].t.map(([l, p]) => ({ l, p }));
  if (key === 'custom' && b.plan_custom) {
    const rows = String(b.plan_custom).split(/\n/).map((x) => x.split(/[;|]/)).filter((x) => x[0] && x[1]).map(([l, p]) => ({ l: l.trim().slice(0, 80), p: Math.max(0, parseFloat(String(p).replace(',', '.')) || 0) })).filter((x) => x.p > 0);
    const sum = rows.reduce((a, x) => a + x.p, 0);
    if (rows.length && Math.abs(sum - 100) < 0.5) return rows;
  }
  const dep = Math.min(100, Math.max(0, parseFloat(String(b.deposit_pct || 50).replace(',', '.')) || 0));
  return dep >= 100 ? [{ l: 'Paiement à la commande', p: 100 }] : dep <= 0 ? [{ l: 'Paiement à la mise en ligne', p: 100 }] : [{ l: 'Acompte à la commande', p: dep }, { l: 'Solde à la mise en ligne', p: 100 - dep }];
}
function planOf(q) {
  try { const p = JSON.parse(q.plan || ''); if (Array.isArray(p) && p.length) return p; } catch (e) {}
  const dep = Number(q.deposit_pct) || 0;
  return dep >= 100 || dep <= 0 ? [{ l: 'Paiement', p: 100 }] : [{ l: 'Acompte à la commande', p: dep }, { l: 'Solde à la mise en ligne', p: 100 - dep }];
}
function planKey(plan) { const s = JSON.stringify(plan.map((x) => [x.l, x.p])); return Object.keys(PLANS).find((k) => JSON.stringify(PLANS[k].t) === s) || 'custom'; }
module.exports = { PLANS, planFromBody, planOf, planKey };
