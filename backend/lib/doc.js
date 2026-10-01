'use strict';
const { esc, money, pct, dateFr, amountWords, num } = require('./fmt');

const LOGO = '<svg viewBox="14 8 38 48" aria-hidden="true"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="currentColor"/><path d="M28 10 A22 22 0 0 1 28 54 Z" fill="currentColor"/></svg>';
const KIND = { acompte: 'Facture d’acompte', solde: 'Facture de solde', totale: 'Facture' };

function legal(s) {
  const bits = [];
  if (s.company_legal) bits.push(esc(s.company_legal));
  if (s.company_ice) bits.push('ICE ' + esc(s.company_ice));
  if (s.company_if) bits.push('IF ' + esc(s.company_if));
  if (s.company_rc) bits.push('RC ' + esc(s.company_rc));
  if (s.company_patente) bits.push('Patente ' + esc(s.company_patente));
  if (s.company_cnss) bits.push('CNSS ' + esc(s.company_cnss));
  return bits.join(' · ');
}

/* type : 'devis' ou 'facture' */
function renderDoc({ type, doc, items, client, s, paid = 0, quote = null }) {
  const isQ = type === 'devis';
  const t = { ht: num(doc.total_ht), tva: num(doc.total_tva), ttc: num(doc.total_ttc) };
  const subtotal = items.reduce((a, it) => a + num(it.qty, 1) * num(it.unit_price), 0);
  const discount = isQ ? subtotal - t.ht : 0;
  const rows = items.map((it, i) => `<tr><td class="c-n">${i + 1}</td><td><b>${esc(it.label)}</b>${it.description ? `<small>${esc(it.description)}</small>` : ''}</td><td class="c-r">${String(num(it.qty, 1)).replace('.', ',')}${it.unit ? ` <i>${esc(it.unit)}</i>` : ''}</td>${num(it.unit_price) === 0 ? '<td class="c-r off" colspan="2">Offert</td>' : `<td class="c-r">${money(it.unit_price)}</td><td class="c-r">${money(num(it.qty, 1) * num(it.unit_price))}</td>`}</tr>`).join('');
  const title = isQ ? 'Devis' : (KIND[doc.kind] || 'Facture');
  const deposit = isQ ? t.ttc * num(doc.deposit_pct) / 100 : 0;
  const due = isQ ? 0 : Math.max(0, t.ttc - paid);
  const cl = client || {};
  const tvaLine = num(doc.tva_rate) > 0 ? `<tr><td>TVA ${pct(doc.tva_rate)}</td><td>${money(t.tva)}</td></tr>` : '<tr><td colspan="2" class="t-note">TVA non applicable</td></tr>';
  return `<article class="doc ${isQ ? 'is-q' : 'is-f'}">
<header class="d-head"><div class="d-brand"><span class="d-logo">${LOGO}</span><div><b>${esc(s.company_name)}</b><small>${esc(s.company_tagline)}</small></div></div>
<div class="d-id"><span class="d-type">${title}</span><b class="d-num">${esc(doc.number || 'Brouillon')}</b><dl><dt>Date</dt><dd>${dateFr(doc.issue_date)}</dd>${isQ ? `<dt>Valable jusqu’au</dt><dd>${dateFr(doc.valid_until)}</dd>` : `<dt>Échéance</dt><dd>${dateFr(doc.due_date)}</dd>`}${!isQ && quote ? `<dt>Devis</dt><dd>${esc(quote.number)}</dd>` : ''}</dl></div></header>
<section class="d-parties"><div><span class="d-lab">De</span><b>${esc(s.company_name)}</b><p>${esc(s.company_address)}<br>${esc(s.company_phone)}<br>${esc(s.company_email)}</p></div>
<div class="d-to"><span class="d-lab">${isQ ? 'Pour' : 'Facturé à'}</span><b>${esc(cl.company || cl.name || '')}</b><p>${cl.company && cl.name ? esc(cl.name) + '<br>' : ''}${cl.address ? esc(cl.address) + '<br>' : ''}${cl.city ? esc(cl.city) + '<br>' : ''}${cl.phone ? esc(cl.phone) + '<br>' : ''}${cl.email ? esc(cl.email) : ''}${cl.ice ? '<br>ICE ' + esc(cl.ice) : ''}</p></div></section>
${doc.title ? `<h2 class="d-title">${esc(doc.title)}</h2>` : ''}
<table class="d-table"><thead><tr><th class="c-n">#</th><th>Désignation</th><th class="c-r">Qté</th><th class="c-r">Prix unitaire HT</th><th class="c-r">Total HT</th></tr></thead><tbody>${rows}</tbody></table>
<section class="d-sum"><div class="d-words"><span class="d-lab">${isQ ? 'Arrêté le présent devis à la somme de' : 'Arrêtée la présente facture à la somme de'}</span><p>${amountWords(t.ttc)} TTC.</p>
${isQ && num(doc.deposit_pct) > 0 ? `<div class="d-dep"><div><span>Acompte à la commande (${pct(doc.deposit_pct)})</span><b>${money(deposit)}</b></div><div><span>Solde à la livraison</span><b>${money(t.ttc - deposit)}</b></div></div>` : ''}
${!isQ ? `<div class="d-dep"><div><span>Déjà réglé</span><b>${money(paid)}</b></div><div class="${due > 0 ? 'due' : 'ok'}"><span>${due > 0 ? 'Reste à payer' : 'Facture réglée'}</span><b>${money(due)}</b></div></div>` : ''}</div>
<table class="d-tot">${discount > 0.004 ? `<tr><td>Sous-total HT</td><td>${money(subtotal)}</td></tr><tr><td>Remise ${pct(doc.discount_pct)}</td><td>−${money(discount)}</td></tr>` : ''}<tr><td>Total HT</td><td>${money(t.ht)}</td></tr>${tvaLine}<tr class="ttc"><td>Total TTC</td><td>${money(t.ttc)}</td></tr></table></section>
${isQ && doc.delay ? `<p class="d-delay"><b>Délai :</b> ${esc(doc.delay)}</p>` : ''}
${doc.notes ? `<section class="d-notes"><span class="d-lab">Notes</span><p>${esc(doc.notes).replace(/\n/g, '<br>')}</p></section>` : ''}
${isQ && doc.conditions ? `<section class="d-notes"><span class="d-lab">Conditions</span><p>${esc(doc.conditions).replace(/\n/g, '<br>')}</p></section>` : ''}
<section class="d-foot-grid">${s.bank_rib ? `<div class="d-bank"><span class="d-lab">Règlement par virement</span><p>${s.bank_name ? esc(s.bank_name) + '<br>' : ''}RIB ${esc(s.bank_rib)}${s.bank_swift ? '<br>SWIFT ' + esc(s.bank_swift) : ''}<br>Référence : ${esc(doc.number || '')}</p></div>` : '<div></div>'}
${isQ ? (doc.accepted_at ? `<div class="d-sign ok"><span class="d-lab">Bon pour accord</span><p>${doc.accepted_name ? `Accepté en ligne le ${dateFr(doc.accepted_at)}<br>par <b>${esc(doc.accepted_name)}</b>` : `Accord du client confirmé le ${dateFr(doc.accepted_at)}`}</p></div>` : '<div class="d-sign"><span class="d-lab">Bon pour accord</span><p>Date, nom et signature du client</p></div>') : ''}</section>
<footer class="d-legal">${esc(s.company_name)} · ${esc(s.company_address)} · ${esc(s.company_site)}${legal(s) ? '<br>' + legal(s) : ''}</footer>
</article>`;
}

module.exports = { renderDoc, LOGO, KIND };
