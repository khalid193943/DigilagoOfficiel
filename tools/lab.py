"""Digilago Lab : les projets maison de Digilago, présentés comme un catalogue (idempotent).

Fabrique trois pages, en français (l'anglais et l'arabe suivent avec le reste de la chaîne) :
- lab.html         le Lab : ce que Digilago construit pour lui-même, chaque projet avec son numéro et son statut ;
- lab-radar.html   LAB-01, le Radar (prospection et diagnostic des entreprises du Maroc) ;
- lab-gestion.html LAB-02, la Gestion (demandes, devis signés en ligne, factures, comptabilité, suivi des projets) ;
- lab-lago.html    LAB-03, LAGO, le jeu gratuit (le jeu lui-même est dans site/lago/, construit à part).

Les pages reprennent l'en-tête et le pied de page du site (depuis services.html), dans un décor de nuit qui leur
est propre (src/css/lab.src.css, inséré dans ces trois pages seulement). Chaque page finit par « Profiter d'un
projet » (démo, outil sur mesure, être prévenu, partenariat), et l'assistant du Lab attend en bas à droite : les deux
envoient la demande à la Gestion comme les autres formulaires du site (src/js/lab.js, inséré dans ces pages).
Le Lab n'est pas dans le menu : « Digilago Lab » est dans le pied de page de toutes les pages, et un encart le présente
en bas de Services, Secteurs et À propos (src/css/lab-band.src.css). Le script range les traductions anglaises et
arabes dans src/i18n/ (sans écraser une traduction déjà relue).

Confidentialité : aucune capture de devis, de facture, de comptabilité ni de publicité (montants, identifiants légaux,
logo sur un document) ; aucun détail technique (outils, sources, sécurité) n'est publié.

Règles de contenu : rien d'inventé. Les textes décrivent ce que font réellement les deux applications (voir
leurs README) ; les captures (site/assets/lab/) sont faites avec des données de démonstration, ce que les pages
disent ; le journal reprend l'historique réel des dépôts. Le Radar et la Gestion sont des outils internes :
aucune page ne renvoie vers eux.

Usage : python3 tools/lab.py
"""
import glob, hashlib, html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(ROOT, 'src', 'i18n')
WA = 'https://wa.me/212649953813'
TR = {}


def typo(fr):
    """Espace insécable avant « ? ! : ; » et dans les guillemets : la ponctuation ne part jamais seule à la ligne."""
    return re.sub(r'« ', '«\u00a0', re.sub(r' ([?!:;»])', '\u00a0\\1', fr))


def T(x):
    """Un triplet (fr, en, ar) → le français échappé pour le HTML ; l'anglais et l'arabe sont retenus."""
    fr, en, ar = x
    fr = typo(fr)
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=False)


def A(x):
    """Pareil, pour une valeur d'attribut."""
    fr, en, ar = x
    fr = typo(fr)
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=True)


def sid(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def save_tr():
    n = 0
    for lang, i in (('en', 0), ('ar', 1)):
        p = os.path.join(I18N, lang + '.json')
        d = json.load(open(p, encoding='utf-8'))
        for fr, tt in TR.items():
            k = sid(fr)
            if not d.get(k):
                d[k] = tt[i]
                n += 1
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(d.items())), f, ensure_ascii=False, indent=1)
            f.write('\n')
    return n


# ─── icônes (traits, 24 × 24) ─────────────────────────────────────────────

ICON = {
    'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'chat': '<path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.6 18.6z"/>',
    'facts': '<path d="M12 3.5 4.5 6.5v5.2c0 4.3 3.1 7.6 7.5 8.8 4.4-1.2 7.5-4.5 7.5-8.8V6.5z"/><path d="m8.6 12.2 2.4 2.4 4.6-4.8"/>',
    'human': '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
    'lock': '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.5v2"/>',
    'test': '<path d="M9 3.5h6M10 3.5v5.2L5.2 17.4A2.2 2.2 0 0 0 7.1 20.5h9.8a2.2 2.2 0 0 0 1.9-3.1L14 8.7V3.5"/><path d="M7.5 14h9"/>',
    'source': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    'wa': '<path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.6 18.6z"/><path d="m9.2 12.2 2 2 3.8-4"/>',
    'nosend': '<path d="M3.5 11.5 20 4l-7.5 16.5-2.2-6.8z"/><path d="M4 20 20 4" opacity=".55"/>',
    'stop': '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    'eye': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    'merge': '<circle cx="6.5" cy="5.5" r="2"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="12" r="2"/><path d="M6.5 7.5v9M8.3 6.4c4 .6 7 2.5 7.4 4.1"/>',
    'cent': '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M7 9.5v5M17 9.5v5"/>',
    'calendar': '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/><path d="m9.5 15 2 2 3.5-3.5"/>',
    'devices': '<rect x="3" y="5" width="13" height="10" rx="2"/><rect x="15.5" y="9" width="5.5" height="10" rx="1.5"/><path d="M6 19h6"/>',
    'shield': '<path d="M12 3.5 4.5 6.5v5.2c0 4.3 3.1 7.6 7.5 8.8 4.4-1.2 7.5-4.5 7.5-8.8V6.5z"/>',
    'save': '<path d="M5 4.5h11l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19z"/><path d="M8.5 4.5v4.5h6V4.5M8.5 20.5v-6h7v6"/>',
    'hidden': '<path d="M3 3l18 18"/><path d="M10.6 5.7c.5-.1.9-.2 1.4-.2 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.7A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1.1"/>',
    'info': '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
}


def svg(name, cls=''):
    return ('<svg%s viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">%s</svg>') % ((' class="%s"' % cls) if cls else '', ICON[name])


ARR = svg('arrow')

# ─── textes communs ──────────────────────────────────────────────────────

S = {
    'home': ('Accueil', 'Home', 'الرئيسية'),
    'lab': ('Lab', 'Lab', 'المختبر'),
    'lab_full': ('Digilago Lab', 'Digilago Lab', 'مختبر Digilago'),
    'crumb': ('Fil d’Ariane', 'Breadcrumb', 'مسار التصفح'),
    'internal': ('Usage interne · en service', 'Internal use · in service', 'استعمال داخلي · قيد التشغيل'),
    'wip': ('En préparation', 'In the works', 'قيد الإعداد'),
    'demo_note': ('Captures réalisées avec des données de démonstration : les entreprises et les clients affichés sont fictifs.',
                  'Screenshots taken with demo data: the businesses and clients shown are fictional.',
                  'لقطات شاشة مأخوذة ببيانات تجريبية: الشركات والزبناء المعروضون وهميون.'),
    'start': ('Parler de mon projet', 'Talk about my project', 'تحدث معنا عن مشروعك'),
    'wa': ('Écrire sur WhatsApp', 'Message us on WhatsApp', 'راسلنا على WhatsApp'),
    'see': ('Découvrir le projet', 'Explore the project', 'اكتشف المشروع'),
    'made': ('Conçu et codé par Digilago', 'Designed and coded by Digilago', 'من تصميم Digilago وبرمجتها'),
    'web_phone': ('Ordinateur et téléphone', 'Desktop and phone', 'الحاسوب والهاتف'),
    'nov': ('Novembre 2026', 'November 2026', 'نونبر 2026'),
    'rules_k': ('Nos règles', 'Our rules', 'قواعدنا'),
    'prev': ('Projet précédent', 'Previous project', 'المشروع السابق'),
    'next': ('Projet suivant', 'Next project', 'المشروع التالي'),
    'all': ('Tout le Lab', 'The whole Lab', 'كل المختبر'),
    'langs': ('Messages en français et en arabe', 'Messages in French and Arabic', 'رسائل بالفرنسية والعربية'),
    'more': ('Et aussi', 'And also', 'وأيضاً'),
    'live': ('En ligne · gratuit', 'Live · free', 'متاح · مجاناً'),
}
CODE = {i: ('LAB-%02d' % i,) * 3 for i in (1, 2, 3, 4)}
RADAR = ('Radar', 'Radar', 'الرادار')


def head(k, h1, h2, p=None, cls=''):
    """Titre de section : petit repère, deux lignes (la seconde en italique), puis un paragraphe."""
    return ('<div class="lab-head%s"><p class="lab-k rv">%s</p><h2 class="rv d1">%s <em>%s</em></h2>%s</div>' % (
        (' ' + cls) if cls else '', T(k), T(h1), T(h2), ('<p class="lab-p rv d2">%s</p>' % T(p)) if p else ''))


def img(name, alt, big='1600', small='960', sizes='(max-width: 760px) 92vw, 760px', eager=False, w=1600, h=1000):
    return ('<img src="assets/lab/%s-%s.webp" srcset="assets/lab/%s-%s.webp %sw, assets/lab/%s-%s.webp %sw" sizes="%s" '
            'width="%d" height="%d" alt="%s" %s decoding="async">') % (
        name, big, name, small, small, name, big, big, sizes, w, h, A(alt),
        'fetchpriority="high"' if eager else 'loading="lazy"')


def browser(name, alt, label, eager=False, sizes='(max-width: 760px) 92vw, 760px'):
    return ('<div class="lab-br"><b aria-hidden="true"><i></i><i></i><i></i><span>%s</span></b>%s</div>') % (
        T(label), img(name, alt, eager=eager, sizes=sizes))


def phone(name, alt, eager=False, sizes='(max-width: 760px) 60vw, 330px'):
    """Un vrai téléphone : cadre, îlot, boutons sur les côtés et barre d'état (dessinés en CSS), écran 393 × 798."""
    return '<div class="lab-ph"><div class="lab-ph-s">%s</div></div>' % img(
        name, alt, big='600', small='390', sizes=sizes, eager=eager, w=600, h=1218)


def crumbs(items):
    out = []
    for label, href in items:
        out.append('<a href="%s">%s</a>' % (href, T(label)) if href else '<span aria-current="page">%s</span>' % T(label))
    return '<nav class="lab-crumb" aria-label="%s">%s</nav>' % (A(S['crumb']), '<span class="sep" aria-hidden="true">/</span>'.join(out))


def status(kind='int'):
    label = S['internal'] if kind == 'int' else S['wip']
    return '<span class="lab-st %s"><i aria-hidden="true"></i>%s</span>' % (kind, T(label))


def faq(qs):
    items = ''.join('<details class="rv"><summary>%s<i aria-hidden="true"></i></summary><p>%s</p></details>' % (T(q), T(a))
                    for q, a in qs)
    return '<div class="faq">%s</div>' % items


# ─── « Profiter d'un projet » : ce que le visiteur veut, puis ses coordonnées (envoyées à la Gestion) ───
# Les libellés data-fr partent tels quels dans la Gestion (en français, quelle que soit la langue de la page).

GET = {
    'k': ('Profiter d’un projet', 'Make use of a project', 'استفد من مشروع'),
    'legend': ('Ce que vous voulez', 'What you want', 'ما تريده'),
    'name': ('Prénom et nom', 'Full name', 'الاسم الكامل'),
    'company': ('Entreprise', 'Company', 'الشركة'),
    'opt': ('facultatif', 'optional', 'اختياري'),
    'phone': ('Téléphone ou WhatsApp', 'Phone or WhatsApp', 'الهاتف أو WhatsApp'),
    'email': ('E-mail', 'Email', 'البريد الإلكتروني'),
    'msg': ('Votre message', 'Your message', 'رسالتك'),
    'msg_ph': ('Votre activité, votre ville, ce que vous aimeriez voir…', 'Your business, your city, what you would like to see…',
               'نشاطك ومدينتك وما تودّ رؤيته…'),
    'send': ('Envoyer ma demande', 'Send my request', 'أرسل طلبي'),
    'or_wa': ('ou écrire sur WhatsApp', 'or message us on WhatsApp', 'أو راسلنا على WhatsApp'),
    'privacy': ('Vos coordonnées servent seulement à vous répondre, et ne sont jamais revendues.',
                'Your details are only used to reply to you, and are never sold.',
                'تُستعمل معلوماتك للرد عليك فقط، ولا تُباع أبداً.'),
    'privacy_a': ('Confidentialité', 'Privacy', 'الخصوصية'),
    'e_name': ('Indiquez votre nom.', 'Please enter your name.', 'المرجو إدخال اسمك.'),
    'e_contact': ('Laissez un numéro ou un e-mail pour qu’on puisse vous répondre.',
                  'Leave a phone number or an email so we can reply.', 'اترك رقم هاتف أو بريداً إلكترونياً لنتمكن من الرد عليك.'),
    'e_send': ('L’envoi n’a pas abouti. Réessayez, ou écrivez-nous sur WhatsApp : votre message est déjà prêt.',
               'Sending failed. Try again, or message us on WhatsApp: your message is already written.',
               'لم يتم الإرسال. أعد المحاولة، أو راسلنا على WhatsApp: رسالتك مكتوبة مسبقاً.'),
    'ok_h': ('C’est bien reçu.', 'Received, thank you.', 'توصلنا بطلبك.'),
    'ok_p': ('Quelqu’un de l’équipe vous répond le jour même, du lundi au samedi, de 9 h à 19 h.',
             'Someone from the team replies the same day, Monday to Saturday, 9 a.m. to 7 p.m.',
             'سيرد عليك أحد أعضاء الفريق في اليوم نفسه، من الاثنين إلى السبت، من التاسعة صباحاً إلى السابعة مساءً.'),
    'wa_hello': ('Bonjour Digilago, je vous écris depuis le Lab.', 'Hello Digilago, I am writing from the Lab.',
                 'مرحباً Digilago، أكتب إليكم من المختبر.'),
    'site_q': ('Vous cherchez plutôt un site web ?', 'Looking for a website instead?', 'تبحث بالأحرى عن موقع إلكتروني؟'),
    'site_a': ('Démarrer un projet', 'Start a project', 'ابدأ مشروعاً'),
    'collab_a': ('Toutes les façons de collaborer', 'All the ways to work together', 'كل طرق التعاون'),
    'demo': ('Voir une démo', 'See a demo', 'شاهد عرضاً تجريبياً'),
    'partner': ('Un partenariat', 'A partnership', 'شراكة'),
}
# par page : titre, phrase d'introduction, puis les quatre choix (clé, libellé pour la Gestion, titre, description)
GET_PAGE = {
    'index': {
        'h1': ('Un de ces projets', 'One of these projects', 'أحد هذه المشاريع'),
        'h2': ('vous intéresse ?', 'caught your eye?', 'يهمّك؟'),
        'p': ('Le Radar et la Gestion restent des outils internes : ni en vente, ni ouverts au public. Voici ce qu’on peut '
              'faire pour vous quand même.',
              'The Radar and Gestion stay internal tools: neither for sale nor open to the public. Here is what we can '
              'still do for you.',
              'يبقى الرادار وتطبيق التدبير أداتين داخليتين: ليستا للبيع ولا متاحتين للعموم. وإليك ما يمكننا فعله لك رغم ذلك.'),
        'opts': [
            ('demo', 'Démo', GET['demo'],
             ('Le Radar ou la Gestion, en visio de 30 minutes, avec des données de démonstration.',
              'The Radar or Gestion, in a 30-minute video call, with demo data.',
              'الرادار أو تطبيق التدبير، في مكالمة فيديو مدتها 30 دقيقة، ببيانات تجريبية.')),
            ('same', 'Outil sur mesure', ('Un outil sur mesure', 'A custom tool', 'أداة حسب الطلب'),
             ('Prospection, devis, réservations, suivi de clients : votre outil, à votre nom.',
              'Prospecting, quotes, bookings, client tracking: your tool, under your name.',
              'التنقيب عن الزبناء، وعروض الأسعار، والحجوزات، وتتبع الزبناء: أداتك، باسمك.')),
            ('notify', 'Être prévenu du prochain projet', ('Le prochain projet', 'The next project', 'المشروع المقبل'),
             ('Le jour où LAB-04 sort, vous le saurez en premier.', 'The day LAB-04 comes out, you will be the first to know.',
              'يوم يصدر LAB-04، ستكون أول من يعلم.')),
            ('partner', 'Partenariat', GET['partner'],
             ('Co-création, distribution, sponsoring : parlons-en.', 'Co-creation, distribution, sponsorship: let’s talk.',
              'الإبداع المشترك، والتوزيع، والرعاية: لنتحدث.')),
        ],
    },
    'radar': {
        'h1': ('Le Radar vous intéresse ?', 'Interested in the Radar?', 'هل يهمّك الرادار؟'),
        'h2': ('Choisissez comment en profiter.', 'Choose how to make use of it.', 'اختر طريقة الاستفادة منه.'),
        'p': ('Le Radar reste un outil interne : il n’est ni en vente ni ouvert au public. Voici ce que vous pouvez en '
              'tirer quand même.',
              'The Radar stays an internal tool: it is neither for sale nor open to the public. Here is what you can '
              'still get out of it.',
              'يبقى الرادار أداة داخلية: ليس للبيع ولا متاحاً للعموم. وإليك ما يمكنك الاستفادة منه رغم ذلك.'),
        'opts': [
            ('demo', 'Démo', GET['demo'],
             ('Une visio de 30 minutes : le Radar en marche, avec des données de démonstration.',
              'A 30-minute video call: the Radar at work, with demo data.',
              'مكالمة فيديو مدتها 30 دقيقة: الرادار وهو يشتغل، ببيانات تجريبية.')),
            ('same', 'Outil sur mesure, sur le modèle du Radar', ('Le même, à votre nom', 'Your own version', 'نسخة باسمك'),
             ('Votre outil de prospection sur ce modèle, avec vos villes, vos métiers et vos règles.',
              'Your prospecting tool built on this model, with your cities, your trades and your rules.',
              'أداة تنقيب خاصة بك على هذا النموذج، بمدنك وأنشطتك وقواعدك.')),
            ('notify', 'Être prévenu si le Radar ouvre', ('Être prévenu', 'Get notified', 'كن أول من يعلم'),
             ('S’il ouvre un jour au public ou à la vente, vous le saurez en premier.',
              'If it ever opens to the public or goes on sale, you will be the first to know.',
              'إذا أصبح يوماً متاحاً للعموم أو للبيع، ستكون أول من يعلم.')),
            ('partner', 'Partenariat', GET['partner'],
             ('Le distribuer, le co-construire, le sponsoriser : parlons-en.',
              'Distribute it, co-build it, sponsor it: let’s talk.', 'توزيعه أو المشاركة في بنائه أو رعايته: لنتحدث.')),
        ],
    },
    'gestion': {
        'h1': ('La Gestion vous intéresse ?', 'Interested in Gestion?', 'هل يهمّك تطبيق التدبير؟'),
        'h2': ('Choisissez comment en profiter.', 'Choose how to make use of it.', 'اختر طريقة الاستفادة منه.'),
        'p': ('La Gestion reste un outil interne : elle n’est ni en vente ni ouverte au public. Voici ce que vous pouvez en '
              'tirer quand même.',
              'Gestion stays an internal tool: it is neither for sale nor open to the public. Here is what you can still '
              'get out of it.',
              'يبقى تطبيق التدبير أداة داخلية: ليس للبيع ولا متاحاً للعموم. وإليك ما يمكنك الاستفادة منه رغم ذلك.'),
        'opts': [
            ('demo', 'Démo', GET['demo'],
             ('Une visio de 30 minutes : la Gestion en marche, avec des données de démonstration.',
              'A 30-minute video call: Gestion at work, with demo data.',
              'مكالمة فيديو مدتها 30 دقيقة: تطبيق التدبير وهو يشتغل، ببيانات تجريبية.')),
            ('same', 'Outil sur mesure, sur le modèle de la Gestion', ('Le même, à votre nom', 'Your own version', 'نسخة باسمك'),
             ('Votre outil de gestion sur ce modèle, avec vos services, vos prix et vos documents.',
              'Your management tool built on this model, with your services, your prices and your documents.',
              'أداة تدبير خاصة بك على هذا النموذج، بخدماتك وأسعارك ووثائقك.')),
            ('notify', 'Être prévenu si la Gestion ouvre', ('Être prévenu', 'Get notified', 'كن أول من يعلم'),
             ('Si elle ouvre un jour au public ou à la vente, vous le saurez en premier.',
              'If it ever opens to the public or goes on sale, you will be the first to know.',
              'إذا أصبح يوماً متاحاً للعموم أو للبيع، ستكون أول من يعلم.')),
            ('partner', 'Partenariat', GET['partner'],
             ('La distribuer, la co-construire, la sponsoriser : parlons-en.',
              'Distribute it, co-build it, sponsor it: let’s talk.', 'توزيعه أو المشاركة في بنائه أو رعايته: لنتحدث.')),
        ],
    },
}
GET_PAGE['lago'] = {
    'h1': ('Un jeu comme LAGO,', 'A game like LAGO,', 'لعبة مثل LAGO،'),
    'h2': ('pour votre marque ?', 'for your brand?', 'لعلامتك التجارية؟'),
    'p': ('Un jeu court, à vos couleurs, qui raconte votre métier et se partage tout seul. Ou simplement : être prévenu '
          'quand Rabat et la version mobile arrivent.',
          'A short game in your colours, telling the story of your trade and sharing itself. Or simply: be told when '
          'Rabat and the mobile version arrive.',
          'لعبة قصيرة بألوانك، تحكي نشاطك وتنتشر وحدها. أو ببساطة: أن تُخبَر حين تصل الرباط والنسخة المحمولة.'),
    'opts': [
        ('jeu', 'Un jeu pour ma marque', ('Un jeu pour ma marque', 'A game for my brand', 'لعبة لعلامتي التجارية'),
         ('Votre métier en mini-jeu : pour vos réseaux, un salon, une campagne ou une école.',
          'Your trade as a mini-game: for your social media, a trade show, a campaign or a school.',
          'نشاطك في لعبة صغيرة: لشبكاتك الاجتماعية، أو معرض، أو حملة، أو مدرسة.')),
        ('notify', 'Être prévenu : Rabat et version mobile', ('Être prévenu', 'Get notified', 'كن أول من يعلم'),
         ('Rabat, Google Play et l’App Store : vous le saurez en premier.',
          'Rabat, Google Play and the App Store: you will be the first to know.',
          'الرباط وGoogle Play وApp Store: ستكون أول من يعلم.')),
        ('site', 'Mon entreprise en ligne', ('Mon entreprise en ligne', 'My business online', 'شركتي على الإنترنت'),
         ('Comme dans le jeu, mais pour de vrai : site, fiche Google, réservations, WhatsApp.',
          'Like in the game, but for real: website, Google profile, bookings, WhatsApp.',
          'كما في اللعبة، لكن على أرض الواقع: موقع، وملف Google، وحجوزات، وWhatsApp.')),
        ('partner', 'Partenariat', GET['partner'],
         ('Sponsoriser une ville, une école ou un tournoi : parlons-en.',
          'Sponsor a city, a school or a tournament: let’s talk.', 'رعاية مدينة أو مدرسة أو دوري: لنتحدث.')),
    ],
}
PROJECT = {'index': '', 'radar': 'Radar', 'gestion': 'Gestion', 'lago': 'Lago'}


def field(name, label, kind='text', auto='', opt=False, ph='', mx=120, full=False):
    """Un champ de formulaire, son étiquette visible au-dessus (« facultatif » écrit en petit)."""
    attrs = ' name="%s" id="g-%s" maxlength="%d"' % (name, name, mx)
    if auto:
        attrs += ' autocomplete="%s"' % auto
    if ph:
        attrs += ' placeholder="%s"' % A(ph)
    if kind == 'area':
        ctl = '<textarea%s rows="3"></textarea>' % attrs
    else:
        attrs += ' type="%s"' % kind + (' inputmode="tel"' if kind == 'tel' else '')
        ctl = '<input%s>' % attrs
    return '<div class="ask-f%s"><label for="g-%s">%s%s</label>%s</div>' % (
        ' full' if full else '', name, T(label), (' <small>%s</small>' % T(GET['opt'])) if opt else '', ctl)


def profit(kind):
    """La section « Profiter d'un projet » : quatre choix (boutons radio) et le formulaire."""
    P = GET_PAGE[kind]
    opts = ''.join(
        '<label class="lab-opt"><input type="radio" name="want" value="lab-%s" data-fr="%s"%s>'
        '<span class="lab-opt-b"><b>%s</b><small>%s</small></span></label>' % (
            key, html.escape(fr), ' checked' if i == 0 else '', T(title), T(desc))
        for i, (key, fr, title, desc) in enumerate(P['opts']))
    form = (
        '<form class="ask lab-form rv d1" novalidate data-src="Lab, formulaire%s" data-project="%s" data-form="lab" '
        'aria-labelledby="getTitle">'
        '<fieldset class="lab-opts"><legend class="vh">%s</legend>%s</fieldset>'
        '<div class="ask-grid">%s%s%s%s%s</div>'
        '<div class="ask-hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>'
        '<p class="ask-err" role="alert" hidden><span data-e="name">%s</span><span data-e="contact">%s</span>'
        '<span data-e="send">%s</span></p>'
        '<div class="ask-go"><button class="lab-btn" type="submit">%s%s</button>'
        '<a class="ask-wa" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a></div>'
        '<p class="ask-pv">%s%s <a href="confidentialite.html">%s</a></p>'
        '<span class="ask-t" hidden data-t="hello">%s</span>'
        '</form>'
        '<div class="ask-ok lab-ok" role="status" tabindex="-1" hidden>%s<b>%s</b><p>%s</p>'
        '<a class="lab-btn gh" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a></div>') % (
        (', ' + PROJECT[kind]) if PROJECT[kind] else '', PROJECT[kind],
        T(GET['legend']), opts,
        field('name', GET['name'], auto='name', mx=80),
        field('company', GET['company'], auto='organization', opt=True, mx=120),
        field('phone', GET['phone'], kind='tel', auto='tel', mx=24, ph=('06 00 00 00 00',) * 3),
        field('email', GET['email'], kind='email', auto='email', opt=True, mx=120),
        field('message', GET['msg'], kind='area', opt=True, ph=GET['msg_ph'], mx=1500, full=True),
        T(GET['e_name']), T(GET['e_contact']), T(GET['e_send']),
        T(GET['send']), ARR.replace('<svg', '<svg class="ar"', 1), WA, svg('chat'), T(GET['or_wa']),
        svg('lock'), T(GET['privacy']), T(GET['privacy_a']), T(GET['wa_hello']),
        svg('facts'), T(GET['ok_h']), T(GET['ok_p']), WA, svg('chat'), T(S['wa']))
    side = ('<p class="lab-k rv">%s</p><h2 class="rv d1" id="getTitle">%s <em>%s</em></h2><p class="lab-p rv d2">%s</p>'
            '<ul class="lab-get-links rv d3"><li>%s <a href="demarrer.html">%s</a></li>'
            '<li><a href="collaborer.html">%s</a></li></ul>') % (
        T(GET['k']), T(P['h1']), T(P['h2']), T(P['p']), T(GET['site_q']), T(GET['site_a']), T(GET['collab_a']))
    return ('<section class="lab-sec lab-get" id="profiter"><div class="lab-w"><div class="lab-get-in">'
            '<div class="lab-get-side">%s</div><div class="lab-get-main">%s</div></div></div></section>') % (side, form)


# ─── la famille de logos : un seul D, une direction par partie ─────────────────────────────────────
# Lab : le D couché, un soleil d'or sur l'horizon. Radar : le D devient un écran qui balaie (points verts = entreprises
# trouvées). Gestion : le D tranché en lignes de registre, la dernière verte (réglée). Animés en CSS (lab-marks.src.css).

def mark(kind, cls=''):
    c = ' class="dgmk dgmk-%s%s"' % (kind, (' ' + cls) if cls else '')
    if kind == 'lab':
        return ('<svg%s viewBox="-2 -2 48 40" aria-hidden="true"><path class="dgmk-sun" d="M0 22 A22 22 0 0 1 44 22 Z"/>'
                '<rect class="dgmk-hz" x="0" y="26" width="44" height="8" rx="1.5"/></svg>') % c
    base = ('<rect class="dgmk-bar" x="16" y="10" width="8" height="44" rx="1.5"/>'
            '<path class="dgmk-fill" d="M28 10 A22 22 0 0 1 28 54 Z"/><path class="dgmk-rim" d="M28 10 A22 22 0 0 1 28 54"/>')
    if kind == 'radar':
        # Radar : un écran gradué ; le faisceau balaie avec sa traîne, les cibles trouvées s'allument en vert
        inner = ('<path class="dgmk-arc" d="M28 17 A15 15 0 0 1 28 47"/><path class="dgmk-arc b" d="M28 24 A8 8 0 0 1 28 40"/>'
                 '<path class="dgmk-axis" d="M28 32H50"/><path class="dgmk-tick" d="M37.6 15.37L38.6 13.64M44.63 22.4L46.36 21.4M44.63 41.6L46.36 42.6M37.6 48.63L38.6 50.36"/>'
                 '<g class="dgmk-sweep"><path class="dgmk-tr c" d="M28 32L35.88 11.46A22 22 0 0 1 41.85 14.9Z"/><path class="dgmk-tr b" d="M28 32L41.85 14.9A22 22 0 0 1 45.57 18.76Z"/>'
                 '<path class="dgmk-tr" d="M28 32L45.57 18.76A22 22 0 0 1 47.94 22.7Z"/><path class="dgmk-line" d="M28 32L47.94 22.7"/></g>'
                 '<circle class="dgmk-ping" cx="39.49" cy="22.36" r="3.6"/><circle class="dgmk-dot" cx="39.49" cy="22.36" r="1.9"/>'
                 '<circle class="dgmk-dot b" cx="35.36" cy="40.17" r="1.5"/><circle class="dgmk-pv" cx="28" cy="32" r="1.5"/>')
    else:
        # Gestion : le demi-disque tranché en quatre lignes de registre ; la dernière, verte, est réglée
        return ('<svg%s viewBox="14 8 38 48" aria-hidden="true"><rect class="dgmk-bar" x="16" y="10" width="8" height="44" rx="1.5"/>'
                '<path class="dgmk-band" d="M28 10A22 22 0 0 1 46.1 19.5H28Z"/>'
                '<path class="dgmk-band b" d="M28 21.5H47.33A22 22 0 0 1 49.98 31H28Z"/>'
                '<path class="dgmk-band c" d="M28 33H49.98A22 22 0 0 1 47.33 42.5H28Z"/>'
                '<path class="dgmk-band ok" d="M28 44.5H46.1A22 22 0 0 1 28 54Z"/>'
                '<path class="dgmk-ck" d="M31.5 48.6l2.3 2.2 4.4-4.2"/></svg>') % c
    return '<svg%s viewBox="14 8 38 48" aria-hidden="true">%s%s</svg>' % (c, base, inner)


# ─── l'assistant du Lab : une conversation guidée, en bas à droite ─────────────────────────────────
# Pas d'IA : des réponses écrites à l'avance (rien d'inventé), et un relais vers l'équipe (Gestion et WhatsApp).
# Tout le texte est ici, dans un <template> : il est traduit avec le reste de la page.

BOT_M = [  # (clé, texte) : les messages de l'assistant
    ('hello_index', ('Bonjour ! Bienvenue au Lab. Je peux vous montrer un projet, vous mettre en contact avec l’équipe ou '
                     'répondre à une question.',
                     'Hello! Welcome to the Lab. I can show you a project, put you in touch with the team or answer a question.',
                     'مرحباً! أهلاً بك في المختبر. يمكنني أن أعرض عليك مشروعاً، أو أن أصلك بالفريق، أو أن أجيب عن سؤالك.')),
    ('hello_radar', ('Bonjour ! Vous regardez le Radar, notre outil de prospection. Que puis-je faire pour vous ?',
                     'Hello! You are looking at the Radar, our prospecting tool. What can I do for you?',
                     'مرحباً! أنت تتصفح الرادار، أداتنا للتنقيب عن الزبناء. كيف يمكنني مساعدتك؟')),
    ('hello_gestion', ('Bonjour ! Vous regardez la Gestion, l’application qui fait tourner l’agence. Que puis-je faire pour vous ?',
                       'Hello! You are looking at Gestion, the app that runs the agency. What can I do for you?',
                       'مرحباً! أنت تتصفح تطبيق التدبير، التطبيق الذي تشتغل به الوكالة. كيف يمكنني مساعدتك؟')),
    ('hello_lago', ('Bonjour ! Vous regardez LAGO, notre jeu gratuit. Une question, ou une idée de jeu pour votre marque ?',
                    'Hello! You are looking at LAGO, our free game. A question, or a game idea for your brand?',
                    'مرحباً! أنت تتصفح LAGO، لعبتنا المجانية. سؤال، أو فكرة لعبة لعلامتك التجارية؟')),
    ('again', ('Autre chose ? Je suis là.', 'Anything else? I am here.', 'شيء آخر؟ أنا هنا.')),
    ('q_intro', ('Voici ce qu’on me demande le plus souvent :', 'Here is what people ask me most often:', 'إليك أكثر ما يُسأل عنه:')),
    ('a_sale', ('Pas pour l’instant. Le Radar et la Gestion sont des outils internes, fermés au public. Mais on peut '
                'construire le vôtre sur le même modèle.',
                'Not for now. The Radar and Gestion are internal tools, closed to the public. But we can build yours on '
                'the same model.',
                'ليس حالياً. الرادار وتطبيق التدبير أداتان داخليتان، مغلقتان أمام العموم. لكن يمكننا بناء أداتك على النموذج نفسه.')),
    ('a_price', ('Ça dépend de ce qu’il doit faire. Après un premier échange, vous recevez un prix écrit, avant tout engagement.',
                 'It depends on what it needs to do. After a first conversation, you get a written price, before any commitment.',
                 'يتوقف ذلك على ما يجب أن تقوم به. بعد أول حديث بيننا، تتوصل بثمن مكتوب قبل أي التزام.')),
    ('a_time', ('Ça dépend de son ampleur. Le délai et les étapes sont écrits dans le devis, et vous suivez l’avancement en ligne.',
                'It depends on its scope. The timeline and the steps are written in the quote, and you follow progress online.',
                'يتوقف ذلك على حجمها. المدة والمراحل مكتوبة في عرض السعر، وتتابع التقدم عبر الإنترنت.')),
    ('a_data', ('Oui. Elles restent à vous, ne sont jamais revendues, et nous respectons la loi 09-08 sur les données personnelles.',
                'Yes. It stays yours, is never sold, and we comply with Moroccan law 09-08 on personal data.',
                'نعم. تبقى ملكاً لك، ولا تُباع أبداً، ونحترم القانون 09-08 المتعلق بالمعطيات الشخصية.')),
    ('a_real', ('Non. Toutes les captures du Lab sont faites avec des données de démonstration : les entreprises et les '
                'clients sont fictifs.',
                'No. Every screenshot in the Lab is taken with demo data: the businesses and clients are fictional.',
                'لا. كل لقطات المختبر مأخوذة ببيانات تجريبية: الشركات والزبناء وهميون.')),
    ('m_collab', ('Avec plaisir. Apporteur d’affaires, freelance, agence, sponsor ou investisseur : chacun a sa place.',
                  'With pleasure. Referral partner, freelancer, agency, sponsor or investor: there is room for everyone.',
                  'بكل سرور. وسيط أعمال أو مستقل أو وكالة أو راعٍ أو مستثمر: لكل واحد مكانه.')),
    ('m_human_on', ('L’équipe est là. Écrivez-nous sur WhatsApp, ou laissez votre numéro et on vous rappelle.',
                    'The team is here. Message us on WhatsApp, or leave your number and we will call you back.',
                    'الفريق حاضر. راسلنا على WhatsApp، أو اترك رقمك وسنعاود الاتصال بك.')),
    ('m_human_off', ('L’équipe est hors ligne pour l’instant. Laissez votre numéro : on vous répond dès l’ouverture.',
                     'The team is offline right now. Leave your number: we will reply as soon as we open.',
                     'الفريق غير متصل حالياً. اترك رقمك: سنرد عليك فور بدء العمل.')),
    ('ask_name', ('Avec plaisir. Quel est votre prénom ?', 'Sure. What is your first name?', 'بكل سرور. ما اسمك الشخصي؟')),
    ('ask_phone', ('Merci ! Sur quel numéro peut-on vous joindre ? WhatsApp, c’est encore mieux.',
                   'Thanks! What number can we reach you on? WhatsApp is even better.',
                   'شكراً! على أي رقم يمكننا الاتصال بك؟ ويُفضَّل رقم WhatsApp.')),
    ('bad_phone', ('Ce numéro paraît incomplet. Vous pouvez vérifier ?', 'That number looks incomplete. Could you check it?',
                   'يبدو هذا الرقم ناقصاً. هل يمكنك التحقق منه؟')),
    ('ask_more', ('Un mot sur votre activité ou votre besoin ? C’est facultatif.',
                  'A word about your business or what you need? It is optional.', 'كلمة عن نشاطك أو حاجتك؟ هذا اختياري.')),
    ('fail', ('Le message n’est pas parti. Écrivez-nous sur WhatsApp : votre demande est déjà rédigée.',
              'The message did not go through. Message us on WhatsApp: your request is already written.',
              'لم تُرسل الرسالة. راسلنا على WhatsApp: طلبك مكتوب مسبقاً.')),
]
BOT_WHEN = [  # moment de la réponse, selon l'heure du Maroc (lundi-samedi, 9 h-19 h)
    ('when_today', ('aujourd’hui, avant 19 h', 'today, before 7pm', 'اليوم، قبل السابعة مساءً')),
    ('when_9', ('aujourd’hui dès 9 h', 'today from 9am', 'اليوم ابتداءً من التاسعة صباحاً')),
    ('when_tomorrow', ('demain dès 9 h', 'tomorrow from 9am', 'غداً ابتداءً من التاسعة صباحاً')),
    ('when_monday', ('lundi dès 9 h', 'on Monday from 9am', 'يوم الاثنين ابتداءً من التاسعة صباحاً')),
]
BOT_C = [  # (clé, libellé pour la Gestion, texte du bouton) : les réponses que le visiteur peut choisir
    ('demo', 'Démo', GET['demo']),
    ('same', 'Outil sur mesure', ('Un outil comme ça pour moi', 'A tool like this for me', 'أداة مثل هذه لي')),
    ('collab', '', ('Collaborer avec Digilago', 'Work with Digilago', 'التعاون مع Digilago')),
    ('q', '', ('J’ai une question', 'I have a question', 'لدي سؤال')),
    ('human', '', ('Parler à quelqu’un', 'Talk to someone', 'التحدث مع شخص')),
    ('q_sale', '', ('Ces outils sont-ils à vendre ?', 'Are these tools for sale?', 'هل هذه الأدوات للبيع؟')),
    ('q_price', '', ('Combien coûte un outil sur mesure ?', 'How much does a custom tool cost?', 'كم تكلف أداة حسب الطلب؟')),
    ('q_time', '', ('Combien de temps pour le construire ?', 'How long does it take to build?', 'كم يستغرق بناؤها؟')),
    ('q_data', '', ('Mes données seront-elles protégées ?', 'Will my data be protected?', 'هل ستكون بياناتي محمية؟')),
    ('q_real', '', ('Les captures montrent-elles de vrais clients ?', 'Do the screenshots show real clients?',
                    'هل تُظهر اللقطات زبناء حقيقيين؟')),
    ('q_more', '', ('Une autre question', 'Another question', 'سؤال آخر')),
    ('leave', 'Collaboration', ('Laisser mes coordonnées', 'Leave my details', 'اترك معلوماتي')),
    ('call', 'Être rappelé', ('Être rappelé', 'Get a call back', 'معاودة الاتصال بي')),
    ('again', '', ('Autre chose', 'Something else', 'شيء آخر')),
    ('skip', '', ('Passer', 'Skip', 'تخطَّ')),
]
BOT_T = {
    'title': ('Assistant du Lab', 'Lab assistant', 'مساعد المختبر'),
    'on': ('En ligne · réponse rapide', 'Online · quick reply', 'متصل · رد سريع'),
    'off': ('Hors ligne · réponse dès 9 h', 'Offline · reply from 9am', 'غير متصل · الرد ابتداءً من التاسعة صباحاً'),
    'ask': ('Une question ?', 'A question?', 'سؤال؟'),
    'close': ('Fermer l’assistant', 'Close the assistant', 'أغلق المساعد'),
    'send': ('Envoyer', 'Send', 'إرسال'),
    'name': ('Votre prénom', 'Your first name', 'اسمك الشخصي'),
    'phone': ('Votre numéro', 'Your number', 'رقمك'),
    'more': ('Votre message (facultatif)', 'Your message (optional)', 'رسالتك (اختياري)'),
    'done': ('C’est noté ! L’équipe vous répond', 'Noted! The team will reply', 'تم التسجيل! سيرد عليك الفريق'),
    'collab_page': ('Voir les façons de collaborer', 'See the ways to work together', 'اطلع على طرق التعاون'),
    'wa_now': ('Continuer sur WhatsApp', 'Continue on WhatsApp', 'تابع على WhatsApp'),
    'wa_who': ('Prénom', 'First name', 'الاسم'),
    'wa_tel': ('Téléphone', 'Phone', 'الهاتف'),
    'wa_need': ('Demande', 'Request', 'الطلب'),
    'wa_page': ('Page', 'Page', 'الصفحة'),
}
# l'assistant est celui du Lab : il porte son soleil
MARK = mark('lab', 'bot-mk')
SEND_I = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
          'stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>')
CLOSE_I = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
           'aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>')


def bot(kind):
    t = BOT_T
    tpl = ''.join('<p data-m="%s">%s</p>' % (k, T(x)) for k, x in BOT_M)
    tpl += '<p data-m="done">%s <span data-when></span>.</p>' % T(t['done'])
    tpl += ''.join('<span data-w="%s">%s</span>' % (k, T(x)) for k, x in BOT_WHEN)
    tpl += ''.join('<button type="button" class="bot-c" data-c="%s"%s>%s</button>' % (
        k, (' data-fr="%s"' % html.escape(fr)) if fr else '', T(x)) for k, fr, x in BOT_C)
    tpl += '<a class="bot-c" data-c="collab_page" href="collaborer.html">%s</a>' % T(t['collab_page'])
    tpl += '<a class="bot-c wa" data-c="wa" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a>' % (WA, svg('chat'), T(S['wa']))
    tpl += '<a class="bot-c wa" data-c="wa_now" href="%s" target="_blank" rel="noopener noreferrer">%s%s</a>' % (WA, svg('chat'), T(t['wa_now']))
    tpl += ('<input data-i="name" name="bn" autocomplete="given-name" maxlength="40" placeholder="%s" aria-label="%s">'
            '<input data-i="phone" name="bp" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="06 00 00 00 00" aria-label="%s">'
            '<textarea data-i="more" name="bm" rows="2" maxlength="1500" placeholder="%s" aria-label="%s"></textarea>') % (
        A(t['name']), A(t['name']), A(t['phone']), A(t['more']), A(t['more']))
    tpl += '<button type="submit" class="bot-go" data-b="send" aria-label="%s">%s</button>' % (A(t['send']), SEND_I)
    tpl += ''.join('<span data-t="%s">%s</span>' % (k, T(t[k])) for k in ('wa_who', 'wa_tel', 'wa_need', 'wa_page'))
    tpl += '<span data-t="hello">%s</span>' % T(GET['wa_hello'])
    return ('<div class="bot" id="labBot" data-page="%s">'
            '<section class="bot-panel" id="labBotPanel" role="dialog" aria-labelledby="labBotTitle" hidden>'
            '<header class="bot-head"><span class="bot-av" aria-hidden="true">%s</span><div><b id="labBotTitle">%s</b>'
            '<small class="bot-st"><i aria-hidden="true"></i><span data-on>%s</span><span data-off hidden>%s</span></small></div>'
            '<button type="button" class="bot-x" aria-label="%s">%s</button></header>'
            '<div class="bot-log" role="log" aria-live="polite"></div>'
            '<div class="bot-act"></div>'
            '<template>%s</template></section>'
            '<button type="button" class="bot-btn" aria-expanded="false" aria-controls="labBotPanel">'
            '<span class="bot-av" aria-hidden="true">%s<i></i></span><span class="bot-lbl">%s</span></button></div>') % (
        kind, MARK, T(t['title']), T(t['on']), T(t['off']), A(t['close']), CLOSE_I, tpl, MARK, T(t['ask']))


def rules(items, cls=''):
    return '<ul class="lab-rules%s">%s</ul>' % ((' ' + cls) if cls else '', ''.join(
        '<li class="rv d%d">%s<h3>%s</h3><p>%s</p></li>' % (i % 3 + 1, svg(ic), T(t), T(p)) for i, (ic, t, p) in enumerate(items)))


def feats(items):
    out = []
    for i, f in enumerate(items):
        kind = f.get('kind', 'br')
        if kind == 'br':
            vis = '<figure class="lab-fig rv d1">%s</figure>' % browser(f['img'], f['alt'], f['label'])
        elif kind == 'duo':
            vis = '<figure class="lab-fig rv d1"><div class="lab-duo">%s%s</div></figure>' % (
                browser(f['img'], f['alt'], f['label']), phone(f['img2'], f['alt2'], sizes='(max-width: 760px) 32vw, 200px'))
        else:
            vis = '<figure class="lab-fig rv d1">%s</figure>' % phone(f['img'], f['alt'])
        facts = ''.join('<li>%s</li>' % T(x) for x in f.get('facts', []))
        cls = 'lab-feat' + (' rev' if i % 2 else '') + (' mob' if kind == 'ph' else '')
        out.append('<article class="%s"><div class="lab-ft rv"><span class="lab-n">%s</span><h3>%s</h3><p>%s</p>%s</div>%s</article>' % (
            cls, T(f['n']), T(f['h']), T(f['p']), ('<ul class="lab-facts">%s</ul>' % facts) if facts else '', vis))
    return '<div class="lab-feats">%s</div>' % ''.join(out)


# ─── page « Lab » ────────────────────────────────────────────────────────

LAB = {
    'title': ('Digilago Lab : les applications que nous construisons | Digilago',
              'Digilago Lab: the apps we build for ourselves | Digilago',
              'مختبر Digilago: التطبيقات التي نبنيها لأنفسنا | Digilago'),
    'desc': ('Le Lab Digilago : le Radar, la Gestion et nos prochains projets. Les applications que nous concevons et '
             'utilisons chaque jour, et ce qu’elles montrent de notre façon de construire.',
             'The Digilago Lab: the Radar, Gestion and our next projects. The apps we design and use every '
             'day, and what they show about the way we build.',
             'مختبر Digilago: الرادار وتطبيق التدبير ومشاريعنا المقبلة. التطبيقات التي نصممها ونستعملها كل يوم، وما تكشفه '
             'عن طريقتنا في البناء.'),
    'h1a': ('Ce qu’on construit', 'What we build', 'ما نبنيه'),
    'h1b': ('pour nous.', 'for ourselves.', 'لأنفسنا.'),
    'lead': ('Le Lab, c’est l’atelier de Digilago : les applications que nous concevons, utilisons chaque jour et '
             'améliorons nous-mêmes. Elles font tourner l’agence, et elles montrent ce que nous savons construire pour vous.',
             'The Lab is Digilago’s workshop: the apps we design, use every day and improve ourselves. They run the '
             'agency, and they show what we can build for you.',
             'المختبر هو ورشة Digilago: التطبيقات التي نصممها ونستعملها كل يوم ونطوّرها بأنفسنا. بها تشتغل الوكالة، '
             'وهي دليل على ما نستطيع بناءه لك.'),
    'cat_k': ('Le catalogue', 'The catalogue', 'الفهرس'),
    'cat_h1': ('Chaque projet a son numéro,', 'Every project has its number,', 'لكل مشروع رقمه،'),
    'cat_h2': ('et son statut.', 'and its status.', 'وحالته.'),
    'cat_p': ('Un projet entre au Lab quand il tourne pour de vrai. Il y garde son histoire : ce qu’il fait, comment il '
              'est construit, ce qui change de version en version.',
              'A project joins the Lab once it really runs. It keeps its story here: what it does, how it is built, '
              'what changes from one version to the next.',
              'يدخل المشروع إلى المختبر حين يشتغل فعلاً. ويحتفظ هنا بقصته: ما يقوم به، وكيف بُني، وما الذي يتغيّر من نسخة إلى أخرى.'),
    'radar_tag': ('Le Maroc, entreprise par entreprise.', 'Morocco, business by business.', 'المغرب، شركةً شركة.'),
    'radar_p': ('Il trouve les entreprises par ville et par métier, mesure leur présence en ligne et explique, point par '
                'point, ce qui peut les aider.',
                'It finds businesses by city and trade, measures their online presence and explains, point by point, '
                'what could help them.',
                'يعثر على الشركات حسب المدينة والنشاط، ويقيس حضورها على الإنترنت، ويشرح نقطة بنقطة ما الذي يمكن أن يساعدها.'),
    'radar_tags': [('Prospection', 'Prospecting', 'التنقيب عن الزبناء'), ('Diagnostic', 'Diagnosis', 'التشخيص'),
                   ('Carte 3D', '3D map', 'خريطة ثلاثية الأبعاد'), ('Terrain', 'Field work', 'العمل الميداني')],
    'gestion_tag': ('Toute l’agence, de la demande à la facture.', 'The whole agency, from request to invoice.',
                    'الوكالة كلها، من الطلب إلى الفاتورة.'),
    'gestion_p': ('Demandes, devis signés en ligne, acomptes, factures, comptabilité marocaine et suivi des projets : '
                  'tout au même endroit.',
                  'Requests, quotes signed online, deposits, invoices, Moroccan bookkeeping and project tracking: all in '
                  'one place.',
                  'الطلبات، وعروض الأسعار الموقّعة عبر الإنترنت، والعربون، والفواتير، والمحاسبة المغربية، وتتبع المشاريع: '
                  'كل شيء في مكان واحد.'),
    'gestion_tags': [('Devis', 'Quotes', 'عروض الأسعار'), ('Factures', 'Invoices', 'الفواتير'),
                     ('Comptabilité', 'Bookkeeping', 'المحاسبة'), ('Signature en ligne', 'Online signature', 'التوقيع عبر الإنترنت')],
    'lago_tag': ('Le jeu : allume le Maroc.', 'The game: light up Morocco.', 'اللعبة: أضِئ المغرب.'),
    'lago_p': ('Notre premier jeu, gratuit et ouvert à tous : mettez en ligne les entreprises de Casablanca avec Lago, '
               'Radar et Gestion, en tenant les trois promesses de Digilago.',
               'Our first game, free and open to everyone: bring the businesses of Casablanca online with Lago, Radar and '
               'Gestion, keeping Digilago’s three promises.',
               'لعبتنا الأولى، مجانية ومتاحة للجميع: انشر شركات الدار البيضاء على الإنترنت مع Lago والرادار وتطبيق التدبير، '
               'مع الوفاء بوعود Digilago الثلاثة.'),
    'lago_tags': [('Jeu gratuit', 'Free game', 'لعبة مجانية'), ('Téléphone', 'Phone', 'الهاتف'),
                  ('Casablanca', 'Casablanca', 'الدار البيضاء'), ('Sans inscription', 'No sign-up', 'دون تسجيل')],
    'next_h': ('Le prochain projet', 'The next project', 'المشروع المقبل'),
    'next_p': ('Il est sur l’établi. Chaque projet que Digilago termine pour son propre compte rejoint le Lab, avec son '
               'numéro, son statut et son journal.',
               'It is on the workbench. Every project Digilago completes for itself joins the Lab, with its number, its '
               'status and its changelog.',
               'إنه على طاولة العمل. كل مشروع تنجزه Digilago لحسابها الخاص ينضم إلى المختبر، برقمه وحالته وسجل تحديثاته.'),
    'leg_k': ('Les statuts', 'Statuses', 'الحالات'),
    'leg_h1': ('Une étiquette', 'A label', 'بطاقة'),
    'leg_h2': ('pour chaque projet.', 'for every project.', 'لكل مشروع.'),
    'leg': [(('En ligne', 'Live', 'متاح على الإنترنت'), 'on',
             ('Ouvert au public : on peut l’utiliser tout de suite.', 'Open to the public: you can use it right away.',
              'مفتوح للعموم: يمكن استعماله فوراً.')),
            (('À vendre', 'For sale', 'للبيع'), 'sale',
             ('Disponible pour une entreprise : en licence, ou adapté à sa façon de travailler.',
              'Available to a business: under licence, or adapted to the way it works.',
              'متاح لشركة: بترخيص، أو مكيَّف مع طريقة عملها.')),
            (('Usage interne', 'Internal use', 'استعمال داخلي'), 'int',
             ('Réservé à l’équipe Digilago : présenté ici, mais pas accessible.',
              'Reserved for the Digilago team: shown here, but not accessible.',
              'مخصّص لفريق Digilago: معروض هنا، لكنه غير متاح.')),
            (('En préparation', 'In the works', 'قيد الإعداد'), 'wip',
             ('En cours de construction : il rejoindra le Lab quand il tournera.',
              'Under construction: it will join the Lab once it runs.',
              'قيد البناء: سينضم إلى المختبر حين يبدأ في الاشتغال.'))],
    'rules_h1': ('Quatre règles,', 'Four rules,', 'أربع قواعد،'),
    'rules_h2': ('dans chaque projet.', 'in every project.', 'في كل مشروع.'),
    'rules': [('facts', ('Rien d’inventé', 'Nothing made up', 'لا شيء مختلَق'),
               ('Une donnée inconnue reste inconnue. Les exemples de démonstration sont marqués comme tels, partout.',
                'Unknown data stays unknown. Demo examples are labelled as such, everywhere.',
                'المعلومة المجهولة تبقى مجهولة. والأمثلة التجريبية موسومة بذلك في كل مكان.')),
              ('human', ('Un humain décide', 'A human decides', 'الإنسان هو من يقرّر'),
               ('Les outils préparent, l’équipe valide : aucun message ne part tout seul vers un prospect.',
                'The tools prepare, the team approves: no message goes out to a prospect on its own.',
                'الأدوات تُحضّر والفريق يصادق: لا تُرسَل أي رسالة إلى زبون محتمل من تلقاء نفسها.')),
              ('lock', ('La sécurité d’abord', 'Security first', 'الأمان أولاً'),
               ('Clés gardées sur le serveur, sessions protégées, connexions limitées, accès par rôle.',
                'Keys kept on the server, protected sessions, rate-limited logins, role-based access.',
                'المفاتيح محفوظة في الخادم، والجلسات محمية، ومحاولات الدخول محدودة، والولوج حسب الدور.')),
              ('test', ('Testé à chaque modification', 'Tested on every change', 'مختبَر عند كل تعديل'),
               ('Chaque changement passe des tests automatiques avant d’être mis en ligne.',
                'Every change goes through automated tests before it goes live.',
                'يمر كل تغيير عبر اختبارات آلية قبل نشره.'))],
    'faq_k': ('Questions fréquentes', 'FAQ', 'الأسئلة الشائعة'),
    'faq_h1': ('Ce qu’on nous demande', 'What people ask us', 'ما يسألنا عنه الناس'),
    'faq_h2': ('à propos du Lab.', 'about the Lab.', 'عن المختبر.'),
    'faq': [(('Peut-on utiliser le Radar ou la Gestion ?', 'Can I use the Radar or Gestion?',
              'هل يمكنني استعمال الرادار أو تطبيق التدبير؟'),
             ('Pas pour l’instant : ce sont des outils internes, réservés à l’équipe Digilago. Ils sont présentés ici '
              'pour montrer notre façon de travailler.',
              'Not for now: they are internal tools, reserved for the Digilago team. They are shown here to illustrate '
              'the way we work.',
              'ليس حالياً: إنهما أداتان داخليتان مخصصتان لفريق Digilago. نعرضهما هنا لنُظهر طريقة عملنا.')),
            (('Quel projet du Lab peut-on essayer ?', 'Which Lab project can I try?', 'أي مشروع في المختبر يمكنني تجربته؟'),
             ('LAGO, notre jeu (LAB-03) : gratuit, sans inscription, sur téléphone et ordinateur.',
              'LAGO, our game (LAB-03): free, no sign-up, on phone and computer.',
              'LAGO، لعبتنا (LAB-03): مجانية ودون تسجيل، على الهاتف والحاسوب.')),
            (('Pouvez-vous créer une application comme celles-ci pour mon entreprise ?',
              'Can you build an app like these for my business?', 'هل يمكنكم إنشاء تطبيق مثل هذين لشركتي؟'),
             ('Oui. Nous concevons des applications sur mesure : prospection, devis et factures, réservations, suivi de '
              'clients… Décrivez votre besoin : vous recevez un prix écrit avant de commencer.',
              'Yes. We design custom apps: prospecting, quotes and invoices, bookings, client tracking… Describe what '
              'you need: you get a written price before we start.',
              'نعم. نصمّم تطبيقات حسب الطلب: التنقيب عن الزبناء، وعروض الأسعار والفواتير، والحجوزات، وتتبع الزبناء… '
              'صِف حاجتك: تتوصل بسعر مكتوب قبل البدء.')),
            (('Les captures montrent-elles de vraies données ?', 'Do the screenshots show real data?',
              'هل تُظهر لقطات الشاشة بيانات حقيقية؟'),
             ('Non. Toutes les captures du Lab sont faites avec des données de démonstration : les entreprises et les '
              'clients qu’on y voit sont fictifs.',
              'No. Every screenshot in the Lab is taken with demo data: the businesses and clients you see are fictional.',
              'لا. كل لقطات الشاشة في المختبر مأخوذة ببيانات تجريبية: الشركات والزبناء الظاهرون فيها وهميون.')),
            (('Quel est le prochain projet du Lab ?', 'What is the Lab’s next project?', 'ما المشروع المقبل في المختبر؟'),
             ('Il est en préparation. Chaque projet que Digilago termine pour son propre compte rejoint le Lab, avec son '
              'statut : en ligne, à vendre ou à usage interne.',
              'It is in the works. Every project Digilago completes for itself joins the Lab, with its status: live, '
              'for sale or internal use.',
              'إنه قيد الإعداد. كل مشروع تنجزه Digilago لحسابها الخاص ينضم إلى المختبر بحالته: متاح على الإنترنت، أو للبيع، '
              'أو للاستعمال الداخلي.'))],
}


def card(code, num, href, name, tag, p, tags, image, alt, label, mk='', st='int'):
    return ('<a class="lab-card rv" href="%s"><span class="lab-num" aria-hidden="true">%s</span>%s'
            '<div class="lab-card-top">%s<span class="lab-code">%s</span>%s</div><h3>%s<span class="lab-it">%s</span></h3>'
            '<p>%s</p><ul class="lab-tags">%s</ul><span class="lab-go">%s%s</span></a>') % (
        href, num, browser(image, alt, label, sizes='(max-width: 760px) 92vw, 560px'), mark(mk) if mk else '', T(code),
        status_on() if st == 'on' else status(st), T(name), T(tag), T(p),
        ''.join('<li>%s</li>' % T(t) for t in tags), T(S['see']), ARR)


def page_lab():
    L = LAB
    idx = ('<ul class="lab-idx">'
           '<li><a href="lab-radar.html"><span>%s</span>%s</a></li>'
           '<li><a href="lab-gestion.html"><span>%s</span>%s</a></li>'
           '<li><a href="lab-lago.html"><span>%s</span>%s</a></li>'
           '<li class="wip"><b><span>%s</span>%s</b></li></ul>') % (
        T(CODE[1]), T(RADAR), T(CODE[2]), T(GE['name']), T(CODE[3]), T(LAGO), T(CODE[4]), T(S['wip']))
    deco = lambda n: ('<div class="lab-br"><b><i></i><i></i><i></i><span>%s</span></b><img src="assets/lab/%s-960.webp" '
                      'srcset="assets/lab/%s-960.webp 960w, assets/lab/%s-1600.webp 1600w" sizes="470px" width="960" height="600" '
                      'alt="" decoding="async"></div>') % ((T(RA['label']) if n == 'radar-carte' else T(GE['label'])), n, n, n)
    stack = '<div class="lab-stack" aria-hidden="true"><div class="lab-sk b">%s</div><div class="lab-sk f">%s</div></div>' % (
        deco('gestion-tableau'), deco('radar-carte'))
    hero = ('<header class="lab-hero idx"><div class="lab-w">%s<div class="lab-tagrow"><span class="lab-lock">' + mark('lab') + '<span>%s</span></span></div>'
            '<h1><span class="l"><span>%s</span></span><span class="l"><span><em>%s</em></span></span></h1>'
            '<p class="lab-lead">%s</p>%s%s</div></header>') % (
        crumbs([(S['home'], 'index.html'), (S['lab'], None)]), T(S['lab_full']), T(L['h1a']), T(L['h1b']), T(L['lead']), idx, stack)
    cat = ('<section class="lab-sec" id="catalogue"><div class="lab-w">%s<div class="lab-cat">%s%s'
           '%s<div class="lab-card next rv"><span class="lab-num" aria-hidden="true">04</span><div>'
           '<div class="lab-card-top" style="margin-top:0"><span class="lab-code">%s</span>%s</div><h3>%s</h3><p>%s</p></div></div>'
           '</div><p class="lab-note rv">%s%s</p></div></section>') % (
        head(L['cat_k'], L['cat_h1'], L['cat_h2'], L['cat_p']),
        card(CODE[1], '01', 'lab-radar.html', RADAR, L['radar_tag'], L['radar_p'], L['radar_tags'],
             'radar-carte', ('La carte du Maroc dans le Radar : les entreprises détectées, ville par ville (données de démonstration)',
                             'The Morocco map in the Radar: businesses detected, city by city (demo data)',
                             'خريطة المغرب في الرادار: الشركات المرصودة مدينةً مدينة (بيانات تجريبية)'), RA['label'], 'radar'),
        card(CODE[2], '02', 'lab-gestion.html', GE['name'], L['gestion_tag'], L['gestion_p'], L['gestion_tags'],
             'gestion-tableau', ('Le tableau de bord de la Gestion : la journée, les demandes et les villes clientes (données de démonstration)',
                                 'The Gestion dashboard: the day, the requests and the client cities (demo data)',
                                 'لوحة قيادة تطبيق التدبير: مهام اليوم والطلبات ومدن الزبناء (بيانات تجريبية)'), GE['label'], 'gestion'),
        card(CODE[3], '03', 'lab-lago.html', LAGO, L['lago_tag'], L['lago_p'], L['lago_tags'], 'lago-rue', LG['hero_alt'],
             LG['label'], 'lab', st='on'),
        T(CODE[4]), status('wip'), T(L['next_h']), T(L['next_p']), svg('info'), T(S['demo_note']))
    leg = ('<section class="lab-sec"><div class="lab-w">%s<ul class="lab-legend">%s</ul></div></section>') % (
        head(L['leg_k'], L['leg_h1'], L['leg_h2']),
        ''.join('<li class="rv d%d"><span class="lab-st %s"><i aria-hidden="true"></i>%s</span><p>%s</p></li>' % (
            i + 1, k, T(n), T(p)) for i, (n, k, p) in enumerate(L['leg'])))
    rl = '<section class="lab-sec"><div class="lab-w">%s%s</div></section>' % (
        head(S['rules_k'], L['rules_h1'], L['rules_h2']), rules(L['rules'], 'four'))
    fq = '<section class="lab-sec lab-faq" id="faq"><div class="lab-w">%s%s</div></section>' % (
        head(L['faq_k'], L['faq_h1'], L['faq_h2']), faq(L['faq']))
    body = hero + cat + leg + rl + fq + profit('index')
    return 'index', L['title'], L['desc'], body


# ─── LAB-01 : le Radar ───────────────────────────────────────────────────

RA = {
    'label': ('Radar · usage interne', 'Radar · internal use', 'Radar · استعمال داخلي'),
    'title': ('Radar : notre outil de prospection au Maroc | Digilago Lab',
              'Radar: our prospecting tool for Morocco | Digilago Lab',
              'الرادار: أداتنا للتنقيب عن الزبناء في المغرب | Digilago Lab'),
    'desc': ('LAB-01 · Le Radar trouve les entreprises du Maroc par ville et par métier, diagnostique leur présence en ligne '
             'et prépare un premier contact utile. Un outil interne de Digilago.',
             'LAB-01 · The Radar finds Moroccan businesses by city and trade, diagnoses their online presence and prepares '
             'a useful first contact. An internal Digilago tool.',
             'LAB-01 · يعثر الرادار على شركات المغرب حسب المدينة والنشاط، ويشخّص حضورها على الإنترنت، ويُحضّر أول تواصل مفيد. '
             'أداة داخلية من Digilago.'),
    'h1a': ('Le Radar.', 'The Radar.', 'الرادار.'),
    'h1b': ('Le Maroc, entreprise par entreprise.', 'Morocco, business by business.', 'المغرب، شركةً شركة.'),
    'lead': ('Notre outil de prospection. Il découvre les entreprises par ville et par métier, mesure leur présence en '
             'ligne, explique son score point par point et accompagne l’équipe jusqu’au client signé.',
             'Our prospecting tool. It discovers businesses by city and trade, measures their online presence, explains '
             'its score point by point and supports the team all the way to a signed client.',
             'أداتنا للتنقيب عن الزبناء. يكتشف الشركات حسب المدينة والنشاط، ويقيس حضورها على الإنترنت، ويشرح تقييمه نقطة '
             'بنقطة، ويرافق الفريق حتى توقيع الزبون.'),
    'hero_alt': ('La carte 3D du Maroc dans le Radar, avec le flux des entreprises détectées (données de démonstration)',
                 'The 3D map of Morocco in the Radar, with the feed of detected businesses (demo data)',
                 'خريطة المغرب ثلاثية الأبعاد في الرادار، مع تدفق الشركات المرصودة (بيانات تجريبية)'),
    'hero_alt2': ('Le Radar sur téléphone : les prospects autour de soi, avec leur distance (données de démonstration)',
                  'The Radar on a phone: nearby prospects, with their distance (demo data)',
                  'الرادار على الهاتف: الزبناء المحتملون القريبون منك مع المسافة (بيانات تجريبية)'),
    'why_k': ('Le point de départ', 'The starting point', 'نقطة الانطلاق'),
    'why_h1': ('Des milliers d’entreprises,', 'Thousands of businesses,', 'آلاف الشركات،'),
    'why_h2': ('et aucun moyen de savoir lesquelles aider.', 'and no way to know which ones to help.',
               'ولا وسيلة لمعرفة أيّها نساعد.'),
    'why_p': ('Au Maroc, beaucoup d’entreprises n’ont pas de site, ou un site qui ne leur amène aucun client. Les trouver '
              'une par une, vérifier leur présence en ligne et savoir quoi leur proposer prenait des heures. Le Radar fait '
              'ce travail avec méthode, et chaque nuit il avance tout seul.',
              'In Morocco, many businesses have no website, or one that brings them no clients. Finding them one by one, '
              'checking their online presence and knowing what to offer them took hours. The Radar does this work '
              'methodically, and every night it moves forward on its own.',
              'في المغرب، كثير من الشركات لا تملك موقعاً، أو تملك موقعاً لا يجلب لها أي زبون. كان العثور عليها واحدة واحدة، '
              'والتحقق من حضورها على الإنترنت، ومعرفة ما نقترحه عليها، يستغرق ساعات. الرادار يقوم بهذا العمل بمنهجية، '
              'ويتقدم وحده كل ليلة.'),
    'f_k': ('Ce qu’il fait', 'What it does', 'ما يقوم به'),
    'f_h1': ('Cinq gestes,', 'Five moves,', 'خمس خطوات،'),
    'f_h2': ('du premier repérage au client signé.', 'from first spotting to signed client.', 'من الرصد الأول إلى توقيع الزبون.'),
    'rules_h1': ('Des règles,', 'Rules,', 'قواعد،'),
    'rules_h2': ('écrites dans le code.', 'written into the code.', 'مكتوبة في الشيفرة.'),
}
RA['feats'] = [
    {'n': ('01 · Balayage', '01 · Sweep', '01 · المسح'),
     'h': ('Il balaie le Maroc, rue par rue.', 'It sweeps Morocco, street by street.', 'يمسح المغرب شارعاً شارعاً.'),
     'p': ('Une ville, un point sur la carte, une région ou tout le pays : le Radar découpe la zone en mailles de 3,3 km, '
           'écarte la mer, redécoupe les quartiers trop denses et estime le travail avant de lancer.',
           'A city, a point on the map, a region or the whole country: the Radar splits the area into 3.3 km cells, '
           'leaves out the sea, re-splits areas that are too dense and estimates the work before it starts.',
           'مدينة، أو نقطة على الخريطة، أو جهة، أو البلد كله: يقسّم الرادار المنطقة إلى خلايا من 3,3 كلم، ويستبعد البحر، '
           'ويعيد تقسيم الأحياء الكثيفة جداً، ويقدّر حجم العمل قبل الانطلاق.'),
     'facts': [('Environ 490 villes et communes au catalogue', 'About 490 cities and municipalities in its catalogue',
                'حوالي 490 مدينة وجماعة في الفهرس'),
               ('22 secteurs et plus de 140 métiers', '22 sectors and more than 140 trades', '22 قطاعاً وأكثر من 140 نشاطاً'),
               ('Quota du jour atteint : pause, puis reprise le lendemain', 'Daily quota reached: pause, then resume the next day',
                'عند بلوغ حصة اليوم: توقف ثم استئناف في اليوم الموالي')],
     'img': 'radar-balayage', 'label': RA['label'],
     'alt': ('Préparer un balayage d’El Jadida : les mailles de 3,3 km et les secteurs choisis',
             'Preparing a sweep of El Jadida: the 3.3 km cells and the chosen sectors',
             'تحضير مسح مدينة الجديدة: خلايا 3,3 كلم والقطاعات المختارة')},
    {'n': ('02 · Diagnostic', '02 · Diagnosis', '02 · التشخيص'),
     'h': ('Il établit un diagnostic honnête.', 'It makes an honest diagnosis.', 'يضع تشخيصاً صادقاً.'),
     'p': ('Pour chaque entreprise : son site, sa fiche Google, son référencement et sa visibilité dans les IA. Le score '
           's’explique point par point, et chaque coordonnée garde sa source et sa date.',
           'For each business: its website, its Google profile, its search ranking and its visibility in AI '
           'assistants. The score is explained point by point, and every contact detail keeps its source and date.',
           'لكل شركة: موقعها، وملفها على Google، وظهورها في محركات البحث وفي أدوات الذكاء الاصطناعي. التقييم يُشرح نقطة '
           'بنقطة، وكل معلومة اتصال تحتفظ بمصدرها وتاريخها.'),
     'facts': [('« Pourquoi ce score ? » en clair, sur chaque fiche', '“Why this score?” in plain words, on every record',
                '«لماذا هذا التقييم؟» بوضوح في كل بطاقة'),
               ('Vitesse du site mesurée sur mobile', 'Website speed measured on mobile', 'سرعة الموقع مقيسة على الهاتف'),
               ('Concurrents proches, pour situer l’entreprise', 'Nearby competitors, to put the business in context',
                'المنافسون القريبون، لوضع الشركة في سياقها')],
     'img': 'radar-fiche', 'label': RA['label'],
     'alt': ('La fiche d’une entreprise fictive dans le Radar : score, présence digitale et les quatre piliers',
             'A fictional business record in the Radar: score, digital presence and the four pillars',
             'بطاقة شركة وهمية في الرادار: التقييم والحضور الرقمي والركائز الأربع')},
    {'n': ('03 · Situations', '03 · Situations', '03 · الحالات'),
     'h': ('Il range chaque entreprise dans l’une de quatre situations.', 'It places each business in one of four situations.',
           'يصنّف كل شركة في واحدة من أربع حالات.'),
     'p': ('Aucun site trouvé, une page Facebook ou un site Google seulement, un site basique, ou un bon site : à chaque '
           'situation son argument, et un message déjà rédigé, en français ou en arabe.',
           'No website found, only a Facebook page or a Google site, a basic website, or a good one: each situation '
           'gets its own argument, and a message already written, in French or Arabic.',
           'لا موقع، أو صفحة Facebook أو موقع Google فقط، أو موقع بسيط، أو موقع جيد: لكل حالة حجتها، ورسالة جاهزة بالفرنسية '
           'أو العربية.'),
     'facts': [('Filtres partagés par un simple lien', 'Filters shared with a simple link', 'مرشحات تُشارك برابط بسيط'),
               ('Export Excel avec la source de chaque donnée', 'Excel export with the source of every data point',
                'تصدير Excel مع مصدر كل معلومة'),
               ('Doublons fusionnés avec prudence, toujours réversibles', 'Duplicates merged carefully, always reversible',
                'دمج المكررات بحذر، مع إمكانية التراجع دائماً')],
     'img': 'radar-entreprises', 'label': RA['label'],
     'alt': ('La liste des entreprises du Radar, triées en quatre situations (données de démonstration)',
             'The Radar’s list of businesses, sorted into four situations (demo data)',
             'قائمة الشركات في الرادار مصنفة في أربع حالات (بيانات تجريبية)')},
    {'n': ('04 · Suivi', '04 · Follow-up', '04 · التتبع'),
     'h': ('Il suit chaque affaire jusqu’au client signé.', 'It follows every deal to a signed client.',
           'يتتبع كل صفقة حتى توقيع الزبون.'),
     'p': ('Un tableau du premier contact à la signature, avec les montants, une prévision pondérée et les relances '
           'programmées. Un clic sur « Préparer le devis » envoie tout dans la Gestion (LAB-02).',
           'A board from first contact to signature, with amounts, a weighted forecast and scheduled follow-ups. One '
           'click on “Prepare the quote” sends everything to Gestion (LAB-02).',
           'لوحة من أول تواصل إلى التوقيع، مع المبالغ وتوقع مرجَّح والتذكيرات المبرمجة. ونقرة على «تحضير عرض السعر» '
           'ترسل كل شيء إلى تطبيق التدبير (LAB-02).'),
     'facts': [('Relance à J+3 et appel à J+7, annulés dès que l’entreprise répond',
                'Follow-up on day 3 and a call on day 7, cancelled as soon as the business replies',
                'تذكير في اليوم الثالث ومكالمة في اليوم السابع، يُلغيان بمجرد رد الشركة'),
               ('Statuts et montants synchronisés avec la Gestion', 'Statuses and amounts synced with Gestion',
                'الحالات والمبالغ متزامنة مع تطبيق التدبير')],
     'img': 'radar-pipeline', 'label': RA['label'],
     'alt': ('Le pipeline commercial du Radar, du premier contact au client signé (données de démonstration)',
             'The Radar’s sales pipeline, from first contact to signed client (demo data)',
             'مسار المبيعات في الرادار، من أول تواصل إلى توقيع الزبون (بيانات تجريبية)')},
    {'n': ('05 · Terrain', '05 · Field', '05 · الميدان'), 'kind': 'ph',
     'h': ('Il marche aussi sur le terrain.', 'It works in the field too.', 'يشتغل في الميدان أيضاً.'),
     'p': ('Installé sur le téléphone, il montre les prospects à 1, 3, 5 ou 10 km, avec l’itinéraire et l’appel en un '
           'geste. La position sert au calcul : elle n’est pas enregistrée.',
           'Installed on the phone, it shows prospects within 1, 3, 5 or 10 km, with directions and a call in one tap. '
           'The location is used for the calculation: it is not stored.',
           'بعد تثبيته على الهاتف، يعرض الزبناء المحتملين على بعد 1 أو 3 أو 5 أو 10 كلم، مع المسار والاتصال بلمسة واحدة. '
           'يُستعمل الموقع للحساب فقط: ولا يُحفظ.'),
     'facts': [('« Visite faite » et sa note, gardées dans l’historique', '“Visit done” and its note, kept in the history',
                '«تمت الزيارة» وملاحظتها محفوظتان في السجل'),
               ('Aucune donnée gardée sur le téléphone', 'No data kept on the phone', 'لا تُحفظ أي بيانات على الهاتف')],
     'img': 'radar-terrain',
     'alt': ('Le Radar sur téléphone : les prospects les plus proches, avec leur distance et leur situation (données de démonstration)',
             'The Radar on a phone: the closest prospects, with their distance and situation (demo data)',
             'الرادار على الهاتف: أقرب الزبناء المحتملين مع المسافة والحالة (بيانات تجريبية)')},
]
RA['rules'] = [
    ('facts', ('Aucune donnée inventée', 'No invented data', 'لا بيانات مختلَقة'),
     ('Un champ inconnu reste vide, et « aucun site trouvé » ne veut pas dire « pas de site » : la fiche dit quelles '
      'sources ont été consultées, et quand.',
      'An unknown field stays empty, and “no website found” does not mean “no website”: the record says which sources '
      'were checked, and when.',
      'الحقل المجهول يبقى فارغاً، و«لم يُعثر على موقع» لا تعني «لا يوجد موقع»: البطاقة تذكر المصادر التي رُوجعت ومتى.')),
    ('wa', ('WhatsApp, seulement avec une preuve', 'WhatsApp, only with proof', 'WhatsApp بدليل فقط'),
     ('Un numéro mobile ne suffit pas : il faut un lien publié par l’entreprise, ou l’accord d’un membre de l’équipe '
      'qui l’a vérifié.',
      'A mobile number is not enough: it takes a link published by the business, or confirmation from a team member '
      'who checked it.',
      'رقم الهاتف المحمول لا يكفي: يلزم رابط تنشره الشركة، أو تأكيد عضو من الفريق تحقق منه.')),
    ('nosend', ('Pas d’envoi automatique', 'No automatic sending', 'لا إرسال تلقائي'),
     ('Les messages s’ouvrent déjà rédigés ; un membre de l’équipe les relit et les envoie, un par un.',
      'Messages open already written; a team member reads them and sends them, one by one.',
      'تُفتح الرسائل محرَّرة مسبقاً؛ ويراجعها عضو من الفريق ويرسلها واحدة واحدة.')),
    ('stop', ('« Ne pas contacter », partout', '“Do not contact”, everywhere', '«عدم التواصل» في كل مكان'),
     ('Une entreprise qui ne veut pas être contactée ne l’est plus, même si son numéro réapparaît plus tard.',
      'A business that does not want to be contacted is not contacted again, even if its number shows up later.',
      'الشركة التي لا ترغب في التواصل معها لا يُتواصل معها، حتى لو ظهر رقمها لاحقاً.')),
    ('eye', ('Google pour vérifier, pas pour copier', 'Google to check, not to copy', 'Google للتحقق لا للنسخ'),
     ('La note et les avis s’affichent en direct, à la demande, et ne sont jamais enregistrés ni exportés.',
      'Ratings and reviews are shown live, on request, and are never stored or exported.',
      'التقييم والآراء تُعرض مباشرة عند الطلب، ولا تُحفظ ولا تُصدَّر أبداً.')),
    ('merge', ('Corrections protégées', 'Protected corrections', 'تصحيحات محمية'),
     ('Une correction faite à la main n’est jamais écrasée, et chaque fusion de doublons peut être annulée.',
      'A correction made by hand is never overwritten, and every duplicate merge can be undone.',
      'التصحيح اليدوي لا يُستبدل أبداً، وكل دمج للمكررات يمكن إلغاؤه.')),
]


def page_project(P, kind, code, num, crumb_name, hero_img, hero_ph, neighbours):
    hero = ('<header class="lab-hero prj"><div class="lab-w"><div>%s<div class="lab-tagrow"><span class="lab-pmk">' + mark(kind) + '</span><span class="lab-code">%s</span>%s</div>'
            '<h1><span class="l"><span>%s</span></span><span class="l"><span><em>%s</em></span></span></h1>'
            '<p class="lab-lead">%s</p><ul class="lab-meta"><li>%s</li><li>%s</li><li>%s</li></ul></div>'
            '<figure class="lab-show">%s%s</figure></div></header>') % (
        crumbs([(S['home'], 'index.html'), (S['lab'], 'lab.html'), (crumb_name, None)]), T(code), status('int'),
        T(P['h1a']), T(P['h1b']), T(P['lead']), T(S['made']), T(S['web_phone']), T(S['langs']),
        browser(hero_img, P['hero_alt'], P['label'], eager=True, sizes='(max-width: 760px) 92vw, 1184px'),
        phone(hero_ph, P['hero_alt2'], sizes='(max-width: 760px) 34vw, 290px'))
    why = ('<section class="lab-sec"><div class="lab-w"><div class="lab-intro"><div class="lab-head"><p class="lab-k rv">%s</p>'
           '<h2 class="rv d1">%s <em>%s</em></h2></div><p class="lab-p rv d2">%s</p></div></div></section>') % (
        T(P['why_k']), T(P['why_h1']), T(P['why_h2']), T(P['why_p']))
    # « Et aussi » : les fonctions présentées sans capture (aucun devis, aucune facture, aucun montant à l'écran)
    more = ('<div class="lab-more"><p class="lab-k rv">%s</p>%s</div>' % (T(S['more']), rules(P['extras']))) if P.get('extras') else ''
    ft = '<section class="lab-sec"><div class="lab-w">%s%s%s<p class="lab-note rv">%s%s</p></div></section>' % (
        head(P['f_k'], P['f_h1'], P['f_h2']), feats(P['feats']), more, svg('info'), T(S['demo_note']))
    rl = '<section class="lab-sec"><div class="lab-w">%s%s</div></section>' % (
        head(S['rules_k'], P['rules_h1'], P['rules_h2']), rules(P['rules']))
    def nlink(code, name, href, side, cls=''):
        # une seule phrase par langue (« Projet suivant · LAB-02 ») : traduite d'un bloc
        small = T(S['all']) if href == 'lab.html' else T(tuple('%s · %s' % (a, b) for a, b in zip(S[side], code)))
        return '<a%s href="%s"><small>%s</small><b>%s</b></a>' % (cls, href, small, T(name))
    (pc, pn, ph), (nc, nn, nh) = neighbours
    nb = ('<section class="lab-sec"><div class="lab-w"><nav class="lab-next" aria-label="%s">%s%s</nav></div></section>') % (
        A(S['lab_full']), nlink(pc, pn, ph, 'prev'), nlink(nc, nn, nh, 'next', ' class="r"'))
    body = hero + why + ft + rl + profit(kind) + nb
    return body


def page_radar():
    body = page_project(RA, 'radar', CODE[1], '01', RADAR, 'radar-carte', 'radar-terrain',
                        ((None, S['lab_full'], 'lab.html'), (CODE[2], GE['name'], 'lab-gestion.html')))
    return 'radar', RA['title'], RA['desc'], body


# ─── LAB-02 : la Gestion ─────────────────────────────────────────────────

GE = {
    'name': ('Gestion', 'Gestion', 'تطبيق التدبير'),
    'label': ('Gestion · usage interne', 'Gestion · internal use', 'Gestion · استعمال داخلي'),
    'title': ('Gestion : devis, factures et comptabilité | Digilago Lab',
              'Gestion: quotes, invoices and bookkeeping | Digilago Lab',
              'تطبيق التدبير: عروض الأسعار والفواتير والمحاسبة | Digilago Lab'),
    'desc': ('LAB-02 · La Gestion Digilago réunit les demandes, les devis signés en ligne, les acomptes, les factures, la '
             'comptabilité marocaine et le suivi des projets. Un outil interne de Digilago.',
             'LAB-02 · Digilago Gestion brings together requests, quotes signed online, deposits, invoices, '
             'Moroccan bookkeeping and project tracking. An internal Digilago tool.',
             'LAB-02 · يجمع تطبيق التدبير من Digilago الطلبات، وعروض الأسعار الموقّعة عبر الإنترنت، والعربون، والفواتير، '
             'والمحاسبة المغربية، وتتبع المشاريع. أداة داخلية من Digilago.'),
    'h1a': ('La Gestion.', 'Gestion.', 'تطبيق التدبير.'),
    'h1b': ('Toute l’agence, de la demande à la facture.', 'The whole agency, from request to invoice.',
            'الوكالة كلها، من الطلب إلى الفاتورة.'),
    'lead': ('Notre espace de travail privé. Chaque demande, chaque devis, chaque paiement et chaque projet au même endroit, '
             'du premier appel à la mise en ligne.',
             'Our private workspace. Every request, quote, payment and project in one place, from the first call to the '
             'launch.',
             'فضاء عملنا الخاص. كل طلب وكل عرض سعر وكل أداء وكل مشروع في مكان واحد، من أول مكالمة إلى النشر.'),
    'hero_alt': ('Le tableau de bord de la Gestion : les actions du jour et l’objectif d’allumer tout le Maroc (données de démonstration)',
                 'The Gestion dashboard: today’s actions and the goal of lighting up all of Morocco (demo data)',
                 'لوحة قيادة تطبيق التدبير: مهام اليوم وهدف إضاءة المغرب كله (بيانات تجريبية)'),
    'hero_alt2': ('Le suivi d’un projet sur le téléphone du client (données de démonstration)',
                  'A project being tracked on the client’s phone (demo data)',
                  'تتبع مشروع على هاتف الزبون (بيانات تجريبية)'),
    'why_k': ('Le point de départ', 'The starting point', 'نقطة الانطلاق'),
    'why_h1': ('Une agence vit de ses demandes,', 'An agency lives on its requests,', 'الوكالة تعيش من طلباتها،'),
    'why_h2': ('pas de fichiers éparpillés.', 'not on scattered files.', 'لا من ملفات مبعثرة.'),
    'why_p': ('Des demandes sur WhatsApp, des devis dans un tableur, des factures en PDF, des paiements à vérifier : tout '
              'se perd entre deux appels. La Gestion réunit ce travail dans un seul outil, pensé pour une entreprise marocaine.',
              'Requests on WhatsApp, quotes in a spreadsheet, invoices as PDFs, payments to check: everything gets lost '
              'between two calls. Gestion brings this work together in one tool, designed for a Moroccan business.',
              'طلبات على WhatsApp، وعروض أسعار في جدول، وفواتير بصيغة PDF، وأداءات يجب التحقق منها: كل شيء يضيع بين '
              'مكالمتين. يجمع تطبيق التدبير هذا العمل في أداة واحدة، صُممت لشركة مغربية.'),
    'f_k': ('Ce qu’elle fait', 'What it does', 'ما يقوم به'),
    'f_h1': ('L’essentiel,', 'The essentials,', 'الأساسي،'),
    'f_h2': ('du premier appel à la livraison.', 'from the first call to delivery.', 'من أول مكالمة إلى التسليم.'),
    'rules_h1': ('Des chiffres justes,', 'Accurate figures,', 'أرقام دقيقة،'),
    'rules_h2': ('des accès protégés.', 'protected access.', 'وولوج محمي.'),
}
GE['feats'] = [
    {'n': ('01 · Demandes', '01 · Requests', '01 · الطلبات'),
     'h': ('Toutes les demandes au même endroit.', 'Every request in one place.', 'كل الطلبات في مكان واحد.'),
     'p': ('Site, WhatsApp, téléphone, recommandation ou Radar : chaque demande arrive dans le même tableau, avec sa '
           'provenance et sa date de rappel. Chaque matin, « Ma journée » dit quoi faire en premier.',
           'Website, WhatsApp, phone, referral or Radar: every request lands on the same board, with its source and '
           'its call-back date. Every morning, “My day” says what to do first.',
           'الموقع، أو WhatsApp، أو الهاتف، أو التوصية، أو الرادار: كل طلب يصل إلى اللوحة نفسها مع مصدره وموعد معاودة '
           'الاتصال. وكل صباح تخبرك «يومي» بما يجب البدء به.'),
     'facts': [('Une demande inconnue est cherchée dans le Radar, puis reliée', 'An unknown request is looked up in the Radar, then linked',
                'يُبحث عن الطلب المجهول في الرادار ثم يُربط به'),
               ('Gagnée ou perdue, toujours avec sa raison', 'Won or lost, always with its reason', 'رابحة أو خاسرة، مع السبب دائماً')],
     'img': 'gestion-demandes', 'label': GE['label'],
     'alt': ('Le pipeline des demandes dans la Gestion, par étape (données de démonstration)',
             'The request pipeline in Gestion, by stage (demo data)',
             'مسار الطلبات في تطبيق التدبير حسب المرحلة (بيانات تجريبية)')},
    {'n': ('02 · Devis', '02 · Quotes', '02 · عروض الأسعار'),
     'h': ('Un devis prêt en une minute.', 'A quote ready in one minute.', 'عرض سعر جاهز في دقيقة.'),
     'p': ('Pendant l’appel, l’assistant dit quoi demander, recommande les bonnes prestations et prépare le devis et '
           'l’échéancier. Un clic crée le client, le projet et le devis.',
           'During the call, the assistant says what to ask, recommends the right services and prepares the quote and '
           'the payment schedule. One click creates the client, the project and the quote.',
           'أثناء المكالمة، يخبرك المساعد بما يجب السؤال عنه، ويقترح الخدمات المناسبة، ويُحضّر عرض السعر وجدول الأداء. '
           'ونقرة واحدة تُنشئ الزبون والمشروع وعرض السعر.'),
     'facts': [('Numérotation continue, année par année', 'Continuous numbering, year by year', 'ترقيم متسلسل سنة بسنة'),
               ('Montant en toutes lettres et mentions légales marocaines', 'Amount written in words and Moroccan legal mentions',
                'المبلغ بالحروف والبيانات القانونية المغربية')],
     'img': 'gestion-assistant', 'label': GE['label'],
     'alt': ('L’assistant « Nouveau projet » de la Gestion, qui guide l’appel et estime le devis',
             'Gestion’s “New project” assistant, guiding the call and estimating the quote',
             'مساعد «مشروع جديد» في تطبيق التدبير، يوجّه المكالمة ويقدّر عرض السعر')},
    {'n': ('03 · Suivi client', '03 · Client tracking', '03 · تتبع الزبون'), 'kind': 'ph',
     'h': ('Le client suit son projet.', 'The client follows their project.', 'الزبون يتتبع مشروعه.'),
     'p': ('Un lien privé montre l’avancement, ce qu’il reste à fournir, les fichiers et les messages, du lancement à la '
           'livraison. Sans mot de passe, et jamais indexé par Google.',
           'A private link shows progress, what is still needed, files and messages, from kick-off to delivery. No '
           'password, and never indexed by Google.',
           'رابط خاص يعرض التقدم، وما بقي على الزبون تقديمه، والملفات والرسائل، من الانطلاق إلى التسليم. دون كلمة مرور، '
           'ولا يفهرسه Google أبداً.'),
     'facts': [('Messages dans les deux sens', 'Messages both ways', 'رسائل في الاتجاهين'),
               ('À la livraison : l’adresse du site, le domaine et les échéances', 'At delivery: the site address, the domain and renewal dates',
                'عند التسليم: عنوان الموقع واسم النطاق ومواعيد التجديد')],
     'img': 'gestion-suivi',
     'alt': ('L’espace de suivi d’un projet, sur le téléphone du client (données de démonstration)',
             'A project tracking space, on the client’s phone (demo data)',
             'فضاء تتبع مشروع على هاتف الزبون (بيانات تجريبية)')},
]
GE['extras'] = [
    ('facts', ('Signé en ligne, depuis le téléphone', 'Signed online, from the phone', 'موقَّع عبر الإنترنت من الهاتف'),
     ('Le client ouvre son lien, reçoit un code de vérification et signe au doigt. Le bon de commande se crée tout seul.',
      'The client opens their link, receives a verification code and signs with a finger. The purchase order is created automatically.',
      'يفتح الزبون رابطه، ويتوصل برمز تحقق، ويوقّع بإصبعه. ويُنشأ طلب الشراء تلقائياً.')),
    ('cent', ('Une comptabilité marocaine', 'Moroccan bookkeeping', 'محاسبة مغربية'),
     ('Chaque échéance se facture d’un clic, la TVA se calcule par période et le comptable a son accès en lecture seule.',
      'Each due date is invoiced in one click, VAT is computed by period and the accountant has read-only access.',
      'كل استحقاق يُفوتر بنقرة، والضريبة على القيمة المضافة تُحسب حسب الفترة، وللمحاسب ولوج للقراءة فقط.')),
    ('eye', ('Chaque dirham de publicité, suivi', 'Every advertising dirham, tracked', 'كل درهم إشهار، متتبَّع'),
     ('Chaque demande garde sa provenance : coût par demande et par client signé, campagne par campagne.',
      'Every request keeps its source: cost per request and per signed client, campaign by campaign.',
      'كل طلب يحتفظ بمصدره: تكلفة الطلب وتكلفة الزبون الموقِّع، حملةً حملة.')),
]
GE['rules'] = [
    ('cent', ('Des montants exacts', 'Exact amounts', 'مبالغ دقيقة'),
     ('Calculs au centime, échéances facturées dans l’ordre et jamais deux fois, même en cas de double clic.',
      'Calculations to the cent, due dates invoiced in order and never twice, even after a double click.',
      'حسابات دقيقة حتى السنتيم، واستحقاقات تُفوتر بالترتيب ولا تتكرر أبداً، حتى عند النقر المزدوج.')),
    ('calendar', ('Un mois clôturé ne bouge plus', 'A closed month stays closed', 'الشهر المختوم لا يتغيّر'),
     ('Une fois la période clôturée, ses factures, paiements et dépenses ne peuvent plus être modifiés.',
      'Once a period is closed, its invoices, payments and expenses can no longer be changed.',
      'بعد ختم الفترة، لا يمكن تعديل فواتيرها وأداءاتها ومصاريفها.')),
    ('lock', ('Connexions surveillées', 'Monitored sign-ins', 'تسجيلات دخول مراقبة'),
     ('Essais limités, sessions signées, et déconnexion de tous les appareils en un clic si un téléphone est perdu.',
      'Limited attempts, signed sessions, and sign-out from every device in one click if a phone is lost.',
      'محاولات محدودة، وجلسات موقّعة، وتسجيل الخروج من كل الأجهزة بنقرة إذا ضاع هاتف.')),
    ('shield', ('Messages vérifiés', 'Verified messages', 'رسائل متحقَّق منها'),
     ('Chaque message WhatsApp reçu est vérifié : personne ne peut se faire passer pour un client.',
      'Every WhatsApp message received is verified: no one can pretend to be a client.',
      'كل رسالة WhatsApp واردة يُتحقَّق منها: لا أحد يستطيع انتحال صفة زبون.')),
    ('hidden', ('Pages client privées', 'Private client pages', 'صفحات زبناء خاصة'),
     ('Les liens envoyés aux clients ne sont jamais indexés ni gardés en cache.',
      'Links sent to clients are never indexed or cached.', 'الروابط المرسَلة إلى الزبناء لا تُفهرس ولا تُخزَّن مؤقتاً أبداً.')),
    ('save', ('Sauvegarde en un clic', 'One-click backup', 'نسخة احتياطية بنقرة'),
     ('Toutes les données, sans aucun mot de passe ni jeton dedans.', 'All the data, without a single password or token inside.',
      'كل البيانات، دون أي كلمة مرور أو رمز بداخلها.')),
]


def page_gestion():
    body = page_project(GE, 'gestion', CODE[2], '02', GE['name'], 'gestion-tableau', 'gestion-suivi',
                        ((CODE[1], RADAR, 'lab-radar.html'), (CODE[3], LAGO, 'lab-lago.html')))
    return 'gestion', GE['title'], GE['desc'], body


# ─── LAB-03 : LAGO, le jeu ───────────────────────────────────────────────
# Le seul projet du Lab ouvert au public : un jeu gratuit, sur téléphone et ordinateur (site/lago/, construit à part).
# Il rejoue ce que Digilago fait chaque jour : repérer une entreprise, comprendre son métier, écrire un prix juste,
# construire en 72 heures, répondre le jour même, rester après la mise en ligne. Entreprises fictives ; aucune donnée
# collectée (la progression reste sur l'appareil du joueur).

GAME_URL = '/lago/'
LAGO = ('Lago', 'Lago', 'Lago')
LG = {
    'label': ('Lago · le jeu', 'Lago · the game', 'Lago · اللعبة'),
    'title': ('LAGO, allume le Maroc : le jeu gratuit de Digilago | Digilago Lab',
              'LAGO, light up Morocco: Digilago’s free game | Digilago Lab',
              'LAGO، أضِئ المغرب: لعبة Digilago المجانية | Digilago Lab'),
    'desc': ('LAB-03 · Un jeu gratuit, sur téléphone et ordinateur : aidez Lago, Radar et Gestion à mettre en ligne les '
             'entreprises de Casablanca. Devis écrit, site en 72 heures, réponse le jour même. Sans inscription.',
             'LAB-03 · A free game for phone and computer: help Lago, Radar and Gestion bring the businesses of Casablanca '
             'online. Written quote, website in 72 hours, same-day reply. No sign-up.',
             'LAB-03 · لعبة مجانية على الهاتف والحاسوب: ساعد Lago والرادار وتطبيق التدبير على نشر شركات الدار البيضاء على '
             'الإنترنت. عرض سعر مكتوب، وموقع في 72 ساعة، ورد في اليوم نفسه. دون تسجيل.'),
    'h1a': ('Lago.', 'Lago.', 'Lago.'),
    'h1b': ('Allume le Maroc.', 'Light up Morocco.', 'أضِئ المغرب.'),
    'lead': ('Notre premier jeu. Aidez Lago, Radar et Gestion à rendre visibles les entreprises de Casablanca, une par '
             'une : un prix écrit avant de commencer, un site en 72 heures, une réponse le jour même.',
             'Our first game. Help Lago, Radar and Gestion make the businesses of Casablanca visible, one by one: a price '
             'written before we start, a website in 72 hours, a reply the same day.',
             'لعبتنا الأولى. ساعد Lago والرادار وتطبيق التدبير على إظهار شركات الدار البيضاء على الإنترنت، واحدة تلو '
             'الأخرى: ثمن مكتوب قبل البدء، وموقع في 72 ساعة، ورد في اليوم نفسه.'),
    'play': ('Jouer maintenant', 'Play now', 'العب الآن'),
    'trailer_btn': ('Voir la bande-annonce', 'Watch the trailer', 'شاهد الإعلان'),
    'm1': ('Gratuit, sans inscription', 'Free, no sign-up', 'مجانية ودون تسجيل'),
    'm2': ('Téléphone et ordinateur', 'Phone and computer', 'الهاتف والحاسوب'),
    'm3': ('Jeu en français', 'Game in French', 'اللعبة بالفرنسية'),
    'hero_alt': ('La rue de la médina de Casablanca dans le jeu LAGO : les entreprises s’allument quand elles passent en ligne',
                 'The Casablanca medina street in the LAGO game: businesses light up when they go online',
                 'شارع المدينة القديمة بالدار البيضاء في لعبة LAGO: تُضاء الشركات حين تصبح متاحة على الإنترنت'),
    'hero_alt2': ('L’écran d’accueil du jeu LAGO sur téléphone, avec Lago qui salue',
                  'The LAGO game start screen on a phone, with Lago waving', 'شاشة بداية لعبة LAGO على الهاتف، وLago يلوّح'),
    'why_k': ('L’idée', 'The idea', 'الفكرة'),
    'why_h1': ('Un jeu qui raconte', 'A game that tells', 'لعبة تحكي'),
    'why_h2': ('notre vrai métier.', 'what we really do.', 'عملنا الحقيقي.'),
    'why_p': ('Au Maroc, beaucoup d’entreprises font un travail remarquable et restent invisibles en ligne. Dans LAGO, '
              'vous faites ce que Digilago fait chaque jour : les repérer, comprendre leur métier, écrire un prix juste, '
              'construire leur site en 72 heures, et rester à leurs côtés après la mise en ligne. Chaque entreprise '
              'allumée éclaire un peu plus la ville.',
              'In Morocco, many businesses do remarkable work and stay invisible online. In LAGO, you do what Digilago '
              'does every day: spot them, understand their trade, write a fair price, build their website in 72 hours, '
              'and stay by their side after launch. Every business you light up brightens the city a little more.',
              'في المغرب، شركات كثيرة تقوم بعمل رائع لكنها تبقى غير مرئية على الإنترنت. في LAGO، تفعل ما تفعله Digilago '
              'كل يوم: ترصدها، وتفهم نشاطها، وتكتب ثمناً عادلاً، وتبني موقعها في 72 ساعة، وتبقى إلى جانبها بعد النشر. '
              'وكل شركة تُضيئها تنير المدينة أكثر.'),
    'note': ('Captures du jeu : les entreprises, les clients et les messages sont fictifs.',
             'Game screenshots: the businesses, clients and messages are fictional.',
             'لقطات من اللعبة: الشركات والزبناء والرسائل وهمية.'),
    'tr_k': ('La bande-annonce', 'The trailer', 'الإعلان'),
    'tr_h1': ('Lago en 50 secondes,', 'Lago in 50 seconds,', 'Lago في 50 ثانية،'),
    'tr_h2': ('sous-titrée.', 'with subtitles.', 'مع ترجمة مكتوبة.'),
    'tr_alt': ('Bande-annonce : Lago, le D de Digilago, allume les entreprises du Maroc',
               'Trailer: Lago, the D of Digilago, lights up the businesses of Morocco',
               'الإعلان: Lago، حرف D في Digilago، يُضيء شركات المغرب'),
    'f_k': ('Comment on joue', 'How to play', 'كيف تلعب'),
    'f_h1': ('Une mission,', 'One mission,', 'مهمة واحدة،'),
    'f_h2': ('cinq étapes, comme chez nous.', 'five steps, just like at our place.', 'خمس مراحل، كما عندنا.'),
    'c_k': ('Les personnages', 'The characters', 'الشخصيات'),
    'c_h1': ('Une équipe,', 'A team,', 'فريق،'),
    'c_h2': ('et ceux qui la rejoignent.', 'and those who join it.', 'ومن ينضم إليه.'),
    'map_k': ('La carte', 'The map', 'الخريطة'),
    'map_h1': ('Casablanca d’abord,', 'Casablanca first,', 'الدار البيضاء أولاً،'),
    'map_h2': ('puis tout le Maroc.', 'then all of Morocco.', 'ثم المغرب كله.'),
    'map_p': ('Le Studio Digilago est à Casablanca : c’est là que tout commence, dans la médina puis dans le quartier '
              'd’affaires. Chaque ville arrive avec sa propre identité, ses métiers et ses entreprises.',
              'The Digilago Studio is in Casablanca: that is where it all begins, in the medina and then in the business '
              'district. Each city arrives with its own identity, its trades and its businesses.',
              'يوجد استوديو Digilago في الدار البيضاء: من هناك تبدأ القصة، في المدينة القديمة ثم في حي الأعمال. وكل مدينة '
              'تأتي بهويتها وأنشطتها وشركاتها.'),
    'map_alt': ('La carte du Maroc dans le jeu : Casablanca jouable, Rabat bientôt',
                'The map of Morocco in the game: Casablanca playable, Rabat coming soon',
                'خريطة المغرب في اللعبة: الدار البيضاء متاحة للعب، والرباط قريباً'),
    'r_h1': ('Nos règles,', 'Our rules,', 'قواعدنا،'),
    'r_h2': ('dans le jeu aussi.', 'in the game too.', 'في اللعبة أيضاً.'),
    'faq_h1': ('Ce qu’on nous demande', 'What people ask us', 'ما يسألنا عنه الناس'),
    'faq_h2': ('à propos de LAGO.', 'about LAGO.', 'عن LAGO.'),
}
LG['feats'] = [
    {'n': ('01 · Radar', '01 · Radar', '01 · الرادار'), 'kind': 'ph', 'img': 'lago-radar',
     'h': ('Radar repère une entreprise invisible.', 'Radar spots an invisible business.', 'الرادار يرصد شركة غير مرئية.'),
     'p': ('Le faisceau balaie la ville : touchez au bon moment pour trouver l’entreprise qui n’existe pas encore en '
           'ligne, et découvrir son problème.',
           'The beam sweeps the city: tap at the right moment to find the business that does not exist online yet, and '
           'discover its problem.',
           'يمسح الشعاع المدينة: المس في اللحظة المناسبة لتعثر على الشركة التي لا وجود لها بعد على الإنترنت، وتكتشف مشكلتها.'),
     'alt': ('Le radar du jeu : le faisceau passe sur une entreprise hors ligne', 'The game radar: the beam passes over an offline business',
             'رادار اللعبة: الشعاع يمر فوق شركة غير متصلة')},
    {'n': ('02 · Le métier', '02 · The trade', '02 · النشاط'), 'kind': 'ph', 'img': 'lago-metier',
     'h': ('Lago enfile la tenue du métier.', 'Lago puts on the trade’s outfit.', 'Lago يرتدي لباس النشاط.'),
     'p': ('Tablier de chef au café, blouse au cabinet, maillot au club de foot, costume au quartier d’affaires : pour '
           'bien faire un site, il faut comprendre le métier. Chaque entreprise a son mini-jeu.',
           'A chef’s apron at the café, a white coat at the clinic, a jersey at the football club, a suit in the business '
           'district: to make a good website, you have to understand the trade. Each business has its own mini-game.',
           'مئزر الطباخ في المقهى، والوزرة البيضاء في العيادة، والقميص في نادي كرة القدم، والبذلة في حي الأعمال: لصنع موقع '
           'جيد يجب فهم النشاط. ولكل شركة لعبتها الصغيرة.'),
     'facts': [('Le thé du café, l’agenda du cabinet, les tirs au but du club', 'The café’s tea, the clinic’s schedule, the club’s penalties',
                'شاي المقهى، ومواعيد العيادة، وضربات الجزاء في النادي')],
     'alt': ('Lago en tenue de chef sert le thé au Café de l’Horloge', 'Lago in a chef’s outfit pours tea at the Café de l’Horloge',
             'Lago بلباس الطباخ يصب الشاي في مقهى الساعة')},
    {'n': ('03 · Le devis', '03 · The quote', '03 · عرض السعر'), 'kind': 'ph', 'img': 'lago-devis',
     'h': ('Gestion écrit le prix avant de commencer.', 'Gestion writes the price before we start.', 'تطبيق التدبير يكتب الثمن قبل البدء.'),
     'p': ('Écoutez le client et choisissez exactement les services dont il a besoin : site, fiche Google, réservations, '
           'WhatsApp, présence dans les IA… Ni plus, ni moins.',
           'Listen to the client and choose exactly the services they need: website, Google profile, bookings, WhatsApp, '
           'presence in AI assistants… No more, no less.',
           'استمع إلى الزبون واختر بالضبط الخدمات التي يحتاجها: موقع، وملف Google، وحجوزات، وWhatsApp، وحضور في أدوات الذكاء '
           'الاصطناعي… لا أكثر ولا أقل.'),
     'alt': ('Le devis signé de Gestion, avec les services choisis', 'Gestion’s signed quote, with the chosen services',
             'عرض السعر الموقّع من تطبيق التدبير، مع الخدمات المختارة')},
    {'n': ('04 · 72 heures', '04 · 72 hours', '04 · 72 ساعة'), 'kind': 'ph', 'img': 'lago-chantier',
     'h': ('Le site se construit en 72 heures.', 'The website is built in 72 hours.', 'يُبنى الموقع في 72 ساعة.'),
     'p': ('Posez les blocs dans l’ordre, écrasez les bugs, et répondez au client qui écrit en plein chantier. Une réponse '
           'le jour même vaut une étoile.',
           'Place the blocks in order, squash the bugs, and answer the client who writes mid-build. A same-day reply earns '
           'a star.',
           'ضع الكتل بالترتيب، واسحق الأخطاء، وأجب الزبون الذي يكتب أثناء العمل. الرد في اليوم نفسه يساوي نجمة.'),
     'alt': ('Le chantier de 72 heures : les blocs du site, un bug et le message du client',
             'The 72-hour build: the website blocks, a bug and the client’s message',
             'ورش 72 ساعة: كتل الموقع وخطأ ورسالة الزبون')},
    {'n': ('05 · En ligne', '05 · Online', '05 · على الإنترنت'), 'kind': 'ph', 'img': 'lago-enligne',
     'h': ('L’entreprise s’allume.', 'The business lights up.', 'تُضاء الشركة.'),
     'p': ('Les fenêtres s’éclairent, la fiche Google apparaît, et trois étoiles récompensent les promesses tenues : le prix '
           'juste, le délai, la réponse. Puis on reste : mises à jour, messages, nouveaux partenaires.',
           'The windows light up, the Google profile appears, and three stars reward the promises kept: the fair price, '
           'the deadline, the reply. Then we stay: updates, messages, new partners.',
           'تُضاء النوافذ، ويظهر ملف Google، وتكافئ ثلاث نجوم الوعود المحفوظة: الثمن العادل، والمدة، والرد. ثم نبقى: '
           'تحديثات، ورسائل، وشركاء جدد.'),
     'alt': ('L’École Les Jasmins passe en ligne avec trois étoiles', 'École Les Jasmins goes online with three stars',
             'مدرسة الياسمين تصبح على الإنترنت بثلاث نجوم')},
]
LG['cast'] = [
    ('lago', ('Lago', 'Lago', 'Lago'), ('Le D de Digilago', 'The D of Digilago', 'حرف D في Digilago'),
     ('Il construit les sites, et change de tenue pour chaque métier.', 'He builds the websites, and changes outfit for every trade.',
      'يبني المواقع، ويغيّر لباسه مع كل نشاط.')),
    ('radar', RADAR, ('Le repérage', 'The scout', 'الرصد'),
     ('Il balaie la ville et trouve les entreprises invisibles en ligne.', 'He sweeps the city and finds the businesses invisible online.',
      'يمسح المدينة ويعثر على الشركات غير المرئية على الإنترنت.')),
    ('gestion', ('Gestion', 'Gestion', 'تطبيق التدبير'), ('Le prix écrit', 'The written price', 'الثمن المكتوب'),
     ('Rien ne commence sans un devis clair, accepté par le client.', 'Nothing starts without a clear quote, accepted by the client.',
      'لا شيء يبدأ دون عرض سعر واضح يقبله الزبون.')),
    ('cumulus', ('Cumulus', 'Cumulus', 'Cumulus'), ('L’hébergement', 'The hosting', 'الاستضافة'),
     ('Le nuage qui garde les sites allumés. Quand il pleut, une mise à jour attend.', 'The cloud that keeps websites lit. When it rains, an update is waiting.',
      'السحابة التي تُبقي المواقع مضاءة. وحين تمطر، ينتظر تحديث.')),
    ('youssef', ('Youssef', 'Youssef', 'يوسف'), ('Apporteur d’affaires', 'Referral partner', 'وسيط أعمال'),
     ('Il ouvre le quartier d’affaires, avec un accord écrit avant le premier contact.', 'He opens the business district, with an agreement written before the first contact.',
      'يفتح حي الأعمال، باتفاق مكتوب قبل أول تواصل.')),
    ('anas', ('Anas', 'Anas', 'أنس'), ('Stagiaire', 'Intern', 'متدرّب'),
     ('Recruté quand le travail s’accumule, il répond aux clients le jour même.', 'Hired when work piles up, he answers clients the same day.',
      'يُوظَّف حين يتراكم العمل، ويرد على الزبناء في اليوم نفسه.')),
]
LG['cities'] = [
    (('Casablanca', 'Casablanca', 'الدار البيضاء'), 'on', ('Jouable', 'Playable', 'متاحة للعب'),
     ('La médina, ses cinq commerces, puis le quartier d’affaires et ses grands comptes.',
      'The medina and its five shops, then the business district and its major accounts.',
      'المدينة القديمة ومتاجرها الخمسة، ثم حي الأعمال وكبار زبنائه.')),
    (('Rabat', 'Rabat', 'الرباط'), 'next', ('Prochaine mise à jour', 'Next update', 'التحديث المقبل'),
     ('Les Oudayas, la vallée du Bouregreg et les institutions.', 'The Oudayas, the Bouregreg valley and the institutions.',
      'الأوداية ووادي أبي رقراق والمؤسسات.')),
    (('Marrakech', 'Marrakech', 'مراكش'), 'wip', ('Bientôt', 'Coming soon', 'قريباً'),
     ('Les riads, les souks et le tourisme.', 'Riads, souks and tourism.', 'الرياضات والأسواق والسياحة.')),
    (('Fès', 'Fez', 'فاس'), 'wip', ('Bientôt', 'Coming soon', 'قريباً'),
     ('Les artisans de la médina et les écoles.', 'The medina’s artisans and its schools.', 'صناع المدينة العتيقة ومدارسها.')),
    (('Tanger', 'Tangier', 'طنجة'), 'wip', ('Bientôt', 'Coming soon', 'قريباً'),
     ('Le port, la logistique et le détroit.', 'The port, logistics and the strait.', 'الميناء واللوجستيك والمضيق.')),
]
LG['rules'] = [
    ('facts', ('Entreprises fictives', 'Fictional businesses', 'شركات وهمية'),
     ('Les entreprises, les clients et les messages du jeu sont inventés pour le jeu. Les métiers et les promesses, eux, sont vrais.',
      'The game’s businesses, clients and messages are made up for the game. The trades and the promises are real.',
      'الشركات والزبناء والرسائل في اللعبة مختلَقة لأجلها. أما الأنشطة والوعود فحقيقية.')),
    ('hidden', ('Aucune donnée collectée', 'No data collected', 'لا جمع للبيانات'),
     ('Pas de compte, pas de formulaire : la progression reste sur votre appareil, et le nom que vous tapez à la fin ne nous est pas envoyé.',
      'No account, no form: your progress stays on your device, and the name you type at the end is not sent to us.',
      'لا حساب ولا استمارة: يبقى تقدمك على جهازك، والاسم الذي تكتبه في النهاية لا يُرسَل إلينا.')),
    ('stop', ('Sans publicité', 'No ads', 'دون إعلانات'),
     ('Pas de publicité, pas d’achat dans le jeu, pas de compte à rebours pour vous retenir.',
      'No ads, no in-game purchases, no countdown to keep you hooked.', 'لا إعلانات، ولا مشتريات داخل اللعبة، ولا عدّاد لإبقائك.')),
    ('devices', ('Partout, tout de suite', 'Anywhere, right away', 'في كل مكان وفوراً'),
     ('Dans le navigateur, sur téléphone comme sur ordinateur, sans rien installer.',
      'In the browser, on phone or computer, with nothing to install.', 'في المتصفح، على الهاتف أو الحاسوب، دون تثبيت أي شيء.')),
]
LG['faq'] = [
    (('LAGO est-il vraiment gratuit ?', 'Is LAGO really free?', 'هل LAGO مجانية فعلاً؟'),
     ('Oui. Pas d’inscription, pas de publicité, pas d’achat dans le jeu. C’est un projet du Digilago Lab, offert à tous.',
      'Yes. No sign-up, no ads, no in-game purchases. It is a Digilago Lab project, open to everyone.',
      'نعم. لا تسجيل ولا إعلانات ولا مشتريات داخل اللعبة. إنها مشروع من مختبر Digilago، متاح للجميع.')),
    (('Sur quels appareils peut-on jouer ?', 'Which devices can I play on?', 'على أي أجهزة يمكن اللعب؟'),
     ('Sur tout téléphone, tablette ou ordinateur récent, directement dans le navigateur. Une version Google Play et App '
      'Store est en préparation.',
      'On any recent phone, tablet or computer, right in the browser. A Google Play and App Store version is in the works.',
      'على أي هاتف أو لوحة أو حاسوب حديث، مباشرة في المتصفح. ونسخة Google Play وApp Store قيد الإعداد.')),
    (('Ma progression est-elle sauvegardée ?', 'Is my progress saved?', 'هل يُحفظ تقدمي؟'),
     ('Oui, sur votre appareil, dans votre navigateur. Rien n’est envoyé à Digilago : si vous changez de téléphone, la '
      'partie recommence.',
      'Yes, on your device, in your browser. Nothing is sent to Digilago: if you change phones, the game starts over.',
      'نعم، على جهازك داخل متصفحك. لا يُرسَل أي شيء إلى Digilago: إذا غيّرت هاتفك، تبدأ اللعبة من جديد.')),
    (('Les entreprises du jeu existent-elles ?', 'Do the businesses in the game exist?', 'هل الشركات في اللعبة موجودة؟'),
     ('Non, elles sont fictives. Les métiers, eux, sont ceux que nous accompagnons tous les jours : écoles, cafés, '
      'cabinets médicaux, commerces, clubs de sport, hôtels, logistique.',
      'No, they are fictional. The trades, however, are the ones we work with every day: schools, cafés, medical '
      'practices, shops, sports clubs, hotels, logistics.',
      'لا، إنها وهمية. أما الأنشطة فهي التي نرافقها كل يوم: المدارس والمقاهي والعيادات والمتاجر والنوادي الرياضية '
      'والفنادق واللوجستيك.')),
    (('Pouvez-vous créer un jeu pour ma marque ?', 'Can you make a game for my brand?', 'هل يمكنكم صنع لعبة لعلامتي التجارية؟'),
     ('Oui. Un jeu court, à vos couleurs, qui raconte votre métier et se partage facilement : décrivez votre idée, vous '
      'recevez un prix écrit avant de commencer.',
      'Yes. A short game in your colours, telling the story of your trade and easy to share: describe your idea, and '
      'you get a written price before we start.',
      'نعم. لعبة قصيرة بألوانك، تحكي نشاطك ويسهل تداولها: صِف فكرتك، وتتوصل بثمن مكتوب قبل البدء.')),
]


def status_on():
    return '<span class="lab-st on"><i aria-hidden="true"></i>%s</span>' % T(S['live'])


def page_lago():
    P = LG
    play_ic = '<svg class="pl" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>'
    hero = ('<header class="lab-hero prj lago"><div class="lab-w"><div>%s<div class="lab-tagrow"><span class="lab-pmk">'
            + mark('lab') + '</span><span class="lab-code">%s</span>%s</div>'
            '<h1><span class="l"><span>%s</span></span><span class="l"><span><em>%s</em></span></span></h1>'
            '<p class="lab-lead">%s</p><div class="lab-btns"><a class="lab-btn" href="%s" data-play="hero">%s%s</a>'
            '<a class="lab-btn gh" href="#bande-annonce">%s</a></div>'
            '<ul class="lab-meta"><li>%s</li><li>%s</li><li>%s</li></ul></div>'
            '<figure class="lab-show"><a class="lago-shot" href="%s" data-play="image" aria-label="%s">%s</a>'
            '<a class="lago-phone" href="%s" data-play="phone" tabindex="-1" aria-hidden="true">%s<span class="lago-go">%s</span></a></figure></div></header>') % (
        crumbs([(S['home'], 'index.html'), (S['lab'], 'lab.html'), (LAGO, None)]), T(CODE[3]), status_on(),
        T(P['h1a']), T(P['h1b']), T(P['lead']), GAME_URL, T(P['play']), play_ic, T(P['trailer_btn']),
        T(P['m1']), T(P['m2']), T(P['m3']),
        GAME_URL, A(P['play']), browser('lago-rue', P['hero_alt'], P['label'], eager=True, sizes='(max-width: 760px) 92vw, 1184px'),
        GAME_URL, phone('lago-titre', P['hero_alt2'], sizes='(max-width: 760px) 34vw, 290px'), play_ic)
    why = ('<section class="lab-sec"><div class="lab-w"><div class="lab-intro"><div class="lab-head"><p class="lab-k rv">%s</p>'
           '<h2 class="rv d1">%s <em>%s</em></h2></div><p class="lab-p rv d2">%s</p></div></div></section>') % (
        T(P['why_k']), T(P['why_h1']), T(P['why_h2']), T(P['why_p']))
    trailer = ('<section class="lab-sec" id="bande-annonce"><div class="lab-w">%s<figure class="lago-video rv d1">'
               '<video controls playsinline preload="none" poster="assets/lab/lago-bande-annonce.jpg" width="1280" height="720" '
               'aria-label="%s"><source src="assets/lab/lago-bande-annonce.mp4" type="video/mp4"></video></figure></div></section>') % (
        head(P['tr_k'], P['tr_h1'], P['tr_h2']), A(P['tr_alt']))
    ft = '<section class="lab-sec" id="comment-jouer"><div class="lab-w">%s%s<p class="lab-note rv">%s%s</p></div></section>' % (
        head(P['f_k'], P['f_h1'], P['f_h2']), feats(P['feats']), svg('info'), T(P['note']))
    cast = ''.join(
        '<li class="rv d%d"><img src="assets/lab/lago-perso-%s.webp" width="480" height="480" alt="%s" loading="lazy" decoding="async">'
        '<b>%s</b><small>%s</small><p>%s</p></li>' % (i % 3 + 1, k, A(n), T(n), T(r), T(p))
        for i, (k, n, r, p) in enumerate(P['cast']))
    cs = '<section class="lab-sec" id="personnages"><div class="lab-w">%s<ul class="lago-cast">%s</ul></div></section>' % (
        head(P['c_k'], P['c_h1'], P['c_h2']), cast)
    cities = ''.join('<li class="%s"><span class="lago-city"><b>%s</b><em>%s</em></span><p>%s</p></li>' % (
        st, T(n), T(lab), T(p)) for n, st, lab, p in P['cities'])
    mp = ('<section class="lab-sec" id="carte"><div class="lab-w"><article class="lab-feat mob"><div class="lab-ft">%s'
          '<ul class="lago-cities rv d2">%s</ul></div><figure class="lab-fig rv d1">%s</figure></article></div></section>') % (
        head(P['map_k'], P['map_h1'], P['map_h2'], P['map_p']), cities, phone('lago-carte', P['map_alt']))
    rl = '<section class="lab-sec"><div class="lab-w">%s%s</div></section>' % (
        head(S['rules_k'], P['r_h1'], P['r_h2']), rules(P['rules'], 'four'))
    cta = ('<section class="lab-sec lago-cta"><div class="lab-w"><div class="lago-cta-in rv"><h2>%s <em>%s</em></h2>'
           '<a class="lab-btn" href="%s" data-play="bas">%s%s</a></div></div></section>') % (
        T(P['h1a']), T(P['h1b']), GAME_URL, T(P['play']), play_ic)
    fq = '<section class="lab-sec lab-faq" id="faq"><div class="lab-w">%s%s</div></section>' % (
        head(LAB['faq_k'], P['faq_h1'], P['faq_h2']), faq(P['faq']))

    def nlink(code, name, href, side, cls=''):
        small = T(S['all']) if href == 'lab.html' else T(tuple('%s · %s' % (a, b) for a, b in zip(S[side], code)))
        return '<a%s href="%s"><small>%s</small><b>%s</b></a>' % (cls, href, small, T(name))
    nb = ('<section class="lab-sec"><div class="lab-w"><nav class="lab-next" aria-label="%s">%s%s</nav></div></section>') % (
        A(S['lab_full']), nlink(CODE[2], GE['name'], 'lab-gestion.html', 'prev'), nlink(None, S['lab_full'], 'lab.html', 'next', ' class="r"'))
    body = hero + why + trailer + ft + cs + mp + rl + cta + fq + profit('lago') + nb
    return 'lago', P['title'], P['desc'], body


# ─── assemblage ──────────────────────────────────────────────────────────

def css(name='lab.src.css'):
    src = open(os.path.join(ROOT, 'src', 'css', name), encoding='utf-8').read()
    out = re.sub(r'(?<![\w.#-])(-?\d+(?:\.\d+)?)u\b', r'calc(\1 * var(--u))', src)
    out = re.sub(r'/\*.*?\*/', '', out, flags=re.S)
    out = re.sub(r'\s+', ' ', out)
    out = re.sub(r'\s*([{};,>])\s*', r'\1', out)
    return out.replace(';}', '}').strip()


def shell():
    h = open(os.path.join(SITE, 'services.html'), encoding='utf-8').read()
    a = h.index('<main class="pg light" id="main">')
    # le bandeau « On vous rappelle » du site n'est pas repris : chaque page du Lab a son propre appel, puis le pied de page
    b = h.index('</main>', h.index('<section class="blk"><div class="cband'))
    return h[:a], h[b:]


def lab_js():
    """src/js/lab.js (formulaires « Profiter d'un projet » et assistant), minifié comme les autres scripts du site."""
    import sys
    sys.path.insert(0, HERE)
    from inject import terser
    return terser(open(os.path.join(ROOT, 'src', 'js', 'lab.js'), encoding='utf-8').read()).replace('</script', '<\\/script')


def build(hd, tail, kind, title, desc, body, style, js):
    # l'assistant et le script, juste avant </body> : hors de <main>, dont la perspective piégerait la position fixe
    i = tail.rindex('</body>')
    tail = tail[:i] + bot(kind) + '<script id="lab-js">%s</script>' % js + tail[i:]
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % T(title), hd, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % A(desc), h, count=1)
    h = re.sub(r'<style id="(?:lab|lband)-css">.*?</style>', '', h, flags=re.S)
    h = h.replace('</head>', '<style id="lab-css">%s</style></head>' % style, 1)
    h = re.sub(r'<body(?: class="[^"]*")?>', '<body class="labpg">', h, count=1)
    return h + '<main class="pg dglab" id="main" data-lab="%s">%s' % (kind, body) + tail


def nav_links(h):
    """« Digilago Lab » dans le pied de page de toutes les pages (idempotent). Le Lab n'est pas dans le menu du haut
    ni dans le menu du téléphone : on l'en retire s'il y était (il a sa place en bas de Services, Secteurs, À propos)."""
    fl = h.find('<div class="fl">')
    if fl >= 0:
        end = h.find('</div>', fl)
        h = h[:fl] + h[fl:end].replace('<a href="lab.html">%s</a>' % T(S['lab']), '') + h[end:]
    m = re.search(r'<nav class="fsm-nav" aria-label="Pages">(.*?)</nav>', h, re.S)
    if m and 'href="lab.html"' in m.group(1):
        items = [it for it in re.findall(r'<a [^>]*href="[^"]+"[^>]*>.*?</a>', m.group(1), re.S) if 'href="lab.html"' not in it]
        fixed = []
        for i, it in enumerate(items):
            it = re.sub(r' style="--i:\d+"', '', it)
            it = it.replace('<a ', '<a style="--i:%d" ' % i, 1)
            it = re.sub(r'<small>\d+</small>', '<small>%02d</small>' % (i + 1), it, count=1)
            fixed.append(it)
        h = h[:m.start(1)] + ''.join(fixed) + h[m.end(1):]
    f = re.search(r'<nav class="f-col" aria-label="Navigation"><h6>Navigation</h6>(.*?)</nav>', h, re.S)
    if f and 'href="lab.html"' not in f.group(1):
        col = re.sub(r'(<a href="realisations\.html">.*?</a>)', lambda x: x.group(1) + '<a href="lab.html">%s</a>' % T(S['lab_full']),
                     f.group(1), count=1, flags=re.S)
        h = h[:f.start(1)] + col + h[f.end(1):]
    return h


# ─── l'encart « Digilago Lab » en bas de Services, Secteurs et À propos ─────────────────────────────

BAND = {
    'h1': ('Nous construisons aussi', 'We also build', 'نبني أيضاً'),
    'h2': ('nos propres applications.', 'our own apps.', 'تطبيقاتنا الخاصة.'),
    'p': ('Le Radar trouve nos futurs clients partout au Maroc. La Gestion fait tourner l’agence, de la demande à la '
          'livraison. Deux outils que nous utilisons chaque jour, et la preuve de ce que nous savons construire pour vous.',
          'The Radar finds our future clients all over Morocco. Gestion runs the agency, from request to delivery. Two '
          'tools we use every day, and proof of what we can build for you.',
          'الرادار يعثر على زبنائنا المقبلين في كل أنحاء المغرب. وتطبيق التدبير يُسيّر الوكالة من الطلب إلى التسليم. '
          'أداتان نستعملهما كل يوم، ودليل على ما نستطيع بناءه لك.'),
    'btn': ('Découvrir le Lab', 'Explore the Lab', 'اكتشف المختبر'),
}
BAND_PAGES = ('services.html', 'secteurs.html', 'a-propos.html')
BAND_START, BAND_END = '<!--dg:lband-->', '<!--/dg:lband-->'


def band():
    card = lambda href, im, code, name, tag, mk: (
        '<a class="lband-card" href="%s"><img src="assets/lab/%s-960.webp" width="960" height="600" alt="" loading="lazy" '
        'decoding="async"><small>%s%s</small><b>%s</b><span>%s</span></a>') % (href, im, mark(mk), T(code), T(name), T(tag))
    return (BAND_START + '<section class="blk lband-sec" id="lab"><div class="lband w rv">'
            '<div class="lband-txt"><p class="lband-k">' + mark('lab') + '%s</p><h2>%s <em>%s</em></h2><p>%s</p>'
            '<a class="lband-btn" href="lab.html">%s%s</a></div><div class="lband-cards">%s%s</div></div></section>' + BAND_END) % (
        T(S['lab_full']), T(BAND['h1']), T(BAND['h2']), T(BAND['p']), T(BAND['btn']), ARR.replace('<svg', '<svg class="ar"', 1),
        card('lab-radar.html', 'radar-carte', CODE[1], RADAR, LAB['radar_tag'], 'radar'),
        card('lab-gestion.html', 'gestion-tableau', CODE[2], GE['name'], LAB['gestion_tag'], 'gestion'))


def add_band(h, style):
    """Encart avant le bandeau « On vous rappelle » (ou en fin de page), et ses styles dans le <head> (idempotent)."""
    h = re.sub(re.escape(BAND_START) + '.*?' + re.escape(BAND_END), '', h, flags=re.S)
    h = re.sub(r'<style id="lband-css">.*?</style>', '', h, flags=re.S)
    i = h.find('<section class="blk"><div class="cband')
    if i < 0:
        i = h.index('</main>')
    h = h[:i] + band() + h[i:]
    return h.replace('</head>', '<style id="lband-css">%s</style></head>' % style, 1)


def main():
    hd, tail = shell()
    style, js = css('lab-marks.src.css') + css(), lab_js()
    pages = {'lab.html': page_lab(), 'lab-radar.html': page_radar(), 'lab-gestion.html': page_gestion(), 'lab-lago.html': page_lago()}
    for name, (kind, title, desc, body) in pages.items():
        open(os.path.join(SITE, name), 'w', encoding='utf-8').write(build(hd, tail, kind, title, desc, body, style, js))
    n, band_css = 0, css('lab-marks.src.css') + css('lab-band.src.css')
    for f in glob.glob(os.path.join(SITE, '*.html')):
        h = open(f, encoding='utf-8').read()
        k = nav_links(h)
        if os.path.basename(f) in BAND_PAGES:
            k = add_band(k, band_css)
        if k != h:
            open(f, 'w', encoding='utf-8').write(k)
            n += 1
    missing = [a for a in sorted(set(re.findall(r'assets/lab/[\w.-]+', ''.join(open(os.path.join(SITE, p), encoding='utf-8').read() for p in pages))))
               if not os.path.exists(os.path.join(SITE, a))]
    if missing:
        raise SystemExit('lab : images manquantes ' + ', '.join(missing))
    print('Lab : %d pages, pied de page et encarts mis à jour sur %d pages, %d traductions ajoutées' % (len(pages), n, save_tr()))


if __name__ == '__main__':
    main()
