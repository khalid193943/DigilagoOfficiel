"""Identité Digilago : les icônes (agence, Lab, Radar, Gestion) et leurs fichiers.

Un seul D, une direction par partie (planche d'identité « Le jour se lève ») :
  agence   le D blanc sur le bleu du jour
  lab      le D couché devient un soleil d'or qui se lève sur l'horizon, la nuit
  radar    le D devient un écran gradué qui balaie ; les points verts sont les entreprises trouvées
  gestion  le D tranché en lignes de registre ; la dernière, verte et cochée, est réglée

tools/identity.py s'en sert à chaque construction (icône de l'onglet). Ce script, lancé à la main, écrit les
images fixes : icônes iPhone et Android, favicon.ico, logo carré pour Google.

Usage : python3 tools/brand.py
"""
import io, os, urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'site', 'assets', 'brand')

SIGNATURE = ('Votre infrastructure digitale, entre de bonnes mains.', 'Aujourd’hui et demain.')
SIGNATURE_EN = ('Your digital infrastructure, in good hands.', 'Today and tomorrow.')
SIGNATURE_AR = ('بنيتكم الرقمية في أيدٍ أمينة،', 'اليوم وغداً.')

DAY, DAY_DEEP, NIGHT, SUN, SKY, CLOUD, OK = '#2F84EC', '#1F57C7', '#071433', '#F5B83D', '#5F9FF9', '#DDEBFF', '#3DDC97'

# Les quatre marques, dessinées dans leur propre repère (viewBox 14 8 38 48, ou -2 -2 48 40 pour le soleil).
D_BAR = '<rect x="16" y="10" width="8" height="44" rx="1.5" fill="%s"/>'
MARKS = {
    'agence': (D_BAR % '#FFFFFF') + '<path d="M28 10A22 22 0 0 1 28 54Z" fill="#FFFFFF"/>',
    'lab': '<path d="M0 22A22 22 0 0 1 44 22Z" fill="%s"/><rect x="0" y="26" width="44" height="8" rx="1.5" fill="#FFFFFF"/>' % SUN,
    'radar': (D_BAR % SKY) +
    '<path d="M28 10A22 22 0 0 1 28 54Z" fill="%s" fill-opacity=".16"/>' % SKY +
    '<path d="M28 10A22 22 0 0 1 28 54" fill="none" stroke="%s" stroke-width="2"/>' % SKY +
    '<path d="M28 17A15 15 0 0 1 28 47M28 24A8 8 0 0 1 28 40" fill="none" stroke="%s" stroke-width="1.3" stroke-opacity=".6"/>' % SKY +
    '<path d="M35.88 11.46A22 22 0 0 1 47.94 22.7L28 32Z" fill="#9FC8FF" fill-opacity=".3"/>'
    '<path d="M41.85 14.9A22 22 0 0 1 47.94 22.7L28 32Z" fill="#9FC8FF" fill-opacity=".35"/>'
    '<path d="M28 32L47.94 22.7" stroke="%s" stroke-width="2" stroke-linecap="round"/>' % CLOUD +
    '<circle cx="39.49" cy="22.36" r="2.2" fill="%s"/><circle cx="35.36" cy="40.17" r="1.7" fill="%s" fill-opacity=".6"/>' % (OK, OK),
    'gestion': (D_BAR % SKY) +
    '<path d="M28 10A22 22 0 0 1 46.1 19.5H28Z" fill="%s"/>' % CLOUD +
    '<path d="M28 21.5H47.33A22 22 0 0 1 49.98 31H28Z" fill="#A9CBFB"/>'
    '<path d="M28 33H49.98A22 22 0 0 1 47.33 42.5H28Z" fill="#6FA6F6"/>'
    '<path d="M28 44.5H46.1A22 22 0 0 1 28 54Z" fill="%s"/>' % OK +
    '<path d="M31.5 48.6l2.3 2.2 4.4-4.2" fill="none" stroke="%s" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' % NIGHT,
}
# Place de chaque marque dans l'icône 64 × 64 (décalage x, décalage y, échelle, origine du repère).
FIT = {'agence': (18.6, 15, .71, (14, 8)), 'lab': (13, 17.6, .864, (0, 0)),
       'radar': (16, 13, .79, (14, 8)), 'gestion': (16, 13, .79, (14, 8))}


def icon(kind, rounded=True):
    """Icône carrée 64 × 64 : coins arrondis pour l'onglet, pleine page pour iPhone et Android (qui arrondissent eux-mêmes)."""
    x, y, k, (ox, oy) = FIT[kind]
    r = 14 if rounded else 0
    if kind == 'agence':
        bg = ('<defs><linearGradient id="g" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="%s"/>'
              '<stop offset="1" stop-color="%s"/></linearGradient></defs><rect width="64" height="64" rx="%d" fill="url(#g)"/>'
              % (DAY, DAY_DEEP, r))
    else:
        bg = '<rect width="64" height="64" rx="%d" fill="%s"/>' % (r, NIGHT)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">%s<g transform="translate(%s %s) scale(%s) translate(%s %s)">%s</g></svg>'
            % (bg, x, y, k, -ox, -oy, MARKS[kind]))


def data_uri(svg):
    return 'data:image/svg+xml,' + urllib.parse.quote(svg, safe=' =:/,#()".-')


def squeeze(png, kind):
    """Allège l'image : 256 couleurs pour les fonds de nuit (unis), couleurs pleines pour le dégradé du jour."""
    try:
        from PIL import Image
    except ImportError:
        return png
    im = Image.open(io.BytesIO(png)).convert('RGB')
    if kind != 'agence':
        im = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    out = io.BytesIO()
    im.save(out, 'PNG', optimize=True)
    return out.getvalue()


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(OUT, exist_ok=True)
    jobs = [('apple-touch-icon.png', 'agence', 180, False), ('icon-192.png', 'agence', 192, False),
            ('icon-512.png', 'agence', 512, False),
            ('apple-touch-icon-lab.png', 'lab', 180, False), ('apple-touch-icon-radar.png', 'radar', 180, False),
            ('apple-touch-icon-gestion.png', 'gestion', 180, False)]
    ico = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        for name, kind, size, rounded in jobs + [('ico-%d' % s, 'agence', s, True) for s in (16, 32, 48)]:
            pg.set_viewport_size({'width': size, 'height': size})
            pg.set_content('<html><body style="margin:0;background:transparent">%s</body></html>'
                           % icon(kind, rounded).replace('<svg ', '<svg width="%d" height="%d" ' % (size, size), 1))
            png = pg.screenshot(omit_background=True)
            if name.startswith('ico-'):
                ico[size] = png
            else:
                open(os.path.join(OUT, name), 'wb').write(squeeze(png, kind))
        b.close()
    try:
        from PIL import Image
        imgs = [Image.open(io.BytesIO(ico[s])) for s in (48, 32, 16)]
        imgs[0].save(os.path.join(ROOT, 'site', 'favicon.ico'), sizes=[(48, 48), (32, 32), (16, 16)], append_images=imgs[1:])
    except ImportError:
        print('Pillow absent : favicon.ico non écrit')
    print('écrit', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
