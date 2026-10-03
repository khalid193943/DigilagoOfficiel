"""Section « Tous les métiers » de l'accueil : chaque carte montre le haut d'un vrai site, avec sa photo.

Les photos sont dans src/metiers/ (une par métier, dans l'ordre des cartes). Ce script :
- prépare trois tailles en WebP (600, 900 et 1280 px de large) dans site/assets/, nommées d'après leur
  contenu (mt-<empreinte>-<largeur>.webp) : une photo modifiée change de nom, le cache du navigateur suit ;
- remplace l'illustration de chaque carte par la photo, en gardant ses textes et ses couleurs ;
- ajoute la description de chaque photo (alt) en français, anglais et arabe dans src/i18n/.

Pour changer une photo : remplacer le fichier dans src/metiers/ (même nom), puis npm run build.
Idempotent. Usage : python3 tools/metiers.py
"""
import glob, hashlib, json, os, re
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
SRC = os.path.join(ROOT, 'src', 'metiers')
I18N = os.path.join(ROOT, 'src', 'i18n')
P = os.path.join(SITE, 'index.html')
WIDTHS = (600, 900, 1280)
SIZES = '(max-width: 759px) 86vw, 25vw'

# Dans l'ordre des cartes : fichier, cadrage (object-position), description FR / EN / AR
CARDS = [
    ('ecole', '62% 50%', 'Élèves entrant dans une école privée au Maroc',
     'Students walking into a private school in Morocco', 'تلاميذ يدخلون مدرسة خاصة في المغرب'),
    ('clinique', '64% 42%', 'Médecin recevant une patiente dans une clinique',
     'A doctor welcoming a patient at a clinic', 'طبيب يستقبل مريضة في عيادة'),
    ('restaurant', '52% 45%', 'Serveur apportant un tajine sur la terrasse d’un restaurant',
     'A waiter serving a tagine on a restaurant terrace', 'نادل يقدّم طاجيناً على شرفة مطعم'),
    ('hotel', '42% 50%', 'Terrasse de riad au coucher du soleil, face à la Koutoubia',
     'A riad rooftop terrace at sunset, facing the Koutoubia', 'سطح رياض عند الغروب مطلّ على الكتبية'),
    ('commerce', '46% 50%', 'Boutique d’artisanat marocain : sacs en cuir et lanternes',
     'A Moroccan craft boutique: leather bags and lanterns', 'متجر للصناعة التقليدية المغربية: حقائب جلدية وفوانيس'),
    ('industrie', '42% 45%', 'Technicien qui suit une ligne de production robotisée',
     'A technician monitoring a robotic production line', 'تقني يتابع خط إنتاج آلي'),
    ('juridique', '56% 50%', 'Avocat qui conseille un client dans son cabinet',
     'A lawyer advising a client in his office', 'محامٍ يقدّم المشورة لموكّله في مكتبه'),
    ('immobilier', '50% 45%', 'Agent immobilier qui présente une villa à un couple',
     'A real estate agent presenting a villa to a couple', 'وكيل عقاري يعرض فيلا على زوجين'),
    ('sport', '56% 50%', 'Joueurs sur les terrains d’un club de padel au coucher du soleil',
     'Players on the courts of a padel club at sunset', 'لاعبون في ملاعب نادٍ للبادل عند الغروب'),
    ('beaute', '56% 40%', 'Soin du visage dans un institut de beauté',
     'A facial treatment at a beauty institute', 'علاج للوجه في معهد تجميل'),
    ('tourisme', '40% 45%', 'Voyageuse qui admire Marrakech et l’Atlas enneigé',
     'A traveler looking out over Marrakech and the snowy Atlas', 'مسافرة تتأمّل مراكش وجبال الأطلس المكسوّة بالثلوج'),
    ('btp', '40% 45%', 'Chefs de chantier qui consultent les plans devant une grue',
     'Site managers reviewing plans in front of a crane', 'مسؤولا ورش يراجعان المخططات أمام رافعة'),
]


def esc(s):
    return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


def assets():
    """Prépare les trois tailles de chaque photo ; retire les anciennes versions devenues inutiles."""
    out, keep = [], set()
    for key, *_ in CARDS:
        src = os.path.join(SRC, key + '.webp')
        h = hashlib.sha1(open(src, 'rb').read()).hexdigest()[:10]
        im = None
        files = []
        for w in WIDTHS:
            name = 'mt-%s-%d.webp' % (h, w)
            keep.add(name)
            dst = os.path.join(SITE, 'assets', name)
            if not os.path.exists(dst):
                im = im or Image.open(src).convert('RGB')
                r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
                r.save(dst, 'WEBP', quality=76 if w > 900 else 78, method=6)
            files.append(name)
        ref = Image.open(os.path.join(SITE, 'assets', files[0]))
        out.append((files, ref.size))
    for f in glob.glob(os.path.join(SITE, 'assets', 'mt-*.webp')):
        if os.path.basename(f) not in keep:
            os.remove(f)
    return out


def text_on(color):
    """Couleur du texte lisible sur le bouton (couleur d'accent du métier)."""
    c = color.lstrip('#')
    r, g, b = (int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in (r, g, b)]
    L = .2126 * lin[0] + .7152 * lin[1] + .0722 * lin[2]
    return '#0B1B3A' if L > .36 else '#fff'


def card_html(old, files, size, card):
    key, pos, alt = card[0], card[1], card[2]
    style = re.search(r'class="sp-site[^"]*"[^>]*? style="([^"]*)"', old).group(1)
    style = re.sub(r';?--(acf|op):[^;]*', '', style)
    ac = re.search(r'--ac:(#[0-9A-Fa-f]{6})', style).group(1)
    style += ';--acf:%s;--op:%s' % (text_on(ac), pos)
    k = re.search(r'<span class="sp-k">(.*?)</span>', old).group(1)
    b = re.search(r'<b>(.*?)</b>', old).group(1)
    cta = re.search(r'<span class="sp-cta">(.*?)</span>', old).group(1)
    srcset = ', '.join('assets/%s %dw' % (f, w) for f, w in zip(files, WIDTHS))
    img = ('<img src="assets/%s" srcset="%s" sizes="%s" width="%d" height="%d" alt="%s" loading="lazy" decoding="async">'
           % (files[0], srcset, SIZES, size[0], size[1], esc(alt)))
    return ('<div class="mc2-site"><div class="sp-site sp-ph" data-m="%s" style="%s">'
            '<div class="sp-img">%s</div>'
            '<div class="sp-bar" aria-hidden="true"><i></i><i></i><i></i><span class="sp-u"></span></div>'
            '<div class="sp-l"><span class="sp-k">%s</span><b>%s</b><span class="sp-cta">%s</span></div>'
            '</div></div>') % (key, style, img, k, b, cta)


def i18n():
    """Descriptions des photos (alt) : ajoutées aux traductions si elles n'y sont pas encore."""
    paths = {n: os.path.join(I18N, n + '.json') for n in ('strings', 'en', 'ar')}
    data = {n: json.load(open(p, encoding='utf-8')) for n, p in paths.items()}
    added = 0
    for _, _, fr, en, ar in CARDS:
        sid = hashlib.sha1(fr.encode('utf-8')).hexdigest()[:12]
        if sid not in data['strings']:
            data['strings'][sid] = {'fr': fr, 'kind': 'attr:alt', 'ctx': 'photo d’un métier (accueil)', 'pages': ['index.html']}
            added += 1
        for n, t in (('en', en), ('ar', ar)):
            if sid not in data[n]:
                data[n][sid] = t
                added += 1
    if added:
        # même mise en forme que tools/i18n_extract.py (strings) et que les traductions (triées)
        open(paths['strings'], 'w', encoding='utf-8').write(json.dumps(data['strings'], ensure_ascii=False, indent=1))
        for n in ('en', 'ar'):
            open(paths[n], 'w', encoding='utf-8').write(json.dumps(data[n], ensure_ascii=False, indent=1, sort_keys=True) + '\n')
    return added


def main():
    h = open(P, encoding='utf-8').read()
    imgs = assets()
    n = 0

    def repl(m):
        nonlocal n
        i = int(m.group(1))
        if i >= len(CARDS):
            return m.group(0)
        n += 1
        files, size = imgs[i]
        return m.group(0).replace(m.group(2), card_html(m.group(2), files, size, CARDS[i]))

    h = re.sub(r'<article class="mc2[^"]*" data-i="(\d+)">(<div class="mc2-site">.*?)(?=<div class="mc2-b">)', repl, h, flags=re.S)
    if n != len(CARDS):
        raise SystemExit('métiers : %d cartes trouvées au lieu de %d' % (n, len(CARDS)))
    open(P, 'w', encoding='utf-8').write(h)
    print('%d cartes métiers avec leur photo (%s px) ; %d descriptions ajoutées aux traductions'
          % (n, ' / '.join(map(str, WIDTHS)), i18n()))


if __name__ == '__main__':
    main()
