"""Page « Collaborer avec Digilago » (collaborer.html), en français ; l'anglais et l'arabe suivent avec le reste de la chaîne.

Six façons de travailler avec Digilago (apporteur d'affaires, freelances et créatifs, agences en marque blanche,
co-création au Lab, sponsoring et écoles, investisseurs et distributeurs), comment ça se passe, nos engagements,
puis le formulaire : la proposition arrive dans la Gestion (« Demandes », source « Collaboration, … ») comme les
autres formulaires du site, avec WhatsApp en relais (src/js/lab.js, partagé avec le Lab).

L'idée de la page tient dans le logo : le « D » de Digilago est fait de deux pièces qui s'emboîtent (une barre et un
demi-disque). La barre, c'est ce que vous apportez ; le demi-disque, ce que Digilago apporte. Le haut de page les
assemble une fois, et chaque carte reprend les deux pièces.

La page reprend l'en-tête, le ciel du haut de page et le pied de page du site (depuis services.html). Le script ajoute
aussi « Collaborer » dans la colonne Navigation du pied de page de toutes les pages (idempotent).
Rien n'est promis que Digilago ne fasse déjà : montants et délais sont fixés par écrit, au cas par cas.

Usage : python3 tools/collab.py
"""
import glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lab  # noqa: E402  (traductions, champs de formulaire, icônes et script partagés avec le Lab)
from lab import T, A, ARR, WA, GET, field, svg  # noqa: E402

ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
FOOT = ('Collaborer', 'Work with us', 'تعاون معنا')

ICO = {
    'apporteur': '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    'creatif': '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M13.5 6.5l3 3"/>',
    'agence': '<path d="M12 3.5 3.5 8l8.5 4.5L20.5 8z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5" opacity=".55"/>',
    'cocreation': '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2V16h5v-.2c0-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
    'sponsoring': '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.6 7 21l5-2.6 5 2.6-1.6-7.4"/>',
    'investisseur': '<path d="M4 19.5h16"/><path d="M5 15.5 9.5 11l3.5 3.5L19 8.5"/><path d="M15 8.5h4v4"/>',
    'check': '<circle cx="12" cy="12" r="8.5"/><path d="m8.6 12.2 2.4 2.4 4.6-4.8"/>',
    'pen': '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    'users': '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.7-3.2 2.9-5 5.5-5s4.8 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.2c2.3.1 4 1.7 4.7 4.8"/>',
    'star': '<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"/>',
}


def ico(name):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">%s</svg>') % ICO[name]


# les deux pièces du « D » (mêmes tracés que le logo du site)
BAR = '<svg class="co-pc" viewBox="15 9 10 46" aria-hidden="true"><rect x="16" y="10" width="8" height="44" rx="1.5"/></svg>'
HALF = '<svg class="co-pc" viewBox="27 9 24 46" aria-hidden="true"><path d="M28 10 A22 22 0 0 1 28 54 Z"/></svg>'

C = {
    'title': ('Collaborer avec Digilago : partenaires, freelances, sponsors | Digilago',
              'Work with Digilago: partners, freelancers, sponsors | Digilago',
              'تعاون مع Digilago: شركاء ومستقلون ورعاة | Digilago'),
    'desc': ('Apporteur d’affaires, freelance, agence, co-création, sponsoring ou investissement : six façons de collaborer '
             'avec Digilago, agence web marocaine. Tout est écrit avant de commencer.',
             'Referral partner, freelancer, agency, co-creation, sponsorship or investment: six ways to work with Digilago, '
             'a Moroccan web agency. Everything is in writing before we start.',
             'وسيط أعمال أو مستقل أو وكالة أو إبداع مشترك أو رعاية أو استثمار: ست طرق للتعاون مع Digilago، الوكالة الرقمية '
             'المغربية. كل شيء مكتوب قبل أن نبدأ.'),
    'eyebrow': ('Collaborer', 'Work with us', 'تعاون معنا'),
    'h1a': ('Travaillons ensemble :', 'Let’s work together:', 'لنعمل معاً:'),
    'h1b': ('six façons de collaborer.', 'six ways to collaborate.', 'ست طرق للتعاون.'),
    'lead': ('Vous recommandez des clients, vous créez, vous organisez, vous investissez : il y a une place pour vous. '
             'Chaque collaboration commence par un appel, puis un accord écrit.',
             'You refer clients, you create, you organise, you invest: there is a place for you. Every collaboration '
             'starts with a call, then a written agreement.',
             'توصي بزبناء، أو تبدع، أو تنظم، أو تستثمر: هناك مكان لك. كل تعاون يبدأ بمكالمة، ثم باتفاق مكتوب.'),
    'cta': ('Proposer une collaboration', 'Suggest a collaboration', 'اقترح تعاوناً'),
    'trust': [('Accord écrit avant de commencer', 'Written agreement before we start', 'اتفاق مكتوب قبل البدء'),
              ('Réponse le jour même', 'Same-day reply', 'رد في اليوم نفسه'),
              ('Dans tout le Maroc', 'All over Morocco', 'في كل أنحاء المغرب')],
    'you': ('Vous', 'You', 'أنتم'),
    'mark_p': ('Notre logo tient en deux pièces qui s’emboîtent. C’est aussi notre façon de travailler.',
               'Our logo is made of two pieces that fit together. That is also how we work.',
               'شعارنا مكوّن من قطعتين تتكاملان. وهكذا نعمل أيضاً.'),
    'ways_k': ('Six façons', 'Six ways', 'ست طرق'),
    'ways_h1': ('Une place pour chacun,', 'A place for everyone,', 'مكان لكل واحد،'),
    'ways_h2': ('selon ce que vous apportez.', 'depending on what you bring.', 'حسب ما تقدّمه.'),
    'ways_p': ('Chaque carte dit ce que vous apportez, et ce que Digilago apporte de son côté.',
               'Each card says what you bring, and what Digilago brings on its side.',
               'كل بطاقة توضح ما تقدّمه أنت، وما تقدّمه Digilago من جهتها.'),
    'for': ('Pour qui', 'Who for', 'لمن'),
    'propose': ('Proposer', 'Suggest', 'اقترح'),
    'steps_k': ('Comment ça se passe', 'How it works', 'كيف يتم ذلك'),
    'steps_h1': ('Trois étapes,', 'Three steps,', 'ثلاث مراحل،'),
    'steps_h2': ('et tout est écrit.', 'and everything is in writing.', 'وكل شيء مكتوب.'),
    'rules_k': ('Nos engagements', 'Our commitments', 'التزاماتنا'),
    'rules_h1': ('Ce que vous pouvez', 'What you can', 'ما يمكنك'),
    'rules_h2': ('attendre de nous.', 'expect from us.', 'أن تنتظره منا.'),
    'form_k': ('Proposer', 'Suggest', 'اقترح'),
    'form_h1': ('Parlons de votre idée,', 'Let’s talk about your idea,', 'لنتحدث عن فكرتك،'),
    'form_h2': ('on vous répond le jour même.', 'we reply the same day.', 'نرد عليك في اليوم نفسه.'),
    'form_p': ('Dites-nous qui vous êtes et ce que vous proposez. Un appel de 20 minutes suffit ensuite pour savoir si ça colle.',
               'Tell us who you are and what you suggest. A 20-minute call is then enough to see if it fits.',
               'أخبرنا من أنت وما تقترحه. بعدها تكفي مكالمة من 20 دقيقة لنعرف إن كان الأمر مناسباً.'),
    'legend': ('Type de collaboration', 'Type of collaboration', 'نوع التعاون'),
    'other': ('Autre idée', 'Another idea', 'فكرة أخرى'),
    'structure': ('Entreprise ou structure', 'Company or organisation', 'الشركة أو الهيئة'),
    'city': ('Ville', 'City', 'المدينة'),
    'msg': ('Votre proposition', 'Your proposal', 'اقتراحك'),
    'msg_ph': ('Qui vous êtes, ce que vous proposez, et ce que vous attendez de Digilago.',
               'Who you are, what you suggest, and what you expect from Digilago.',
               'من أنت، وما تقترحه، وما تنتظره من Digilago.'),
    'send': ('Envoyer ma proposition', 'Send my proposal', 'أرسل اقتراحي'),
    'e_msg': ('Dites-nous en quelques mots ce que vous proposez.', 'Tell us in a few words what you suggest.',
              'أخبرنا في كلمات قليلة بما تقترحه.'),
    'wa_hello': ('Bonjour Digilago, je vous écris pour une collaboration.', 'Hello Digilago, I am writing about a collaboration.',
                 'مرحباً Digilago، أكتب إليكم بخصوص تعاون.'),
    'faq_k': ('Questions', 'Questions', 'أسئلة'),
    'faq_h1': ('Ce qu’on nous demande', 'What people ask us', 'ما يُسأل عنه'),
    'faq_h2': ('avant de collaborer.', 'before working together.', 'قبل التعاون.'),
}

# (clé, icône, titre, pour qui, ce que vous apportez, ce que Digilago apporte, libellé pour la Gestion)
WAYS = [
    ('apporteur', 'apporteur', ('Apporteur d’affaires', 'Referral partner', 'وسيط أعمال'),
     ('Vous connaissez des entreprises qui ont besoin d’un site, d’une boutique ou d’être trouvées sur Google.',
      'You know businesses that need a website, an online shop or to be found on Google.',
      'تعرف شركات تحتاج إلى موقع أو متجر إلكتروني أو إلى الظهور على Google.'),
     ('Une recommandation, une mise en relation.', 'A recommendation, an introduction.', 'توصية، وربط للتواصل.'),
     ('Le projet de A à Z, et une commission fixée par écrit avant le premier contact.',
      'The project from A to Z, and a commission set in writing before the first contact.',
      'المشروع من الألف إلى الياء، وعمولة محددة كتابةً قبل أول تواصل.'), 'Apporteur d’affaires'),
    ('creatif', 'creatif', ('Freelances et créatifs', 'Freelancers and creatives', 'المستقلون والمبدعون'),
     ('Photographes, vidéastes, designers, rédacteurs et développeurs.',
      'Photographers, videographers, designers, writers and developers.',
      'المصورون وصانعو الفيديو والمصممون والكتّاب والمطورون.'),
     ('Votre talent, sur des missions précises.', 'Your talent, on clear assignments.', 'موهبتك، في مهام واضحة.'),
     ('Des projets clients, un brief clair et un paiement à la date prévue.',
      'Client projects, a clear brief and payment on the agreed date.',
      'مشاريع لزبناء، وتوجيه واضح، وأداء في التاريخ المتفق عليه.'), 'Freelance / créatif'),
    ('agence', 'agence', ('Agences, en marque blanche', 'Agencies, white label', 'الوكالات، بعلامتها الخاصة'),
     ('Agences de communication, de marketing ou d’événementiel qui vendent des sites sans les construire.',
      'Communication, marketing or events agencies that sell websites without building them.',
      'وكالات التواصل أو التسويق أو تنظيم الفعاليات التي تبيع مواقع دون أن تبنيها.'),
     ('Vos clients, et la relation avec eux.', 'Your clients, and the relationship with them.', 'زبناؤك، والعلاقة معهم.'),
     ('Le site ou l’application, livré sous votre marque. Nous ne contactons jamais vos clients sans vous.',
      'The website or app, delivered under your brand. We never contact your clients without you.',
      'الموقع أو التطبيق، يُسلَّم باسم علامتك. ولا نتواصل أبداً مع زبنائك دون علمك.'), 'Agence (marque blanche)'),
    ('cocreation', 'cocreation', ('Co-création au Lab', 'Co-creation in the Lab', 'الإبداع المشترك في المختبر'),
     ('Experts d’un métier qui ont l’idée d’un outil qui manque au Maroc.',
      'Experts in a trade who have the idea for a tool Morocco is missing.',
      'خبراء في مجال ما لديهم فكرة أداة يفتقدها المغرب.'),
     ('Le métier, l’idée, les premiers utilisateurs.', 'The trade, the idea, the first users.', 'المعرفة بالمجال، والفكرة، وأول المستعملين.'),
     ('La conception et le code, comme pour le Radar et la Gestion. Le partage est fixé par écrit.',
      'The design and the code, as for the Radar and Gestion. The split is set in writing.',
      'التصميم والبرمجة، كما في الرادار وتطبيق التدبير. والتقاسم يُحدَّد كتابةً.'), 'Co-création Lab'),
    ('sponsoring', 'sponsoring', ('Sponsoring, événements et écoles', 'Sponsorship, events and schools', 'الرعاية والفعاليات والمدارس'),
     ('Événements, associations, clubs, écoles et universités.', 'Events, associations, clubs, schools and universities.',
      'الفعاليات والجمعيات والأندية والمدارس والجامعات.'),
     ('Un public, une occasion, une scène.', 'An audience, an occasion, a stage.', 'جمهور، ومناسبة، ومنصة.'),
     ('Du sponsoring, des ateliers sur la visibilité en ligne, et des stages quand nous en proposons.',
      'Sponsorship, workshops on online visibility, and internships when we offer them.',
      'رعاية، وورشات حول الظهور على الإنترنت، وتداريب حين نوفرها.'), 'Sponsoring / événement / école'),
    ('investisseur', 'investisseur', ('Investisseurs et distributeurs', 'Investors and distributors', 'المستثمرون والموزعون'),
     ('Celles et ceux qui veulent faire grandir un projet du Lab, au Maroc ou ailleurs.',
      'Those who want to grow a Lab project, in Morocco or elsewhere.',
      'من يريدون تنمية مشروع من مشاريع المختبر، في المغرب أو خارجه.'),
     ('Un financement, un réseau, un marché.', 'Funding, a network, a market.', 'تمويل، وشبكة علاقات، وسوق.'),
     ('Des outils qui tournent déjà pour de vrai, et l’équipe qui les construit.',
      'Tools that already run for real, and the team that builds them.',
      'أدوات تشتغل فعلاً، والفريق الذي يبنيها.'), 'Investisseur / distributeur'),
]
STEPS = [
    (('Vous nous écrivez', 'You write to us', 'تكتب إلينا'),
     ('Par le formulaire ci-dessous ou sur WhatsApp. Deux minutes suffisent.',
      'With the form below or on WhatsApp. Two minutes are enough.', 'عبر الاستمارة أسفله أو على WhatsApp. تكفي دقيقتان.')),
    (('Un appel de 20 minutes', 'A 20-minute call', 'مكالمة من 20 دقيقة'),
     ('On se présente, on écoute votre proposition et on voit si elle colle.',
      'We introduce ourselves, listen to your proposal and see if it fits.', 'نتعارف، ونستمع إلى اقتراحك، ونرى إن كان مناسباً.')),
    (('Un accord écrit', 'A written agreement', 'اتفاق مكتوب'),
     ('Rôles, rémunération, délais et confidentialité : tout est écrit et signé avant de commencer.',
      'Roles, pay, timelines and confidentiality: everything is written and signed before we start.',
      'الأدوار والأجر والآجال والسرية: كل شيء مكتوب وموقَّع قبل البدء.')),
]
RULES = [
    ('pen', ('Tout est écrit', 'Everything in writing', 'كل شيء مكتوب'),
     ('Rémunération, délais et rôles sont fixés par écrit avant de commencer. Pas de surprise ensuite.',
      'Pay, timelines and roles are set in writing before we start. No surprises later.',
      'الأجر والآجال والأدوار تُحدَّد كتابةً قبل البدء. ولا مفاجآت بعد ذلك.')),
    ('clock', ('Payé à la date prévue', 'Paid on the agreed date', 'الأداء في التاريخ المتفق عليه'),
     ('Commission ou mission : vous êtes payé à la date écrite dans l’accord.',
      'Commission or assignment: you are paid on the date written in the agreement.',
      'عمولة أو مهمة: تتوصل بأجرك في التاريخ المكتوب في الاتفاق.')),
    ('users', ('Vos contacts restent à vous', 'Your contacts stay yours', 'علاقاتك تبقى لك'),
     ('En marque blanche, nous ne contactons jamais vos clients sans vous.',
      'In white label, we never contact your clients without you.', 'في العمل بعلامتك الخاصة، لا نتواصل أبداً مع زبنائك دون علمك.')),
    ('star', ('Le mérite partagé', 'Shared credit', 'الفضل المشترك'),
     ('Avec votre accord, votre nom figure sur les projets que nous faisons ensemble.',
      'With your consent, your name appears on the projects we do together.',
      'بموافقتك، يظهر اسمك على المشاريع التي ننجزها معاً.')),
]
FAQ = [
    (('Faut-il être une entreprise pour collaborer avec Digilago ?', 'Do I need to be a company to work with Digilago?',
      'هل يجب أن أكون شركة للتعاون مع Digilago؟'),
     ('Non. Indépendants, associations, écoles, étudiants ou entreprises : chacun peut proposer une collaboration.',
      'No. Freelancers, associations, schools, students or companies: anyone can suggest a collaboration.',
      'لا. المستقلون والجمعيات والمدارس والطلبة والشركات: يمكن للجميع اقتراح تعاون.')),
    (('Comment est payé un apporteur d’affaires ?', 'How is a referral partner paid?', 'كيف يتقاضى وسيط الأعمال أجره؟'),
     ('Par une commission sur le projet signé. Son montant est fixé par écrit avant que nous contactions le client, et elle '
      'est versée une fois le client payé.',
      'With a commission on the signed project. Its amount is set in writing before we contact the client, and it is '
      'paid once the client has paid.',
      'بعمولة على المشروع الموقَّع. يُحدَّد مبلغها كتابةً قبل أن نتواصل مع الزبون، وتُؤدّى بعد أن يؤدي الزبون.')),
    (('Travaillez-vous avec des freelances partout au Maroc ?', 'Do you work with freelancers all over Morocco?',
      'هل تتعاملون مع مستقلين في كل أنحاء المغرب؟'),
     ('Oui. Nous travaillons à distance avec des indépendants dans tout le Maroc, et parfois à l’étranger.',
      'Yes. We work remotely with freelancers all over Morocco, and sometimes abroad.',
      'نعم. نعمل عن بُعد مع مستقلين في كل أنحاء المغرب، وأحياناً خارجه.')),
    (('Peut-on proposer une idée d’application pour le Lab ?', 'Can I suggest an app idea for the Lab?',
      'هل يمكن اقتراح فكرة تطبيق للمختبر؟'),
     ('Oui, c’est le principe de la co-création : vous apportez le métier et l’idée, nous construisons l’outil. Le partage '
      'est fixé par écrit avant la première ligne de code.',
      'Yes, that is what co-creation is about: you bring the trade and the idea, we build the tool. The split is set in '
      'writing before the first line of code.',
      'نعم، هذا هو مبدأ الإبداع المشترك: تقدّم المعرفة بالمجال والفكرة، ونحن نبني الأداة. ويُحدَّد التقاسم كتابةً قبل أول سطر من البرمجة.')),
    (('Digilago peut-il sponsoriser notre événement ?', 'Can Digilago sponsor our event?', 'هل يمكن لـ Digilago رعاية فعاليتنا؟'),
     ('Nous étudions chaque demande. Dites-nous ce que vous organisez, pour qui et quand : nous répondons, même quand c’est non.',
      'We look at every request. Tell us what you are organising, for whom and when: we reply, even when the answer is no.',
      'ندرس كل طلب. أخبرنا بما تنظمه، ولمن، ومتى: سنرد عليك، حتى لو كان الجواب بالرفض.')),
]


def sh(k, h1, h2, p=None, cls=''):
    """Titre de section à la manière du site : pastille, deux lignes (la seconde en dégradé), puis un paragraphe."""
    return ('<div class="sh%s"><span class="pill rv"><span class="ic"></span>%s</span><h2 class="rv d1"><span class="l">'
            '<span class="li">%s</span></span><span class="l"><span class="li grad">%s</span></span></h2>%s</div>') % (
        (' ' + cls) if cls else '', T(k), T(h1), T(h2), ('<p class="rv d2">%s</p>' % T(p)) if p else '')


def hero(sky):
    trust = ''.join('<li>%s%s</li>' % (ico('check'), T(t)) for t in C['trust'])
    mark = ('<figure class="co-mark in2" aria-hidden="true"><div class="co-d"><span class="co-a">%s<small>%s</small></span>'
            '<span class="co-b">%s<small>Digilago</small></span></div></figure><p class="co-mark-p in2">%s</p>') % (
        BAR, T(C['you']), HALF, T(C['mark_p']))
    return ('<header class="phero co-hero">%s<p class="eyebrow in"><i class="live" aria-hidden="true"></i><span>%s</span></p>'
            '<h1 class="hin"><span class="l"><span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span></h1>'
            '<p class="lead in2 hin">%s</p><div class="hcta in2"><a href="#proposer" class="cta mono"><span class="arw">%s</span>'
            '<span class="lbl">%s</span></a><a href="%s" class="ghost" target="_blank" rel="noopener noreferrer">%s%s</a></div>'
            '<ul class="trust in2">%s</ul>%s</header>') % (
        sky, T(C['eyebrow']), T(C['h1a']), T(C['h1b']), T(C['lead']), ARR, T(C['cta']), WA, T(lab.S['wa']), ARR, trust, mark)


def ways():
    cards = ''.join(
        ('<article class="co-way rv" id="co-%s"><span class="co-ic">%s</span><h3>%s</h3><p class="co-for"><b>%s</b> %s</p>'
         '<div class="co-two"><div class="co-you">%s<b>%s</b><p>%s</p></div><div class="co-us">%s<b>Digilago</b><p>%s</p></div></div>'
         '<a class="co-go" href="#proposer" data-pick="co-%s">%s %s</a></article>') % (
            k, ico(ic), T(title), T(C['for']), T(who), BAR, T(C['you']), T(you), HALF, T(us), k, T(C['propose']),
            ARR.replace('<svg', '<svg class="ar"', 1))
        for k, ic, title, who, you, us, fr in WAYS)
    return '<section class="blk co-sec" id="facons">%s<div class="co-ways w">%s</div></section>' % (
        sh(C['ways_k'], C['ways_h1'], C['ways_h2'], C['ways_p']), cards)


def steps():
    items = ''.join('<li class="rv d%d"><span class="co-num" aria-hidden="true">0%d</span><h3>%s</h3><p>%s</p></li>' % (
        i + 1, i + 1, T(h), T(p)) for i, (h, p) in enumerate(STEPS))
    rules = ''.join('<li class="rv d%d"><span class="co-ic">%s</span><div><h3>%s</h3><p>%s</p></div></li>' % (
        i % 2 + 1, ico(ic), T(h), T(p)) for i, (ic, h, p) in enumerate(RULES))
    return ('<section class="blk co-sec" id="etapes">%s<ol class="co-steps w">%s</ol></section>'
            '<section class="blk co-sec" id="engagements">%s<ul class="co-rules w">%s</ul></section>') % (
        sh(C['steps_k'], C['steps_h1'], C['steps_h2']), items, sh(C['rules_k'], C['rules_h1'], C['rules_h2']), rules)


def form():
    opts = ''.join(
        '<label class="co-opt"><input type="radio" name="kind" value="co-%s" data-fr="Collaboration · %s"%s><span>%s%s</span></label>' % (
            k, fr, ' checked' if i == 0 else '', ico(ic), T(title)) for i, (k, ic, title, who, you, us, fr) in enumerate(WAYS))
    opts += '<label class="co-opt"><input type="radio" name="kind" value="co-autre" data-fr="Collaboration · autre idée"><span>%s%s</span></label>' % (
        svg('chat'), T(C['other']))
    f = ('<form class="ask co-form rv d1" novalidate data-need-msg data-src="Collaboration" data-form="collaboration" '
         'aria-labelledby="coFormTitle">'
         '<fieldset class="co-opts"><legend>%s</legend>%s</fieldset>'
         '<div class="ask-grid">%s%s%s%s%s%s</div>'
         '<div class="ask-hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>'
         '<p class="ask-err" role="alert" hidden><span data-e="name">%s</span><span data-e="contact">%s</span>'
         '<span data-e="message">%s</span><span data-e="send">%s</span></p>'
         '<div class="ask-go"><button class="co-send" type="submit">%s%s</button>'
         '<a class="ask-wa" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a></div>'
         '<p class="ask-pv">%s%s <a href="confidentialite.html">%s</a></p>'
         '<span class="ask-t" hidden data-t="hello">%s</span></form>'
         '<div class="ask-ok co-ok" role="status" tabindex="-1" hidden>%s<b>%s</b><p>%s</p>'
         '<a class="co-send" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a></div>') % (
        T(C['legend']), opts,
        field('name', GET['name'], auto='name', mx=80),
        field('company', C['structure'], auto='organization', opt=True, mx=120),
        field('phone', GET['phone'], kind='tel', auto='tel', mx=24, ph=('06 00 00 00 00',) * 3),
        field('email', GET['email'], kind='email', auto='email', opt=True, mx=120),
        field('city', C['city'], auto='address-level2', opt=True, mx=80, full=True),
        field('message', C['msg'], kind='area', ph=C['msg_ph'], mx=2000, full=True),
        T(GET['e_name']), T(GET['e_contact']), T(C['e_msg']), T(GET['e_send']),
        T(C['send']), ARR.replace('<svg', '<svg class="ar"', 1), WA, svg('chat'), T(GET['or_wa']),
        svg('lock'), T(GET['privacy']), T(GET['privacy_a']), T(C['wa_hello']),
        ico('check'), T(GET['ok_h']), T(GET['ok_p']), WA, svg('chat'), T(lab.S['wa']))
    return ('<section class="blk co-sec" id="proposer"><div class="co-form-in w"><div class="co-form-side">%s</div>'
            '<div class="co-form-main">%s</div></div></section>') % (
        sh(C['form_k'], C['form_h1'], C['form_h2'], C['form_p'], cls='left').replace('<h2 ', '<h2 id="coFormTitle" ', 1), f)


def faq():
    items = ''.join('<details class="rv"><summary>%s<i aria-hidden="true"></i></summary><p>%s</p></details>' % (T(q), T(a))
                    for q, a in FAQ)
    return '<section class="blk co-sec" id="faq">%s<div class="faq co-faq w">%s</div></section>' % (
        sh(C['faq_k'], C['faq_h1'], C['faq_h2']), items)


def css():
    src = open(os.path.join(ROOT, 'src', 'css', 'collab.src.css'), encoding='utf-8').read()
    out = re.sub(r'(?<![\w.#-])(-?\d+(?:\.\d+)?)u\b', r'calc(\1 * var(--u))', src)
    out = re.sub(r'/\*.*?\*/', '', out, flags=re.S)
    out = re.sub(r'\s+', ' ', out)
    out = re.sub(r'\s*([{};,>])\s*', r'\1', out)
    return out.replace(';}', '}').strip()


def foot_link(h):
    """« Collaborer » dans la colonne Navigation du pied de page, après le Lab (idempotent)."""
    f = re.search(r'<nav class="f-col" aria-label="Navigation"><h6>Navigation</h6>(.*?)</nav>', h, re.S)
    if not f or 'href="collaborer.html"' in f.group(1):
        return h
    col, n = re.subn(r'(<a href="lab\.html">.*?</a>)', lambda x: x.group(1) + '<a href="collaborer.html">%s</a>' % T(FOOT),
                     f.group(1), count=1, flags=re.S)
    if not n:
        col = col.replace('<a href="contact.html">', '<a href="collaborer.html">%s</a><a href="contact.html">' % T(FOOT), 1)
    return h[:f.start(1)] + col + h[f.end(1):]


def main():
    src = open(os.path.join(SITE, 'services.html'), encoding='utf-8').read()
    a = src.index('<main class="pg light" id="main">')
    b = src.index('</main>', src.index('<section class="blk"><div class="cband'))
    hd, tail = src[:a], src[b:]
    ph = src[a:src.index('</header>', a)]
    sky = ph[ph.index('<div class="sky"'):ph.index('<p class="eyebrow')]
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % T(C['title']), hd, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % A(C['desc']), h, count=1)
    h = re.sub(r'<style id="co-css">.*?</style>', '', h, flags=re.S)
    h = h.replace('</head>', '<style id="co-css">%s</style></head>' % css(), 1)
    i = tail.rindex('</body>')
    tail = tail[:i] + '<script id="lab-js">%s</script>' % lab.lab_js() + tail[i:]
    body = hero(sky) + ways() + steps() + form() + faq()
    page = foot_link(h + '<main class="pg light co" id="main" data-co="1">%s' % body + tail)
    open(os.path.join(SITE, 'collaborer.html'), 'w', encoding='utf-8').write(page)
    n = 0
    for f in glob.glob(os.path.join(SITE, '*.html')):
        h = open(f, encoding='utf-8').read()
        k = foot_link(h)
        if k != h:
            open(f, 'w', encoding='utf-8').write(k)
            n += 1
    print('Collaborer : page écrite, lien ajouté au pied de %d pages, %d traductions ajoutées' % (n, lab.save_tr()))


if __name__ == '__main__':
    main()
