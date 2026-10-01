'use strict';
/* Modèles de messages pour chaque étape du parcours client, en français et en arabe.
   Variables : {prenom} {entreprise} {numero} {montant} {lien} {echeance} {reste} {domaine} {site} {lien_avis} {signature} */
const T = [
  // ---- Prise de contact
  ['lead_site', 'Prise de contact', 'Premier contact après une demande du site', 'Votre projet avec Digilago',
    'Bonjour {prenom},\n\nMerci pour votre demande sur digilago.ma. J’ai bien noté votre projet pour {entreprise}.\n\nPouvons-nous en parler 10 minutes aujourd’hui ou demain ? Dites-moi le moment qui vous arrange.\n\n{signature}',
    'مرحبا {prenom}،\n\nشكرا على طلبكم عبر موقع digilago.ma. لقد اطلعت على مشروعكم الخاص بـ {entreprise}.\n\nهل يمكننا التحدث 10 دقائق اليوم أو غدا؟ أخبرني بالوقت الذي يناسبكم.\n\n{signature}'],
  ['apres_appel', 'Prise de contact', 'Récapitulatif après l’appel', 'Récapitulatif de notre échange',
    'Bonjour {prenom},\n\nMerci pour notre échange. Pour résumer :\n• Votre besoin : {besoin}\n• Prochaine étape : je vous envoie votre devis sous 24 heures.\n\nSi vous avez votre logo, des photos ou des exemples de sites que vous aimez, envoyez-les-moi ici.\n\n{signature}',
    'مرحبا {prenom}،\n\nشكرا على المكالمة. باختصار:\n• حاجتكم: {besoin}\n• الخطوة التالية: سأرسل لكم عرض السعر خلال 24 ساعة.\n\nإذا كان لديكم الشعار أو صور أو أمثلة لمواقع تعجبكم، يمكنكم إرسالها هنا.\n\n{signature}'],
  // ---- Devis
  ['devis_envoi', 'Devis', 'Envoi du devis', 'Votre devis {numero}',
    'Bonjour {prenom},\n\nVoici votre devis {numero} pour {entreprise} : {montant} TTC.\n{lien}\n\nVous pouvez le consulter, le télécharger et l’accepter en ligne en un clic. Je reste disponible pour toute question.\n\n{signature}',
    'مرحبا {prenom}،\n\nإليكم عرض السعر {numero} الخاص بـ {entreprise}: {montant} شامل الضريبة.\n{lien}\n\nيمكنكم الاطلاع عليه وتحميله وقبوله عبر الإنترنت بنقرة واحدة. أنا رهن إشارتكم لأي سؤال.\n\n{signature}'],
  ['devis_relance1', 'Devis', 'Relance du devis (3 jours après)', 'Votre devis {numero}',
    'Bonjour {prenom},\n\nAvez-vous pu consulter le devis {numero} ? Si un point mérite d’être ajusté (pages, délai, budget, paiement en plusieurs fois), dites-le-moi : on trouve toujours une solution.\n{lien}\n\n{signature}',
    'مرحبا {prenom}،\n\nهل تمكنتم من الاطلاع على عرض السعر {numero}؟ إذا كانت هناك نقطة تحتاج إلى تعديل (الصفحات، المدة، الميزانية، الدفع على أقساط)، أخبروني: دائما نجد حلا.\n{lien}\n\n{signature}'],
  ['devis_relance2', 'Devis', 'Seconde relance (7 jours après)', 'On lance votre site ?',
    'Bonjour {prenom},\n\nJe reviens vers vous pour le site de {entreprise}. Chaque semaine sans site, ce sont des clients qui cherchent sur Google et trouvent un concurrent.\n\nSi vous validez cette semaine, la première version est prête en 72 heures.\n{lien}\n\n{signature}',
    'مرحبا {prenom}،\n\nأعود إليكم بخصوص موقع {entreprise}. كل أسبوع بدون موقع يعني زبائن يبحثون في Google ويجدون منافسا.\n\nإذا وافقتم هذا الأسبوع، ستكون النسخة الأولى جاهزة خلال 72 ساعة.\n{lien}\n\n{signature}'],
  ['devis_accepte', 'Devis', 'Merci pour l’acceptation (acompte)', 'Merci ! On démarre votre projet',
    'Bonjour {prenom},\n\nMerci pour votre confiance ! Votre commande est confirmée.\n\nPour démarrer, il reste l’acompte de {montant}. Dès réception, nous lançons la création.\n{lien}\n\nPouvez-vous aussi remplir ce court questionnaire (2 minutes) ? {lien_brief}\n\n{signature}',
    'مرحبا {prenom}،\n\nشكرا على ثقتكم! تم تأكيد طلبكم.\n\nللبدء، يتبقى العربون بقيمة {montant}. بمجرد التوصل به، نبدأ في الإنجاز.\n{lien}\n\nهل يمكنكم أيضا ملء هذا الاستبيان القصير (دقيقتان)؟ {lien_brief}\n\n{signature}'],
  // ---- Production
  ['brief', 'Production', 'Demande des informations (brief)', 'Quelques informations pour votre site',
    'Bonjour {prenom},\n\nPour créer un site qui vous ressemble, j’ai besoin de quelques informations : logo, couleurs, photos, horaires, textes. Tout se remplit ici, en 2 minutes :\n{lien_brief}\n\nVous pouvez revenir compléter plus tard avec le même lien.\n\n{signature}',
    'مرحبا {prenom}،\n\nلإنشاء موقع يشبهكم، أحتاج إلى بعض المعلومات: الشعار، الألوان، الصور، أوقات العمل، النصوص. يمكنكم ملء كل شيء هنا في دقيقتين:\n{lien_brief}\n\nيمكنكم العودة لإكمال المعلومات لاحقا عبر نفس الرابط.\n\n{signature}'],
  ['infos_rappel', 'Production', 'Rappel des informations manquantes', 'Il nous manque quelques éléments',
    'Bonjour {prenom},\n\nVotre site avance bien ! Pour le terminer, il nous manque encore : {manque}.\n{lien_brief}\n\nDès que c’est reçu, on continue.\n\n{signature}',
    'مرحبا {prenom}،\n\nموقعكم يتقدم بشكل جيد! لإتمامه، ما زلنا نحتاج إلى: {manque}.\n{lien_brief}\n\nبمجرد التوصل بها، نواصل العمل.\n\n{signature}'],
  ['maquette', 'Production', 'Maquette prête à valider', 'Votre maquette est prête',
    'Bonjour {prenom},\n\nLa maquette de votre site est prête : {site}\n\nPrenez le temps de la regarder sur ordinateur et sur téléphone. Dites-moi ce que vous aimez et ce que vous voulez changer : deux séries de modifications sont incluses.\n\n{signature}',
    'مرحبا {prenom}،\n\nالنموذج الأولي لموقعكم جاهز: {site}\n\nخذوا الوقت لمشاهدته على الحاسوب والهاتف. أخبروني بما يعجبكم وما تريدون تغييره: تعديلان مشمولان في العرض.\n\n{signature}'],
  ['modifications', 'Production', 'Modifications faites', 'Vos modifications sont en ligne',
    'Bonjour {prenom},\n\nC’est fait : vos modifications sont visibles ici {site}\n\nSi tout vous convient, répondez simplement « Je valide » et nous préparons la mise en ligne.\n\n{signature}',
    'مرحبا {prenom}،\n\nتم الأمر: تعديلاتكم ظاهرة هنا {site}\n\nإذا كان كل شيء يناسبكم، أجيبوا فقط بـ « موافق » وسنحضر لنشر الموقع.\n\n{signature}'],
  ['livraison', 'Production', 'Site en ligne', 'Votre site est en ligne 🎉',
    'Bonjour {prenom},\n\nBonne nouvelle : le site de {entreprise} est en ligne !\n{site}\n\nIl est sécurisé (HTTPS), rapide, adapté au téléphone et prêt pour Google et les assistants IA. Partagez-le à vos clients, sur votre WhatsApp et vos réseaux.\n\nMerci pour votre confiance.\n{signature}',
    'مرحبا {prenom}،\n\nخبر سار: موقع {entreprise} أصبح متاحا على الإنترنت!\n{site}\n\nالموقع آمن (HTTPS)، سريع، متوافق مع الهاتف وجاهز لـ Google ولمساعدي الذكاء الاصطناعي. شاركوه مع زبائنكم وعلى واتساب وشبكاتكم الاجتماعية.\n\nشكرا على ثقتكم.\n{signature}'],
  // ---- Facturation
  ['facture', 'Facturation', 'Envoi d’une facture', 'Votre facture {numero}',
    'Bonjour {prenom},\n\nVoici votre facture {numero} de {montant} TTC, à régler avant le {echeance}.\n{lien}\n\nMerci !\n{signature}',
    'مرحبا {prenom}،\n\nإليكم الفاتورة {numero} بمبلغ {montant} شامل الضريبة، يرجى أداؤها قبل {echeance}.\n{lien}\n\nشكرا!\n{signature}'],
  ['paiement_rappel1', 'Facturation', 'Rappel amical avant échéance', 'Petit rappel : facture {numero}',
    'Bonjour {prenom},\n\nPetit rappel amical : la facture {numero} ({reste}) arrive à échéance le {echeance}.\n{lien}\n\nMerci et bonne journée !\n{signature}',
    'مرحبا {prenom}،\n\nتذكير ودي: الفاتورة {numero} ({reste}) تستحق بتاريخ {echeance}.\n{lien}\n\nشكرا ويوم سعيد!\n{signature}'],
  ['paiement_rappel2', 'Facturation', 'Relance d’une facture en retard', 'Facture {numero} en attente',
    'Bonjour {prenom},\n\nSauf erreur de notre part, la facture {numero} ({reste}) reste à régler depuis le {echeance}. Pouvez-vous me confirmer la date du paiement ?\n{lien}\n\n{signature}',
    'مرحبا {prenom}،\n\nما لم نكن مخطئين، الفاتورة {numero} ({reste}) لم تؤد بعد منذ {echeance}. هل يمكنكم تأكيد تاريخ الأداء؟\n{lien}\n\n{signature}'],
  ['paiement_rappel3', 'Facturation', 'Dernière relance', 'Dernier rappel : facture {numero}',
    'Bonjour {prenom},\n\nMalgré nos rappels, la facture {numero} ({reste}) n’est toujours pas réglée. Merci de procéder au paiement sous 7 jours, ou de m’appeler pour trouver une solution ensemble.\n{lien}\n\n{signature}',
    'مرحبا {prenom}،\n\nرغم تذكيراتنا، الفاتورة {numero} ({reste}) لم تؤد بعد. نرجو الأداء خلال 7 أيام، أو الاتصال بي لنجد حلا معا.\n{lien}\n\n{signature}'],
  ['recu', 'Facturation', 'Paiement reçu (reçu)', 'Paiement bien reçu, merci',
    'Bonjour {prenom},\n\nNous avons bien reçu votre paiement de {montant}. Merci ! Voici votre reçu :\n{lien}\n\n{signature}',
    'مرحبا {prenom}،\n\nتوصلنا بأدائكم بمبلغ {montant}. شكرا! إليكم وصل الأداء:\n{lien}\n\n{signature}'],
  // ---- Fidélisation
  ['avis', 'Fidélisation', 'Demande d’avis Google', 'Votre avis compte beaucoup',
    'Bonjour {prenom},\n\nVotre site est en ligne depuis quelques jours : j’espère qu’il vous apporte déjà des contacts !\n\nSi vous êtes satisfait, un avis Google nous aide énormément (30 secondes) :\n{lien_avis}\n\nMerci du fond du cœur.\n{signature}',
    'مرحبا {prenom}،\n\nموقعكم متاح منذ بضعة أيام: أتمنى أن يكون قد جلب لكم اتصالات جديدة!\n\nإذا كنتم راضين، فإن تقييمكم على Google يساعدنا كثيرا (30 ثانية):\n{lien_avis}\n\nشكرا جزيلا.\n{signature}'],
  ['maintenance', 'Fidélisation', 'Proposition de maintenance', 'Gardez votre site toujours au top',
    'Bonjour {prenom},\n\nPour que votre site reste rapide, sécurisé et à jour, nous proposons un suivi mensuel : mises à jour, sauvegardes, petites modifications et support prioritaire sur WhatsApp.\n\nVoulez-vous que je vous envoie la formule ?\n\n{signature}',
    'مرحبا {prenom}،\n\nلكي يبقى موقعكم سريعا وآمنا ومحدثا، نقترح متابعة شهرية: تحديثات، نسخ احتياطية، تعديلات صغيرة ودعم ذو أولوية على واتساب.\n\nهل تريدون أن أرسل لكم العرض؟\n\n{signature}'],
  ['rapport', 'Fidélisation', 'Rapport mensuel', 'Votre site ce mois-ci',
    'Bonjour {prenom},\n\nVoici le bilan de votre site ce mois-ci : visites, appels et position sur Google.\n{lien}\n\nMon conseil du mois : {conseil}\n\n{signature}',
    'مرحبا {prenom}،\n\nإليكم حصيلة موقعكم هذا الشهر: الزيارات، الاتصالات والترتيب على Google.\n{lien}\n\nنصيحة الشهر: {conseil}\n\n{signature}'],
  ['renouvellement', 'Fidélisation', 'Renouvellement du domaine ou de l’hébergement', 'Renouvellement de {domaine}',
    'Bonjour {prenom},\n\nLe nom de domaine {domaine} (ou l’hébergement) arrive à échéance le {echeance}. Pour éviter toute coupure du site et des e-mails, nous nous occupons du renouvellement.\n\nJe vous envoie la facture ?\n\n{signature}',
    'مرحبا {prenom}،\n\nاسم النطاق {domaine} (أو الاستضافة) سينتهي بتاريخ {echeance}. لتفادي أي انقطاع للموقع والبريد الإلكتروني، سنتكفل بالتجديد.\n\nهل أرسل لكم الفاتورة؟\n\n{signature}'],
  ['anniversaire', 'Fidélisation', 'Un an du site', 'Votre site fête ses 1 an 🎂',
    'Bonjour {prenom},\n\nIl y a un an, le site de {entreprise} était mis en ligne ! Merci pour votre fidélité.\n\nPour cette nouvelle année, on peut aller plus loin : nouvelles pages, boutique, rendez-vous en ligne, référencement local. Un appel de 10 minutes pour en parler ?\n\n{signature}',
    'مرحبا {prenom}،\n\nقبل سنة، تم نشر موقع {entreprise}! شكرا على وفائكم.\n\nفي هذه السنة الجديدة، يمكننا الذهاب أبعد: صفحات جديدة، متجر، حجز المواعيد عبر الإنترنت، تحسين الظهور المحلي. هل نتحدث 10 دقائق؟\n\n{signature}'],
  ['relance_perdu', 'Fidélisation', 'Relance douce d’une demande perdue', 'Votre projet de site',
    'Bonjour {prenom},\n\nNous avions échangé il y a quelque temps au sujet de votre site. Votre projet est-il toujours d’actualité ? Nous avons de nouvelles formules, y compris en paiement en plusieurs fois.\n\nJe reste disponible.\n{signature}',
    'مرحبا {prenom}،\n\nتواصلنا منذ مدة بخصوص موقعكم. هل ما زال مشروعكم قائما؟ لدينا عروض جديدة، بما فيها الأداء على أقساط.\n\nأنا رهن إشارتكم.\n{signature}'],
];
const STEPS = ['Prise de contact', 'Devis', 'Production', 'Facturation', 'Fidélisation'];
const DEFAULT = T.map(([key, step, title, subject, fr, ar], i) => ({ key, step, title, subject, fr, ar, sort: i }));

/* remplissage des variables ; les variables vides disparaissent proprement */
function fill(text, v) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/* le prochain message conseillé selon la situation */
function recommend(ctx) {
  const { lead, quote, invoice, project, rest = 0 } = ctx;
  if (invoice) { if (invoice.kind === 'avoir') return null; if (rest <= 0.009) return 'recu'; if (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)) return (ctx.reminders || 0) >= 2 ? 'paiement_rappel3' : 'paiement_rappel2'; return ctx.reminders ? 'paiement_rappel1' : 'facture'; }
  if (project) { if (project.status === 'livre') return ctx.reviewAsked ? 'maintenance' : 'avis'; if (ctx.missing) return ctx.briefSent ? 'infos_rappel' : 'brief'; return 'maquette'; }
  if (quote) { if (['accepte', 'facture'].includes(quote.status)) return 'devis_accepte'; if (quote.status === 'brouillon') return 'devis_envoi'; const d = quote.sent_at ? (Date.now() - new Date(quote.sent_at.replace(' ', 'T') + 'Z')) / 864e5 : 0; return d >= 7 ? 'devis_relance2' : d >= 3 ? 'devis_relance1' : 'devis_envoi'; }
  if (lead) { if (lead.stage === 'perdu') return 'relance_perdu'; if (lead.stage === 'contacte') return 'apres_appel'; return 'lead_site'; }
  return 'lead_site';
}
module.exports = { DEFAULT, STEPS, fill, recommend };
