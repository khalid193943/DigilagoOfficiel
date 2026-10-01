'use strict';
const crypto = require('node:crypto');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v, d = 0) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : d; };

function money(n, cur = 'DH') {
  const v = round2(n), neg = v < 0, abs = Math.abs(v);
  const [i, d] = abs.toFixed(2).split('.');
  return (neg ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ',' + d + (cur ? '\u00a0' + cur : '');
}
const pct = (n) => String(round2(n)).replace('.', ',') + '\u00a0%';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + Number(n || 0)); return x.toISOString().slice(0, 10); };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateFr(d) { if (!d) return ''; const [y, m, j] = d.slice(0, 10).split('-'); return `${Number(j)} ${MOIS[Number(m) - 1]} ${y}`; }
const token = () => crypto.randomBytes(18).toString('base64url');

/* Montant en toutes lettres (usage marocain : « Arrêté le présent devis à la somme de … ») */
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const D = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
function under100(n) {
  if (n <= 16) return U[n];
  if (n < 20) return 'dix-' + U[n - 10];
  if (n < 70) { const d = Math.floor(n / 10), u = n % 10; return D[d] + (u === 0 ? '' : u === 1 ? '-et-un' : '-' + U[u]); }
  if (n < 80) return n === 71 ? 'soixante-et-onze' : 'soixante-' + under100(n - 60);
  if (n === 80) return 'quatre-vingts';
  return 'quatre-vingt-' + under100(n - 80);
}
function under1000(n) {
  const c = Math.floor(n / 100), r = n % 100;
  let s = c === 0 ? '' : c === 1 ? 'cent' : U[c] + '-cent' + (r === 0 ? 's' : '');
  if (r) s += (s ? '-' : '') + under100(r);
  return s || 'zéro';
}
function words(n) {
  n = Math.floor(n);
  if (n === 0) return 'zéro';
  const parts = [];
  const mds = Math.floor(n / 1e9), mns = Math.floor((n % 1e9) / 1e6), ks = Math.floor((n % 1e6) / 1000), r = n % 1000;
  if (mds) parts.push(under1000(mds) + '-milliard' + (mds > 1 ? 's' : ''));
  if (mns) parts.push(under1000(mns) + '-million' + (mns > 1 ? 's' : ''));
  if (ks) parts.push(ks === 1 ? 'mille' : under1000(ks).replace(/cents$/, 'cent') + '-mille');
  if (r) parts.push(under1000(r));
  return parts.join('-');
}
function amountWords(v) {
  const t = round2(Math.abs(v)), dh = Math.floor(t), cts = Math.round((t - dh) * 100);
  let s = words(dh) + ' dirham' + (dh > 1 ? 's' : '');
  if (cts) s += ' et ' + words(cts) + ' centime' + (cts > 1 ? 's' : '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Totaux d'un document */
function totals(items, tvaRate = 20, discountPct = 0) {
  const lines = items.map((it) => round2(num(it.qty, 1) * num(it.unit_price)));
  const subtotal = round2(lines.reduce((a, b) => a + b, 0));
  const discount = round2(subtotal * num(discountPct) / 100);
  const ht = round2(subtotal - discount);
  const tva = round2(ht * num(tvaRate) / 100);
  return { lines, subtotal, discount, ht, tva, ttc: round2(ht + tva) };
}

module.exports = { esc, round2, num, money, pct, today, addDays, dateFr, token, amountWords, totals };
