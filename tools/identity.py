"""Identité Digilago sur toutes les pages (idempotent).

  - L'icône de l'onglet et l'icône d'écran d'accueil (iPhone, Android) : le D de l'agence partout, sauf sur les
    pages du Lab qui ont la leur (le soleil, le radar, le registre).
  - La couleur de la barre du navigateur sur téléphone : le bleu du jour, la nuit sur les pages du Lab.
  - Le pied de page : une phrase claire sur ce que fait l'agence, puis la signature
    « Votre infrastructure digitale, entre de bonnes mains. Aujourd'hui et demain. »
  - Le manifeste (site.webmanifest) pour l'écran d'accueil des téléphones.

Les images fixes sont écrites par tools/brand.py. Traductions anglaise et arabe : src/i18n/en.json et ar.json.

Usage : python3 tools/identity.py
"""
import glob, hashlib, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand import SIGNATURE, SIGNATURE_AR, SIGNATURE_EN, data_uri, icon  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(ROOT, 'src', 'i18n')

KIND = {'lab.html': 'lab', 'lab-radar.html': 'radar', 'lab-gestion.html': 'gestion'}
THEME = {'agence': '#1B6BDB', 'lab': '#071433', 'radar': '#071433', 'gestion': '#071433'}
TOUCH = {'agence': 'apple-touch-icon.png', 'lab': 'apple-touch-icon-lab.png',
         'radar': 'apple-touch-icon-radar.png', 'gestion': 'apple-touch-icon-gestion.png'}

ABOUT = 'Agence web marocaine : site web, fiche Google et réseaux sociaux pour les entreprises, au Maroc comme à l’international.'
TR = {
    ABOUT: ('Moroccan web agency: websites, Google Business Profiles and social media for businesses, in Morocco and abroad.',
            'وكالة ويب مغربية: مواقع إلكترونية وبطاقات Google ومواقع التواصل للمقاولات، في المغرب وخارجه.'),
    SIGNATURE[0]: (SIGNATURE_EN[0], SIGNATURE_AR[0]),
    SIGNATURE[1]: (SIGNATURE_EN[1], SIGNATURE_AR[1]),
}
FOOT = '<p>%s</p><p class="f-sig"><b>%s</b> <em>%s</em></p>' % (ABOUT, SIGNATURE[0], SIGNATURE[1])
FOOT_RE = re.compile(r'(<div class="f-brand">.*?</a>)<p>[^<]*</p>(?:<p class="f-sig">.*?</p>)?', re.S)

CSS = ('<style id="idn-css">.f-brand p.f-sig{margin-top:calc(14 * var(--u));color:#fff;font-family:Sora,sans-serif;'
       'font-weight:500;line-height:1.4;letter-spacing:-.01em}.f-sig b{font-weight:500}'
       '.f-sig em{display:block;margin-top:calc(2 * var(--u));font-family:"Playfair Display",Georgia,serif;font-style:italic;'
       'font-size:calc(17 * var(--u));letter-spacing:0;color:#9FC8FF}'
       'html[lang="ar"] .f-sig{font-family:inherit;letter-spacing:0}html[lang="ar"] .f-sig em{font-family:inherit;font-style:normal}</style>')

MANIFEST = {
    'name': 'Digilago', 'short_name': 'Digilago', 'lang': 'fr', 'start_url': '/', 'display': 'browser',
    'description': ' '.join(SIGNATURE), 'theme_color': THEME['agence'], 'background_color': '#FFFFFF',
    'icons': [{'src': '/assets/brand/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
              {'src': '/assets/brand/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'}],
}


def sid(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def save_tr():
    for lang, i in (('en', 0), ('ar', 1)):
        p = os.path.join(I18N, lang + '.json')
        d = json.load(open(p, encoding='utf-8'))
        for fr, tt in TR.items():
            d.setdefault(sid(fr), tt[i])
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(d.items())), f, ensure_ascii=False, indent=1)
            f.write('\n')


def head_links(kind):
    return ('<link rel="icon" href="%s"><link rel="apple-touch-icon" href="assets/brand/%s"><link rel="manifest" href="/site.webmanifest">'
            % (data_uri(icon(kind)), TOUCH[kind]))


def apply(h, name):
    kind = KIND.get(name, 'agence')
    h = re.sub(r'<link rel="(?:apple-touch-icon|manifest)"[^>]*>', '', h)
    links = head_links(kind)
    if re.search(r'<link rel="icon"[^>]*>', h):
        h = re.sub(r'<link rel="icon"[^>]*>', lambda m: links, h, count=1)
    else:
        h = h.replace('</head>', links + '</head>', 1)
    h = re.sub(r'<meta name="theme-color" content="[^"]*">', '<meta name="theme-color" content="%s">' % THEME[kind], h)
    if FOOT_RE.search(h):
        h = FOOT_RE.sub(lambda m: m.group(1) + FOOT, h, count=1)
        h = re.sub(r'<style id="idn-css">.*?</style>', '', h, flags=re.S)
        h = h.replace('</head>', CSS + '</head>', 1)
    return h


def main():
    n = 0
    for p in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        name = os.path.basename(p)
        h = open(p, encoding='utf-8').read()
        new = apply(h, name)
        if new != h:
            open(p, 'w', encoding='utf-8').write(new)
            n += 1
    with open(os.path.join(SITE, 'site.webmanifest'), 'w', encoding='utf-8') as f:
        json.dump(MANIFEST, f, ensure_ascii=False, indent=1)
        f.write('\n')
    save_tr()
    print('identité :', n, 'pages mises à jour')


if __name__ == '__main__':
    main()
