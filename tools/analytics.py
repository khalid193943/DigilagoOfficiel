"""Mesure d'audience et consentement (loi 09-08, CNDP) : bandeau de cookies, politique de confidentialité, IndexNow.

Rien n'est chargé tant que le visiteur n'a pas accepté : ni Google Analytics, ni Tag Manager, ni Clarity.
Sans aucun identifiant dans src/analytics.json, le bandeau reste caché et le site ne pose aucun cookie de mesure.

Publicité (Meta, Google Ads) : un second choix dans le bandeau (« Publicité »). Le pixel Meta et la balise Google Ads ne se
chargent qu'avec cet accord ; la mesure d'audience peut être acceptée seule.

Usage :
  python3 tools/analytics.py                                  # applique la configuration enregistrée (utilisé par build.py)
  python3 tools/analytics.py --meta 123456789012345 --aw AW-123456789 --aw_lead AbCdEf --aw_wa GhIjKl --aw_tel MnOpQr
  python3 tools/analytics.py --fbdv code_de_verification_du_domaine_meta
  python3 tools/analytics.py --gsc CODE_SEARCH_CONSOLE        # balise de vérification de Google Search Console
  python3 tools/analytics.py --ga4 G-XXXXXXX --gtm GTM-XXXXXXX --clarity abcd1234ef --vercel on
  python3 tools/analytics.py --ga4 ""                         # retire un identifiant
puis : python3 tools/build.py

GA4 est envoyé directement ; Tag Manager (GTM), s'il est présent, se charge en plus (n'y mettez pas la balise GA4 : doublon).
Le fichier de clé IndexNow (site/<clé>.txt) est créé ici ; l'envoi des adresses se fait avec tools/indexnow.py.
"""
import glob, hashlib, html, json, os, re, secrets, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(ROOT, 'src', 'i18n')
CONF = os.path.join(ROOT, 'src', 'analytics.json')
KEYF = os.path.join(ROOT, 'src', 'indexnow_key.txt')
TR = {}


def T(x):
    fr, en, ar = x
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=False)


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


# ——— Textes : (français, anglais, arabe) ———
BAN = {
    'label': ('Cookies', 'Cookies', 'ملفات الارتباط'),
    'title': ('Votre choix sur les cookies', 'Your cookie choice', 'اختيارك بشأن ملفات الارتباط'),
    'text': ('Avec votre accord, nous mesurons l’audience du site (pages vues, demandes envoyées) pour l’améliorer. Aucune publicité, aucune revente de vos données.',
             'With your consent, we measure site traffic (page views, requests sent) to improve it. No advertising, and we never sell your data.',
             'بموافقتك، نقيس زيارات الموقع (الصفحات المعروضة والطلبات المرسلة) لتحسينه. لا إعلانات ولا نبيع بياناتك.'),
    'text_ads': ('Avec votre accord, nous mesurons l’audience du site et l’efficacité de nos annonces (Meta, Google). Aucune revente de vos données.',
                 'With your consent, we measure site traffic and how well our ads work (Meta, Google). We never sell your data.',
                 'بموافقتك، نقيس زيارات الموقع وفعالية إعلاناتنا (ميتا، غوغل). لا نبيع بياناتك أبداً.'),
    'pick': ('Choisir', 'Choose', 'اختيار'),
    'save': ('Enregistrer mon choix', 'Save my choice', 'حفظ اختياري'),
    'c_a': ('Mesure d’audience', 'Audience measurement', 'قياس الزيارات'),
    'c_a2': ('pages lues, demandes envoyées', 'pages read, requests sent', 'الصفحات المقروءة والطلبات المرسلة'),
    'c_m': ('Publicité', 'Advertising', 'الإعلانات'),
    'c_m2': ('efficacité de nos annonces Meta et Google', 'how well our Meta and Google ads work', 'فعالية إعلاناتنا على ميتا وغوغل'),
    'more': ('En savoir plus', 'Learn more', 'اعرف المزيد'),
    'no': ('Refuser', 'Decline', 'رفض'),
    'yes': ('Accepter', 'Accept', 'قبول'),
}
PRIV_BASE = ('Ce site n’utilise pas de cookies publicitaires. Seuls des réglages techniques peuvent être enregistrés dans votre navigateur.',
             'This site does not use advertising cookies. Only technical settings may be stored in your browser.',
             'لا يستخدم هذا الموقع ملفات ارتباط إعلانية. قد تُحفظ في متصفحك إعدادات تقنية فقط.')
PRIV_INTRO = ('Ce site n’utilise aucun cookie publicitaire. Seuls des réglages techniques sont enregistrés sans votre accord. Avec votre accord, nous utilisons des outils de mesure d’audience pour savoir quelles pages sont lues et combien de demandes sont envoyées. Votre choix est conservé 12 mois et vous pouvez le modifier à tout moment.',
              'This site uses no advertising cookies. Only technical settings are stored without your consent. With your consent, we use audience measurement tools to see which pages are read and how many requests are sent. Your choice is kept for 12 months and you can change it at any time.',
              'لا يستخدم هذا الموقع أي ملفات ارتباط إعلانية. تُحفظ الإعدادات التقنية فقط دون موافقتك. وبموافقتك نستخدم أدوات لقياس الزيارات لمعرفة الصفحات المقروءة وعدد الطلبات المرسلة. يُحفظ اختيارك 12 شهراً ويمكنك تغييره في أي وقت.')
PRIV_GOOGLE = ('Google Analytics et Google Tag Manager (Google) comptent les pages vues et les demandes envoyées.',
               'Google Analytics and Google Tag Manager (Google) count page views and requests sent.',
               'يحسب Google Analytics وGoogle Tag Manager (من Google) الصفحات المعروضة والطلبات المرسلة.')
PRIV_CLARITY = ('Microsoft Clarity (Microsoft) enregistre de façon anonymisée la façon dont le site est utilisé : clics et défilement.',
                'Microsoft Clarity (Microsoft) records, anonymously, how the site is used: clicks and scrolling.',
                'يسجّل Microsoft Clarity (من Microsoft) بشكل مجهول كيفية استخدام الموقع: النقرات والتمرير.')
PRIV_VERCEL = ('Vercel Web Analytics mesure les visites sans cookie et sans donnée personnelle.',
               'Vercel Web Analytics measures visits with no cookie and no personal data.',
               'يقيس Vercel Web Analytics الزيارات دون ملفات ارتباط ودون بيانات شخصية.')
PRIV_ABROAD = ('Ces services sont exploités par des sociétés étrangères : des données techniques peuvent être traitées hors du Maroc.',
               'These services are run by foreign companies: technical data may be processed outside Morocco.',
               'تُدير هذه الخدمات شركات أجنبية: قد تُعالج بيانات تقنية خارج المغرب.')
PRIV_BTN = ('Modifier mon choix', 'Change my choice', 'تغيير اختياري')
PRIV_INTRO_ADS = ('Seuls des réglages techniques sont enregistrés sans votre accord. Avec votre accord, nous utilisons des outils de mesure d’audience pour savoir quelles pages sont lues et combien de demandes sont envoyées ; si vous acceptez aussi la publicité, des outils publicitaires mesurent l’efficacité de nos annonces. Les deux choix sont séparés, conservés 12 mois et modifiables à tout moment.',
                  'Only technical settings are stored without your consent. With your consent, we use audience measurement tools to see which pages are read and how many requests are sent; if you also accept advertising, advertising tools measure how well our ads work. The two choices are separate, kept for 12 months and can be changed at any time.',
                  'تُحفظ الإعدادات التقنية فقط دون موافقتك. وبموافقتك نستخدم أدوات لقياس الزيارات لمعرفة الصفحات المقروءة وعدد الطلبات المرسلة، وإذا قبلت الإعلانات أيضاً تقيس أدوات إعلانية فعالية إعلاناتنا. الاختياران منفصلان، ويُحفظان 12 شهراً ويمكن تغييرهما في أي وقت.')
PRIV_META = ('Le pixel Meta (Facebook, Instagram) indique si une visite venue de nos annonces a abouti à une demande. Si vous avez accepté la publicité, le téléphone et l’e-mail que vous nous envoyez peuvent être transmis à Meta sous forme chiffrée (hachage), uniquement pour mesurer nos annonces.',
             'The Meta pixel (Facebook, Instagram) shows whether a visit from our ads led to a request. If you accepted advertising, the phone number and e-mail you send us may be passed to Meta in encrypted form (hashed), only to measure our ads.',
             'يبيّن بكسل ميتا (فيسبوك، إنستغرام) ما إذا كانت زيارة قادمة من إعلاناتنا قد أدت إلى طلب. وإذا قبلت الإعلانات، فقد يُرسَل رقم الهاتف والبريد الإلكتروني اللذان ترسلهما إلينا إلى ميتا بشكل مشفّر (تجزئة)، فقط لقياس إعلاناتنا.')
PRIV_GADS = ('Google Ads (Google) mesure de la même façon les demandes venues de nos annonces Google.',
             'Google Ads (Google) measures, in the same way, the requests that come from our Google ads.',
             'يقيس Google Ads (من Google) بالطريقة نفسها الطلبات القادمة من إعلاناتنا على غوغل.')

ID_OK = {'gsc': r'^[A-Za-z0-9_-]{30,64}$', 'gtm': r'^GTM-[A-Z0-9]{4,12}$', 'ga4': r'^G-[A-Z0-9]{4,14}$', 'clarity': r'^[a-z0-9]{6,16}$',
         'meta': r'^\d{10,20}$', 'aw': r'^AW-\d{6,14}$', 'aw_lead': r'^[A-Za-z0-9_-]{6,40}$', 'aw_wa': r'^[A-Za-z0-9_-]{6,40}$', 'aw_tel': r'^[A-Za-z0-9_-]{6,40}$',
         'fbdv': r'^[a-z0-9]{20,40}$'}
ADS = ('meta', 'aw', 'aw_lead', 'aw_wa', 'aw_tel')


def load_conf():
    c = {'gsc': '', 'gtm': '', 'ga4': '', 'clarity': '', 'vercel': False, 'meta': '', 'aw': '', 'aw_lead': '', 'aw_wa': '', 'aw_tel': '', 'fbdv': ''}
    if os.path.exists(CONF):
        c.update(json.load(open(CONF, encoding='utf-8')))
    return c


def cli(c):
    a = sys.argv[1:]
    i = 0
    while i < len(a):
        k = a[i].lstrip('-')
        v = a[i + 1] if i + 1 < len(a) else ''
        if k in ID_OK:
            if v and not re.match(ID_OK[k], v):
                sys.exit('Identifiant %s invalide : %r' % (k, v))
            c[k] = v
        elif k == 'vercel':
            c[k] = v.lower() in ('on', '1', 'oui', 'true')
        else:
            sys.exit('Option inconnue : ' + a[i])
        i += 2
    with open(CONF, 'w', encoding='utf-8') as f:
        json.dump(c, f, indent=1)
        f.write('\n')
    return c


def ads_on(c):
    return bool(c.get('meta') or c.get('aw'))


def banner(c):
    attrs = ''.join(' data-%s="%s"' % (k, html.escape(c.get(k, ''), quote=True)) for k in ('gtm', 'ga4', 'clarity') + ADS)
    if not ads_on(c):
        return ('<!--dg:consent--><div id="dgc" class="dgc" role="dialog" aria-live="polite" aria-label="%s"%s hidden>'
                '<div class="dgc-t"><b>%s</b><p>%s <a href="confidentialite.html">%s</a></p></div>'
                '<div class="dgc-b"><button type="button" data-c="no">%s</button><button type="button" data-c="yes">%s</button></div></div>'
                '%s<!--/dg:consent-->') % (
            html.escape(BAN['label'][0]), attrs, T(BAN['title']), T(BAN['text']), T(BAN['more']), T(BAN['no']), T(BAN['yes']), vercel_tags(c))
    # avec la publicité : deux choix séparés (mesure d'audience, publicité), « Choisir » les montre
    ch = ('<div class="dgc-ch" hidden>'
          '<label><input type="checkbox" data-k="a" checked><span><b>%s</b>%s</span></label>'
          '<label><input type="checkbox" data-k="m"><span><b>%s</b>%s</span></label></div>') % (T(BAN['c_a']), T(BAN['c_a2']), T(BAN['c_m']), T(BAN['c_m2']))
    return ('<!--dg:consent--><div id="dgc" class="dgc dgc-ads" role="dialog" aria-live="polite" aria-label="%s"%s hidden>'
            '<div class="dgc-t"><b>%s</b><p>%s <a href="confidentialite.html">%s</a></p>%s</div>'
            '<div class="dgc-b"><button type="button" data-c="no">%s</button><button type="button" data-c="pick" data-save="%s">%s</button><button type="button" data-c="yes">%s</button></div></div>'
            '%s<!--/dg:consent-->') % (
        html.escape(BAN['label'][0]), attrs, T(BAN['title']), T(BAN['text_ads']), T(BAN['more']), ch, T(BAN['no']), T(BAN['save']), T(BAN['pick']), T(BAN['yes']), vercel_tags(c))


def vercel_tags(c):
    if not c.get('vercel'):
        return ''
    return '<script defer src="/_vercel/insights/script.js"></script><script defer src="/_vercel/speed-insights/script.js"></script>'


def privacy_block(c):
    google = bool(c.get('gtm') or c.get('ga4'))
    on = google or c.get('clarity') or c.get('vercel') or ads_on(c)
    if not on:
        return '<p class="rv d1">%s</p>' % T(PRIV_BASE)
    if ads_on(c):
        ps = []
        if google:
            ps.append(PRIV_GOOGLE)
        if c.get('clarity'):
            ps.append(PRIV_CLARITY)
        if c.get('vercel'):
            ps.append(PRIV_VERCEL)
        if c.get('meta'):
            ps.append(PRIV_META)
        if c.get('aw'):
            ps.append(PRIV_GADS)
        out = '<p class="rv d1">%s</p>' % T(PRIV_INTRO_ADS)
        out += '<p class="rv d1">%s</p>' % T(tuple(' '.join(x[i] for x in ps) for i in range(3)))
        out += '<p class="rv d1">%s</p>' % T(PRIV_ABROAD)
        out += '<p class="rv d1"><button type="button" class="dgc-edit" data-cookies>%s</button></p>' % T(PRIV_BTN)
        return out
    ps = []
    if google:
        ps.append(PRIV_GOOGLE)
    if c.get('clarity'):
        ps.append(PRIV_CLARITY)
    if c.get('vercel'):
        ps.append(PRIV_VERCEL)
    out = '<p class="rv d1">%s</p>' % T(PRIV_INTRO)
    if ps:  # un seul paragraphe : la phrase de chaque outil est traduite, puis l'ensemble (clé = texte français complet)
        out += '<p class="rv d1">%s</p>' % T(tuple(' '.join(x[i] for x in ps) for i in range(3)))
    if google or c.get('clarity'):
        out += '<p class="rv d1">%s</p>' % T(PRIV_ABROAD)
        out += '<p class="rv d1"><button type="button" class="dgc-edit" data-cookies>%s</button></p>' % T(PRIV_BTN)
    return out


def indexnow_key():
    if os.path.exists(KEYF):
        k = open(KEYF, encoding='utf-8').read().strip()
        if re.match(r'^[a-f0-9]{32}$', k):
            return k
    k = secrets.token_hex(16)
    open(KEYF, 'w', encoding='utf-8').write(k + '\n')
    return k


def main():
    c = load_conf()
    if len(sys.argv) > 1:
        c = cli(c)
    elif not os.path.exists(CONF):
        cli(c)
    ban = banner(c)
    n = 0
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        h = open(f, encoding='utf-8').read()
        h2 = re.sub(r'<!--dg:consent-->.*?<!--/dg:consent-->', '', h, flags=re.S)
        h2 = re.sub(r'<!--dg:gsc-->.*?<!--/dg:gsc-->', '', h2, flags=re.S)
        h2 = re.sub(r'<!--dg:fbdv-->.*?<!--/dg:fbdv-->', '', h2, flags=re.S)
        if c.get('fbdv'):  # vérification du domaine dans le Business Manager de Meta (nécessaire pour les conversions)
            h2 = h2.replace('<meta charset="utf-8">', '<meta charset="utf-8"><!--dg:fbdv--><meta name="facebook-domain-verification" content="%s"><!--/dg:fbdv-->' % html.escape(c['fbdv'], quote=True), 1)
        if c.get('gsc'):  # vérification de la propriété dans la Search Console (balise HTML, juste après le jeu de caractères)
            h2 = h2.replace('<meta charset="utf-8">', '<meta charset="utf-8"><!--dg:gsc--><meta name="google-site-verification" content="%s"><!--/dg:gsc-->' % html.escape(c['gsc'], quote=True), 1)
        i = h2.rindex('</body>')
        h2 = h2[:i] + ban + h2[i:]
        if os.path.basename(f) == 'confidentialite.html':
            blk = '<!--dg:ck-->' + privacy_block(c) + '<!--/dg:ck-->'
            if '<!--dg:ck-->' in h2:
                h2 = re.sub(r'<!--dg:ck-->.*?<!--/dg:ck-->', lambda m: blk, h2, count=1, flags=re.S)
            else:
                old = '<p class="rv d1">%s</p>' % html.escape(PRIV_BASE[0], quote=False)
                assert old in h2, 'paragraphe cookies introuvable'
                h2 = h2.replace(old, blk, 1)
        if h2 != h:
            open(f, 'w', encoding='utf-8').write(h2)
            n += 1
    key = indexnow_key()
    kp = os.path.join(SITE, key + '.txt')
    open(kp, 'w', encoding='utf-8').write(key)
    print('mesure :', 'Search Console ' + c['gsc'][:6] + '…' if c['gsc'] else '', 'GTM ' + c['gtm'] if c['gtm'] else '', 'GA4 ' + c['ga4'] if c['ga4'] else '', 'Clarity ' + c['clarity'] if c['clarity'] else '',
          'Meta ' + c['meta'] if c.get('meta') else '', 'Google Ads ' + c['aw'] if c.get('aw') else '',
          'Vercel' if c['vercel'] else '', '' if (c['gsc'] or c['gtm'] or c['ga4'] or c['clarity'] or c['vercel']) else '(aucun outil : bandeau caché)',
          '— %d pages, %d traductions ajoutées, clé IndexNow %s' % (n, save_tr(), key[:6] + '…'))


if __name__ == '__main__':
    main()
