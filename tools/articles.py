"""Articles SEO / GEO : crée les pages à partir de src/articles/*.json (idempotent).

Chaque fichier JSON (titre, description, h1, chapeau, sections, FAQ, articles liés) devient une page au
design des guides : sommaire cliquable, tableaux comparatifs, encadrés, FAQ (lue par Google et les IA via
Schema.org FAQPage) et « À lire aussi ». La page faq.html regroupe toutes les questions par thème.

Le script met aussi à jour la page Guides (toutes les cartes) et ajoute une colonne « Guides » au pied de
page de toutes les pages, pour que Google et les IA trouvent chaque article.

Usage : python3 tools/articles.py
"""
import glob, html, json, os, re, unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
SRC = os.path.join(ROOT, 'src', 'articles')
BASE = os.path.join(SITE, 'guide-prix-site-web-maroc.html')

# Page Guides : trois familles (une page absente est simplement ignorée), la FAQ à la fin
GROUPS = [
    ('Créer et réussir en ligne', 'Les bases,', 'expliquées simplement.',
     ['creation-site-web-maroc.html', 'guide-prix-site-web-maroc.html', 'creer-boutique-en-ligne-maroc.html', 'shopify-maroc.html',
      'application-mobile-maroc.html', 'agence-web-maroc.html', 'wordpress-ou-sur-mesure-maroc.html',
      'guide-site-vitrine-boutique-application.html', 'nom-de-domaine-ma.html', 'guide-bon-moment-maroc.html']),
    ('Par métier', 'Un guide', 'pour votre activité.',
     ['site-web-dentiste-maroc.html', 'site-web-medecin-clinique-maroc.html', 'site-web-ecole-privee-maroc.html',
      'site-web-institut-beaute-maroc.html', 'site-web-restaurant-maroc.html', 'site-web-riad-hotel-maroc.html',
      'site-web-auto-ecole-maroc.html', 'site-web-agence-immobiliere-maroc.html']),
    ('Visibilité et ventes', 'Être trouvé,', 'et choisi.',
     ['referencement-seo-maroc.html', 'guide-google-chatgpt-maroc.html', 'guide-fiche-google-business-maroc.html',
      'avis-google-maroc.html', 'publicite-google-maroc.html', 'vendre-instagram-whatsapp-maroc.html',
      'paiement-en-ligne-maroc.html', 'faq.html']),
]
FOOT = [('creation-site-web-maroc.html', 'Création de site web'), ('creer-boutique-en-ligne-maroc.html', 'Boutique en ligne'),
        ('shopify-maroc.html', 'Shopify au Maroc'), ('application-mobile-maroc.html', 'Application mobile'),
        ('referencement-seo-maroc.html', 'Référencement SEO'), ('agence-web-maroc.html', 'Choisir une agence web'),
        ('faq.html', 'Questions fréquentes')]


def slug(s):
    s = unicodedata.normalize('NFKD', re.sub(r'<[^>]+>', '', s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:60]


def esc(s):
    return html.escape(s, quote=False)


def blocks(bs):
    out = []
    for b in bs:
        if 'p' in b:
            out.append('<p class="rv">%s</p>' % b['p'])
        elif 'ul' in b:
            out.append('<ul class="rv">%s</ul>' % ''.join('<li>%s</li>' % x for x in b['ul']))
        elif 'ol' in b:
            out.append('<ol class="rv">%s</ol>' % ''.join('<li>%s</li>' % x for x in b['ol']))
        elif 'img' in b:
            out.append(figure(b['img'], b.get('alt', ''), b.get('cap', '')))
        elif 'note' in b:
            out.append('<p class="rv art-note">%s</p>' % b['note'])
        elif 'table' in b:
            t = b['table']
            out.append('<div class="rv art-tbl"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (
                ''.join('<th scope="col">%s</th>' % x for x in t['head']),
                ''.join('<tr>%s</tr>' % ''.join(('<th scope="row">%s</th>' if i == 0 else '<td>%s</td>') % c
                                                for i, c in enumerate(r)) for r in t['rows'])))
    return ''.join(out)


BAR = '<span class="art-bar"><i></i><i></i><i></i></span>'


def shot(img):
    """Vignette 760 × 475 (haut de la page) pour la couverture d'un article."""
    dst = os.path.join(SITE, 'assets', 'c-%s.webp' % img)
    if not os.path.exists(dst):
        from PIL import Image
        im = Image.open(os.path.join(SITE, 'assets', img + '.webp')).convert('RGB')
        w = im.width
        im.crop((0, 0, w, round(w * .625))).save(dst, 'WEBP', quality=80)
    return 'assets/c-%s.webp' % img


def figure(img, alt, cap):
    """Capture d'un vrai site dans un cadre de navigateur ; au survol, la page défile de haut en bas."""
    return ('<figure class="art-fig rv"><div class="art-shot" tabindex="0">%s<div class="art-scroll"><img src="assets/%s.webp" alt="%s" '
            'loading="lazy" decoding="async"></div></div>%s</figure>') % (
        BAR, img, html.escape(alt, quote=True), ('<figcaption>%s</figcaption>' % cap) if cap else '')


def article(d):
    secs = d.get('sections') or []
    toc = ''
    if len(secs) > 3:
        toc = '<nav class="art-toc rv" aria-label="Sommaire"><b>Sommaire</b><ol>%s</ol></nav>' % ''.join(
            '<li><a href="#%s">%s</a></li>' % (slug(s['h2']), s['h2']) for s in secs)
    body = ''.join('<h2 class="rv" id="%s">%s</h2>%s' % (slug(s['h2']), s['h2'], blocks(s['blocks'])) for s in secs)
    cover = ''
    if d.get('cover'):
        cover = ('<figure class="art-cover rv"><div class="art-shot">%s<img src="%s" alt="" width="760" height="475" '
                 'fetchpriority="high" decoding="async"></div></figure>') % (BAR, shot(d['cover']))
    return '<section class="blk art-wrap"><article class="art w nar">%s%s%s</article></section>' % (cover, toc, body)


def faq_items(qs):
    return ''.join('<details class="rv"><summary>%s<i aria-hidden="true"></i></summary><p>%s</p></details>' % (q['q'], q['a'])
                   for q in qs)


def faq_section(qs, pill='Questions', l1='En bref,', l2='les réponses.', sid='faq'):
    return ('<section class="blk" id="%s"><div class="sh"><span class="pill rv"><span class="ic"></span>%s</span>'
            '<h2 class="rv d1"><span class="l"><span class="li">%s</span></span><span class="l"><span class="li grad">%s</span></span></h2>'
            '</div><div class="faq w nar mt">%s</div></section>') % (sid, pill, l1, l2, faq_items(qs))


def card_info(name, data):
    """Titre, description et durée de lecture d'une page (nouvel article ou guide existant)."""
    if name in data:
        d = data[name]
        return d['headline'], d['description'], re.sub(r'^[^,]*,\s*', '', d['eyebrow'])
    h = open(os.path.join(SITE, name), encoding='utf-8').read()
    t = re.search(r'<b class="gd-t">', h)
    title = html.unescape(re.search(r'<title>(.*?)</title>', h, re.S).group(1)).split(' | ')[0]
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', h).group(1))
    eb = re.search(r'<p class="eyebrow in">.*?<span>(.*?)</span>', h, re.S)
    mins = re.sub(r'^[^,]*,\s*', '', eb.group(1)) if eb else ''
    return title, desc, mins


def cards(names, data, tpl):
    out = []
    for i, n in enumerate(names):
        t, d, mins = card_info(n, data)
        c = tpl.replace('href="guide-bon-moment-maroc.html"', 'href="%s"' % n)
        c = re.sub(r'(<span class="gd-meta"><svg.*?</svg>)[^<]*', lambda m: m.group(1) + esc(mins), c, flags=re.S)
        c = re.sub(r'<b class="gd-t">.*?</b>', '<b class="gd-t">%s</b>' % esc(t), c, flags=re.S)
        c = re.sub(r'<span class="gd-d">.*?</span>', '<span class="gd-d">%s</span>' % esc(d), c, flags=re.S)
        if i % 2:
            c = c.replace('class="gd light rv"', 'class="gd light rv d1"', 1)
        out.append(c)
    return ''.join(out)


def page(d, base, data, tpl):
    h = base
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % esc(d['title']), h, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">',
               '<meta name="description" content="%s">' % html.escape(d['description'], quote=True), h, count=1)
    h = re.sub(r'(<p class="eyebrow in"><i class="live" aria-hidden="true"></i><span>).*?(</span>)',
               lambda m: m.group(1) + esc(d['eyebrow']) + m.group(2), h, count=1, flags=re.S)
    h = re.sub(r'(<h1 class="hin">).*?(</h1>)', lambda m: m.group(1) +
               '<span class="l"><span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span>' % (
                   esc(d['h1'][0]), esc(d['h1'][1])) + m.group(2), h, count=1, flags=re.S)
    h = re.sub(r'(<p class="lead in2 hin">).*?(</p>)', lambda m: m.group(1) + esc(d['lead']) + m.group(2), h, count=1, flags=re.S)
    a = h.index('<section class="blk art-wrap">')
    b = h.index('<section class="blk"><div class="cband')
    mid = article(d)
    if d.get('groups'):
        nav = '<nav class="faq-nav w nar rv" aria-label="Thèmes">%s</nav>' % ''.join(
            '<a href="#%s">%s</a>' % (slug(g['name']), esc(g['name'])) for g in d['groups'])
        mid = mid.replace('</article></section>', '</article>%s</section>' % nav) if d.get('sections') else \
            '<section class="blk art-wrap">%s</section>' % nav
        mid += ''.join(faq_section(g['faq'], 'Questions', esc(g['name']), '', slug(g['name'])).replace(
            '<span class="l"><span class="li grad"></span></span>', '') for g in d['groups'])
    elif d.get('faq'):
        mid += faq_section(d['faq'])
    rel = [r for r in d.get('related', []) if os.path.exists(os.path.join(SITE, r)) or r in data][:3]
    if rel:
        mid += ('<section class="blk"><div class="sh"><span class="pill rv"><span class="ic"></span>À lire aussi</span>'
                '<h2 class="rv d1"><span class="l"><span class="li">Un autre guide</span></span><span class="l">'
                '<span class="li grad">pour avancer.</span></span></h2></div><div class="gd-grid">%s</div></section>') % cards(rel, data, tpl)
    h = h[:a] + mid + h[b:]
    # les données structurées sont écrites par seo.py (Article + FAQPage), pas ici
    h = re.sub(r'<script type="application/ld\+json">(?:(?!</script>).)*"@type": "Article".*?</script>', '', h, flags=re.S)
    return h


def footer(h):
    if 'aria-label="Guides"><h6>' in h:
        h = re.sub(r'<nav class="f-col" aria-label="Guides">.*?</nav>\s*', '', h, flags=re.S)
    col = '<nav class="f-col" aria-label="Guides"><h6>Guides</h6>%s</nav>\n  ' % ''.join(
        '<a href="%s">%s</a>' % (n, esc(t)) for n, t in FOOT)
    i = h.find('<div class="f-col"><h6>Contact</h6>')
    return h if i < 0 else h[:i] + col + h[i:]


def main():
    data = {}
    for f in sorted(glob.glob(os.path.join(SRC, '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        data[d['file']] = d
    base = open(BASE, encoding='utf-8').read()
    tpl = re.search(r'<a class="gd light rv" href="guide-bon-moment-maroc\.html">.*?</a>', base, re.S).group(0)
    for name, d in data.items():
        open(os.path.join(SITE, name), 'w', encoding='utf-8').write(page(d, base, data, tpl))
    # page Guides : les cartes, par famille
    p = os.path.join(SITE, 'guides.html')
    g = open(p, encoding='utf-8').read()
    have = lambda n: n in data or os.path.exists(os.path.join(SITE, n))
    secs = ''.join(('<section class="blk gd-fam"><div class="sh"><span class="pill rv"><span class="ic"></span>%s</span>'
                    '<h2 class="rv d1"><span class="l"><span class="li">%s</span></span><span class="l"><span class="li grad">%s</span>'
                    '</span></h2></div><div class="gd-grid">%s</div></section>') % (t, l1, l2, cards([n for n in names if have(n)], data, tpl))
                   for t, l1, l2, names in GROUPS)
    g = re.sub(r'<!--dg:guides-->.*?<!--/dg:guides-->', '', g, flags=re.S)
    a = g.find('<section class="blk', g.index('</header>'))
    b = g.index('<section class="blk"><div class="cband')
    a = b if a < 0 or a > b else a
    g = g[:a] + '<!--dg:guides-->' + secs + '<!--/dg:guides-->' + g[b:]
    open(p, 'w', encoding='utf-8').write(g)
    # pied de page de toutes les pages
    for f in glob.glob(os.path.join(SITE, '*.html')):
        h = open(f, encoding='utf-8').read()
        n = footer(h)
        if n != h:
            open(f, 'w', encoding='utf-8').write(n)
    # les anciens guides : leurs données structurées sont désormais dans seo.py
    for f in glob.glob(os.path.join(SITE, 'guide-*.html')):
        h = open(f, encoding='utf-8').read()
        n = re.sub(r'<script type="application/ld\+json">\{"@context": "https://schema\.org", "@graph": \[\{"@type": "Article".*?</script>', '', h, flags=re.S)
        if n != h:
            open(f, 'w', encoding='utf-8').write(n)
    print(len(data), 'articles ; page Guides :', sum(len(x[3]) for x in GROUPS), 'cartes prévues')


if __name__ == '__main__':
    main()
