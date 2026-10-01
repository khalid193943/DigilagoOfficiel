/* Messagerie : modèles remplis automatiquement, langue, canal, ouverture de WhatsApp. */
(function(){
  'use strict';
  var f = document.getElementById('cmp');
  var auto = document.querySelector('[data-autoopen]'); if (auto) { try { window.open(auto.href, '_blank', 'noopener'); } catch (e) {} }
  var bbs = document.getElementById('bbs'); if (bbs) bbs.scrollTop = bbs.scrollHeight;
  if (!f) return;
  var T = JSON.parse(f.dataset.tpl || '[]'), V = JSON.parse(f.dataset.vars || '{}');
  var sel = f.querySelector('[name=template]'), ta = f.querySelector('[name=body]'), subj = f.querySelector('[name=subject]');
  var fill = function(t){ return String(t || '').replace(/\{(\w+)\}/g, function(m, k){ return V[k] !== undefined && V[k] !== null ? String(V[k]) : ''; }).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); };
  var lang = function(){ var r = f.querySelector('[name=lang]:checked'); return r ? r.value : 'fr'; };
  var dirty = false; ta.addEventListener('input', function(){ dirty = true; });
  function apply(force){
    var t = T.filter(function(x){ return x.k === sel.value; })[0]; if (!t) return;
    if (dirty && !force && !confirm('Remplacer votre texte par le modèle ?')) return;
    ta.value = fill(lang() === 'ar' ? t.ar : t.fr); ta.dir = lang() === 'ar' ? 'rtl' : 'ltr'; dirty = false;
    if (subj && !subj.dataset.touched) subj.value = fill(t.s);
  }
  sel.addEventListener('change', function(){ apply(false); });
  f.querySelectorAll('[name=lang]').forEach(function(r){ r.addEventListener('change', function(){ apply(true); }); });
  if (subj) subj.addEventListener('input', function(){ subj.dataset.touched = 1; });
  /* page « écrire » : le destinataire suit le canal (numéro pour WhatsApp, adresse pour l'e-mail) */
  var ch = document.getElementById('wrCh'), to = document.getElementById('wrTo'), subjW = f.querySelector('.wr-subj');
  function chg(){ if (!ch) return; var o = ch.options[ch.selectedIndex], wa = o && o.dataset.wa === '1'; if (to && (f.dataset.phone || f.dataset.email)) to.value = wa ? (f.dataset.phone || f.dataset.email) : (f.dataset.email || f.dataset.phone); if (subjW) subjW.hidden = wa; }
  if (ch) { ch.addEventListener('change', chg); chg(); }
  if (sel.value) apply(true);
  ta.addEventListener('keydown', function(e){ if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') f.requestSubmit(); });
})();
