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

/* ---------- Demandes à l'instant : alerte dès qu'un client écrit sur le site ----------
   Toutes les 15 s (page visible), la gestion demande au serveur s'il y a du nouveau : le compteur
   « Demandes » se met à jour partout, et chaque nouvelle demande s'affiche aussitôt avec ses gestes
   (appeler, WhatsApp, ouvrir), un petit son et, si vous l'avez autorisée, une notification du système. */
(function(){
  'use strict';
  if (!document.body.classList.contains('admin')) return;
  var K = 'dg-lead-last', last = 0, t0 = document.title.replace(/^\(\d+\)\s*/, ''), busy = false, hidden = 0, actx = null;
  try { last = +localStorage.getItem(K) || 0; } catch (e) {}
  var h = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var links = Array.prototype.slice.call(document.querySelectorAll('.side nav a[href="/demandes"], .tabbar a[href="/demandes"]'));
  var stack = document.createElement('div'); stack.className = 'toasts'; stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack);
  function count(n, late){
    links.forEach(function(a){ var b = a.querySelector('.nb'); if (!n) { if (b) b.remove(); return; } if (!b) { b = document.createElement('i'); b.className = 'nb'; a.appendChild(b); } b.textContent = n > 99 ? '99+' : n; });
    document.title = (n ? '(' + n + ') ' : '') + t0;
    var lk = document.querySelector('[data-pulse-late]'); if (lk) lk.textContent = late;
    var ln = document.querySelector('[data-pulse-n]'); if (ln) ln.textContent = n;
  }
  /* un petit carillon (deux notes douces), seulement après un premier geste sur la page */
  document.addEventListener('pointerdown', function(){ try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }, { once: true });
  function chime(){
    if (!actx) return;
    try { [[880, 0], [1320, .14]].forEach(function(n){ var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + n[1];
      o.type = 'sine'; o.frequency.value = n[0]; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + .55); }); } catch (e) {}
  }
  function toast(l){
    var el = document.createElement('div'); el.className = 'toast src-' + h(l.src[0]);
    el.innerHTML = '<div class="t-h"><span class="t-src">' + h(l.src[1]) + '</span><em>' + h(l.at) + '</em><button type="button" class="t-x" aria-label="Fermer">×</button></div>' +
      '<b>' + h(l.who) + '</b>' + (l.need ? '<p>' + h(l.need) + '</p>' : '') + (l.phone ? '<span class="t-ph">' + h(l.phone) + (l.city ? ' · ' + h(l.city) : '') + '</span>' : '') +
      '<div class="t-a">' + (l.phone ? '<a class="btn sm" href="tel:' + h(l.phone) + '">Appeler</a><a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/' + h(l.wa) + '">WhatsApp</a>' : '') + '<a class="btn ghost sm" href="/demandes/' + (+l.id) + '">Ouvrir</a></div>';
    el.querySelector('.t-x').addEventListener('click', function(){ el.classList.add('out'); setTimeout(function(){ el.remove(); }, 260); });
    stack.prepend(el); requestAnimationFrame(function(){ el.classList.add('in'); });
    while (stack.children.length > 3) stack.lastChild.remove();
    if (document.hidden && window.Notification && Notification.permission === 'granted') {
      try { var no = new Notification('Nouvelle demande : ' + l.who, { body: [l.src[1], l.phone, l.need].filter(Boolean).join(' · '), tag: 'lead-' + l.id });
        no.onclick = function(){ window.focus(); location.href = '/demandes/' + (+l.id); }; } catch (e) {}
    }
  }
  /* sur la page des demandes : un bandeau propose d'afficher les nouvelles */
  function banner(k){
    if (location.pathname !== '/demandes') return;
    var b = document.querySelector('.live-b');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'live-b'; b.addEventListener('click', function(){ location.reload(); });
      var at = document.querySelector('.tools') || document.querySelector('.main > .top'); at.parentNode.insertBefore(b, at.nextSibling); }
    b.textContent = k + (k > 1 ? ' nouvelles demandes' : ' nouvelle demande') + ' · Afficher';
  }
  var waiting = 0;
  function tick(){
    if (busy) return; busy = true;
    fetch('/api/pulse?since=' + last, { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(p){
      busy = false; if (!p) return;
      count(p.n, p.late);
      if (!last) last = p.last; /* première visite : pas d'alerte pour les anciennes demandes */
      else if (p.fresh && p.fresh.length) { p.fresh.slice().reverse().forEach(toast); chime(); waiting += p.fresh.length; banner(waiting); }
      if (p.last > last) last = p.last;
      try { localStorage.setItem(K, last); } catch (e) {}
    }).catch(function(){ busy = false; });
  }
  tick(); setInterval(function(){ if (!document.hidden || ++hidden % 4 === 0) tick(); }, 15000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) tick(); });
  /* autoriser les notifications du système (une fois, d'un geste) */
  var ab = document.querySelector('[data-alerts]');
  if (ab && window.Notification && Notification.permission === 'default') {
    ab.hidden = false;
    ab.addEventListener('click', function(){ Notification.requestPermission().then(function(r){ ab.hidden = r !== 'default'; }); });
  }
  /* « Contactée » en un geste, depuis la carte du pipeline */
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-done]'); if (!b) return;
    e.preventDefault(); b.disabled = true;
    fetch('/demandes/' + (+b.dataset.done) + '/etape', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: 'stage=contacte' })
      .then(function(r){ if (!r.ok) throw 0;
        var card = b.closest('.ld'), to = document.querySelector('.kb-col[data-stage="contacte"]'), from = card && card.closest('.kb-col');
        b.remove(); if (card) card.classList.remove('fresh');
        if (card && to && from !== to) { var hd = to.querySelector('header'), em = to.querySelector('.empty'); if (em) em.remove(); hd.parentNode.insertBefore(card, hd.nextSibling); card.classList.add('moved');
          [from, to].forEach(function(c){ var n = c.querySelectorAll('.ld').length, s = c.querySelector('.kb-n'); if (s) s.textContent = n; }); }
        tick();
      }).catch(function(){ b.disabled = false; });
  });
})();

/* ---------- Confirmations : une vraie fenêtre (et non la boîte du navigateur) avant les gestes importants ---------- */
(function(){
  'use strict';
  var dlg = null, pending = null;
  function ask(text, ok, then){
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'confirm';
      dlg.innerHTML = '<form method="dialog"><p></p><div class="cf-a"><button value="no" class="btn ghost">Annuler</button><button value="yes" class="btn cf-ok">Confirmer</button></div></form>';
      document.body.appendChild(dlg);
      dlg.addEventListener('close', function(){ var f = pending; pending = null; if (f && dlg.returnValue === 'yes') f(); });
    }
    dlg.querySelector('p').textContent = text; dlg.querySelector('.cf-ok').textContent = ok || 'Confirmer';
    pending = then; dlg.returnValue = ''; dlg.showModal(); dlg.querySelector('.cf-ok').focus();
  }
  /* la question vient du bouton cliqué (data-confirm) ou du formulaire */
  document.addEventListener('submit', function(e){
    var f = e.target, sb = e.submitter, msg = (sb && sb.dataset.confirm) || f.dataset.confirm;
    if (!msg || f.dataset.confirmed) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var go = function(){ f.dataset.confirmed = '1'; if (f.requestSubmit) f.requestSubmit(sb || undefined); else f.submit(); setTimeout(function(){ delete f.dataset.confirmed; }, 4000); };
    if (!window.HTMLDialogElement) { if (confirm(msg)) go(); return; }
    ask(msg, (sb && sb.dataset.ok) || f.dataset.ok, go);
  }, true);
})();

/* ---------- Aperçus des sites (tableau de bord) : chargés seulement quand on les voit, une fois la page prête ----------
   Un site entier dans la page coûte cher : il ne doit jamais ralentir l'ouverture de la gestion. */
(function(){
  'use strict';
  var fr = document.querySelectorAll('iframe[data-src]'); if (!fr.length) return;
  var go = function(f){ if (!f.src) f.src = f.dataset.src; };
  var idle = window.requestIdleCallback || function(cb){ return setTimeout(cb, 400); };
  var start = function(){
    if (!('IntersectionObserver' in window)) { Array.prototype.forEach.call(fr, go); return; }
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { idle(function(){ go(e.target); }); io.unobserve(e.target); } }); }, { rootMargin: '120px' });
    Array.prototype.forEach.call(fr, function(f){ io.observe(f); });
  };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
