"""Page « Merci » (merci.html) : l'écran où arrive le visiteur après l'envoi d'un formulaire.

Elle sert à trois choses : rassurer (la demande est bien arrivée), expliquer la suite (rappel, prix écrit,
première version en 72 h) et donner une adresse précise à mesurer comme « demande envoyée » dans Google Analytics
ou Google Ads. Elle reste hors de Google (noindex) et hors du sitemap.

La page est bâtie à partir de la page 404 (même ciel, même pied de page) : le build l'écrit puis le reste de la chaîne
(titres, CSS, traductions anglais/arabe, SEO) s'applique comme sur toutes les pages.
Le prénom, la référence et le moment du rappel arrivent dans l'adresse (?n=…&r=…&w=…) et sont posés par
src/js/pages.js, avec textContent, jamais en HTML.

Usage : python3 tools/merci.py
"""
import hashlib, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from secteurs_icons import svg  # noqa: E402

ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(ROOT, 'src', 'i18n')
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


ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>'
CTA_ARROW = ('<span class="arw"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" '
             'stroke="#0C1D43" stroke-width="1.5" stroke-linecap="square"/></svg></span>')

# ——— Textes : (français, anglais, arabe) ———
EYEBROW = ('Demande reçue', 'Request received', 'تم استلام طلبك')
H1 = (('Merci, c’est bien reçu :', 'Thank you, we’ve got it:', 'شكراً، وصلنا طلبك:'),
      ('on s’occupe du reste.', 'we’ll take it from here.', 'ونحن نتكفّل بالباقي.'))
LEAD = ('Votre message est arrivé chez nous. Quelqu’un de l’équipe vous répond le jour même, du lundi au samedi.',
        'Your message has reached us. Someone from the team will reply the same day, Monday to Saturday.',
        'وصلتنا رسالتك. سيردّ عليك أحد أفراد الفريق في اليوم نفسه، من الاثنين إلى السبت.')
STAMP = {
    'title': ('Demande bien enregistrée', 'Request recorded', 'تم تسجيل طلبك'),
    'name': ('Pour', 'For', 'باسم'),
    'ref': ('Référence', 'Reference', 'المرجع'),
    'when': ('Rappel prévu', 'Planned callback', 'موعد الاتصال'),
    'when_def': ('Le jour même, de 9 h à 19 h', 'Same day, 9 am to 7 pm', 'في اليوم نفسه، من 9 صباحاً إلى 7 مساءً'),
    'cost': ('Coût', 'Cost', 'التكلفة'),
    'cost_v': ('Gratuit, sans engagement', 'Free, no obligation', 'مجاني وبدون التزام'),
}
BTN1 = ('Voir des idées de site', 'See site ideas', 'اطلع على أفكار المواقع')
BTN2 = ('Écrire sur WhatsApp', 'Message us on WhatsApp', 'راسلنا على WhatsApp')

NEXT = {
    'pill': ('Et maintenant ?', 'What happens next?', 'وماذا بعد؟'),
    'h2': (('Voici ce qui se passe', 'Here is what happens', 'هذا ما سيحدث'),
           ('dans les prochaines heures.', 'over the next few hours.', 'خلال الساعات القادمة.')),
    'p': ('Quatre étapes, sans jargon et sans surprise.', 'Four steps, no jargon, no surprises.',
          'أربع خطوات، بلا مصطلحات معقّدة وبلا مفاجآت.'),
    'steps': [
        (('On vous rappelle', 'We call you back', 'نتصل بك'),
         ('Le jour même, du lundi au samedi, de 9 h à 19 h. Dix minutes suffisent pour comprendre votre activité.',
          'The same day, Monday to Saturday, 9 am to 7 pm. Ten minutes are enough to understand your business.',
          'في اليوم نفسه، من الاثنين إلى السبت، من 9 صباحاً إلى 7 مساءً. عشر دقائق تكفي لفهم نشاطك.')),
        (('Un prix écrit', 'A written price', 'سعر مكتوب'),
         ('Vous recevez un devis clair avant de commencer. Rien n’est caché.',
          'You receive a clear quote before we start. Nothing is hidden.',
          'تتوصل بعرض سعر واضح قبل أن نبدأ. لا شيء مخفي.')),
        (('Première version en 72\u00a0h', 'First version in 72 hours', 'نسخة أولى في 72 ساعة'),
         ('Un vrai site, avec vos informations, vos couleurs et vos textes.',
          'A real website, with your details, your colors and your text.',
          'موقع حقيقي بمعلوماتك وألوانك ونصوصك.')),
        (('Vous validez, ou rien à payer', 'You approve it, or you pay nothing', 'توافق عليها، أو لا تدفع شيئاً'),
         ('Si le résultat ne vous plaît pas, vous ne payez rien.',
          'If you don’t like the result, you pay nothing.',
          'إذا لم تعجبك النتيجة فلا تدفع شيئاً.')),
    ],
}
TIPS = {
    'pill': ('Pour aller plus vite', 'To go faster', 'لتسريع الأمور'),
    'h2': (('Trois choses à préparer,', 'Three things to prepare,', 'ثلاثة أشياء يمكنك تحضيرها،'),
           ('si vous les avez.', 'if you have them.', 'إن كانت متوفرة لديك.')),
    'p': ('Rien n’est obligatoire : sans elles, on avance quand même et on vous guide.',
          'None of it is required: without them, we move ahead anyway and guide you.',
          'لا شيء إلزامي: وبدونها نتقدّم ونرشدك في كل خطوة.'),
    'items': [
        ('palette', ('Votre logo et vos couleurs', 'Your logo and colors', 'شعارك وألوانك'),
         ('Même un croquis ou la photo de votre enseigne. Sinon, nous créons votre identité.',
          'Even a sketch or a photo of your sign. Otherwise, we create your identity.',
          'حتى لو كان مجرد رسم أو صورة للافتة. وإلا فنحن نصمّم هويتك.')),
        ('camera', ('Quelques photos', 'A few photos', 'بعض الصور'),
         ('Votre local, vos produits ou votre équipe, prises avec votre téléphone.',
          'Your premises, your products or your team, taken with your phone.',
          'محلّك أو منتجاتك أو فريقك، مصوّرة بهاتفك.')),
        ('file', ('Vos informations clés', 'Your key details', 'معلوماتك الأساسية'),
         ('Horaires, adresse, téléphone et la liste de vos services ou de vos prix.',
          'Opening hours, address, phone and the list of your services or prices.',
          'ساعات العمل والعنوان والهاتف وقائمة خدماتك أو أسعارك.')),
    ],
}
WAIT = {
    'pill': ('En attendant', 'In the meantime', 'في هذه الأثناء'),
    'h2': (('Pendant que vous patientez,', 'While you wait,', 'بينما تنتظر،'),
           ('de quoi vous inspirer.', 'some inspiration.', 'ما يلهمك.')),
    'cards': [
        ('layers', 'secteurs.html', ('Des idées pour votre métier', 'Ideas for your trade', 'أفكار لمهنتك'),
         ('18 secteurs et plus de 200 types d’entreprises, avec un exemple de site pour chacun.',
          '18 sectors and over 200 types of business, each with an example site.',
          '18 قطاعاً وأكثر من 200 نوع من الأنشطة، مع مثال موقع لكل منها.'),
         ('Voir les secteurs', 'See the sectors', 'عرض القطاعات')),
        ('book', 'guides.html', ('Nos guides', 'Our guides', 'أدلّتنا'),
         ('Prix, référencement, fiche Google, IA : des réponses simples, sans jargon.',
          'Prices, SEO, Google profile, AI: simple answers, no jargon.',
          'الأسعار والسيو وملف Google التجاري والذكاء الاصطناعي: إجابات بسيطة بلا مصطلحات معقّدة.'),
         ('Lire les guides', 'Read the guides', 'اقرأ الأدلّة')),
        ('chat', 'https://wa.me/212649953813', ('Une urgence ?', 'Something urgent?', 'أمر مستعجل؟'),
         ('Écrivez-nous sur WhatsApp : la réponse arrive le jour même.',
          'Message us on WhatsApp: you get an answer the same day.',
          'راسلنا على WhatsApp: يصلك الرد في اليوم نفسه.'),
         ('Ouvrir WhatsApp', 'Open WhatsApp', 'افتح WhatsApp')),
    ],
}


def heading(pill, h2, p, dark=False):
    return ('<div class="sh%s"><span class="pill rv"><span class="ic"></span>%s</span>'
            '<h2 class="rv d1"><span class="l"><span class="li">%s</span></span><span class="l"><span class="li grad">%s</span></span></h2>'
            '<p class="rv d2">%s</p></div>') % (' dark' if dark else '', T(pill), T(h2[0]), T(h2[1]), T(p))


def main_html(sky):
    wa = 'https://wa.me/212649953813?text=' + 'Bonjour%20Digilago%2C%20j%E2%80%99ai%20envoy%C3%A9%20ma%20demande%20sur%20le%20site.'
    st = STAMP
    stamp = (
        '<div class="mc-stamp rv in2" id="mcStamp" role="status" aria-live="polite">'
        '<div class="mc-ok" aria-hidden="true"><svg viewBox="0 0 64 64"><circle class="mc-c" cx="32" cy="32" r="28"/>'
        '<path class="mc-t" d="M19 33.5l9.5 9.5L46 24"/></svg></div>'
        '<div class="mc-in"><b class="mc-ti">%s</b>'
        '<dl><div class="mc-row" id="mcNameRow" hidden><dt>%s</dt><dd id="mcName"></dd></div>'
        '<div class="mc-row" id="mcRefRow" hidden><dt>%s</dt><dd id="mcRef" class="mono"></dd></div>'
        '<div class="mc-row"><dt>%s</dt><dd id="mcWhen">%s</dd></div>'
        '<div class="mc-row"><dt>%s</dt><dd>%s</dd></div></dl></div></div>'
    ) % (T(st['title']), T(st['name']), T(st['ref']), T(st['when']), T(st['when_def']), T(st['cost']), T(st['cost_v']))
    hero = (
        '<main class="pg light" id="main" data-merci><header class="phero">' + sky +
        '<p class="eyebrow in"><i class="live" aria-hidden="true"></i><span>%s</span></p>' % T(EYEBROW) +
        '<h1 class="hin"><span class="l"><span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span></h1>' % (T(H1[0]), T(H1[1])) +
        '<p class="lead in2 hin">%s</p>' % T(LEAD) + stamp +
        '<div class="hcta in2"><a href="secteurs.html" class="cta mono">%s<span class="lbl">%s</span></a>'
        '<a href="%s" class="ghost" target="_blank" rel="noopener noreferrer">%s%s</a></div></header>' % (CTA_ARROW, T(BTN1), wa, T(BTN2), ARROW))
    steps = ''.join('<div class="rv"><b>%02d</b><h5>%s</h5><p>%s</p></div>' % (i + 1, T(a), T(b)) for i, (a, b) in enumerate(NEXT['steps']))
    nxt = '<section class="blk" id="suite">' + heading(NEXT['pill'], NEXT['h2'], NEXT['p']) + '<div class="st4 w mt">' + steps + '</div></section>'
    tips = ''.join(
        '<div class="mc-tip rv d%d"><span class="vz-ic">%s</span><b>%s</b><p>%s</p></div>' % (i + 1, svg(ic), T(a), T(b))
        for i, (ic, a, b) in enumerate(TIPS['items']))
    tip = '<section class="blk dk" id="preparer">' + heading(TIPS['pill'], TIPS['h2'], TIPS['p'], True) + '<div class="mc-tips w mt">' + tips + '</div></section>'
    cards = ''
    for i, (ic, href, a, b, go) in enumerate(WAIT['cards']):
        ext = ' target="_blank" rel="noopener noreferrer"' if href.startswith('http') else ''
        cards += ('<a class="vz-card rv d%d" href="%s"%s><span class="vz-ic">%s</span><b>%s</b><span class="vz-d">%s</span>'
                  '<span class="vz-go">%s%s</span></a>') % (i + 1, href, ext, svg(ic), T(a), T(b), T(go), ARROW)
    wait = '<section class="blk" id="attendre">' + heading(WAIT['pill'], WAIT['h2'], ('Des idées, des prix et des réponses : tout est là.', 'Ideas, prices and answers: it’s all here.', 'أفكار وأسعار وإجابات: كل شيء هنا.')) + '<div class="mc-wait w mt">' + cards + '</div></section>'
    return hero + nxt + tip + wait + '\n'


def main():
    src = open(os.path.join(SITE, '404.html'), encoding='utf-8').read()
    a = src.index('<main class="pg light" id="main">')
    hs = src.index('<header class="phero">', a)
    sky_end = src.index('<div class="skyfade" aria-hidden="true"></div>', hs) + len('<div class="skyfade" aria-hidden="true"></div>')
    sky = src[hs + len('<header class="phero">'):sky_end]
    head = src[:a]
    foot = src[src.index('</main>', a):]
    head = re.sub(r'<title>.*?</title>', '<title>Merci, demande bien reçue | Digilago</title>', head, count=1, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="Votre demande est arrivée chez Digilago. Réponse le jour même, du lundi au samedi.">', head, count=1)
    T(('Merci, demande bien reçue | Digilago', 'Thank you, request received | Digilago', 'شكراً، تم استلام طلبك | Digilago'))
    T(('Votre demande est arrivée chez Digilago. Réponse le jour même, du lundi au samedi.',
       'Your request has reached Digilago. Same-day reply, Monday to Saturday.',
       'وصل طلبك إلى Digilago. نردّ في اليوم نفسه، من الاثنين إلى السبت.'))
    out = head + main_html(sky) + foot
    # les liens de la page 404 qui portent le nom de la page ne doivent pas rester
    out = out.replace('/404.html', '/merci.html')
    open(os.path.join(SITE, 'merci.html'), 'w', encoding='utf-8').write(out)
    print('merci.html écrit,', save_tr(), 'traductions ajoutées')


if __name__ == '__main__':
    main()
