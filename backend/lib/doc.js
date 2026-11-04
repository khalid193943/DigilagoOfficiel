'use strict';
const { esc, money, pct, dateFr, amountWords, num, round2 } = require('./fmt');

const LOGO = '<svg viewBox="14 8 38 48" aria-hidden="true"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="currentColor"/><path d="M28 10 A22 22 0 0 1 28 54 Z" fill="currentColor"/></svg>';
/* Marque de la Gestion (famille de logos Digilago) : le D tranché en lignes de registre ; la dernière, verte et cochée,
   est réglée. Nuit : menu de l'application. Jour : page de connexion, sur le ciel. Les documents gardent le D de l'agence. */
const gmark = (day) => {
  const c = day ? ['#FFFFFF', '#FFFFFF', 'rgba(255,255,255,.8)', 'rgba(255,255,255,.6)'] : ['#5F9FF9', '#DDEBFF', '#A9CBFB', '#6FA6F6'];
  return `<svg class="gmk" viewBox="14 8 38 48" aria-hidden="true"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="${c[0]}"/><path d="M28 10A22 22 0 0 1 46.1 19.5H28Z" fill="${c[1]}"/><path d="M28 21.5H47.33A22 22 0 0 1 49.98 31H28Z" fill="${c[2]}"/><path d="M28 33H49.98A22 22 0 0 1 47.33 42.5H28Z" fill="${c[3]}"/><path d="M28 44.5H46.1A22 22 0 0 1 28 54Z" fill="#3DDC97"/><path d="M31.5 48.6l2.3 2.2 4.4-4.2" fill="none" stroke="#071433" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};
const GLOGO = gmark(false), GLOGO_DAY = gmark(true);
/* Icône de l'onglet : la même marque sur une tuile de nuit */
const GICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#071433"/><g transform="translate(16 13) scale(0.79) translate(-14 -8)"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="#5F9FF9"/><path d="M28 10A22 22 0 0 1 46.1 19.5H28Z" fill="#DDEBFF"/><path d="M28 21.5H47.33A22 22 0 0 1 49.98 31H28Z" fill="#A9CBFB"/><path d="M28 33H49.98A22 22 0 0 1 47.33 42.5H28Z" fill="#6FA6F6"/><path d="M28 44.5H46.1A22 22 0 0 1 28 54Z" fill="#3DDC97"/><path d="M31.5 48.6l2.3 2.2 4.4-4.2" fill="none" stroke="#071433" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></g></svg>');
const KIND = { acompte: 'Facture d’acompte', situation: 'Facture de situation', solde: 'Facture de solde', totale: 'Facture', avoir: 'Avoir' };
const { planOf } = require('./plans');

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
function renderDoc({ type, doc, items, client, s, paid = 0, quote = null, sig = null }) {
  const isBC = type === 'bdc';
  const isQ = type === 'devis' || isBC;
  const t = { ht: num(doc.total_ht), tva: num(doc.total_tva), ttc: num(doc.total_ttc) };
  /* Prix saisis TTC : le document affiche quand même le prix unitaire HT, le HT, la TVA et le TTC
     (mentions légales). Les lignes HT se déduisent du TTC et tombent juste sur le total HT. */
  const k = num(doc.prices_ttc) ? 1 + num(doc.tva_rate) / 100 : 1;
  const L = items.map((it) => ({ it, unit: round2(num(it.unit_price) / k), total: round2(num(it.qty, 1) * num(it.unit_price) / k) }));
  if (k !== 1 && !(num(doc.discount_pct) > 0) && L.length) {
    const diff = round2(t.ht - L.reduce((a, x) => a + x.total, 0)), last = [...L].reverse().find((x) => x.total !== 0);
    if (last && Math.abs(diff) > 0.004 && Math.abs(diff) < 0.05) { last.total = round2(last.total + diff); if (num(last.it.qty, 1) === 1) last.unit = last.total; }
  }
  const subtotal = L.reduce((a, x) => a + x.total, 0);
  const discount = isQ ? subtotal - t.ht : 0;
  const rows = L.map(({ it, unit, total }, i) => `<tr><td class="c-n">${i + 1}</td><td><b>${esc(it.label)}</b>${it.description ? `<small>${esc(it.description)}</small>` : ''}</td><td class="c-r">${String(num(it.qty, 1)).replace('.', ',')}${it.unit ? ` <i>${esc(it.unit)}</i>` : ''}</td>${num(it.unit_price) === 0 ? '<td class="c-r off" colspan="2">Offert</td>' : `<td class="c-r">${money(unit)}</td><td class="c-r">${money(total)}</td>`}</tr>`).join('');
  const title = isBC ? 'Bon de commande' : isQ ? 'Devis' : (KIND[doc.kind] || 'Facture');
  const deposit = isQ ? t.ttc * num(doc.deposit_pct) / 100 : 0;
  const due = isQ ? 0 : Math.max(0, t.ttc - paid);
  const cl = client || {};
  const tvaLine = num(doc.tva_rate) > 0 ? `<tr><td>TVA ${pct(doc.tva_rate)}</td><td>${money(t.tva)}</td></tr>` : `<tr><td colspan="2" class="t-note">${/^ae_/.test(s.fiscal_regime || '') ? 'TVA non applicable, article 91 du CGI' : 'TVA non applicable'}</td></tr>`;
  return `<article class="doc ${isQ ? 'is-q' : 'is-f'}">
<header class="d-head"><div class="d-brand"><span class="d-logo">${LOGO}</span><div><b>${esc(s.company_name)}</b><small>${esc(s.company_tagline)}</small></div></div>
<div class="d-id"><span class="d-type">${title}</span><b class="d-num">${esc((isBC ? doc.order_number : doc.number) || 'Brouillon')}</b><dl><dt>Date</dt><dd>${dateFr(isBC ? doc.order_date : doc.issue_date)}</dd>${isBC ? `<dt>Devis accepté</dt><dd>${esc(doc.quote_number || '')}</dd>` : isQ ? `<dt>Valable jusqu’au</dt><dd>${dateFr(doc.valid_until)}</dd>` : `<dt>Échéance</dt><dd>${dateFr(doc.due_date)}</dd>`}${!isQ && quote ? `<dt>Devis</dt><dd>${esc(quote.number)}</dd>` : ''}</dl></div></header>
<section class="d-parties"><div><span class="d-lab">De</span><b>${esc(s.company_name)}</b><p>${esc(s.company_address)}<br>${esc(s.company_phone)}<br>${esc(s.company_email)}${s.company_ice ? '<br>ICE ' + esc(s.company_ice) : ''}</p></div>
<div class="d-to"><span class="d-lab">${isQ ? 'Pour' : 'Facturé à'}</span><b>${esc(cl.company || cl.name || '')}</b><p>${cl.company && cl.name ? esc(cl.name) + '<br>' : ''}${cl.address ? esc(cl.address) + '<br>' : ''}${cl.city ? esc(cl.city) + '<br>' : ''}${cl.phone ? esc(cl.phone) + '<br>' : ''}${cl.email ? esc(cl.email) : ''}${cl.ice ? '<br>ICE ' + esc(cl.ice) : ''}${cl.if_num ? ' · IF ' + esc(cl.if_num) : ''}</p></div></section>
${doc.title ? `<h2 class="d-title">${esc(doc.title)}</h2>` : ''}
<table class="d-table"><thead><tr><th class="c-n">#</th><th>Désignation</th><th class="c-r">Qté</th><th class="c-r">Prix unitaire HT</th><th class="c-r">Total HT</th></tr></thead><tbody>${rows}</tbody></table>
<section class="d-sum"><div class="d-words"><span class="d-lab">${isBC ? 'Arrêté le présent bon de commande à la somme de' : isQ ? 'Arrêté le présent devis à la somme de' : doc.kind === 'avoir' ? 'Arrêté le présent avoir à la somme de' : 'Arrêtée la présente facture à la somme de'}</span><p>${amountWords(t.ttc)} TTC.</p>
${isQ ? (() => { const pl = planOf(doc); let acc = 0; return `<div class="d-plan"><span class="d-lab">Échéancier de paiement</span><table>${pl.map((x, i) => { const amt = i === pl.length - 1 ? Math.round((t.ttc - acc) * 100) / 100 : Math.round(t.ttc * x.p) / 100; acc += amt; return `<tr><td>${i + 1}. ${esc(x.l)}</td><td>${pct(x.p)}</td><td>${money(amt)}</td></tr>`; }).join('')}</table></div>`; })() : ''}
${!isQ && doc.kind !== 'avoir' ? `<div class="d-dep"><div><span>Déjà réglé</span><b>${money(paid)}</b></div><div class="${due > 0 ? 'due' : 'ok'}"><span>${due > 0 ? 'Reste à payer' : 'Facture réglée'}</span><b>${money(due)}</b></div></div>` : ''}</div>
<table class="d-tot">${discount > 0.004 ? `<tr><td>Sous-total HT</td><td>${money(subtotal)}</td></tr><tr><td>Remise ${pct(doc.discount_pct)}</td><td>−${money(discount)}</td></tr>` : ''}<tr><td>Total HT</td><td>${money(t.ht)}</td></tr>${tvaLine}<tr class="ttc"><td>Total TTC</td><td>${money(t.ttc)}</td></tr></table></section>
${isQ && doc.delay ? `<p class="d-delay"><b>Délai :</b> ${esc(doc.delay)}</p>` : ''}
${!isQ && doc.kind !== 'avoir' ? `<p class="d-delay"><b>Règlement :</b> au plus tard le ${dateFr(doc.due_date)}, par virement${s.bank_rib ? ' (coordonnées ci-dessous)' : ''}, chèque ou carte. Délai convenu selon la loi n° 69-21 relative aux délais de paiement.${/^ae_/.test(s.fiscal_regime || '') ? '' : ' Règlement en espèces : droit de timbre de 0,25 %.'}</p>` : ''}
${doc.notes ? `<section class="d-notes"><span class="d-lab">Note</span><p>${esc(doc.notes).replace(/\n/g, '<br>')}</p></section>` : ''}
${isQ && doc.conditions ? `<section class="d-notes"><span class="d-lab">Conditions</span><p>${esc(doc.conditions).replace(/\n/g, '<br>')}</p></section>` : ''}
<section class="d-foot-grid">${s.bank_rib ? `<div class="d-bank"><span class="d-lab">Coordonnées bancaires</span><p>${s.bank_name ? esc(s.bank_name) + '<br>' : ''}RIB ${esc(s.bank_rib)}${s.bank_swift ? '<br>SWIFT ' + esc(s.bank_swift) : ''}<br>Libellé du virement : ${esc(doc.number || '')}</p></div>` : '<div></div>'}
${isQ && sig ? `<div class="d-sign ok d-esig"><span class="d-lab">${isBC ? 'Commande signée' : 'Bon pour accord'} · signature électronique</span><img src="${sig.image}" alt="Signature de ${esc(sig.signer_name)}"><p>Signé par <b>${esc(sig.signer_name)}</b>${sig.signer_role ? `, ${esc(sig.signer_role)}` : ''}${sig.signer_company ? ` (${esc(sig.signer_company)})` : ''}<br>le ${esc(sig.when || dateFr(sig.signed_at))}${sig.verified_by ? ` · code vérifié par ${esc(sig.verified_by)}` : ''}<br><small>Empreinte du document : ${esc(String(sig.doc_hash || '').slice(0, 16))}…</small></p></div>` : ''}${isQ && !sig ? (doc.accepted_at ? `<div class="d-sign ok"><span class="d-lab">${isBC ? 'Commande validée' : 'Bon pour accord'}</span><p>${doc.accepted_name ? `Accepté en ligne le ${dateFr(doc.accepted_at)}<br>par <b>${esc(doc.accepted_name)}</b>` : `Accord du client confirmé le ${dateFr(doc.accepted_at)}`}</p></div>` : '<div class="d-sign"><span class="d-lab">Bon pour accord</span><p>Date, nom, signature et cachet du client</p></div>') : ''}</section>
<footer class="d-legal">${esc(s.company_name)} · ${esc(s.company_address)} · ${esc(s.company_site)}${legal(s) ? '<br>' + legal(s) : ''}</footer>
</article>`;
}

module.exports = { renderDoc, LOGO, GLOGO, GLOGO_DAY, GICON, KIND };
