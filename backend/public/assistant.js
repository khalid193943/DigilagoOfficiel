/* Assistant Digilago : il écoute la conversation (le formulaire) et vous souffle la suite. */
(function(){
  'use strict';
  var f = document.getElementById('ac'); if (!f) return;
  var $ = function(s){ return f.querySelector(s); }, $$ = function(s){ return Array.prototype.slice.call(f.querySelectorAll(s)); };
  var SV = JSON.parse(f.dataset.services || '[]'), PL = JSON.parse(f.dataset.plans || '{}');
  var price = {}; SV.forEach(function(x){ price[x.n] = x; });
  var money = function(n){ var p = Math.abs(n).toFixed(2).split('.'); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ',' + p[1] + '\u00a0DH'; };
  var val = function(n){ var el = f.querySelector('[name="' + n + '"]:checked') || f.querySelector('[name="' + n + '"]:not([type=radio])'); return el ? (el.type === 'checkbox' ? (el.checked ? el.value : '') : el.value) : ''; };
  /* le pack : ce qui est de base selon le type de site, et les options */
  var BASE = { vitrine: ['Site vitrine sur mesure'], ecommerce: ['Boutique en ligne', 'Paiement en ligne'], landing: ['Landing page'], application: ['Application sur mesure'] };
  var CORE = ['Code optimisé et performance', 'Rédaction SEO', 'Optimisation GEO (moteurs de réponse IA)', 'Fiche Google Business', 'Nom de domaine offert (1re année)', 'Hébergement sécurisé'];
  var OPTS = ['Refonte et migration', 'Transfert du nom de domaine', 'Création de logo et charte', 'Photos professionnelles', 'Prise de rendez-vous en ligne', 'Paiement en ligne', 'Traduction professionnelle', 'E-mails professionnels', 'Maintenance et support', 'Rapport mensuel SEO'];
  var box = document.getElementById('acPack'), chosen = {}, touched = {};
  function renderPack(){
    var kind = val('kind') || 'vitrine', list = (BASE[kind] || []).concat(CORE).concat(OPTS).filter(function(n, i, a){ return price[n] && a.indexOf(n) === i; });
    box.innerHTML = list.map(function(n){ var base = (BASE[kind] || []).indexOf(n) !== -1, on = chosen[n] === undefined ? base || CORE.indexOf(n) !== -1 : chosen[n]; chosen[n] = on; return '<label class="ac-opt' + (on ? ' on' : '') + (base ? ' base' : '') + '" data-n="' + n + '"><input type="checkbox" name="pack" value="' + n + '"' + (on ? ' checked' : '') + '><span><b>' + n + '</b><small>' + (/offert/i.test(n) ? 'Offert' : price[n].p ? money(price[n].p) + ' / ' + price[n].u : 'Prix à fixer dans Prestations') + '</small></span><em class="rec" hidden>Recommandé</em></label>'; }).join('');
    $$('#acPack input').forEach(function(c){ c.addEventListener('change', function(){ chosen[c.value] = c.checked; touched[c.value] = 1; c.closest('label').classList.toggle('on', c.checked); think(); }); });
  }
  function setPack(n, on){ if (!price[n]) return; chosen[n] = on; var c = f.querySelector('#acPack input[value="' + n + '"]'); if (c) { c.checked = on; c.closest('label').classList.toggle('on', on); } }
  /* le cerveau : questions à poser, recommandations, estimation */
  function think(){
    var sit = val('situation'), kind = val('kind'), sec = val('sector'), metier = (val('metier') || '').toLowerCase();
    var ask = [], rec = [];
    $$('.ac-cond').forEach(function(c){ var ok = c.dataset.if.split(';').every(function(cond){ var kv = cond.split('='); return kv[1].split(',').indexOf(val(kv[0])) !== -1; }); c.hidden = !ok; });
    if ($('#acClient').value !== 'new') $('#acNew').hidden = true; else $('#acNew').hidden = false;
    var isNew = $('#acClient').value === 'new';
    if (isNew && !val('nc_phone')) ask.push('Son numéro de téléphone ou WhatsApp, pour lui envoyer le devis.');
    if (isNew && !val('nc_city')) ask.push('Dans quelle ville est son activité ? (elle s’allumera sur votre carte)');
    if (!sec) ask.push('Quel est son secteur d’activité, et son métier précis ?');
    if (sit === 'domaine' || sit === 'site') { if (!val('domain')) ask.push('Quel est son nom de domaine actuel ?'); if (!val('domain_access')) ask.push('A-t-il les accès à son domaine ? Sinon, qui les a ? (ancien prestataire, hébergeur)'); rec.push(['Transfert du nom de domaine', 'Reprendre le domaine sans coupure du site ni des e-mails.']); }
    if (sit === 'site') { ask.push('Que garde-t-il de l’ancien site (textes, photos, pages bien placées sur Google) ?'); ask.push('Reçoit-il déjà des appels ou des messages grâce à ce site ?'); rec.push(['Refonte et migration', 'Les redirections 301 gardent le référencement déjà acquis.']); }
    if (sit === 'google') ask.push('Est-il propriétaire de sa fiche Google ? Avec quel e-mail ?');
    if (kind === 'ecommerce') { ask.push('Combien de produits, et des variantes (tailles, couleurs) ?'); ask.push('Livraison : où, par qui, à quel prix ? Paiement à la livraison aussi ?'); rec.push(['Paiement en ligne', 'Indispensable pour une boutique qui vend à distance.']); }
    if (kind === 'application') ask.push('Qui utilisera l’application : ses clients, son équipe, les deux ?');
    if (/sant|beaut|sport|juridique/i.test(sec) || /dent|médec|medec|kin|psy|coiff|spa|avocat|coach|clinique/.test(metier)) { ask.push('Ses clients prennent-ils rendez-vous ? Par téléphone, WhatsApp ?'); rec.push(['Prise de rendez-vous en ligne', 'Moins d’appels, plus de rendez-vous, même la nuit.']); }
    if (/restaur|hôtel|hotel|touris/i.test(sec)) ask.push('Réservations en ligne ? Un menu ou des chambres à présenter, avec des photos ?');
    if (val('has_logo') === 'non' || val('has_logo') === 'refaire') rec.push(['Création de logo et charte', 'Un site à votre image commence par un logo soigné.']);
    if (val('has_photos') === 'non' || val('has_photos') === 'peu') rec.push(['Photos professionnelles', 'De vraies photos rassurent et convertissent bien plus.']);
    if (val('has_texts') === 'non') rec.push(['Rédaction SEO', 'Nous écrivons les textes, optimisés pour Google et l’IA.']);
    if (val('has_emails') === 'non') rec.push(['E-mails professionnels', 'contact@son-domaine.ma inspire plus confiance qu’une adresse Gmail.']);
    if (f.querySelector('[name=lang_ar]').checked || f.querySelector('[name=lang_en]').checked) rec.push(['Traduction professionnelle', 'Des textes adaptés à chaque langue, pas une traduction automatique.']);
    rec.push(['Maintenance et support', 'Un abonnement mensuel : site à jour, sécurisé, et un revenu régulier pour vous.']);
    rec.push(['Rapport mensuel SEO', 'Le client voit ses résultats chaque mois : il reste avec vous.']);
    if (!val('has_logo')) ask.push('A-t-il un logo ? Des photos ? Ses textes ?');
    if (!val('due_date')) ask.push('Pour quand souhaite-t-il être en ligne ?');
    if (!val('budget')) ask.push('Avez-vous une idée du budget ? (pour lui proposer la bonne formule)');
    if (!val('nc_email') && isNew) ask.push('Son e-mail, pour les factures.');
    /* recommandations : cochées automatiquement si vous n’y avez pas touché */
    rec = rec.filter(function(r, i, a){ return price[r[0]] && a.findIndex(function(x){ return x[0] === r[0]; }) === i; });
    rec.forEach(function(r){ if (!touched[r[0]] && ['Maintenance et support', 'Rapport mensuel SEO', 'Traduction professionnelle', 'E-mails professionnels'].indexOf(r[0]) === -1) setPack(r[0], true); });
    $$('.ac-opt').forEach(function(l){ l.querySelector('.rec').hidden = !rec.some(function(r){ return r[0] === l.dataset.n; }); });
    document.getElementById('acAsk').innerHTML = ask.slice(0, 5).map(function(t){ return '<li>' + t + '</li>'; }).join('') || '<li class="ok">Vous avez l’essentiel. Bravo !</li>';
    document.getElementById('acRec').innerHTML = rec.slice(0, 6).map(function(r){ var on = chosen[r[0]]; return '<li><span><b>' + r[0] + '</b><small>' + r[1] + '</small></span><button type="button" class="' + (on ? 'on' : '') + '" data-tog="' + r[0] + '">' + (on ? 'Ajouté' : '+ Ajouter') + '</button></li>'; }).join('');
    document.querySelectorAll('[data-tog]').forEach(function(b){ b.addEventListener('click', function(){ var n = b.dataset.tog; touched[n] = 1; setPack(n, !chosen[n]); think(); }); });
    /* estimation */
    var pages = Math.max(1, parseInt(val('pages') || '5', 10)), langs = ['lang_fr', 'lang_ar', 'lang_en'].filter(function(k){ return f.querySelector('[name=' + k + ']').checked; }).length || 1;
    var qty = function(n){ return n === 'Rédaction SEO' ? pages : n === 'Traduction professionnelle' ? pages * Math.max(1, langs - 1) : (n === 'Maintenance et support' || n === 'Rapport mensuel SEO') ? 12 : 1; };
    var ht = 0, missing = 0, lines = Object.keys(chosen).filter(function(n){ return chosen[n]; }).map(function(n){ var t = (price[n].p || 0) * qty(n); if (!price[n].p && !/offert/i.test(n)) missing++; ht += t; return '<div><em>' + n + (qty(n) > 1 ? ' × ' + qty(n) : '') + '</em><b>' + (price[n].p ? money(t) : 'à fixer') + '</b></div>'; });
    var plan = PL[val('plan_key')] ? PL[val('plan_key')].t : [], ttc = ht * 1.2, acc = 0;
    document.getElementById('acEst').innerHTML = lines.join('') + '<div class="tot"><em>Total HT</em><b>' + money(ht) + '</b></div><div class="tot"><em>Total TTC (TVA 20 %)</em><b>' + money(ttc) + '</b></div>' + (plan.length > 1 ? '<div class="plan">' + plan.map(function(x, i){ var a = i === plan.length - 1 ? ttc - acc : Math.round(ttc * x[1]) / 100; acc += a; return '<div><em>' + x[0] + '</em><b>' + money(a) + '</b></div>'; }).join('') + '</div>' : '') + (missing ? '<p class="warn">' + missing + ' prestation' + (missing > 1 ? 's' : '') + ' sans prix : fixez vos tarifs dans Prestations.</p>' : '');
    /* informations collectées */
    var keys = ['nc_phone', 'nc_email', 'nc_city', 'nc_address', 'sector', 'metier', 'situation', 'kind', 'has_logo', 'has_photos', 'has_texts', 'has_gbp', 'due_date', 'budget'];
    var got = keys.filter(function(k){ return !!val(k); }).length + (isNew ? 0 : 4), pct = Math.min(100, Math.round(100 * got / keys.length));
    document.getElementById('acScore').textContent = pct + ' %'; document.getElementById('acBar').style.width = pct + '%';
  }
  f.addEventListener('input', think); f.addEventListener('change', function(e){ if (e.target.name === 'kind') renderPack(); think(); });
  document.addEventListener('keydown', function(e){ if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') f.requestSubmit(); });
  renderPack(); think();
})();
