"""Pages « Secteurs » : un secteur par fichier de src/secteurs/, chaque type d'entreprise trouvé (idempotent).

Fabrique, à partir des données de src/secteurs/*.py (vérifiées par tools/secteurs_check.py) :
- secteurs.html : tous les secteurs, avec une recherche « Trouvez votre activité » sur tous les métiers ;
- une page par secteur (secteur-…-maroc.html) : toutes ses activités à filtrer, la maquette d'un site à essayer,
  ce que nous faisons, Google, les IA, l'outil de gestion, la méthode, les villes, les questions ;
- une page par type d'entreprise recherché (site-web-…-maroc.html) : sa maquette, ses fonctions, ses recherches,
  ses questions, et les autres métiers du secteur.
Les autres types ont une carte « On le fait pour vous » (fenêtre avec le bouton Démarrer).

Le script range aussi les traductions anglaises et arabes dans src/i18n/en.json et ar.json (sans écraser une
traduction déjà relue), écrit src/css/secteurs.css, ajoute « Secteurs » au menu de toutes les pages et relie
chaque carte « Tous les métiers » de l'accueil à son secteur.

Usage : python3 tools/secteurs.py
"""
import glob, hashlib, html, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
SRC = os.path.join(ROOT, 'src', 'secteurs')
I18N = os.path.join(ROOT, 'src', 'i18n')
sys.path.insert(0, HERE)
from secteurs_icons import svg  # noqa: E402

ORDER = ['restauration', 'education', 'sante', 'hotellerie', 'commerce', 'industrie', 'conseil', 'immobilier', 'sport',
         'beaute', 'tourisme', 'btp', 'automobile', 'evenementiel', 'artisanat', 'transport', 'services', 'agriculture']
# carte « Tous les métiers » de l'accueil (data-m) → secteur
HOME = {'ecole': 'education', 'clinique': 'sante', 'restaurant': 'restauration', 'hotel': 'hotellerie',
        'commerce': 'commerce', 'industrie': 'industrie', 'juridique': 'conseil', 'immobilier': 'immobilier',
        'sport': 'sport', 'beaute': 'beaute', 'tourisme': 'tourisme', 'btp': 'btp'}
WA = 'https://wa.me/212649953813'

# ─── traductions ─────────────────────────────────────────────────────────

TR = {}


def T(x):
    """Un triplet (fr, en, ar) → le français échappé pour le HTML ; l'anglais et l'arabe sont retenus."""
    fr, en, ar = x
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=False)


def A(x):
    """Pareil, pour une valeur d'attribut."""
    fr, en, ar = x
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=True)


def sid(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


_OLD = {}


def OLD_TR(lang):
    if lang not in _OLD:
        _OLD[lang] = json.load(open(os.path.join(I18N, lang + '.json'), encoding='utf-8'))
    return _OLD[lang]


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


# ─── textes communs ─────────────────────────────────────────────────────

S = {
    'home': ('Accueil', 'Home', 'الرئيسية'),
    'secteurs': ('Secteurs', 'Industries', 'القطاعات'),
    'crumb': ('Fil d’Ariane', 'Breadcrumb', 'مسار التصفح'),
    'trend': ('Tendance', 'Trending', 'رائج'),
    'see': ('Voir la page', 'View the page', 'عرض الصفحة'),
    'forU': ('On le fait pour vous', 'We do it for you', 'ننجزه لك'),
    'all': ('Toutes', 'All', 'الكل'),
    'q_ph': ('Rechercher votre activité…', 'Search for your business…', 'ابحث عن نشاطك…'),
    'q_lbl': ('Rechercher votre activité', 'Search for your business', 'ابحث عن نشاطك'),
    'find_pill': ('Votre activité', 'Your business', 'نشاطك'),
    'find_1': ('Trouvez votre activité :', 'Find your business:', 'اعثر على نشاطك:'),
    'find_2': ('nous savons quoi faire pour elle.', 'we know exactly what it needs.', 'ونحن نعرف ما يحتاجه.'),
    'find_p': ('Choisissez votre métier : chaque page montre ce que nous faisons pour lui. Le vôtre n’est pas dans '
               'la liste ? Nous le faisons aussi.',
               'Pick your trade: each page shows what we do for it. Yours isn’t listed? We do it too.',
               'اختر نشاطك: تعرض كل صفحة ما ننجزه له. نشاطك ليس في القائمة؟ ننجزه أيضاً.'),
    'none': ('Pas encore dans la liste ? Nous le faisons aussi pour vous.',
             'Not on the list yet? We do it for you too.', 'ليس في القائمة بعد؟ ننجزه لك أيضاً.'),
    'start': ('Démarrer mon projet', 'Start my project', 'ابدأ مشروعي'),
    'wa': ('Écrire sur WhatsApp', 'Message us on WhatsApp', 'راسلنا على WhatsApp'),
    'close': ('Fermer', 'Close', 'إغلاق'),
    'dl_p': ('Site web, fiche Google, visibilité dans les IA et, si besoin, application de gestion : nous construisons '
             'ce dont votre activité a besoin. Prix écrit avant de commencer, première version en 72 h.',
             'Website, Google profile, AI visibility and, if needed, a management app: we build what your business '
             'needs. Price in writing before we start, first version in 72 hours.',
             'موقع إلكتروني وملف Google وظهور في أدوات الذكاء الاصطناعي، وتطبيق تدبير عند الحاجة: ننجز ما يحتاجه نشاطك. '
             'سعر مكتوب قبل البدء، والنسخة الأولى خلال 72 ساعة.'),
    'show_pill': ('Votre futur site', 'Your future website', 'موقعك المقبل'),
    'show_1': ('À quoi ressemblera', 'What will', 'كيف سيبدو'),
    'show_2': ('votre site ?', 'your website look like?', 'موقعك؟'),
    'show_p': ('Un exemple de design pour votre métier : élégant, rapide, pensé d’abord pour le téléphone.',
               'An example design for your trade: elegant, fast, designed phone-first.',
               'مثال لتصميم خاص بنشاطك: أنيق وسريع ومصمَّم للهاتف أولاً.'),
    'show_note': ('Exemple de design créé pour illustrer. Le vôtre sera unique, à vos couleurs et avec vos contenus.',
                  'Example design created for illustration. Yours will be unique, in your colors and with your content.',
                  'تصميم توضيحي. سيكون موقعك فريداً، بألوانك ومحتواك.'),
    'show_tabs': ('Choisir un exemple', 'Choose an example', 'اختر مثالاً'),
    'rating': ('4,9 · Google', '4.9 · Google', '4.9 · Google'),
    'do_pill': ('Ce que nous faisons', 'What we do', 'ما ننجزه'),
    'do_1': ('Tout ce qu’il faut', 'Everything you need', 'كل ما تحتاجه'),
    'do_2': ('pour être choisi en ligne.', 'to be chosen online.', 'لتُختار على الإنترنت.'),
    'do_p': ('Une seule équipe pour votre site, votre fiche Google, votre visibilité dans les IA et vos outils.',
             'One team for your website, Google profile, AI visibility and tools.',
             'فريق واحد لموقعك وملفك على Google وظهورك في أدوات الذكاء الاصطناعي وأدواتك.'),
    'g_pill': ('Sur Google', 'On Google', 'على Google'),
    'g_1': ('Quand on vous cherche,', 'When people search for you,', 'حين يبحث عنك الناس،'),
    'g_2': ('c’est vous qu’on trouve.', 'they find you.', 'يجدونك أنت.'),
    'g_p': ('Le référencement (SEO), c’est simple : écrire votre site avec les mots exacts que tapent vos clients, '
            'et soigner votre fiche Google. Quand quelqu’un cherche votre métier dans sa ville, il tombe sur vous, '
            'pas sur un concurrent.',
            'SEO is simple: write your website with the exact words your customers type, and polish your Google '
            'profile. When someone searches for your trade in their city, they land on you, not a competitor.',
            'تحسين الظهور في محركات البحث (SEO) أمر بسيط: نكتب موقعك بالكلمات نفسها التي يكتبها زبائنك، ونعتني بملفك على '
            'Google. وحين يبحث أحدهم عن نشاطك في مدينته، يجدك أنت لا منافسك.'),
    'g_say': ('Ce que tapent vos clients', 'What your customers type', 'ما يكتبه زبائنك'),
    'g_t1': ('Une page pour chaque service et chaque ville que vous servez', 'A page for every service and city you serve',
             'صفحة لكل خدمة ولكل مدينة تخدمها'),
    'g_t2': ('Une fiche Google complète : horaires, photos, avis, itinéraire',
             'A complete Google profile: hours, photos, reviews, directions',
             'ملف Google كامل: أوقات العمل والصور والتقييمات والاتجاهات'),
    'g_t3': ('Un site rapide sur téléphone, celui que Google préfère', 'A site that’s fast on phones, the kind Google prefers',
             'موقع سريع على الهاتف، كما يفضّله Google'),
    'g_you': ('Votre établissement', 'Your business', 'مؤسستك'),
    'g_rev': ('(128 avis)', '(128 reviews)', '(128 تقييماً)'),
    'g_open': ('Ouvert', 'Open', 'مفتوح'),
    'g_all': ('Tous', 'All', 'الكل'),
    'g_maps': ('Maps', 'Maps', 'الخرائط'),
    'g_img': ('Images', 'Images', 'الصور'),
    'g_site': ('votre-marque.ma', 'your-brand.ma', 'your-brand.ma'),
    'g_snip': ('Horaires, services, avis clients et rendez-vous en ligne. Partout au Maroc.',
               'Hours, services, customer reviews and online booking. Anywhere in Morocco.',
               'أوقات العمل والخدمات وآراء الزبائن والمواعيد عبر الإنترنت. في جميع أنحاء المغرب.'),
    'ai_pill': ('Dans les IA', 'In AI assistants', 'في أدوات الذكاء الاصطناعي'),
    'ai_1': ('Quand on demande à ChatGPT,', 'When people ask ChatGPT,', 'حين يسأل الناس ChatGPT،'),
    'ai_2': ('c’est vous qu’il cite.', 'it names you.', 'يذكرك أنت.'),
    'ai_p': ('De plus en plus de clients posent leurs questions à ChatGPT, Gemini ou Perplexity au lieu de chercher sur '
             'Google. Ces assistants citent les entreprises dont les informations sont claires, complètes et à jour. '
             'C’est le GEO : nous écrivons votre site pour qu’ils le comprennent et le recommandent.',
             'More and more customers ask ChatGPT, Gemini or Perplexity instead of searching Google. These assistants '
             'mention businesses whose information is clear, complete and up to date. That’s GEO: we write your site '
             'so they understand it and recommend it.',
             'يطرح عدد متزايد من الزبائن أسئلتهم على ChatGPT أو Gemini أو Perplexity بدل البحث في Google. وهذه الأدوات '
             'تذكر المؤسسات التي تكون معلوماتها واضحة وكاملة ومحدَّثة. هذا هو GEO: نكتب موقعك لتفهمه هذه الأدوات وتوصي به.'),
    'ai_t1': ('Des réponses claires aux questions de vos clients', 'Clear answers to your customers’ questions',
              'أجوبة واضحة عن أسئلة زبائنك'),
    'ai_t2': ('Des données structurées que les IA savent lire', 'Structured data AI assistants can read',
              'بيانات منظَّمة تعرف أدوات الذكاء الاصطناعي قراءتها'),
    'ai_t3': ('Des informations identiques partout : site, Google, réseaux', 'The same information everywhere: site, Google, social media',
              'المعلومات نفسها في كل مكان: الموقع وGoogle وشبكات التواصل'),
    'ai_honest': ('Personne ne peut garantir une recommandation, mais un site clair et complet met toutes les chances de votre côté.',
                  'Nobody can guarantee a recommendation, but a clear, complete website puts the odds in your favor.',
                  'لا أحد يستطيع ضمان التوصية، لكن الموقع الواضح والكامل يضع كل الحظوظ في صفك.'),
    'ai_say': ('Ce qu’on leur demande', 'What people ask them', 'ما يُسألون عنه'),
    'ai_top': ('Assistant IA', 'AI assistant', 'مساعد ذكي'),
    'ai_a': ('Plusieurs adresses correspondent. Celle-ci revient souvent :', 'Several places match. This one comes up often:',
             'تتوافق عدة عناوين مع طلبك. وهذا العنوان يتكرّر كثيراً:'),
    'ai_why': ('Avis excellents · infos claires · réservation en ligne', 'Excellent reviews · clear info · online booking',
               'تقييمات ممتازة · معلومات واضحة · حجز عبر الإنترنت'),
    'ai_src': ('Sources', 'Sources', 'المصادر'),
    'app_pill': ('Outils de gestion', 'Management tools', 'أدوات التدبير'),
    'app_1': ('Besoin d’une app de gestion ?', 'Need a management app?', 'تحتاج إلى تطبيق للتدبير؟'),
    'app_2': ('Nous sommes votre partenaire.', 'We’re your partner.', 'نحن شريكك.'),
    'app_p': ('Au-delà du site, nous construisons l’outil qui simplifie votre quotidien : pensé pour votre métier, '
              'sur ordinateur et sur téléphone, relié à votre site.',
              'Beyond the website, we build the tool that makes your day-to-day simpler: designed for your trade, on '
              'desktop and phone, connected to your site.',
              'إلى جانب الموقع، نصمّم الأداة التي تبسّط يومك: مصمَّمة لنشاطك، على الحاسوب والهاتف، ومتصلة بموقعك.'),
    'app_m': ('Quelques modules possibles', 'A few possible modules', 'بعض الوحدات الممكنة'),
    'app_dash': ('Tableau de bord', 'Dashboard', 'لوحة القيادة'),
    'app_t1': ('Sur mesure, à votre façon de travailler', 'Custom-built, around how you work', 'على المقاس، حسب طريقة عملك'),
    'app_t2': ('Relié à votre site et à WhatsApp', 'Connected to your site and WhatsApp', 'متصل بموقعك وبـWhatsApp'),
    'app_t3': ('Votre équipe formée, nous restons là', 'Your team trained, and we stay on hand', 'فريقك مكوَّن، ونبقى إلى جانبك'),
    'ft_pill': ('Les fonctions utiles', 'Useful features', 'الوظائف المفيدة'),
    'ft_1': ('Ce dont votre activité', 'What your business', 'ما يحتاجه نشاطك'),
    'ft_2': ('a vraiment besoin.', 'really needs.', 'فعلاً.'),
    'ft_p': ('Pas de gadgets : les fonctions qui font venir vos clients et vous font gagner du temps.',
             'No gimmicks: the features that bring customers in and save you time.',
             'لا أدوات زائدة: فقط الوظائف التي تجلب زبائنك وتوفّر وقتك.'),
    'city_pill': ('Partout au Maroc', 'All over Morocco', 'في جميع أنحاء المغرب'),
    'city_1': ('Nous nous déplaçons,', 'We come to you,', 'نتنقّل إليك،'),
    'city_2': ('et tout se fait aussi en ligne.', 'and everything also works online.', 'ويمكن إنجاز كل شيء عبر الإنترنت.'),
    'city_p': ('Où que soit votre entreprise, nous travaillons avec vous : sur place quand c’est utile, en visio et sur '
               'WhatsApp le reste du temps, 24 h/24 en ligne.',
               'Wherever your business is, we work with you: on site when it helps, by video call and WhatsApp the rest '
               'of the time, online 24/7.',
               'أينما كانت مؤسستك، نعمل معك: في عين المكان حين يكون ذلك مفيداً، وعبر الاتصال المرئي وWhatsApp في باقي '
               'الأوقات، وعلى الإنترنت على مدار الساعة.'),
    'faq_pill': ('Questions', 'Questions', 'أسئلة'),
    'faq_1': ('Vous vous demandez', 'You’re probably', 'لعلك تتساءل'),
    'faq_2': ('sûrement ceci.', 'wondering about this.', 'عن هذا.'),
    'rel_pill': ('Dans le même secteur', 'In the same sector', 'في القطاع نفسه'),
    'rel_1': ('D’autres activités,', 'Other businesses,', 'أنشطة أخرى،'),
    'rel_2': ('le même soin.', 'the same care.', 'والعناية نفسها.'),
    'rel_all': ('Toutes les activités du secteur', 'Every business in this sector', 'كل أنشطة القطاع'),
    'gd_pill': ('Guides', 'Guides', 'أدلّة'),
    'gd_1': ('Pour aller plus loin,', 'To go further,', 'للتعمّق أكثر،'),
    'gd_2': ('nos guides pratiques.', 'our practical guides.', 'أدلتنا العملية.'),
    'gd_k': ('Guide', 'Guide', 'دليل'),
    'hub_title': ('Secteurs : un site web pour chaque métier au Maroc | Digilago',
                  'Industries: a website for every business in Morocco | Digilago',
                  'القطاعات: موقع إلكتروني لكل نشاط في المغرب | Digilago'),
    'hub_desc': ('Restaurants, écoles, cliniques, commerces, industrie, immobilier, tourisme… Trouvez votre activité '
                 'parmi plus de 500 métiers : site web, fiche Google et visibilité dans les IA, partout au Maroc.',
                 'Restaurants, schools, clinics, shops, industry, real estate, tourism… Find your business among more than '
                 '500 trades: website, Google profile and AI visibility, anywhere in Morocco.',
                 'مطاعم ومدارس وعيادات ومتاجر وصناعة وعقار وسياحة… اعثر على نشاطك بين أكثر من 500 نشاط: موقع إلكتروني '
                 'وملف Google وظهور في أدوات الذكاء الاصطناعي، في جميع أنحاء المغرب.'),
    'hub_eb': ('Secteurs', 'Industries', 'القطاعات'),
    'hub_1': ('Votre métier,', 'Your trade,', 'نشاطك،'),
    'hub_2': ('notre spécialité.', 'our specialty.', 'تخصّصنا.'),
    'hub_lead': ('Plus de 500 activités, dans 18 secteurs : tapez votre métier et découvrez ce que nous faisons pour '
                 'lui, du site web à la fiche Google et aux assistants IA.',
                 'More than 500 businesses across 18 sectors: type your trade and see what we do for it, from the '
                 'website to your Google profile and AI assistants.',
                 'أكثر من 500 نشاط في 18 قطاعاً: اكتب نشاطك واكتشف ما ننجزه له، من الموقع الإلكتروني إلى ملف Google '
                 'وأدوات الذكاء الاصطناعي.'),
    'hub_q': ('Ex. : coffee shop, dentiste, usine, riad…', 'E.g. coffee shop, dentist, factory, riad…',
              'مثال: كوفي شوب، طبيب أسنان، مصنع، رياض…'),
    'hub_none': ('Votre activité n’est pas listée ? Nous la faisons aussi', 'Business not listed? We do it too',
                 'نشاطك غير مدرج؟ ننجزه أيضاً'),
    'hub_pill': ('Tous les secteurs', 'All sectors', 'كل القطاعات'),
    'hub_s1': ('Chaque entreprise', 'Every business', 'كل مؤسسة'),
    'hub_s2': ('mérite d’être trouvée.', 'deserves to be found.', 'تستحق أن تُوجد.'),
    'hub_sp': ('Choisissez votre secteur : toutes ses activités, des plus connues aux plus nouvelles.',
               'Choose your sector: every business in it, from the best known to the newest.',
               'اختر قطاعك: كل أنشطته، من الأكثر شهرة إلى الأحدث.'),
    'hub_go': ('Voir les activités', 'See the businesses', 'عرض الأنشطة'),
    'hub_pages': ('Pages des secteurs', 'Sector pages', 'صفحات القطاعات'),
    'mt_all': ('Tous les secteurs et métiers', 'All sectors and trades', 'كل القطاعات والأنشطة'),
    'home_go': ('Voir les activités', 'See the businesses', 'عرض الأنشطة'),
    'sec_title_suffix': ('Secteur', 'Sector', 'القطاع'),
}
# Ce que nous faisons (8 blocs ; le premier est large, avec les trois écrans)
DO = [
    ('laptop', ('Un site web sur mesure', 'A custom website', 'موقع إلكتروني على المقاس'),
     ('Rapide, élégant, parfait sur téléphone, tablette et ordinateur, en français, en arabe et en anglais.',
      'Fast, elegant, perfect on phone, tablet and desktop, in French, Arabic and English.',
      'سريع وأنيق ومثالي على الهاتف واللوحة والحاسوب، بالفرنسية والعربية والإنجليزية.')),
    ('pin', ('Votre fiche Google Maps', 'Your Google Maps profile', 'ملفك على خرائط Google'),
     ('Horaires, photos, avis, itinéraire : vous apparaissez quand on cherche près de chez soi.',
      'Hours, photos, reviews, directions: you show up when people search nearby.',
      'أوقات العمل والصور والتقييمات والاتجاهات: تظهر حين يبحث الناس بالقرب منهم.')),
    ('search', ('Le référencement SEO', 'SEO', 'تحسين الظهور في محركات البحث'),
     ('Des pages écrites sur les recherches réelles de vos clients, avec votre ville et votre quartier.',
      'Pages written around your customers’ real searches, with your city and neighborhood.',
      'صفحات مكتوبة انطلاقاً من عمليات البحث الحقيقية لزبائنك، مع مدينتك وحيّك.')),
    ('sparkle', ('La visibilité dans les IA', 'Visibility in AI assistants', 'الظهور في أدوات الذكاء الاصطناعي'),
     ('Des informations claires que ChatGPT, Gemini et Perplexity savent lire et recommander.',
      'Clear information that ChatGPT, Gemini and Perplexity can read and recommend.',
      'معلومات واضحة يعرف ChatGPT وGemini وPerplexity قراءتها والتوصية بها.')),
    ('calendar', ('Réservations, commandes, devis', 'Bookings, orders, quotes', 'الحجوزات والطلبات وعروض الأسعار'),
     ('Le bon formulaire pour votre métier : les demandes arrivent sur WhatsApp, prêtes à traiter.',
      'The right form for your trade: requests arrive on WhatsApp, ready to handle.',
      'الاستمارة المناسبة لنشاطك: تصلك الطلبات عبر WhatsApp جاهزة للمعالجة.')),
    ('card', ('Le paiement en ligne', 'Online payment', 'الدفع عبر الإنترنت'),
     ('Acomptes, commandes et cartes cadeaux payés en ligne, avec une solution marocaine.',
      'Deposits, orders and gift cards paid online, with a Moroccan payment provider.',
      'العربون والطلبات وبطاقات الهدايا تُدفع عبر الإنترنت، بحل دفع مغربي.')),
    ('palette', ('Logo et identité', 'Logo and identity', 'الشعار والهوية'),
     ('Une image cohérente et reconnaissable, du site aux réseaux sociaux.',
      'A consistent, recognizable image, from your website to social media.',
      'صورة منسجمة ومميّزة، من الموقع إلى شبكات التواصل.')),
    ('layers', ('Une app de gestion', 'A management app', 'تطبيق للتدبير'),
     ('Un outil sur mesure pour vos rendez-vous, vos stocks ou vos clients, si vous en avez besoin.',
      'A custom tool for your appointments, stock or customers, if you need one.',
      'أداة على المقاس لمواعيدك أو مخزونك أو زبائنك، إن احتجت إليها.')),
]
CITIES = [('Casablanca', 'Casablanca', 'الدار البيضاء'), ('Rabat', 'Rabat', 'الرباط'), ('Marrakech', 'Marrakech', 'مراكش'),
          ('Tanger', 'Tangier', 'طنجة'), ('Fès', 'Fez', 'فاس'), ('Agadir', 'Agadir', 'أكادير'), ('Meknès', 'Meknes', 'مكناس'),
          ('Oujda', 'Oujda', 'وجدة'), ('Kénitra', 'Kenitra', 'القنيطرة'), ('Tétouan', 'Tetouan', 'تطوان'),
          ('Salé', 'Salé', 'سلا'), ('Témara', 'Temara', 'تمارة'), ('Mohammedia', 'Mohammedia', 'المحمدية'),
          ('Safi', 'Safi', 'آسفي'), ('Béni Mellal', 'Beni Mellal', 'بني ملال'), ('Nador', 'Nador', 'الناظور'),
          ('Khouribga', 'Khouribga', 'خريبكة'), ('Settat', 'Settat', 'سطات'), ('Berrechid', 'Berrechid', 'برشيد'),
          ('Larache', 'Larache', 'العرائش'), ('Taza', 'Taza', 'تازة'), ('Errachidia', 'Errachidia', 'الرشيدية'),
          ('Ouarzazate', 'Ouarzazate', 'ورزازات'), ('Essaouira', 'Essaouira', 'الصويرة'), ('Laâyoune', 'Laayoune', 'العيون'),
          ('Dakhla', 'Dakhla', 'الداخلة'), ('Guelmim', 'Guelmim', 'كلميم'), ('Tiznit', 'Tiznit', 'تيزنيت'),
          ('Taroudant', 'Taroudant', 'تارودانت'), ('Al Hoceïma', 'Al Hoceima', 'الحسيمة'), ('Ifrane', 'Ifrane', 'إفران'),
          ('Chefchaouen', 'Chefchaouen', 'شفشاون'), ('Bouskoura', 'Bouskoura', 'بوسكورة'), ('Benslimane', 'Benslimane', 'بنسليمان')]
HUB_FAQ = [
    (('Mon métier n’est pas dans la liste : pouvez-vous quand même m’aider ?',
      'My trade isn’t listed. Can you still help?', 'نشاطي غير مدرج في القائمة: هل يمكنكم مساعدتي رغم ذلك؟'),
     ('Oui. Les pages montrent les métiers les plus courants, mais nous travaillons pour toute entreprise : '
      'décrivez-nous votre activité, nous vous proposons ce qui lui convient, avec un prix écrit.',
      'Yes. These pages show the most common trades, but we work with any business: tell us what you do and we’ll '
      'suggest what fits, with a written price.',
      'نعم. تعرض هذه الصفحات الأنشطة الأكثر شيوعاً، لكننا نعمل مع كل مؤسسة: صف لنا نشاطك ونقترح عليك ما يناسبه، بسعر مكتوب.')),
    (('Combien coûte un site web pour mon activité ?', 'How much does a website for my business cost?',
      'كم يكلّف موقع إلكتروني لنشاطي؟'),
     ('Cela dépend de ce dont vous avez besoin : site vitrine, réservation, boutique ou application. Le prix est '
      'toujours écrit avant de commencer, et vous ne payez rien si la première version, livrée en 72 h, ne vous plaît pas.',
      'It depends on what you need: a showcase site, bookings, an online shop or an app. The price is always written '
      'down before we start, and you pay nothing if the first version, delivered in 72 hours, doesn’t suit you.',
      'يتوقف ذلك على ما تحتاجه: موقع تعريفي أو حجز أو متجر أو تطبيق. يُحدَّد السعر كتابياً قبل البدء دائماً، ولا تدفع '
      'شيئاً إن لم تعجبك النسخة الأولى التي تصلك خلال 72 ساعة.')),
    (('Travaillez-vous partout au Maroc ?', 'Do you work all over Morocco?', 'هل تعملون في جميع أنحاء المغرب؟'),
     ('Oui : nous nous déplaçons quand c’est utile, et tout peut aussi se faire en ligne, sur WhatsApp et en visio.',
      'Yes: we travel when it helps, and everything can also be done online, on WhatsApp and by video call.',
      'نعم: نتنقّل حين يكون ذلك مفيداً، ويمكن أيضاً إنجاز كل شيء عبر الإنترنت، على WhatsApp وبالاتصال المرئي.')),
    (('Qu’est-ce que la visibilité dans les IA ?', 'What is visibility in AI assistants?',
      'ما المقصود بالظهور في أدوات الذكاء الاصطناعي؟'),
     ('Beaucoup de clients demandent désormais conseil à ChatGPT, Gemini ou Perplexity. Nous écrivons votre site et '
      'vos informations pour que ces assistants les comprennent et puissent vous citer.',
      'Many customers now ask ChatGPT, Gemini or Perplexity for advice. We write your website and information so '
      'these assistants understand them and can mention you.',
      'يطلب كثير من الزبائن اليوم النصيحة من ChatGPT أو Gemini أو Perplexity. نكتب موقعك ومعلوماتك لتفهمها هذه '
      'الأدوات وتتمكّن من ذكرك.')),
]
# zellige : un motif d'étoiles à huit branches, discret, en fond des maquettes et des cartes de secteur
def zellige(pid):
    star = 'M12 2l2.6 3.4 4.2-.6-.6 4.2L21.6 12l-3.4 2.6.6 4.2-4.2-.6L12 21.6l-2.6-3.4-4.2.6.6-4.2L2.4 12l3.4-2.6-.6-4.2 4.2.6z'
    return ('<svg class="mk-z" aria-hidden="true" focusable="false"><defs><pattern id="%s" width="48" height="48" '
            'patternUnits="userSpaceOnUse"><path d="%s" transform="translate(12 12)" fill="none" stroke="currentColor" '
            'stroke-width="1.2"/><path d="M0 24h12M36 24h12M24 0v12M24 36v12" stroke="currentColor" stroke-width="1.2"/>'
            '</pattern></defs><rect width="100%%" height="100%%" fill="url(#%s)"/></svg>') % (pid, star, pid)


ARR = ('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" '
       'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>')
CHECK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')
WAI = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 '
       '12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4'
       'l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 '
       '3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>')
PIN = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z" '
       'stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="#fff" stroke="none"/></svg>')


def load(name):
    spec = importlib.util.spec_from_file_location('secteur_' + name, os.path.join(SRC, name + '.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def kw(*xs):
    """Mots-clés de recherche (français, anglais, arabe), sans répétition."""
    seen, out = set(), []
    for x in xs:
        for w in (x if isinstance(x, str) else ' '.join(x)).replace('·', ' ').split():
            lw = w.lower().strip('«»:,.;()')
            if lw and lw not in seen:
                seen.add(lw)
                out.append(lw)
    return html.escape(' '.join(out), quote=True)


def ink_on(hexcol):
    r, g, b = (int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    L = .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b)
    return '#FFFFFF' if (1.05 / (L + .05)) >= ((L + .05) / .05) * .78 else '#111111'


def head_sh(pill, l1, l2, p=None, dark=False, cls=''):
    return ('<div class="sh%s%s"><span class="pill rv"><span class="ic"></span>%s</span><h2 class="rv d1"><span class="l">'
            '<span class="li">%s</span></span><span class="l"><span class="li grad">%s</span></span></h2>%s</div>') % (
        ' dark' if dark else '', (' ' + cls) if cls else '', T(pill), T(l1), T(l2), ('<p class="rv d2">%s</p>' % T(p)) if p else '')


# ─── la page de base (Services) : en-tête, ciel, bandeau d'appel et pied de page ───────────────────

class Base:
    def __init__(self):
        h = open(os.path.join(SITE, 'services.html'), encoding='utf-8').read()
        self.h = h
        a = h.index('<main class="pg light" id="main">')
        self.head = h[:a]
        hs = h.index('<header class="phero">', a)
        sky_end = h.index('<div class="skyfade" aria-hidden="true"></div>', hs) + len('<div class="skyfade" aria-hidden="true"></div>')
        self.sky = h[hs + len('<header class="phero">'):sky_end]
        self.hcta = re.search(r'<div class="hcta in2">.*?</div>', h[hs:], re.S).group(0)
        self.trust = re.search(r'<ul class="trust in2">.*?</ul>', h[hs:], re.S).group(0)
        b = h.index('<section class="blk"><div class="cband')
        self.tail = h[b:]
        self.incl = self.section(h, '<section class="blk dk"><div class="sh dark"><span class="pill rv"><span class="ic"></span>Inclus')
        self.steps = self.section(h, '<section class="blk" id="methode">')
        self.price = self.section(h, '<section class="blk"><div class="sh"><span class="pill rv"><span class="ic"></span>Tarifs')

    @staticmethod
    def section(h, start):
        i = h.index(start)
        depth = 0
        for m in re.finditer(r'<(/?)section\b', h[i:]):
            depth += -1 if m.group(1) else 1
            if depth == 0:
                return h[i:h.index('>', i + m.start()) + 1]
        raise ValueError(start)

    def page(self, kind, title, desc, hero, body):
        hd = re.sub(r'<title>.*?</title>', '<title>%s</title>' % T(title), self.head, count=1, flags=re.S)
        hd = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % A(desc), hd, count=1)
        main = '<main class="pg light vz-page" id="main" data-vz="%s"><header class="phero">%s%s</header>' % (kind, self.sky, hero)
        return hd + main + body + self.tail

    def cta(self, met):
        c = self.hcta.replace('<a href="demarrer.html" class="cta mono">', '<a href="demarrer.html" class="cta mono" data-met="%s">' % A(met), 1)
        return c


# ─── blocs ─────────────────────────────────────────────────────────────

def crumbs(items):
    out = []
    for i, (label, href) in enumerate(items):
        if href:
            out.append('<a href="%s">%s</a>' % (href, T(label)))
        else:
            out.append('<span aria-current="page">%s</span>' % T(label))
    return '<nav class="vz-crumb in" aria-label="%s">%s</nav>' % (A(S['crumb']), '<i aria-hidden="true">/</i>'.join(out))


def hero(base, crumb, eyebrow, h1, lead, met, anchors=None, extra=''):
    anc = ''
    if anchors:
        anc = '<nav class="anchors in2" aria-label="%s">%s</nav>' % (
            A(('Sur cette page', 'On this page', 'في هذه الصفحة')),
            ''.join('<a href="#%s"><span>%02d</span>%s</a>' % (i, n + 1, T(lbl)) for n, (i, lbl) in enumerate(anchors)))
    return ('%s<p class="eyebrow in"><i class="live" aria-hidden="true"></i><span>%s</span></p><h1 class="hin"><span class="l">'
            '<span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span></h1><p class="lead in2 hin">%s</p>'
            '%s%s%s%s') % (crumb, T(eyebrow), T(h1[0]), T(h1[1]), T(lead), extra, base.cta(met), base.trust, anc)


def sband(cities):
    def row(cls, d, items):
        return '<div class="row" data-d="%d">%s</div>' % (d, ''.join(
            '<span class="%s">%s</span><span class="s">✦</span>' % (cls(i), T(c)) for i, c in enumerate(items)))
    a = cities[:12] * 2
    b = list(reversed(cities[12:24])) * 2
    return '<div class="sband" aria-hidden="true">%s%s</div>' % (row(lambda i: 'it' if i % 2 else '', -1, a), row(lambda i: 'o', 1, b))


def card_type(t):
    return ('<a class="vz-card rv" id="t-%s" href="%s" data-g="%s" data-k="%s"><span class="vz-ic">%s</span>%s<b>%s</b>'
            '<span class="vz-d">%s</span><span class="vz-go">%s%s</span></a>') % (
        t['id'], t['file'], t['group'], kw(t['k'], t['name']), svg(t['icon']),
        ('<span class="vz-new">%s</span>' % T(S['trend'])) if t.get('trend') else '', T(t['name']), T(t['short']), T(S['see']), ARR)


def card_more(c):
    tags = '<span class="vz-tags">%s</span>' % ''.join('<i>%s</i>' % T(x) for x in c['tags'])
    new = ('<span class="vz-new">%s</span>' % T(S['trend'])) if c.get('trend') else ''
    if c.get('href'):
        return ('<a class="vz-card rv" id="t-%s" href="%s" data-g="%s" data-k="%s"><span class="vz-ic">%s</span>%s<b>%s</b>'
                '<span class="vz-d">%s</span><span class="vz-go">%s%s</span></a>') % (
            c['id'], c['href'], c['group'], kw(c['k'], c['name']), svg(c['icon']), new, T(c['name']), T(c['short']), T(S['see']), ARR)
    return ('<button type="button" class="vz-card vz-c rv" id="t-%s" data-g="%s" data-k="%s" data-met="%s"><span class="vz-ic">%s</span>%s'
            '<b>%s</b><span class="vz-d">%s</span><span class="vz-more">%s</span><span class="vz-go">%s%s</span></button>') % (
        c['id'], c['group'], kw(c['k'], c['name']), A(c['name']), svg(c['icon']), new, T(c['name']), T(c['short']), tags, T(S['forU']), ARR)


def dialog():
    x = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
         '<path d="M6 6l12 12M18 6 6 18"/></svg>')
    return ('<dialog class="vz-dlg" id="vzDlg" aria-labelledby="vzDlgT"><div class="vz-dl-top"><button type="button" class="vz-dl-x" '
            'aria-label="%s">%s</button><span class="vz-ic"></span><span class="vz-dl-k">%s</span><b class="vz-dl-t" id="vzDlgT"></b></div>'
            '<div class="vz-dl-b"><p class="vz-dl-d"></p><span class="vz-tags vz-dl-tags"></span><p class="vz-dl-p">%s</p>'
            '<div class="vz-dl-a"><a class="vz-btn vz-dl-go" href="demarrer.html">%s%s</a><a class="vz-btn wa" href="%s" target="_blank" '
            'rel="noopener noreferrer">%sWhatsApp</a></div></div></dialog>') % (
        A(S['close']), x, T(S['forU']), T(S['dl_p']), T(S['start']), ARR, WA, WAI)


def find(sec, types, cards):
    groups = sec['groups']
    chips = '<button type="button" class="vz-chip" data-g="" aria-pressed="true">%s</button>' % T(S['all']) + ''.join(
        '<button type="button" class="vz-chip" data-g="%s" aria-pressed="false">%s</button>' % (g, T(n)) for g, n in groups)
    items = []
    for g, _ in groups:  # par famille : d'abord les pages, puis les cartes
        items += [card_type(t) for t in types if t['group'] == g]
        items += [card_more(c) for c in cards if c['group'] == g]
    return ('<section class="blk vz-find" id="activites">%s<div class="vz-tools w rv"><label class="vz-q">%s<input type="search" '
            'placeholder="%s" aria-label="%s" autocomplete="off"></label><div class="vz-chips">%s</div></div><div class="vz-grid w">%s</div>'
            '<div class="vz-none w" hidden><p>%s</p><a class="vz-btn" href="demarrer.html" data-met="%s">%s%s</a></div>%s</section>') % (
        head_sh(S['find_pill'], S['find_1'], S['find_2'], S['find_p']), svg('search'), A(S['q_ph']), A(S['q_lbl']), chips,
        ''.join(items), T(S['none']), A(sec['met']), T(S['start']), ARR, dialog())


def mock(t, on=False):
    mk = t['mk']
    bg, fg, ac, a2 = mk['pal']
    style = '--mb:%s;--mf:%s;--ma:%s;--m2:%s;--mc:%s' % (bg, fg, ac, a2, ink_on(ac))
    cls = 'mk' + (' mk-serif' if mk['font'] == 'serif' else '') + (' mk-dark' if mk.get('dark') else '') + (' on' if on else '')
    feat_icons = [f[0] for f in t['feats']]
    its = ''.join('<div class="mk-it"><span class="mk-ii">%s</span><b>%s</b><em>%s</em></div>' % (svg(feat_icons[i % 6]), T(n), T(p))
                  for i, (n, p) in enumerate(mk['items']))
    pits = ''.join('<div><b>%s</b><em>%s</em></div>' % (T(n), T(p)) for n, p in mk['items'][:2])
    return ('<div class="%s" data-t="%s" style="%s"><div class="mk-desk"><div class="mk-bar"><i></i><i></i><i></i><span class="mk-url">'
            '%s</span></div><div class="mk-view"><div class="mk-page"><div class="mk-nav"><b class="mk-logo">%s%s</b><span class="mk-lk">'
            '<i></i><i></i><i></i></span><span class="mk-b mk-b-s">%s</span></div><div class="mk-hero"><div class="mk-tx"><span class="mk-k">'
            '%s</span><b class="mk-h">%s</b><span class="mk-s">%s</span><span class="mk-cs"><span class="mk-b">%s</span><span class="mk-b mk-b-g">'
            '%s</span></span><span class="mk-r"><i>★★★★★</i>%s</span></div><div class="mk-art">%s<span class="mk-orb a"></span>'
            '<span class="mk-orb b"></span><span class="mk-big">%s</span></div></div><div class="mk-its">%s</div><div class="mk-info"><i></i>%s</div>'
            '<div class="mk-row2"><div class="mk-map">%s</div><div class="mk-rev"><i>★★★★★</i><span class="mk-l"></span><span class="mk-l s">'
            '</span><span class="mk-l"></span></div></div></div></div><div class="mk-toast"><span class="mk-tk">%s</span><span>%s</span></div></div>'
            '<div class="mk-ph" aria-hidden="true"><div class="mk-pv"><div class="mk-pn"><b>%s</b><i></i></div><div class="mk-pa">%s%s</div>'
            '<div class="mk-ph-h"><span class="mk-k">%s</span><b class="mk-h">%s</b></div><div class="mk-pits">%s</div><div class="mk-pbar">'
            '<span class="mk-b">%s</span><span class="mk-wa">%s</span></div></div></div></div>') % (
        cls, t['id'], style, T(S['g_site']), svg(t['icon']), T(mk['brand']), T(mk['cta']), T(mk['kick']), T(mk['hero']), T(mk['sub']),
        T(mk['cta']), T(mk['cta2']), T(S['rating']), zellige('z-' + t['id']), svg(t['icon']), its, T(mk['info']), PIN,
        CHECK, T(mk['toast']), T(mk['brand']), zellige('zp-' + t['id']), svg(t['icon'], 'ic'), T(mk['kick']), T(mk['hero']), pits,
        T(mk['cta']), WAI)


def show(types, tabs=True):
    tb = ''
    if tabs and len(types) > 1:
        tb = '<div class="vz-tabs rv" role="tablist" aria-label="%s">%s</div>' % (A(S['show_tabs']), ''.join(
            '<button type="button" role="tab" data-t="%s" aria-selected="%s">%s%s</button>' % (
                t['id'], 'true' if i == 0 else 'false', svg(t['icon']), T(t['name'])) for i, t in enumerate(types)))
    return ('<section class="blk vz-show" id="site">%s%s<div class="mk-stage rv">%s</div><p class="vz-note rv">%s</p></section>') % (
        head_sh(S['show_pill'], S['show_1'], S['show_2'], S['show_p']), tb, ''.join(mock(t, i == 0) for i, t in enumerate(types)),
        T(S['show_note']))


def do_section():
    cells = []
    for i, (ic, b, p) in enumerate(DO):
        dev = '<span class="vz-dev" aria-hidden="true"><i></i><i></i><i></i></span>' if i == 0 else ''
        cells.append('<div class="rv%s%s"><span class="vz-ic">%s</span><b>%s</b><p>%s</p>%s</div>' % (
            ' wide' if i == 0 else '', ' d%d' % (i % 3) if i % 3 else '', svg(ic), T(b), T(p), dev))
    # 8 blocs dont un large : 9 cases, la dernière ligne est complète
    return '<section class="blk dk">%s<div class="vz-do w">%s</div></section>' % (
        head_sh(S['do_pill'], S['do_1'], S['do_2'], S['do_p'], dark=True), ''.join(cells))


def google(searches, ident):
    qs = ''.join('<li>%s</li>' % T(s) for s in searches)
    say = ''.join('<span>%s%s</span>' % (svg('search'), T(s)) for s in searches)
    pts = ''.join('<li>%s%s</li>' % (CHECK, T(S[k])) for k in ('g_t1', 'g_t2', 'g_t3'))
    pins = ('<span class="vz-gpin o" style="left:22%;top:40%">' + PIN + '</span><span class="vz-gpin o" style="left:74%;top:30%">' + PIN +
            '</span><span class="vz-gpin o" style="left:64%;top:78%">' + PIN + '</span><span class="vz-gpin me" style="left:46%;top:58%">' + PIN + '</span>')
    gi = lambda me: ('<div class="vz-gi%s"><b>%s</b><span class="st"><i>★★★★★</i> %s</span><span class="op">%s</span>'
                     '<span class="bt"><span>%s</span><span>%s</span></span></div>') % (
        ' me', T(S['g_you']), T(('4,9 (128 avis)', '4.9 (128 reviews)', '4.9 (128 تقييماً)')), T(S['g_open']), svg('phone'), svg('map')) if me else (
        '<div class="vz-gi"><span class="ln"></span><span class="ln s"></span><span class="bt"><span>%s</span></span></div>' % svg('map'))
    visual = ('<div class="vz-g rv" id="%s"><ul class="vz-qs" hidden>%s</ul><div class="vz-gbar">%s<span class="vz-gq">%s</span></div>'
              '<div class="vz-gtabs"><i>%s</i><i>%s</i><i>%s</i></div><div class="vz-gmap">%s</div><div class="vz-gl">%s%s%s</div>'
              '<div class="vz-gorg"><small>%s</small><b>%s</b><span>%s</span></div></div>') % (
        ident, qs, svg('search'), T(searches[0]), T(S['g_all']), T(S['g_maps']), T(S['g_img']), pins, gi(True), gi(False), gi(False),
        T(S['g_site']), T(S['g_you']), T(S['g_snip']))
    text = ('<div>%s<ul class="vz-pts rv">%s</ul><div class="vz-say rv"><b>%s</b>%s</div></div>') % (
        head_sh(S['g_pill'], S['g_1'], S['g_2'], S['g_p']), pts, T(S['g_say']), say)
    return '<section class="blk" id="google"><div class="vz-split w">%s%s</div></section>' % (text, visual)


def ai(questions, icon):
    pts = ''.join('<li>%s%s</li>' % (CHECK, T(S[k])) for k in ('ai_t1', 'ai_t2', 'ai_t3'))
    say = ''.join('<span>%s%s</span>' % (svg('chat'), T(q)) for q in questions)
    qs = ''.join('<li>%s</li>' % T(q) for q in questions)
    visual = ('<div class="vz-chat rv"><ul class="vz-qs" hidden>%s</ul><div class="vz-ch-top"><i></i>%s</div><div class="vz-ch-u"><span>%s</span></div>'
              '<div class="vz-ch-dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="vz-ch-a"><p>%s</p><div class="vz-ch-pick">'
              '<span class="vz-ic">%s</span><span><b>%s</b><small>%s</small></span></div><span class="vz-ch-o"></span><span class="vz-ch-o s"></span>'
              '<div class="vz-ch-src"><span>%s</span><span>%s</span><span>Google Maps</span></div></div></div>') % (
        qs, T(S['ai_top']), T(questions[0]), T(S['ai_a']), svg(icon), T(S['g_you']), T(S['ai_why']), T(S['g_site']), T(S['ai_src']))
    text = ('<div>%s<ul class="vz-pts rv">%s</ul><div class="vz-say rv"><b>%s</b>%s</div><p class="vz-honest rv">%s</p></div>') % (
        head_sh(S['ai_pill'], S['ai_1'], S['ai_2'], S['ai_p']), pts, T(S['ai_say']), say, T(S['ai_honest']))
    return '<section class="blk" id="ia"><div class="vz-split w rev">%s%s</div></section>' % (text, visual)


def app(mods):
    side = ''.join('<span%s>%s</span>' % (' class="on"' if i == 0 else '', T(m)) for i, m in enumerate(mods[:5]))
    rows = ''.join('<div><i></i>%s<em></em></div>' % T(m) for m in mods[:3])
    dash = ('<div class="vz-dash rv" aria-hidden="true"><aside><b><i></i>%s</b>%s</aside><main><div class="vz-kpi"><div><i></i><b></b></div>'
            '<div><i></i><b></b></div><div><i></i><b></b></div></div><div class="vz-chart">%s</div><div class="vz-rows">%s</div></main></div>') % (
        T(S['app_dash']), side, ''.join('<i style="height:%d%%;animation-delay:-%.1fs"></i>' % (h, i * .3) for i, h in
                                         enumerate((45, 62, 38, 74, 56, 88, 70, 95))), rows)
    lst = ''.join('<div class="rv%s"><span class="vz-ic">%s</span><span>%s</span></div>' % (' d%d' % i if i else '', svg(ic), T(S[k]))
                  for i, (ic, k) in enumerate((('gear', 'app_t1'), ('chat', 'app_t2'), ('users', 'app_t3'))))
    return ('<section class="blk dk" id="app">%s<div class="vz-app w">%s<div class="vz-mods">%s</div></div></section>') % (
        head_sh(S['app_pill'], S['app_1'], S['app_2'], S['app_p'], dark=True), dash, lst)


def feats(t):
    cells = ''.join('<div class="rv%s"><span class="n">%02d</span><span class="vz-ic">%s</span><b>%s</b><p>%s</p></div>' % (
        ' d%d' % (i % 3) if i % 3 else '', i + 1, svg(ic), T(b), T(p)) for i, (ic, b, p) in enumerate(t['feats']))
    return '<section class="blk" id="fonctions">%s<div class="vz-ft w">%s</div></section>' % (
        head_sh(S['ft_pill'], S['ft_1'], S['ft_2'], S['ft_p']), cells)


def cities():
    return '<section class="blk" id="villes">%s<ul class="vz-cities rv">%s</ul></section>' % (
        head_sh(S['city_pill'], S['city_1'], S['city_2'], S['city_p']),
        ''.join('<li>%s%s</li>' % (svg('pin'), T(c)) for c in CITIES))


def faq(qs):
    items = ''.join('<details class="rv"><summary>%s<i aria-hidden="true"></i></summary><p>%s</p></details>' % (T(q), T(a)) for q, a in qs)
    return '<section class="blk" id="faq">%s<div class="faq w nar mt">%s</div></section>' % (head_sh(S['faq_pill'], S['faq_1'], S['faq_2']), items)


def guides(names):
    out = []
    for n in names:
        p = os.path.join(SITE, n)
        if not os.path.exists(p):
            continue
        h = open(p, encoding='utf-8').read()
        full = html.unescape(re.search(r'<title>(.*?)</title>', h, re.S).group(1)).strip()
        title = full.split(' | ')[0].strip()
        tr = [OLD_TR(l).get(sid(full), '') for l in ('en', 'ar')]
        if all(tr):  # le titre de l'onglet est déjà traduit : on en garde la première partie
            T((title, tr[0].split(' | ')[0].strip(), tr[1].split(' | ')[0].strip()))
        desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', h).group(1))
        out.append('<a class="rv" href="%s"><small>%s</small><b>%s</b><span>%s</span></a>' % (
            n, T(S['gd_k']), html.escape(title, quote=False), html.escape(desc, quote=False)))
    if not out:
        return ''
    return '<section class="blk">%s<div class="vz-gds w">%s</div></section>' % (head_sh(S['gd_pill'], S['gd_1'], S['gd_2']), ''.join(out))


def related(sec, types, cur):
    links = ''.join('<a href="%s">%s%s</a>' % (t['file'], svg(t['icon']), T(t['name'])) for t in types if t['id'] != cur)
    links += '<a class="all" href="%s#activites">%s%s</a>' % (sec['file'], svg('layers'), T(S['rel_all']))
    return '<section class="blk">%s<div class="vz-rel rv">%s</div></section>' % (head_sh(S['rel_pill'], S['rel_1'], S['rel_2']), links)


# ─── pages ─────────────────────────────────────────────────────────────

def sector_page(base, m, all_secs):
    sec, types, cards = m.SECTOR, m.TYPES, m.CARDS
    themes = [next(t for t in types if t['id'] == i) for i in sec['themes']]
    mods = []
    for t in types:
        for x in t['app']:
            if x not in mods:
                mods.append(x)
    anchors = [('activites', S['find_pill']), ('site', S['show_pill']), ('google', S['g_pill']), ('ia', S['ai_pill']),
               ('app', S['app_pill']), ('faq', S['faq_pill'])]
    hr = hero(base, crumbs([(S['home'], 'index.html'), (S['secteurs'], 'secteurs.html'), (sec['name'], None)]),
              sec['eyebrow'], sec['h1'], sec['lead'], sec['met'], anchors)
    body = (sband(CITIES) + find(sec, types, cards) + show(themes) + do_section() + google(sec['search'], 'vzG') +
            ai(sec['ai'], sec['icon']) + app(mods[:6]) + base.steps + base.price + cities() + faq(sec['faq']) + guides(sec['guides']))
    return base.page('sector', sec['title'], sec['desc'], hr, body)


def type_page(base, m, t):
    sec = m.SECTOR
    hr = hero(base, crumbs([(S['home'], 'index.html'), (S['secteurs'], 'secteurs.html'), (sec['name'], sec['file']), (t['name'], None)]),
              (sec['name'][0] + ' · ' + t['name'][0], sec['name'][1] + ' · ' + t['name'][1], sec['name'][2] + ' · ' + t['name'][2]),
              t['h1'], t['lead'], t['name'])
    shared_faq = [sec['faq'][0]] + ([sec['faq'][2]] if len(sec['faq']) > 2 else [])
    body = (sband(CITIES) + show([t], tabs=False) + feats(t) + google(t['search'], 'vzG') + ai(t['ai'], t['icon']) +
            app(t['app']) + base.incl + base.steps + faq(t['faq'] + shared_faq) + related(sec, m.TYPES, t['id']) + cities() +
            guides(sec['guides'][:4]))
    return base.page('type', t['title'], t['desc'], hr, body)


def hub_page(base, mods, photos):
    secs, idx = [], []
    for m in mods:
        sec = m.SECTOR
        n = len(m.TYPES) + len(m.CARDS)
        if sec.get('photo') and sec['photo'] in photos:
            src, srcset = photos[sec['photo']]
            im = '<img src="%s" srcset="%s" sizes="(max-width: 759px) 92vw, 30vw" alt="" loading="lazy" decoding="async">' % (src, srcset)
        else:
            im = zellige('zs-' + sec['id']).replace('class="mk-z"', 'class="vz-z"') + '<span class="big">%s</span>' % svg(sec['icon'])
        ex = ''.join('<i>%s</i>' % T(t['name']) for t in m.TYPES[:4])
        cnt = ('%d activités' % n, '%d businesses' % n, '%d نشاطاً' % n)
        allk = [sec['name']] + [t['name'] for t in m.TYPES] + [c['name'] for c in m.CARDS]
        secs.append(('<a class="vz-sec rv" id="%s" href="%s" data-k="%s"><span class="vz-sec-im">%s<span class="n">%s</span></span>'
                     '<span class="vz-sec-b"><b>%s</b><span class="d">%s</span><span class="ex">%s</span><span class="vz-go">%s%s</span></span></a>') % (
            sec['id'], sec['file'], kw(*allk), im, T(cnt), T(sec['name']), T(tuple(x[:1].upper() + x[1:] for x in sec['h1'][1])), ex, T(S['hub_go']), ARR))
        for t in m.TYPES:
            idx.append('<a href="%s" data-k="%s"><span class="vz-ic">%s</span><span><b>%s</b><small>%s</small></span></a>' % (
                t['file'], kw(t['k'], t['name']), svg(t['icon']), T(t['name']), T(sec['name'])))
        for c in m.CARDS:
            href = c.get('href') or '%s#t-%s' % (sec['file'], c['id'])
            idx.append('<a href="%s" data-k="%s"><span class="vz-ic">%s</span><span><b>%s</b><small>%s</small></span></a>' % (
                href, kw(c['k'], c['name']), svg(c['icon']), T(c['name']), T(sec['name'])))
        idx.append('<a href="%s" data-k="%s"><span class="vz-ic">%s</span><span><b>%s</b><small>%s</small></span></a>' % (
            sec['file'], kw(sec['name'], sec['met']), svg(sec['icon']), T(sec['name']), T(S['secteurs'])))
    search = ('<div class="vz-hub in2"><label class="vz-q">%s<input type="search" id="vzHubQ" placeholder="%s" aria-label="%s" '
              'autocomplete="off" aria-controls="vzHubR"></label><div class="vz-hres" id="vzHubR" hidden></div>'
              '<a class="vz-hnone" id="vzHubNone" href="demarrer.html" hidden><span class="vz-ic">%s</span><span><b>%s</b></span></a>'
              '<div class="vz-idx">%s</div></div>') % (svg('search'), A(S['hub_q']), A(S['q_lbl']), svg('sparkle'), T(S['hub_none']), ''.join(idx))
    hr = hero(base, crumbs([(S['home'], 'index.html'), (S['secteurs'], None)]), S['hub_eb'], (S['hub_1'], S['hub_2']),
              S['hub_lead'], ('Autre activité', 'Other business', 'نشاط آخر'), None, search)
    body = (sband(CITIES) + '<section class="blk" id="tous">%s<div class="vz-secs w">%s</div></section>' % (
        head_sh(S['hub_pill'], S['hub_s1'], S['hub_s2'], S['hub_sp']), ''.join(secs)) +
            do_section() + base.steps + cities() + faq(HUB_FAQ))
    return base.page('hub', S['hub_title'], S['hub_desc'], hr, body)


# ─── liens dans tout le site ─────────────────────────────────────────────

def nav_links(h):
    """« Secteurs » dans la barre du haut, le menu plein écran et le pied de page (idempotent)."""
    lab = T(S['secteurs'])
    if '<a href="secteurs.html">' not in h.split('<div class="fl">', 1)[-1][:400]:
        h = h.replace('<div class="fl"><a href="services.html">Services</a>',
                      '<div class="fl"><a href="services.html">Services</a><a href="secteurs.html">%s</a>' % lab, 1)
    m = re.search(r'<nav class="fsm-nav" aria-label="Pages">(.*?)</nav>', h, re.S)
    if m and 'href="secteurs.html"' not in m.group(1):
        items = re.findall(r'<a href="[^"]+"[^>]*>.*?</a>', m.group(1), re.S)
        out = []
        for it in items:
            out.append(it)
            if 'href="services.html"' in it:
                out.append('<a href="secteurs.html"><small>00</small><span>%s</span></a>' % lab)
        out2 = []
        for i, it in enumerate(out):
            it = re.sub(r' style="--i:\d+"', '', it)
            it = it.replace('<a href="', '<a style="--i:%d" href="' % i, 1) if 'style=' not in it else it
            it = re.sub(r'<small>\d+</small>', '<small>%02d</small>' % (i + 1), it, count=1)
            out2.append(it)
        h = h[:m.start(1)] + ''.join(out2) + h[m.end(1):]
    f = re.search(r'<nav class="f-col" aria-label="Navigation"><h6>Navigation</h6>(.*?)</nav>', h, re.S)
    if f and 'href="secteurs.html"' not in f.group(1):
        h = h[:f.start(1)] + f.group(1).replace('<a href="services.html">Services</a>',
                                                '<a href="services.html">Services</a><a href="secteurs.html">%s</a>' % lab, 1) + h[f.end(1):]
    return h


def home_links(h, files):
    """Accueil : chaque carte métier mène à son secteur, et un lien vers tous les secteurs sous la section."""
    def add(m):
        art = m.group(0)
        if 'class="mc2-go"' in art:
            art = re.sub(r'<a class="mc2-go"[^>]*>.*?</a>', '', art, flags=re.S)
        dm = re.search(r'data-m="([^"]+)"', art)
        sec = HOME.get(dm.group(1)) if dm else None
        if not sec or sec not in files:
            return art
        return art.replace('</ul></div></article>', '</ul><a class="mc2-go" href="%s">%s%s</a></div></article>' % (
            files[sec], T(S['home_go']), ARR), 1)
    h = re.sub(r'<article class="mc2" data-i="\d+">.*?</article>', add, h, flags=re.S)
    h = re.sub(r'<!--dg:mt-all-->.*?<!--/dg:mt-all-->', '', h, flags=re.S)
    i = h.find('id="t-met"')
    if i > 0:
        # sous le titre « Chaque entreprise mérite d'être trouvée » : le lien vers tous les secteurs
        j = h.find('</p>', i) + len('</p>')
        h = h[:j] + '<!--dg:mt-all--><a class="mt-all rv d2" href="secteurs.html">%s%s</a><!--/dg:mt-all-->' % (
            T(S['mt_all']), ARR) + h[j:]
    return h


def css():
    src = open(os.path.join(ROOT, 'src', 'css', 'secteurs.src.css'), encoding='utf-8').read()
    out = re.sub(r'(?<![\w.#-])(-?\d+(?:\.\d+)?)u\b', r'calc(\1 * var(--u))', src)
    open(os.path.join(ROOT, 'src', 'css', 'secteurs.css'), 'w', encoding='utf-8').write(
        '/* Généré par tools/secteurs.py à partir de secteurs.src.css : ne pas modifier à la main */\n' + out)


def photos():
    """Les photos des 12 métiers de l'accueil (déjà en WebP, 3 tailles) : src et srcset par métier."""
    h = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'data-m="([^"]+)"[^>]*><div class="sp-img"><img src="([^"]+)" srcset="([^"]+)"', h):
        out[m.group(1)] = (m.group(2), m.group(3))
    # noms des fichiers photos (src/metiers/) ↔ data-m de l'accueil
    return {'ecole': out.get('ecole'), 'clinique': out.get('clinique'), 'restaurant': out.get('restaurant'),
            'hotel': out.get('hotel'), 'commerce': out.get('commerce'), 'industrie': out.get('industrie'),
            'juridique': out.get('juridique'), 'immobilier': out.get('immobilier'), 'sport': out.get('sport'),
            'beaute': out.get('beaute'), 'tourisme': out.get('tourisme'), 'btp': out.get('btp')}


def main():
    css()
    base = Base()
    mods = [load(n) for n in ORDER]
    files = {m.SECTOR['id']: m.SECTOR['file'] for m in mods}
    pics = {k: v for k, v in photos().items() if v}
    written = []
    # les anciennes pages générées (un type renommé ou retiré) disparaissent
    old = [f for f in glob.glob(os.path.join(SITE, '*.html'))
           if re.search(r'<main class="pg light vz-page" id="main" data-vz="', open(f, encoding='utf-8').read())]
    for f in old:
        os.remove(f)
    out = {'secteurs.html': hub_page(base, mods, pics)}
    for m in mods:
        out[m.SECTOR['file']] = sector_page(base, m, mods)
        for t in m.TYPES:
            out[t['file']] = type_page(base, m, t)
    for name, h in out.items():
        if os.path.exists(os.path.join(SITE, name)):
            sys.exit('secteurs : %s existe déjà et n’est pas une page de secteur' % name)
        open(os.path.join(SITE, name), 'w', encoding='utf-8').write(h)
        written.append(name)
    # menu « Secteurs » partout, et cartes de l'accueil
    for f in glob.glob(os.path.join(SITE, '*.html')):
        h = open(f, encoding='utf-8').read()
        n = nav_links(h)
        if os.path.basename(f) == 'index.html':
            n = home_links(n, files)
        if n != h:
            open(f, 'w', encoding='utf-8').write(n)
    added = save_tr()
    print('%d pages secteurs (%d secteurs, %d métiers avec page, %d cartes) ; %d traductions ajoutées' % (
        len(written), len(mods), sum(len(m.TYPES) for m in mods), sum(len(m.CARDS) for m in mods), added))


if __name__ == '__main__':
    main()
