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
  /* lignes cliquables */
  $$('tr[data-href]').forEach(function(tr){ tr.addEventListener('click', function(e){ if (!e.target.closest('a,button,form,input')) location.href = tr.dataset.href; }); });

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
    var disc = sub * Math.min(100, num($('#disc').value)) / 100, ht = sub - disc, tva = ht * num($('#tva').value) / 100, ttc = ht + tva, dep = ttc * Math.min(100, num($('#dep').value)) / 100;
    $('#sSub').textContent = money(sub); $('#sDisc').textContent = disc ? '−' + money(disc) : money(0); $('#sHt').textContent = money(ht); $('#sTva').textContent = money(tva); $('#sTtc').textContent = money(ttc); $('#sDep').textContent = money(dep); $('#sSol').textContent = money(ttc - dep);
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
  ['#disc', '#dep', '#tva'].forEach(function(s){ $(s).addEventListener('input', calc); $(s).addEventListener('change', calc); });
  calc();
})();
