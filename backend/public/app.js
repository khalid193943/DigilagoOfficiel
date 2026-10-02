(function(){
  'use strict';
  var $ = function(s, r){ return (r || document).querySelector(s); }, $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var num = function(v){ var n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  var money = function(n){ var neg = n < 0, p = Math.abs(n).toFixed(2).split('.'); return (neg ? '−' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ',' + p[1] + '\u00a0DH'; };

  /* impression = PDF */
  $$('[data-print]').forEach(function(b){ b.addEventListener('click', function(){ window.print(); }); });
  /* copier le lien client */
  $$('[data-copy]').forEach(function(b){ b.addEventListener('click', function(){ var i = $(b.dataset.copy); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand('copy'); } b.textContent = 'Copié'; setTimeout(function(){ b.textContent = 'Copier'; }, 1500); }); });
  /* envoyer = marquer le devis comme envoyé */
  $$('[data-mark]').forEach(function(a){ a.addEventListener('click', function(){ try { fetch(a.dataset.mark, { method: 'POST', credentials: 'same-origin' }); } catch (e) {} }); });
  /* confirmations */
  $$('form[data-confirm]').forEach(function(f){ f.addEventListener('submit', function(e){ if (!confirm(f.dataset.confirm)) e.preventDefault(); }); });
  /* un formulaire envoyé une fois ne repart pas au double-clic (doubles factures, doubles paiements…) */
  document.addEventListener('submit', function(e){
    var f = e.target; if (e.defaultPrevented || f.method.toLowerCase() !== 'post') return;
    if (f.dataset.sent) { e.preventDefault(); return; }
    f.dataset.sent = '1'; setTimeout(function(){ delete f.dataset.sent; }, 5000);
  });
  /* lignes cliquables */
  $$('tr[data-href]').forEach(function(tr){ tr.addEventListener('click', function(e){ if (!e.target.closest('a,button,form,input')) location.href = tr.dataset.href; }); });


  /* ---------- Recherche globale ⌘K : un client, un projet, une facture en deux touches ---------- */
  (function(){
    if (!document.body.classList.contains('admin')) return;
    var ACT = [['Nouveau projet (assistant)', '/assistant'], ['Nouveau devis', '/devis/nouveau'], ['Ajouter une dépense', '/depenses'], ['Ma journée', '/'], ['Projets', '/projets'], ['Factures en retard', '/factures?statut=retard'], ['Rapports', '/rapports']];
    var box = document.createElement('div'); box.className = 'cmdk'; box.hidden = true;
    box.innerHTML = '<div class="cmdk-in"><input placeholder="Rechercher un client, un projet, un devis, une facture… ou une action" aria-label="Recherche"><ul></ul><p><kbd>↑</kbd><kbd>↓</kbd> naviguer · <kbd>Entrée</kbd> ouvrir · <kbd>Échap</kbd> fermer</p></div>';
    document.body.appendChild(box);
    var inp = box.querySelector('input'), ul = box.querySelector('ul'), items = [], act = 0, timer = 0;
    /* tout ce qui vient de la base est échappé : un nom de client ne peut jamais devenir du code */
    var h = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    function draw(){ ul.innerHTML = items.map(function(it, i){ return '<li class="' + (i === act ? 'on' : '') + '" data-u="' + h(/^\//.test(it.u) ? it.u : '/') + '"><em>' + h(it.t) + '</em><b>' + h(it.n) + '</b><small>' + h(it.s) + '</small></li>'; }).join('') || '<li class="none">Aucun résultat</li>'; ul.querySelectorAll('li[data-u]').forEach(function(li){ li.addEventListener('click', function(){ location.href = li.dataset.u; }); }); }
    function base(q){ var t = (q || '').toLowerCase(); return ACT.filter(function(a){ return !t || a[0].toLowerCase().indexOf(t) !== -1; }).map(function(a){ return { t: 'Action', n: a[0], u: a[1] }; }); }
    function search(){ var q = inp.value.trim(); act = 0; items = base(q); draw(); clearTimeout(timer); if (q.length < 2) return; timer = setTimeout(function(){ fetch('/api/recherche?q=' + encodeURIComponent(q), { credentials: 'same-origin' }).then(function(r){ return r.json(); }).then(function(r){ items = r.concat(base(q)); act = 0; draw(); }).catch(function(){}); }, 140); }
    function open(){ box.hidden = false; inp.value = ''; inp.focus(); search(); }
    function close(){ box.hidden = true; }
    inp.addEventListener('input', search);
    inp.addEventListener('keydown', function(e){ if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); draw(); } else if (e.key === 'Enter' && items[act]) location.href = items[act].u; else if (e.key === 'Escape') close(); });
    box.addEventListener('click', function(e){ if (e.target === box) close(); });
    document.addEventListener('keydown', function(e){ if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.hidden ? open() : close(); } else if (e.key === 'n' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && box.hidden) location.href = '/assistant'; });
    document.querySelectorAll('[data-cmdk]').forEach(function(b){ b.addEventListener('click', open); });
  })();

  /* ---------- formulaire de devis ---------- */
  var form = $('#qform'); if (!form) return;
  var SV = []; try { SV = JSON.parse(form.dataset.services || '[]'); } catch (e) {}
  var body = $('#itemsBody');
  var sel = $('#clientSel'), nc = $('#newClient');
  if (sel) sel.addEventListener('change', function(){ nc.hidden = sel.value !== 'new'; if (sel.value === 'new') { var f = nc.querySelector('input'); if (f) f.focus(); } });
  function renumber(){
    $$('tr.it', body).forEach(function(tr, i){
      tr.querySelector('.drag').textContent = i + 1;
      $$('input,textarea', tr).forEach(function(el){ el.name = el.name.replace(/items\[\d+\]/, 'items[' + i + ']'); });
    });
  }
  function calc(){
    var sub = 0;
    $$('tr.it', body).forEach(function(tr){ var t = num($('.it-q', tr).value || 1) * num($('.it-p', tr).value); tr.querySelector('.it-t').textContent = money(t).replace('\u00a0DH', ''); sub += t; });
    /* data-ttc : prix saisis TTC (ce que paie le client) ; le HT et la TVA s'en déduisent */
    var rate = num($('#tva').value) / 100, disc = sub * Math.min(100, num($('#disc').value)) / 100, ht, tva, ttc;
    if (form.dataset.ttc === '1') { ttc = sub - disc; ht = Math.round(ttc / (1 + rate) * 100) / 100; tva = ttc - ht; }
    else { ht = sub - disc; tva = ht * rate; ttc = ht + tva; }
    var dep = ttc * Math.min(100, num($('#dep').value)) / 100;
    $('#sSub').textContent = money(sub); $('#sDisc').textContent = disc ? '−' + money(disc) : money(0); $('#sHt').textContent = money(ht); $('#sTva').textContent = money(tva); $('#sTtc').textContent = money(ttc);
    planPreview(ttc);
  }
  function fill(tr){
    var l = $('.it-l', tr), s = SV.filter(function(x){ return x.n === l.value; })[0]; if (!s) return;
    var d = $('textarea', tr), u = $('.it-u', tr), p = $('.it-p', tr);
    if (!d.value) d.value = s.d || ''; if (!u.value || u.value === 'forfait') u.value = s.u || 'forfait'; if (!num(p.value) && s.p) p.value = String(s.p).replace('.', ',');
    calc();
  }
  function addRow(name){
    var first = $('tr.it', body), tr = first.cloneNode(true);
    $$('input,textarea', tr).forEach(function(el){ el.value = el.classList.contains('it-q') ? '1' : el.classList.contains('it-u') ? 'forfait' : ''; });
    body.appendChild(tr); renumber(); bind(tr);
    if (name) { $('.it-l', tr).value = name; fill(tr); } else $('.it-l', tr).focus();
    calc(); return tr;
  }
  function bind(tr){
    $$('input,textarea', tr).forEach(function(el){ el.addEventListener('input', calc); });
    $('.it-l', tr).addEventListener('change', function(){ fill(tr); });
    $('[data-del]', tr).addEventListener('click', function(){ if ($$('tr.it', body).length > 1) { tr.remove(); renumber(); calc(); } else { $$('input,textarea', tr).forEach(function(el){ if (!el.classList.contains('it-q')) el.value = ''; }); calc(); } });
    $$('textarea', tr).forEach(function(t){ t.addEventListener('input', function(){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }); });
  }
  $$('tr.it', body).forEach(bind);
  $('#addRow').addEventListener('click', function(){ addRow(''); });
  $$('[data-add]').forEach(function(b){ b.addEventListener('click', function(){
    var empty = $$('tr.it', body).filter(function(tr){ return !$('.it-l', tr).value; })[0];
    if (empty) { $('.it-l', empty).value = b.dataset.add; fill(empty); } else addRow(b.dataset.add);
  }); });
  /* échéancier : aperçu des montants de chaque tranche */
  var PL = {}; try { PL = JSON.parse(($('#planPrev') || {}).dataset ? $('#planPrev').dataset.plans : '{}'); } catch (e) {}
  function planRows(){ var k = $('#planKey') ? $('#planKey').value : '50-50'; if (k === 'custom') { return ($('[name=plan_custom]').value || '').split(/\n/).map(function(l){ var p = l.split(/[;|]/); return p[1] ? [p[0].trim(), num(p[1])] : null; }).filter(Boolean); } return PL[k] || []; }
  function planPreview(ttc){ var box = $('#planPrev'); if (!box) return; var rows = planRows(), acc = 0, sum = rows.reduce(function(a, r){ return a + r[1]; }, 0);
    box.innerHTML = '<span>Échéancier</span>' + rows.map(function(r, i){ var amt = i === rows.length - 1 ? ttc - acc : Math.round(ttc * r[1]) / 100; acc += amt; return '<div><em>' + (i + 1) + '. ' + r[0] + '</em><b>' + money(amt) + '</b></div>'; }).join('') + (Math.abs(sum - 100) > 0.5 ? '<p class="warn">Le total des tranches doit faire 100 % (actuellement ' + sum + ' %).</p>' : '');
    var d = $('#dep'); if (d && rows.length) d.value = rows.length > 1 ? rows[0][1] : 100; }
  if ($('#planKey')) $('#planKey').addEventListener('change', function(){ $('#planCustomW').hidden = $('#planKey').value !== 'custom'; calc(); });
  if ($('[name=plan_custom]')) $('[name=plan_custom]').addEventListener('input', calc);
  ['#disc', '#tva'].forEach(function(s){ $(s).addEventListener('input', calc); $(s).addEventListener('change', calc); });
  calc();
})();

/* ---------- Téléphone : menu plein écran et tableaux en cartes ---------- */
(function(){
  'use strict';
  var mb = document.querySelector('[data-menu]');
  if (mb) mb.addEventListener('click', function(){
    var on = document.body.classList.toggle('menu-open');
    mb.setAttribute('aria-expanded', on ? 'true' : 'false');
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && document.body.classList.contains('menu-open')) mb.click(); });
  /* chaque cellule reçoit l'intitulé de sa colonne : lisible en carte sur téléphone */
  Array.prototype.forEach.call(document.querySelectorAll('table.tbl:not(.edit)'), function(t){
    var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function(th){ return th.textContent.trim(); });
    if (!heads.length) return;
    Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function(tr){
      Array.prototype.forEach.call(tr.children, function(td, i){ if (heads[i]) td.setAttribute('data-label', heads[i]); });
    });
  });
})();
