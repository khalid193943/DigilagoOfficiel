'use strict';
/* Assistant « Nouveau projet » : pensé pour un appel ou un rendez-vous avec un client. */
const { esc } = require('./fmt');
const SECTORS = ['Santé et médical', 'Éducation', 'Restauration', 'Hôtellerie', 'Commerce', 'Immobilier', 'Sport et loisirs', 'Beauté et bien-être', 'Industrie', 'Juridique et conseil', 'Tourisme', 'Services', 'Autre'];
const SOURCES = ['Téléphone', 'Site web', 'WhatsApp', 'Recommandation', 'Instagram ou Facebook', 'Google', 'Salon ou rencontre', 'Client existant', 'Autre'];
const CITIES = ['Casablanca', 'Rabat', 'El Jadida', 'Marrakech', 'Tanger', 'Fès', 'Agadir', 'Meknès', 'Kénitra', 'Oujda', 'Tétouan', 'Safi', 'Mohammedia', 'Témara', 'Salé', 'Béni Mellal', 'Nador', 'Essaouira', 'Laâyoune', 'Dakhla'];
const card = (name, val, t, s, ic, checked) => `<label class="ac-card"><input type="radio" name="${name}" value="${val}"${checked ? ' checked' : ''}><span class="ac-ic">${ic}</span><b>${t}</b><small>${s}</small></label>`;
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const yn = (name, label, opts = [['oui', 'Oui'], ['non', 'Non']]) => `<div class="ac-yn"><span>${label}</span><div>${opts.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}"><i>${t}</i></label>`).join('')}</div></div>`;
function page({ clients, services, plans, lead }) {
  const L = lead || {};
  const src = /site|démarrer|contact/i.test(L.source || '') ? 'Site web' : L.source || '';
  const kindOf = { refonte: 'vitrine', google: 'vitrine', autre: 'vitrine' }[L.kind] || L.kind || 'vitrine';
  return `<form method="post" class="ac" id="ac" data-services='${esc(JSON.stringify(services.map((x) => ({ n: x.name, p: x.unit_price, u: x.unit }))))}' data-plans='${esc(JSON.stringify(plans))}'>
${L.id ? `<input type="hidden" name="lead_id" value="${L.id}">` : ''}<div class="ac-main">${L.id ? `<div class="ac-lead"><b>Depuis la demande de ${esc(L.company || L.name || '')}</b><span>${esc([src, L.city, L.need].filter(Boolean).join(' · ').slice(0, 140))}</span></div>` : ''}
<section class="ac-sec" data-step="1"><header><span>1</span><h2>Le client</h2><small>Qui est-ce, et comment le joindre</small></header>
<div class="row"><label class="grow">Client existant<select name="client_id" id="acClient"><option value="new">+ Nouveau client</option>${clients.map((c) => `<option value="${c.id}">${esc(c.company ? c.company + ' (' + c.name + ')' : c.name)}</option>`).join('')}</select></label></div>
<div id="acNew"><div class="row"><label>Nom et prénom<input name="nc_name" value="${esc(L.name || '')}" placeholder="Ex. : Sara Alami" autofocus></label><label>Entreprise<input name="nc_company" value="${esc(L.company || '')}" placeholder="Ex. : Clinique Azur"></label></div>
<div class="row"><label>Téléphone<input name="nc_phone" value="${esc(L.phone || '')}" inputmode="tel" placeholder="06…"></label><label>E-mail<input name="nc_email" type="email" value="${esc(L.email || '')}"></label></div>
<div class="row"><label>Ville<input name="nc_city" list="acCities" placeholder="Casablanca…" value="${esc(L.city || '')}"></label><label>Adresse<input name="nc_address" placeholder="Rue, quartier"></label></div>
<datalist id="acCities">${CITIES.map((c) => `<option value="${c}">`).join('')}</datalist></div>
<div class="row"><label>Secteur<select name="sector" id="acSector"><option value="">Choisir…</option>${SECTORS.map((x) => `<option${L.sector === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label><label>Métier précis<input name="metier" placeholder="Ex. : dentiste, riad, pâtisserie…"></label><label>Comment nous a-t-il connus ?<select name="source">${SOURCES.map((x) => `<option${src === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div></section>

<section class="ac-sec" data-step="2"><header><span>2</span><h2>Sa situation aujourd’hui</h2><small>Ce qui existe déjà en ligne</small></header>
<div class="ac-cards">${card('situation', 'rien', 'Rien en ligne', 'On part de zéro', I('<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>'), L.kind !== 'refonte' && L.kind !== 'google')}${card('situation', 'domaine', 'A un nom de domaine', 'Mais pas de site', I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>'))}${card('situation', 'site', 'A déjà un site', 'À refaire ou moderniser', I('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M8 21h8"/>'), L.kind === 'refonte')}${card('situation', 'google', 'A une fiche Google', 'Seulement Google Maps', I('<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'), L.kind === 'google')}</div>
<div class="ac-cond" data-if="situation=domaine,site"><div class="row"><label>Nom de domaine actuel<input name="domain" placeholder="exemple.ma"></label><label>Chez quel hébergeur ou registrar ?<input name="registrar" placeholder="Heberfacile, Genious, OVH…"></label></div>${yn('domain_access', 'Le client a-t-il les accès (identifiant, mot de passe) ?', [['oui', 'Oui'], ['non', 'Non'], ['?', 'Ne sait pas']])}</div>
<div class="ac-cond" data-if="situation=site"><div class="row"><label>Adresse du site actuel<input name="old_site" placeholder="https://…"></label><label>Fait avec<select name="old_tech"><option value="">Ne sait pas</option><option>WordPress</option><option>Wix</option><option>Shopify</option><option>Site sur mesure</option><option>Autre</option></select></label></div><label>Ce qu’il veut garder ou changer<input name="old_keep" placeholder="Garder les textes, changer le design…"></label></div>
<div class="ac-cond" data-if="situation=google"><label>Lien de la fiche Google<input name="gbp_url" placeholder="https://maps.google.com/…"></label></div></section>

<section class="ac-sec" data-step="3"><header><span>3</span><h2>Son besoin</h2><small>Le type de site et sa taille</small></header>
<div class="ac-cards">${card('kind', 'vitrine', 'Site vitrine', 'Présenter et rassurer', I('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18"/>'), kindOf === 'vitrine')}${card('kind', 'ecommerce', 'Boutique en ligne', 'Vendre à distance', I('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>'), kindOf === 'ecommerce')}${card('kind', 'landing', 'Landing page', 'Une offre, une page', I('<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/>'), kindOf === 'landing')}${card('kind', 'application', 'Application', 'Réservations, espace client', I('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'), kindOf === 'application')}</div>
<div class="row"><label>Nombre de pages<input name="pages" type="number" min="1" max="60" value="5"></label><div class="ac-langs"><span>Langues</span><label><input type="checkbox" name="lang_fr" value="1" checked><i>Français</i></label><label><input type="checkbox" name="lang_ar" value="1"><i>العربية</i></label><label><input type="checkbox" name="lang_en" value="1"><i>English</i></label></div></div>
<div class="ac-cond" data-if="kind=ecommerce"><div class="row"><label>Nombre de produits<input name="products" placeholder="Ex. : 40"></label>${yn('pay_online', 'Paiement par carte en ligne ?')}</div></div></section>

<section class="ac-sec" data-step="4"><header><span>4</span><h2>Ce qu’il a déjà</h2><small>Pour savoir ce qu’il faut créer</small></header>
<div class="ac-grid">${yn('has_logo', 'Un logo', [['oui', 'Oui'], ['refaire', 'À refaire'], ['non', 'Non']])}${yn('has_colors', 'Des couleurs de marque')}${yn('has_photos', 'De bonnes photos', [['oui', 'Oui'], ['peu', 'Quelques-unes'], ['non', 'Non']])}${yn('has_texts', 'Ses textes', [['oui', 'Oui'], ['non', 'Non, à rédiger']])}${yn('has_gbp', 'Une fiche Google à jour')}${yn('has_emails', 'Des e-mails pro (@son-domaine)')}</div></section>

<section class="ac-sec" data-step="5"><header><span>5</span><h2>Le pack présence en ligne</h2><small>Cochez ce que le client veut, l’assistant propose le reste</small></header><div class="ac-pack" id="acPack"></div></section>

<section class="ac-sec" data-step="6"><header><span>6</span><h2>Délai, budget et paiement</h2><small>Pour bien préparer le devis</small></header>
<div class="row"><label>Mise en ligne souhaitée<input type="date" name="due_date"></label><label>Budget annoncé<select name="budget"><option value="">${L.budget ? esc(L.budget) : 'Pas encore'}</option><option>Moins de 5 000 DH</option><option>5 000 à 10 000 DH</option><option>10 000 à 20 000 DH</option><option>20 000 à 40 000 DH</option><option>Plus de 40 000 DH</option></select></label><label>Paiement<select name="plan_key" id="acPlan">${Object.entries(plans).map(([k, x]) => `<option value="${k}">${esc(x.n)}</option>`).join('')}</select></label></div>
<label>Notes de l’appel<textarea name="notes" rows="3" placeholder="Ce qui compte pour lui, ses concurrents, ses exemples préférés…">${esc([L.need, L.message].filter(Boolean).join('\n'))}</textarea></label></section>
</div>

<aside class="ac-side"><div class="ac-ai"><div class="ac-ai-h"><span class="ac-dot"></span><b>Assistant Digilago</b><em id="acScore">0 %</em></div><div class="prog"><i id="acBar" style="width:0%"></i></div>
<div class="ac-blk"><span>À demander maintenant</span><ul id="acAsk"></ul></div>
<div class="ac-blk"><span>Je recommande</span><ul id="acRec"></ul></div>
<div class="ac-blk"><span>Estimation du devis</span><div id="acEst"></div></div>
<button class="btn wide" id="acGo">Créer le client, le projet et le devis</button><p class="ac-note">Tout reste modifiable ensuite : le devis s’ouvre prêt à envoyer.</p></div></aside></form>`;
}
module.exports = { page, SECTORS };
