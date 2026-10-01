'use strict';
/* Comptabilité marocaine : TVA (encaissement ou débit), auto-entrepreneur, droit de timbre, écritures CGNC.
   Les règles codées ici sont des aides au calcul ; la validation reste celle de votre comptable. */
const { round2, num } = require('./fmt');

const REGIMES = {
  ae_services: { n: 'Auto-entrepreneur, prestations de services', ae: true, rate: 1, cap: 200000 },
  ae_commerce: { n: 'Auto-entrepreneur, commerce ou artisanat', ae: true, rate: 0.5, cap: 500000 },
  societe_is: { n: 'Société (SARL, SARL AU, SA) à l’IS', ae: false },
  pp_ir: { n: 'Personne physique à l’IR (résultat net réel ou simplifié)', ae: false },
};
const AE_CLIENT_LIMIT = 80000;            // au-delà, retenue à la source de 30 % sur le surplus, opérée par le client (services)
const CASH_LIMIT = 5000;                  // art. 106-II : TVA non déductible au-delà de 5 000 DH TTC par jour et par fournisseur réglés en espèces
const STAMP_RATE = 0.25;                  // art. 252-I-B : droit de timbre de 0,25 % sur les paiements en espèces
/* catégories de dépenses → compte CGNC proposé (à valider par le comptable) et déductibilité de la TVA */
const CATS = [
  ['Hébergement', '6126', 1], ['Noms de domaine', '6126', 1], ['Logiciels et abonnements', '6126', 1], ['Sous-traitance', '6126', 1],
  ['Publicité', '6144', 1], ['Télécom et internet', '6145', 1], ['Matériel et fournitures', '6125', 1], ['Loyer', '6131', 1],
  ['Honoraires (comptable, avocat)', '6136', 1], ['Frais bancaires', '6147', 1], ['Déplacements et réceptions', '6143', 0],
  ['Impôts et taxes', '6167', 0], ['Autre', '6148', 1],
];
const catOf = (c) => CATS.find((x) => x[0] === c) || CATS.find((x) => c && x[0].startsWith(String(c).split(' ')[0])) || CATS[CATS.length - 1];

/* périodes : mois « 2026-09 » ou trimestre « 2026-T3 » */
function periodOf(date, per) { const y = date.slice(0, 4), m = Number(date.slice(5, 7)); return per === 'mensuelle' ? `${y}-${String(m).padStart(2, '0')}` : `${y}-T${Math.ceil(m / 3)}`; }
function periodRange(p) {
  const y = p.slice(0, 4);
  if (/T\d/.test(p)) { const q = Number(p.slice(-1)), m1 = (q - 1) * 3 + 1; return [`${y}-${String(m1).padStart(2, '0')}-01`, lastDay(`${y}-${String(m1 + 2).padStart(2, '0')}`)]; }
  return [`${p}-01`, lastDay(p)];
}
function lastDay(ym) { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
function periodsOfYear(y, per) { return per === 'mensuelle' ? Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`) : [1, 2, 3, 4].map((q) => `${y}-T${q}`); }
const PNAME = (p) => { const M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']; return /T\d/.test(p) ? `${p.slice(-1)}${p.slice(-1) === '1' ? 'er' : 'e'} trimestre ${p.slice(0, 4)}` : `${M[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}`; };
/* échéance de télédéclaration : avant la fin du mois qui suit la période (art. 110 et 111 du CGI, déclaration électronique) */
function deadline(p) { const end = periodRange(p)[1]; const [y, m] = end.split('-').map(Number); const n = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; return lastDay(n); }
const monthsOf = (p) => { const [a, b] = periodRange(p); const out = []; let [y, m] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number); while (y < yb || (y === yb && m <= mb)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };

/* TVA déductible d'une dépense : facture conforme, catégorie qui l'autorise, espèces dans la limite légale */
function expenseTva(e) {
  const t = num(e.tva), why = [];
  if (!t) return { ded: 0, why };
  const cat = catOf(e.category);
  if (e.deductible === 0 || (!cat[2] && e.deductible !== 1)) why.push(cat[2] ? 'marquée non déductible' : 'catégorie sans droit à déduction (art. 106)');
  if (/esp[eè]ce/i.test(e.method || '') && num(e.amount_ttc) > CASH_LIMIT) why.push('payée en espèces au-delà de 5 000 DH (art. 106-II)');
  if (!e.supplier_ice) why.push('ICE du fournisseur manquant');
  return { ded: why.length ? 0 : round2(t), why };
}

/* le calcul d'une période */
async function computePeriod(db, s, p) {
  const [a, b] = periodRange(p), reg = REGIMES[s.fiscal_regime] || {}, enc = s.tva_regime !== 'debit';
  /* les trois lectures de la période partent ensemble */
  const [sales, pays, exps] = await Promise.all([
    db.prepare("SELECT i.*, c.name cname, c.company ccomp, c.ice cice, c.if_num cif, c.is_foreign cforeign FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.issue_date BETWEEN ? AND ? ORDER BY i.number").all(a, b),
    db.prepare("SELECT p.*, i.number inum, i.total_ttc ittc, i.total_tva itva, i.total_ht iht, i.client_id, c.name cname, c.company ccomp FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN clients c ON c.id = i.client_id WHERE p.date BETWEEN ? AND ? ORDER BY p.date, p.id").all(a, b),
    db.prepare('SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date, id').all(a, b),
  ]);
  for (const x of pays) { const r = x.ittc ? x.amount / x.ittc : 0; x.tva = round2(num(x.itva) * r); x.ht = round2(x.amount - x.tva); x.cash = /esp[eè]ce/i.test(x.method || ''); x.stamp = x.cash && !reg.ae ? round2(x.amount * STAMP_RATE / 100) : 0; }
  for (const e of exps) { const t = expenseTva(e); e.tva_ded = t.ded; e.tva_why = t.why; e.ht = round2(num(e.amount_ttc) - num(e.tva)); e.acc = e.account || catOf(e.category)[1]; }
  const T = {
    ca_ht: round2(sales.reduce((x, i) => x + num(i.total_ht), 0)), ca_ttc: round2(sales.reduce((x, i) => x + num(i.total_ttc), 0)),
    enc_ttc: round2(pays.reduce((x, y) => x + y.amount, 0)), enc_ht: round2(pays.reduce((x, y) => x + y.ht, 0)),
    tva_fact: round2(sales.reduce((x, i) => x + num(i.total_tva), 0)), tva_enc: round2(pays.reduce((x, y) => x + y.tva, 0)),
    tva_ded: round2(exps.reduce((x, e) => x + e.tva_ded, 0)), tva_paid: round2(exps.reduce((x, e) => x + num(e.tva), 0)),
    dep_ttc: round2(exps.reduce((x, e) => x + num(e.amount_ttc), 0)), stamp: round2(pays.reduce((x, y) => x + y.stamp, 0)),
  };
  T.tva_col = s.tva_assujetti === '1' && !reg.ae ? (enc ? T.tva_enc : T.tva_fact) : 0;
  T.tva_net = round2(T.tva_col - (s.tva_assujetti === '1' && !reg.ae ? T.tva_ded : 0));
  if (reg.ae) T.ae_tax = round2(T.enc_ttc * reg.rate / 100);
  return { p, a, b, sales, pays, exps, T, deadline: deadline(p), name: PNAME(p) };
}
/* la TVA d'une période tient compte du crédit reporté depuis le début de l'année */
/* TVA de l'année : les périodes se calculent en parallèle, puis le crédit de TVA est reporté
   de période en période — et d'une année sur l'autre (avant : il repartait de zéro au 1er janvier). */
async function yearTva(db, s, y, carry) {
  const per = s.tva_periodicite === 'mensuelle' ? 'mensuelle' : 'trimestrielle';
  let credit = carry === undefined ? await creditInto(db, s, Number(y)) : carry;
  const out = await Promise.all(periodsOfYear(y, per).map((p) => computePeriod(db, s, p)));
  for (const c of out) {
    const net = round2(c.T.tva_net - credit);
    c.T.credit_in = credit; c.T.tva_due = net > 0 ? net : 0; credit = net < 0 ? -net : 0; c.T.credit_out = credit;
  }
  return out;
}
/* crédit de TVA restant à la fin des années précédentes (depuis la première année d'activité, 5 ans au plus) */
async function creditInto(db, s, y) {
  const r = await db.prepare("SELECT MIN(d) d FROM (SELECT MIN(issue_date) d FROM invoices UNION ALL SELECT MIN(date) FROM expenses UNION ALL SELECT MIN(date) FROM payments)").get();
  const first = Math.max(y - 5, Number(String((r && r.d) || y).slice(0, 4)) || y);
  let credit = 0;
  for (let k = first; k < y; k++) { const ps = await yearTva(db, s, k, credit); credit = ps.length ? ps[ps.length - 1].T.credit_out : credit; }
  return credit;
}
/* auto-entrepreneur : plafond annuel et règle des 80 000 DH par client (sur l'encaissé) */
async function aeWatch(db, s, y) {
  const reg = REGIMES[s.fiscal_regime]; if (!reg || !reg.ae) return null;
  const rows = await db.prepare("SELECT i.client_id, c.name cname, c.company ccomp, SUM(p.amount) t FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN clients c ON c.id = i.client_id WHERE substr(p.date,1,4) = ? GROUP BY i.client_id ORDER BY t DESC").all(String(y));
  const total = round2(rows.reduce((a, r) => a + r.t, 0));
  return { total, cap: reg.cap, rate: reg.rate, pct: Math.round(100 * total / reg.cap), clients: rows.map((r) => ({ ...r, t: round2(r.t), over: round2(Math.max(0, r.t - AE_CLIENT_LIMIT)), warn: r.t >= AE_CLIENT_LIMIT * 0.8 })) };
}
/* écritures comptables (CGNC) d'une période, prêtes à importer par le comptable */
function entries(c, s) {
  const A = (k, d) => s[k] || d, L = [];
  const push = (j, date, piece, acc, lib, d, cr) => { if (Math.abs(d) < 0.005 && Math.abs(cr) < 0.005) return; if (d < 0 || cr < 0) { const x = -d, y = -cr; d = y > 0 ? y : 0; cr = x > 0 ? x : 0; if (d === 0 && cr === 0) return; } L.push({ j, date, piece, acc, lib: lib.slice(0, 80), d: round2(d), c: round2(cr) }); };
  for (const i of c.sales) {
    const who = i.ccomp || i.cname || '', rev = i.cforeign ? A('acc_revenue_export', '7125') : A('acc_revenue', '71243');
    push('VT', i.issue_date, i.number, A('acc_clients', '3421'), `${who} ${i.number}`, i.total_ttc, 0);
    push('VT', i.issue_date, i.number, rev, `${i.kind === 'avoir' ? 'Avoir' : 'Prestation'} ${who}`, 0, i.total_ht);
    push('VT', i.issue_date, i.number, A('acc_tva_out', '4455'), `TVA facturée ${i.number}`, 0, i.total_tva);
  }
  for (const p of c.pays) {
    const tr = p.cash ? A('acc_cash', '5161') : A('acc_bank', '5141'), who = p.ccomp || p.cname || '';
    push(p.cash ? 'CA' : 'BQ', p.date, p.number || p.inum, tr, `Règlement ${who} ${p.inum}`, p.amount, 0);
    push(p.cash ? 'CA' : 'BQ', p.date, p.number || p.inum, A('acc_clients', '3421'), `Règlement ${who} ${p.inum}`, 0, p.amount);
  }
  for (const e of c.exps) {
    const tr = /esp[eè]ce/i.test(e.method || '') ? A('acc_cash', '5161') : A('acc_bank', '5141'), lib = `${e.supplier || ''} ${e.label || ''}`.trim();
    push('HA', e.date, e.invoice_ref || 'D' + e.id, e.acc, lib, round2(e.ht + (num(e.tva) - e.tva_ded)), 0);
    push('HA', e.date, e.invoice_ref || 'D' + e.id, A('acc_tva_in', '34552'), `TVA récupérable ${lib}`, e.tva_ded, 0);
    push('HA', e.date, e.invoice_ref || 'D' + e.id, tr, lib, 0, num(e.amount_ttc));
  }
  return L;
}
module.exports = { REGIMES, CATS, catOf, AE_CLIENT_LIMIT, CASH_LIMIT, STAMP_RATE, periodOf, periodRange, periodsOfYear, PNAME, deadline, monthsOf, expenseTva, computePeriod, yearTva, aeWatch, entries };
