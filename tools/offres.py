"""Les offres de Digilago : la page « Offres » (offres.html) et leurs rappels sur tout le site.

Quatre offres, décidées par le gérant (novembre 2026) :
  1. Fin d'année : pour tout site commandé jusqu'au 31 décembre 2026, la fiche Google Business est créée et
     optimisée, offerte (le domaine et l'hébergement restent offerts la première année, comme toujours).
  2. Le code du jeu LAGO (LAGO-CASA, gagné en terminant Casablanca) : la fiche Google offerte. Sans date de fin.
  3. L'audit gratuit en 24 h (du lundi au samedi) : la demande part dans l'espace de gestion.
  4. Le parrainage : le client parrain reçoit un mois de maintenance offert ; l'entreprise recommandée reçoit la
     fiche Google offerte et une deuxième année de nom de domaine .ma. Sans date de fin.
Règle commune : une seule fiche Google offerte par projet.

Ce script écrit offres.html (bâtie sur les mentions légales : même ciel, même pied de page) et pose les rappels :
le bandeau en haut de chaque page, le lien « Offres » dans le menu, le menu mobile et le pied de page, une ligne
dans le bandeau « On vous rappelle », l'encart de « Démarrer un projet » (avec le champ code ou parrain), l'audit
sur la page Contact et une ligne dans la section « Le bon moment » de l'accueil.
Après le 31 décembre 2026, le bandeau et les rappels de fin d'année disparaissent d'eux-mêmes (data-of-end, retirés
par common.js) et ne sont plus écrits à la construction suivante. Les traductions anglaises et arabes sont
enregistrées dans src/i18n/{en,ar}.json. Idempotent. Usage : python3 tools/offres.py
"""
import datetime, glob, hashlib, html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(ROOT, 'src', 'i18n')
LAST_DAY = datetime.date(2026, 12, 31)
LIVE = datetime.date.today() <= LAST_DAY
CODE = 'LAGO-CASA'
TR = {}


def T(x):
    fr, en, ar = x
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=False)


def A(x):
    """Même chose pour un attribut (aria-label, placeholder)."""
    fr, en, ar = x
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
            if d.get(k) != tt[i]:
                d[k] = tt[i]
                n += 1
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(d.items())), f, ensure_ascii=False, indent=1)
            f.write('\n')
    return n


# ─── icônes ──────────────────────────────────────────────────────────────────────────────────────
ARW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
       'stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
CHK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
       'stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')
XX = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
      'aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>')
COPY = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/>'
        '<path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>')
PLAY = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72'
        'L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>')
PIN = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z'
       'm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>')
WA = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2'
      'a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1'
      'a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7'
      ' 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>')
ACT = {'call': '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
       'route': '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.7 11.3l-9-9a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>',
       'web': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/>'
              '<path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>'}
SUN = '<i class="of-sun" aria-hidden="true"></i>'

# ─── textes communs ──────────────────────────────────────────────────────────────────────────────
NAV = ('Offres', 'Offers', 'العروض')
SEE = ('Voir l’offre', 'See the offer', 'اطّلع على العرض')
YEAR_LINE = ('Fin d’année : votre fiche Google offerte pour tout site commandé avant le 31 décembre.',
             'Year-end: your Google Business profile free with any website ordered before December 31.',
             'نهاية السنة: ملفك على Google مجانًا مع كل موقع يُطلب قبل 31 ديسمبر.')


def bar():
    return ('<!--dg:obar--><div class="obar" id="obar" data-of-end hidden><div class="obar-in">%s<p>'
            '<span class="ob-l">%s</span><span class="ob-s">%s</span></p><a href="offres.html" class="ob-go">'
            '<span class="ob-l">%s</span><span class="ob-s">%s</span>%s</a></div>'
            '<button type="button" class="ob-x" aria-label="%s">%s</button></div><!--/dg:obar-->') % (
        SUN,
        T(('Offre de fin d’année : votre fiche Google offerte pour tout site commandé avant le 31 décembre.',
           'Year-end offer: your Google Business profile free with any website ordered before December 31.',
           'عرض نهاية السنة: ملفك على Google مجانًا مع كل موقع يُطلب قبل 31 ديسمبر.')),
        T(('Fiche Google offerte jusqu’au 31 décembre', 'Free Google profile until December 31', 'ملف Google مجانًا حتى 31 ديسمبر')),
        T(SEE), T(('Voir', 'See', 'اطّلع')), ARW,
        A(('Masquer l’offre', 'Hide the offer', 'إخفاء العرض')), XX)


def line(cls, rv=''):
    """La ligne de rappel de l'offre de fin d'année (bandeau « On vous rappelle », accueil, Démarrer)."""
    return ('<a class="%s%s" href="offres.html" data-of-end>%s<span>%s</span><b>%s%s</b></a>'
            % (cls, rv, SUN, T(YEAR_LINE), T(SEE), ARW))


# ─── la page ─────────────────────────────────────────────────────────────────────────────────────
TITLE = ('Offres : fiche Google offerte, audit gratuit, parrainage | Digilago',
         'Offers: free Google profile, free audit, referrals | Digilago',
         'العروض: ملف Google مجانًا، تدقيق مجاني، الإحالة | Digilago')
DESC = ('Fin d’année : votre fiche Google offerte pour tout site commandé avant le 31 décembre 2026. Audit gratuit en 24 h, '
        'parrainage et code du jeu LAGO : les offres de Digilago et leurs conditions.',
        'Year-end: your Google Business profile free with any website ordered before December 31, 2026. Free audit within 24 hours, '
        'referrals and the LAGO game code: Digilago’s offers and their terms.',
        'نهاية السنة: ملفك على Google مجانًا مع كل موقع يُطلب قبل 31 ديسمبر 2026. تدقيق مجاني خلال 24 ساعة، والإحالة، ورمز لعبة LAGO: '
        'عروض Digilago وشروطها.')
EYEBROW = ('Offres en cours', 'Current offers', 'العروض الحالية')
H1 = (('Allumez votre entreprise', 'Light up your business', 'أضئ مقاولتك'), ('avant 2027.', 'before 2027.', 'قبل 2027.'))
LEAD = ('Une offre de fin d’année, un audit gratuit, le parrainage et le code du jeu LAGO : quatre façons de démarrer avec '
        'un avantage, et des conditions écrites en clair.',
        'A year-end offer, a free audit, referrals and the LAGO game code: four ways to start with an advantage, '
        'with the terms written in plain words.',
        'عرض نهاية السنة، وتدقيق مجاني، والإحالة، ورمز لعبة LAGO: أربع طرق للانطلاق بامتياز، بشروط مكتوبة بوضوح.')


def head(tag, h2a, h2b, p, id_=''):
    return ('<div class="of-h"><span class="of-tag rv">%s<span>%s</span></span><h2 class="rv d1"%s>%s <em>%s</em></h2>'
            '<p class="rv d2">%s</p></div>') % (SUN, T(tag), (' id="%s"' % id_) if id_ else '', T(h2a), T(h2b), T(p))


def sec_year():
    inc = [('Création ou reprise de votre fiche', 'Your profile created or taken over', 'إنشاء ملفك أو استرجاعه'),
           ('Catégories, horaires, zone et description', 'Categories, hours, area and description', 'الفئات والمواعيد والمنطقة والوصف'),
           ('Vos photos mises en valeur', 'Your photos shown at their best', 'صورك معروضة بأفضل شكل'),
           ('Le lien vers votre nouveau site', 'The link to your new website', 'الرابط إلى موقعك الجديد'),
           ('Nos conseils pour vos premiers avis', 'Our advice for your first reviews', 'نصائحنا لأولى تقييماتك')]
    card = ('<div class="of-gbp" aria-hidden="true"><span class="of-ribbon">%s</span><div class="of-gbp-map"><i></i><i></i><i></i>'
            '<span class="of-gbp-pin">%s</span></div><div class="of-gbp-b"><b>%s</b><small>%s</small><em>★★★★★</em>'
            '<span class="of-gbp-open">%s</span><div class="of-gbp-acts"><span>%s%s</span><span>%s%s</span><span>%s%s</span></div></div></div>') % (
        T(('Offerte', 'Free', 'مجانًا')), PIN, T(('Votre entreprise', 'Your business', 'مقاولتك')),
        T(('Votre métier, votre ville', 'Your trade, your city', 'مهنتك، مدينتك')),
        T(('Ouvert, ferme à 19:00', 'Open, closes at 7 pm', 'مفتوح، يغلق على الساعة 19:00')),
        ACT['web'], T(('Site web', 'Website', 'الموقع')), ACT['route'], T(('Itinéraire', 'Directions', 'الاتجاهات')),
        ACT['call'], T(('Appeler', 'Call', 'اتصال')))
    days = ('<div class="of-days rv d2" hidden><b data-of-days>%d</b><span>%s</span></div>'
            % ((LAST_DAY - datetime.date.today()).days + 1, T(('jours restants', 'days left', 'الأيام المتبقية'))))
    return ('<section class="of-sec of-year" id="fin-annee" data-of-end><div class="of-card of-dark w"><div class="of-txt">'
            '<span class="of-tag rv">%s<span>%s</span></span><h2 class="rv d1">%s <em>%s</em></h2><p class="rv d2">%s</p>'
            '<ul class="of-list rv d2">%s</ul><p class="of-note rv d3">%s</p>'
            '<div class="of-cta rv d3"><a href="demarrer.html?offre=fin-2026" class="of-go"><span class="arw">%s</span>'
            '<span class="lbl">%s</span></a><a class="of-link" href="#conditions">%s</a></div></div>'
            '<div class="of-vis rv d2">%s%s</div></div></section>') % (
        SUN, T(('Jusqu’au 31 décembre 2026', 'Until December 31, 2026', 'حتى 31 ديسمبر 2026')),
        T(('Votre fiche Google,', 'Your Google profile,', 'ملفك على Google،')), T(('offerte.', 'on us.', 'مجانًا.')),
        T(('Commandez votre site avant le 31 décembre 2026 : nous créons et optimisons votre fiche Google Business, pour que '
           'vos clients vous trouvent sur Google et sur Maps dès la mise en ligne.',
           'Order your website before December 31, 2026: we create and optimize your Google Business profile, so your '
           'customers find you on Google and Maps from launch day.',
           'اطلب موقعك قبل 31 ديسمبر 2026: ننشئ ملفك على Google Business ونحسّنه، ليجدك زبناؤك على Google وعلى الخرائط منذ يوم الإطلاق.')),
        ''.join('<li>%s<span>%s</span></li>' % (CHK, T(x)) for x in inc),
        T(('Comme toujours, le nom de domaine et l’hébergement sont offerts la première année.',
           'As always, the domain name and hosting are included for the first year.',
           'وكالعادة، اسم النطاق والاستضافة مجانيان في السنة الأولى.')),
        ARW, T(('Démarrer mon projet', 'Start my project', 'ابدأ مشروعي')),
        T(('Lire les conditions', 'Read the terms', 'اقرأ الشروط')), days, card)


def sec_audit():
    pts = [('Votre fiche Google et vos avis', 'Your Google profile and reviews', 'ملفك على Google وتقييماتك'),
           ('Votre site sur téléphone : vitesse et clarté', 'Your website on a phone: speed and clarity', 'موقعك على الهاتف: السرعة والوضوح'),
           ('Votre place quand on cherche votre métier dans votre ville', 'Where you rank when people search your trade in your city',
            'ترتيبك عندما يبحث الناس عن مهنتك في مدينتك'),
           ('Ce que répond ChatGPT quand on lui demande une entreprise comme la vôtre',
            'What ChatGPT answers when asked for a business like yours', 'ما يجيب به ChatGPT عندما يُسأل عن مقاولة مثل مقاولتك')]
    field = lambda n, lab, ac, typ='text', req=True: (
        '<label class="of-in"><span>%s</span><input name="%s" type="%s" autocomplete="%s" maxlength="60"%s></label>'
        % (T(lab), n, typ, ac, ' required' if req else ''))
    form = ('<form class="of-form rv d2" id="ofAudit" novalidate><b class="of-form-t">%s</b>'
            '<div class="of-duo">%s%s</div><div class="of-duo">%s%s</div>%s'
            '<button type="submit" class="of-go"><span class="arw">%s</span><span class="lbl">%s</span></button>'
            '<p class="of-legal">%s <a href="confidentialite.html">%s</a></p>'
            '<p class="of-err" role="alert">%s</p>'
            '<div class="of-ok" role="status"><span class="of-ok-ic">%s</span><b>%s</b><span>%s</span></div>'
            '<div class="of-fail" role="alert"><b>%s</b><span>%s</span><a class="of-wa" href="https://wa.me/212649953813" target="_blank" '
            'rel="noopener noreferrer">%s%s</a></div></form>') % (
        T(('Recevoir mon audit', 'Get my audit', 'احصل على تدقيقي')),
        field('first', ('Votre prénom', 'Your first name', 'اسمك الشخصي'), 'given-name'),
        field('tel', ('WhatsApp ou téléphone', 'WhatsApp or phone', 'واتساب أو الهاتف'), 'tel', 'tel'),
        field('company', ('Nom de l’entreprise', 'Business name', 'اسم المقاولة'), 'organization'),
        field('city', ('Ville', 'City', 'المدينة'), 'address-level2'),
        field('site', ('Votre site web (facultatif)', 'Your website (optional)', 'موقعك الإلكتروني (اختياري)'), 'url', 'text', False),
        ARW, T(('Recevoir mon audit gratuit', 'Get my free audit', 'احصل على تدقيقي المجاني')),
        T(('Vos informations servent uniquement à préparer et envoyer votre audit.',
           'Your details are only used to prepare and send your audit.', 'تُستعمل معلوماتك فقط لإعداد تدقيقك وإرساله.')),
        T(('Confidentialité', 'Privacy', 'الخصوصية')),
        T(('Indiquez votre prénom, votre entreprise, votre ville et un numéro valide.',
           'Please enter your first name, business, city and a valid number.', 'يُرجى إدخال اسمك الشخصي ومقاولتك ومدينتك ورقمًا صحيحًا.')),
        CHK, T(('C’est reçu.', 'Received.', 'تم الاستلام.')),
        T(('Votre audit arrive sous 24 h, du lundi au samedi, sur le numéro indiqué.',
           'Your audit arrives within 24 hours, Monday to Saturday, on the number you gave.',
           'يصلك تدقيقك خلال 24 ساعة، من الاثنين إلى السبت، على الرقم الذي أدخلته.')),
        T(('La demande n’est pas partie.', 'The request was not sent.', 'لم يُرسَل الطلب.')),
        T(('Réessayez, ou envoyez-la sur WhatsApp : rien n’est perdu.', 'Try again, or send it on WhatsApp: nothing is lost.',
           'أعد المحاولة، أو أرسله عبر واتساب: لم يضع شيء.')),
        WA, T(('Envoyer sur WhatsApp', 'Send on WhatsApp', 'أرسل عبر واتساب')))
    return ('<section class="of-sec" id="audit"><div class="of-two w"><div class="of-txt">%s<ul class="of-list of-list-l rv d2">%s</ul>'
            '<p class="of-note rv d3">%s</p></div>%s</div></section>') % (
        head(('Audit gratuit en 24 h', 'Free audit within 24 hours', 'تدقيق مجاني خلال 24 ساعة'),
             ('Votre entreprise est-elle', 'Can customers find', 'هل مقاولتك'),
             ('visible sur Google ?', 'your business on Google?', 'ظاهرة على Google؟'),
             ('Laissez-nous votre prénom, votre entreprise et votre ville : sous 24 h, du lundi au samedi, vous recevez sur '
              'WhatsApp un court bilan, avec ce qui marche, ce qui manque et par quoi commencer.',
              'Leave your first name, business and city: within 24 hours, Monday to Saturday, you receive a short report on '
              'WhatsApp, with what works, what is missing and where to start.',
              'اترك لنا اسمك الشخصي ومقاولتك ومدينتك: خلال 24 ساعة، من الاثنين إلى السبت، يصلك عبر واتساب تقرير قصير بما ينجح وما ينقص ومن أين تبدأ.')),
        ''.join('<li>%s<span>%s</span></li>' % (CHK, T(x)) for x in pts),
        T(('Gratuit et sans engagement. Ce n’est pas une remise : c’est un point de départ.',
           'Free, with no commitment. It is not a discount: it is a starting point.', 'مجاني وبدون التزام. ليس تخفيضًا: إنه نقطة انطلاق.')),
        form)


def sec_parrain():
    steps = [('Créez votre lien de parrainage ci-dessous.', 'Create your referral link below.', 'أنشئ رابط الإحالة الخاص بك أسفله.'),
             ('Envoyez-le à une entreprise qui a besoin d’un site.', 'Send it to a business that needs a website.',
              'أرسله إلى مقاولة تحتاج إلى موقع.'),
             ('Quand son projet est confirmé, vous recevez votre mois de maintenance offert.',
              'When its project is confirmed, you receive your free month of maintenance.', 'عندما يتأكد مشروعها، تحصل على شهر صيانة مجاني.')]
    perks = ('<div class="of-perks rv d2"><div><small>%s</small><b>%s</b></div><div><small>%s</small><b>%s</b></div></div>') % (
        T(('Pour vous', 'For you', 'لك')), T(('Un mois de maintenance offert', 'One month of maintenance free', 'شهر صيانة مجاني')),
        T(('Pour l’entreprise recommandée', 'For the business you recommend', 'للمقاولة التي توصي بها')),
        T(('Sa fiche Google offerte et un an de domaine .ma en plus', 'A free Google profile and one extra year of .ma domain',
           'ملفها على Google مجانًا وسنة إضافية لاسم النطاق \u2066.ma\u2069')))
    tool = ('<div class="of-ref rv d2" id="ofRef"><label class="of-in"><span>%s</span><input id="ofRefName" type="text" maxlength="50" '
            'autocomplete="organization" placeholder="%s"></label><div class="of-ref-out"><code id="ofRefLink">digilago.ma/demarrer.html?parrain=…</code></div>'
            '<div class="of-ref-b"><button type="button" class="of-btn" id="ofRefCopy">%s<span>%s</span></button>'
            '<a class="of-btn of-btn-wa" id="ofRefWa" href="https://wa.me/" target="_blank" rel="noopener noreferrer">%s<span>%s</span></a></div>'
            '<p class="of-ref-ok" id="ofRefOk" role="status"></p>'
            '<p hidden data-of-msg="copied">%s</p><p hidden data-of-msg="name">%s</p>'
            '<p hidden data-of-msg="wa">%s</p></div>') % (
        T(('Votre nom ou celui de votre entreprise', 'Your name or your business name', 'اسمك أو اسم مقاولتك')),
        A(('Ex. : Clinique Azur', 'E.g. Clinique Azur', 'مثال: Clinique Azur')),
        COPY, T(('Copier le lien', 'Copy the link', 'انسخ الرابط')), WA, T(('Envoyer sur WhatsApp', 'Send on WhatsApp', 'أرسل عبر واتساب')),
        T(('Lien copié : il ne reste qu’à l’envoyer.', 'Link copied: now just send it.', 'تم نسخ الرابط: لم يبق إلا إرساله.')),
        T(('Écrivez d’abord votre nom.', 'Write your name first.', 'اكتب اسمك أولًا.')),
        T(('Bonjour, je te recommande Digilago pour ton site web. Avec ce lien, ta fiche Google est offerte et tu as un an de '
           'nom de domaine .ma en plus :',
           'Hello, I recommend Digilago for your website. With this link, your Google profile is free and you get one extra year '
           'of .ma domain name:',
           'مرحبًا، أنصحك بـ Digilago لموقعك الإلكتروني. بهذا الرابط، ملفك على Google مجاني ولك سنة إضافية لاسم النطاق \u2066.ma\u2069:')))
    return ('<section class="of-sec" id="parrainage"><div class="of-two w of-rev"><div class="of-txt">%s<ol class="of-steps rv d2">%s</ol>%s</div>'
            '<div class="of-side">%s</div></div></section>') % (
        head(('Parrainage', 'Referrals', 'الإحالة'), ('Vous êtes client ?', 'Already a client?', 'هل أنت زبون لدينا؟'),
             ('Recommandez-nous.', 'Recommend us.', 'أوصِ بنا.'),
             ('Quand une entreprise que vous recommandez démarre son site avec Digilago, vous recevez un mois de maintenance '
              'offert. Elle, elle reçoit sa fiche Google offerte et un an de nom de domaine .ma en plus.',
              'When a business you recommend starts its website with Digilago, you receive one month of maintenance free. '
              'It receives a free Google profile and one extra year of .ma domain name.',
              'عندما تبدأ مقاولة أوصيت بها موقعها مع Digilago، تحصل على شهر صيانة مجاني. وتحصل هي على ملفها على Google مجانًا '
              'وسنة إضافية لاسم النطاق \u2066.ma\u2069.')),
        ''.join('<li><span>%s</span></li>' % T(x) for x in steps), perks, tool)


def sec_game():
    win = ''.join('<i style="--x:%d;--y:%d;--d:%.1fs"%s></i>' % (x, y, d, ' class="on"' if on else '')
                  for x, y, d, on in ((8, 62, .2, 1), (16, 48, 1.1, 0), (24, 70, .6, 1), (33, 40, 1.6, 1), (41, 58, .9, 0),
                                      (52, 34, .4, 1), (60, 52, 1.3, 1), (68, 44, .1, 0), (77, 60, .8, 1), (86, 38, 1.9, 1),
                                      (92, 66, .5, 0), (47, 72, 1.4, 1)))
    return ('<section class="of-sec" id="jeu"><div class="of-card of-night w"><div class="of-city" aria-hidden="true">%s<span class="of-d"></span></div>'
            '<div class="of-txt">%s<div class="of-cta rv d3"><a href="/lago/" class="of-go of-play"><span class="arw">%s</span><span class="lbl">%s</span></a>'
            '<a class="of-link" href="demarrer.html">%s</a></div></div></div></section>') % (
        win,
        head(('Le code du jeu LAGO', 'The LAGO game code', 'رمز لعبة LAGO'),
             ('Allumez Casablanca,', 'Light up Casablanca,', 'أضئ الدار البيضاء،'),
             ('gagnez votre fiche Google.', 'win your Google profile.', 'واربح ملفك على Google.'),
             ('LAGO est notre jeu gratuit : aidez Lago à allumer les entreprises de la médina, de la Corniche et du quartier '
              'd’affaires. À la fin du niveau, un code vous attend : il vous offre la fiche Google pour la création de votre site.',
              'LAGO is our free game: help Lago light up the businesses of the medina, the Corniche and the business district. '
              'At the end of the level, a code awaits: it gives you a free Google profile when you create your website.',
              'LAGO لعبتنا المجانية: ساعد Lago على إضاءة مقاولات المدينة القديمة والكورنيش وحي الأعمال. في نهاية المرحلة ينتظرك '
              'رمز يمنحك ملفك على Google مجانًا عند إنشاء موقعك.')),
        PLAY, T(('Jouer à LAGO', 'Play LAGO', 'العب LAGO')),
        T(('Vous avez déjà le code ? Saisissez-le à l’étape 2 de « Démarrer un projet ».',
           'Already have the code? Enter it at step 2 of “Start a project”.', 'لديك الرمز؟ أدخله في الخطوة 2 من «ابدأ مشروعًا».')))


TERMS = [
    (('Offre de fin d’année', 'Year-end offer', 'عرض نهاية السنة'),
     ('Valable pour toute commande d’un site web (devis accepté) jusqu’au 31 décembre 2026 inclus, heure du Maroc. Elle comprend '
      'la création ou la reprise, puis l’optimisation, d’une fiche Google Business pour un établissement. La mise en ligne peut '
      'avoir lieu après le 31 décembre. La vérification de la fiche est faite par Google ; nous vous accompagnons à chaque étape.',
      'Valid for any website order (quote accepted) until December 31, 2026 inclusive, Morocco time. It covers creating or taking '
      'over, then optimizing, one Google Business profile for one location. The launch may take place after December 31. The '
      'profile is verified by Google; we guide you through every step.',
      'صالح لكل طلب موقع إلكتروني (عرض سعر مقبول) حتى 31 ديسمبر 2026 ضمنًا، بتوقيت المغرب. ويشمل إنشاء ملف على Google Business '
      'لمؤسسة واحدة أو استرجاعه ثم تحسينه. يمكن أن يتم الإطلاق بعد 31 ديسمبر. تتحقق Google من الملف بنفسها، ونرافقك في كل خطوة.'), True),
    (('Code du jeu LAGO', 'LAGO game code', 'رمز لعبة LAGO'),
     ('Le code gagné à la fin de Casablanca offre la création et l’optimisation d’une fiche Google Business, pour la commande '
      'd’un site web. Un code par projet. Valable jusqu’à nouvel ordre.',
      'The code won at the end of Casablanca gives you the creation and optimization of one Google Business profile when you order '
      'a website. One code per project. Valid until further notice.',
      'الرمز الذي تربحه في نهاية الدار البيضاء يمنحك إنشاء ملف على Google Business وتحسينه عند طلب موقع إلكتروني. رمز واحد لكل '
      'مشروع. صالح إلى إشعار آخر.'), False),
    (('Audit gratuit', 'Free audit', 'التدقيق المجاني'),
     ('Gratuit et sans engagement. Il est envoyé sous 24 h, du lundi au samedi, sur le numéro indiqué. Un audit par entreprise.',
      'Free, with no commitment. It is sent within 24 hours, Monday to Saturday, to the number you gave. One audit per business.',
      'مجاني وبدون التزام. يُرسَل خلال 24 ساعة، من الاثنين إلى السبت، إلى الرقم الذي أدخلته. تدقيق واحد لكل مقاولة.'), False),
    (('Parrainage', 'Referrals', 'الإحالة'),
     ('Le parrain est un client de Digilago. Son mois de maintenance offert lui est accordé quand le projet de l’entreprise '
      'recommandée est confirmé (devis accepté et acompte versé). L’entreprise recommandée reçoit la création et l’optimisation '
      'de sa fiche Google Business, et une deuxième année de nom de domaine .ma offerte. Valable jusqu’à nouvel ordre.',
      'The referrer is a Digilago client. Their free month of maintenance is granted when the recommended business’s project is '
      'confirmed (quote accepted and deposit paid). The recommended business receives the creation and optimization of its Google '
      'Business profile, and a second year of .ma domain name free. Valid until further notice.',
      'المُحيل زبون لدى Digilago. يُمنح شهر الصيانة المجاني عندما يتأكد مشروع المقاولة الموصى بها (عرض سعر مقبول ودفعة أولى '
      'مؤداة). وتحصل المقاولة الموصى بها على إنشاء ملفها على Google Business وتحسينه، وسنة ثانية مجانية لاسم النطاق \u2066.ma\u2069. صالح '
      'إلى إشعار آخر.'), False),
    (('Règles communes', 'Common rules', 'قواعد مشتركة'),
     ('Une seule fiche Google offerte par projet, même si plusieurs offres s’appliquent ; les autres avantages s’ajoutent. Les '
      'avantages ne sont ni échangeables ni remboursables en argent. Digilago peut mettre fin au code du jeu et au parrainage à '
      'tout moment, en l’annonçant sur cette page ; les projets déjà confirmés gardent leurs avantages.',
      'Only one free Google profile per project, even if several offers apply; the other advantages add up. Advantages cannot be '
      'exchanged or refunded for money. Digilago may end the game code and the referral offer at any time by announcing it on '
      'this page; projects already confirmed keep their advantages.',
      'ملف واحد مجاني على Google لكل مشروع، حتى لو انطبقت عدة عروض؛ وتُضاف الامتيازات الأخرى. لا تُستبدل الامتيازات ولا تُسترد '
      'نقدًا. يمكن لـ Digilago إنهاء رمز اللعبة والإحالة في أي وقت بالإعلان عن ذلك في هذه الصفحة؛ وتحتفظ المشاريع المؤكدة بامتيازاتها.'), False),
]


def sec_terms():
    out = ''
    for h, p, year in TERMS:
        if year and not LIVE:
            continue
        out += '<h3 class="rv"%s>%s</h3><p class="rv d1"%s>%s</p>' % (
            ' data-of-end' if year else '', T(h), ' data-of-end' if year else '', T(p))
    out += '<p class="rv d1 of-upd">%s</p>' % T(('Dernière mise à jour : novembre 2026.', 'Last updated: November 2026.', 'آخر تحديث: نونبر 2026.'))
    return ('<section class="of-sec of-terms" id="conditions"><div class="w nar legal"><h2 class="rv">%s</h2>%s</div></section>'
            % (T(('Conditions des offres', 'Terms of the offers', 'شروط العروض')), out))


def page():
    src = open(os.path.join(SITE, 'mentions-legales.html'), encoding='utf-8').read()
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % T(TITLE), src, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % html.escape(DESC[0], quote=True), h, count=1)
    T(DESC)
    h = re.sub(r'(https://www\.digilago\.ma(?:/en|/ar)?)/mentions-legales\.html', r'\1/offres.html', h)
    h = re.sub(r'href="(en|ar)/mentions-legales\.html"', r'href="\1/offres.html"', h)  # sélecteur de langue
    h = re.sub(r'(<h1 class="hin">).*?(</h1>)', lambda m: m.group(1) + '<span class="l"><span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span>'
               % (T(H1[0]), T(H1[1])) + m.group(2), h, count=1, flags=re.S)
    h = re.sub(r'(<p class="eyebrow in"><i class="live" aria-hidden="true"></i><span>).*?(</span></p>)', lambda m: m.group(1) + T(EYEBROW) + m.group(2), h, count=1, flags=re.S)
    h = re.sub(r'(<p class="lead in2 hin">).*?(</p>)', lambda m: m.group(1) + T(LEAD) + m.group(2), h, count=1, flags=re.S)
    hcta = ('<div class="hcta in2"><a href="%s" class="cta mono"><span class="arw">%s</span><span class="lbl">%s</span></a>'
            '<a href="#audit" class="ghost">%s%s</a></div>') % ('demarrer.html?offre=fin-2026' if LIVE else 'demarrer.html', ARW,
                                                            T(('Démarrer mon projet', 'Start my project', 'ابدأ مشروعي')),
                                                            T(('Demander mon audit gratuit', 'Request my free audit', 'اطلب تدقيقي المجاني')), ARW)
    if '<div class="hcta in2">' in h:
        h = re.sub(r'<div class="hcta in2">.*?</div>', lambda m: hcta, h, count=1, flags=re.S)
    else:
        h = h.replace('</p></header>', '</p>' + hcta + '</header>', 1)
    # le contenu : de la première section jusqu'à la fin de <main>
    a = h.index('<section class="blk">', h.index('</header>'))
    b = h.index('</main>', a)
    body = (sec_year() if LIVE else '') + sec_audit() + sec_parrain() + sec_game() + sec_terms()
    h = h[:a] + '<div class="of-page">' + body + '</div>' + h[b:]
    h = h.replace('<main class="pg light" id="main">', '<main class="pg light of-main" id="main">', 1)
    open(os.path.join(SITE, 'offres.html'), 'w', encoding='utf-8').write(h)


# ─── les rappels sur tout le site ───────────────────────────────────────────────────────────────
def strip(t, tag):
    return re.sub(r'<!--dg:%s-->.*?<!--/dg:%s-->' % (tag, tag), '', t, flags=re.S)


def mark(tag, s):
    return '<!--dg:%s-->%s<!--/dg:%s-->' % (tag, s, tag)


def remind(f, t):
    name = os.path.basename(f)
    for tag in ('obar', 'ofnav', 'offoot', 'ofsheet', 'ofsheet2', 'ofcb', 'offin', 'ofwz', 'ofcode', 'ofcontact', 'ofgame'):
        t = strip(t, tag)
    # bandeau en haut de page
    if LIVE:
        t = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + bar(), t, count=1)
    # menu : « Offres » avant « Contact »
    t = t.replace('<a href="contact.html">Contact</a></div>', mark('ofnav', '<a href="offres.html" class="fl-of">%s</a>' % T(NAV)) + '<a href="contact.html">Contact</a></div>', 1)
    # pied de page : après « Démarrer un projet »
    t = t.replace('<a href="demarrer.html">Démarrer un projet</a><a href="contact.html">Contact</a></nav>',
                  '<a href="demarrer.html">Démarrer un projet</a>' + mark('offoot', '<a href="offres.html">%s</a>' % T(NAV)) + '<a href="contact.html">Contact</a></nav>', 1)
    # menu mobile : « Offres » après « Contact » (numéroté à la suite), et une ligne au-dessus de « Démarrer mon projet »
    m = re.search(r'<a style="--i:(\d+)" href="contact\.html"><small>(\d+)</small>.*?</a>', t, re.S)
    if m:
        i, n = int(m.group(1)), int(m.group(2))
        t = t.replace(m.group(0), m.group(0) + mark('ofsheet', '<a style="--i:%d" href="offres.html" class="fsm-ofl"><small>%02d</small><span>%s</span></a>'
                                                     % (i + 1, n + 1, T(NAV))), 1)
    if LIVE:
        t = t.replace('<div class="fsm-bot"><a href="demarrer.html" class="fsm-go">',
                      '<div class="fsm-bot">' + mark('ofsheet2', '<a class="fsm-of" href="offres.html" data-of-end>%s<span>%s</span></a>'
                                                     % (SUN, T(('Fiche Google offerte jusqu’au 31 décembre', 'Free Google profile until December 31',
                                                                'ملف Google مجانًا حتى 31 ديسمبر')))) + '<a href="demarrer.html" class="fsm-go">', 1)
        # bandeau « On vous rappelle »
        t = re.sub(r'(<div class="cband cb2 rv"><div class="cb-l">.*?<div class="cb-alt">.*?</div>)',
                   lambda m: m.group(1) + mark('ofcb', line('cb-of')), t, count=1, flags=re.S)
    if name == 'index.html' and LIVE:
        t = re.sub(r'(<ul class="fin-trust rv d3">.*?</ul>)', lambda m: m.group(1) + mark('offin', line('fin-of', ' rv d3')), t, count=1, flags=re.S)
    if name == 'demarrer.html':
        if LIVE:
            t = t.replace('<div class="wz" id="wz">', mark('ofwz', line('wz-of', ' rv')) + '<div class="wz" id="wz">', 1)
        code = ('<label class="big-in sm of-code"><span>%s</span><input id="wCode" type="text" maxlength="50" autocomplete="off" '
                'placeholder="%s"></label><p class="of-codemsg" id="wCodeMsg" aria-live="polite"></p>'
                '<span hidden data-of-msg="code">%s</span><span hidden data-of-msg="parrain">%s</span><span hidden data-of-msg="autre">%s</span>') % (
            T(('Code avantage ou nom du parrain (facultatif)', 'Advantage code or referrer’s name (optional)', 'رمز الامتياز أو اسم المُحيل (اختياري)')),
            A(('Ex. : %s' % CODE, 'E.g. %s' % CODE, 'مثال: %s' % CODE)),
            T(('Code %s : votre fiche Google est offerte.' % CODE, 'Code %s: your Google profile is free.' % CODE,
               'الرمز %s: ملفك على Google مجاني.' % CODE)),
            T(('Parrainage : votre fiche Google est offerte, avec un an de nom de domaine .ma en plus.',
               'Referral: your Google profile is free, with one extra year of .ma domain name.',
               'إحالة: ملفك على Google مجاني، مع سنة إضافية لاسم النطاق \u2066.ma\u2069.')),
            T(('Noté : nous vérifions ce code pendant l’appel.', 'Noted: we will check this code during the call.', 'تم التسجيل: سنتحقق من هذا الرمز خلال المكالمة.')))
        t = re.sub(r'(<label class="big-in sm"><span>Nom de l’entreprise \(facultatif\)</span><input id="wName"[^>]*></label>)',
                   lambda m: m.group(1) + mark('ofcode', code), t, count=1)
    if name == 'contact.html':
        strip_ = ('<a class="of-strip w rv" href="offres.html#audit"><span class="of-strip-ic">%s</span><span class="of-strip-t"><b>%s</b>'
                  '<span>%s</span></span><span class="of-strip-go">%s%s</span></a>') % (
            SUN, T(('Pas encore prêt ? Commencez par un audit gratuit.', 'Not ready yet? Start with a free audit.', 'لست مستعدًا بعد؟ ابدأ بتدقيق مجاني.')),
            T(('En 24 h, nous vous disons ce qui manque à votre visibilité sur Google.', 'Within 24 hours, we tell you what your Google visibility is missing.',
               'خلال 24 ساعة، نخبرك بما ينقص ظهورك على Google.')),
            T(('Demander mon audit', 'Request my audit', 'اطلب تدقيقي')), ARW)
        t = re.sub(r'(<div class="soc-line w">.*?</span></div>)', lambda m: m.group(1) + mark('ofcontact', strip_), t, count=1, flags=re.S)
    # « Vous voulez jouer ? » : après une demande envoyée (page Merci) et sur la page introuvable
    if name in ('merci.html', '404.html'):
        t = t.replace('</header>', '</header>' + mark('ofgame', game_card()), 1)
    return t


def game_card():
    win = ''.join('<i style="--x:%d;--y:%d;--d:%.1fs"%s></i>' % (x, y, d, ' class="on"' if on else '')
                  for x, y, d, on in ((10, 60, .3, 1), (22, 44, 1.2, 0), (34, 66, .7, 1), (46, 38, 1.5, 1), (58, 56, .2, 0),
                                      (70, 42, 1.0, 1), (82, 62, .5, 1), (90, 36, 1.8, 0)))
    return ('<section class="of-sec of-gamecard"><div class="of-card of-night w"><div class="of-city" aria-hidden="true">%s<span class="of-d"></span></div>'
            '<div class="of-txt">%s<div class="of-cta rv d3"><a href="/lago/" class="of-go of-play"><span class="arw">%s</span><span class="lbl">%s</span></a>'
            '<span class="of-small">%s</span></div></div></div></section>') % (
        win,
        head(('Le jeu de Digilago', 'Digilago’s game', 'لعبة Digilago'), ('Vous voulez jouer ?', 'Fancy a game?', 'هل تريد أن تلعب؟'),
             ('Jouez et découvrez notre agence.', 'Play and discover our agency.', 'العب واكتشف وكالتنا.'),
             ('LAGO est notre jeu gratuit : allumez les entreprises de Casablanca avec Lago, et découvrez comment nous '
              'travaillons. À la fin du niveau, un code vous offre la fiche Google de votre entreprise.',
              'LAGO is our free game: light up the businesses of Casablanca with Lago, and discover how we work. At the end '
              'of the level, a code gives you your business’s Google profile for free.',
              'LAGO لعبتنا المجانية: أضِئ مقاولات الدار البيضاء مع Lago، واكتشف طريقة عملنا. في نهاية المرحلة، يمنحك رمز ملف '
              'Google لمقاولتك مجاناً.')),
        PLAY, T(('Jouer à LAGO', 'Play LAGO', 'العب LAGO')),
        T(('Gratuit, sans inscription, sur téléphone et ordinateur.', 'Free, no sign-up, on phone and computer.',
           'مجانية، دون تسجيل، على الهاتف والحاسوب.')))


def main():
    page()
    n = 0
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        t = open(f, encoding='utf-8').read()
        if '<body' not in t or 'id="fnav"' not in t:
            continue
        u = remind(f, t)
        if u != t:
            open(f, 'w', encoding='utf-8').write(u)
            n += 1
    print('offres.html écrite, rappels posés sur', n, 'pages,', save_tr(), 'traductions ajoutées', '' if LIVE else '(offre de fin d’année terminée)')


if __name__ == '__main__':
    main()
