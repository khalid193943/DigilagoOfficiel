"""Balises SEO et partage pour toutes les pages (idempotent).

Ajoute dans le <head> de chaque page :
- l'URL canonique ;
- Open Graph et Twitter (aperçu quand on partage le lien sur WhatsApp,
  Facebook, LinkedIn, X…) avec l'image assets/og-digilago.jpg ;
- les données structurées Schema.org (JSON-LD), lues par Google et les IA :
  l'entreprise (ProfessionalService) sur l'accueil, Article sur chaque guide,
  FAQPage là où il y a une FAQ, et WebPage partout ailleurs.

Toutes les informations viennent du site lui-même (pied de page, titres, FAQ).

Usage : SITE_URL=https://digilago.ma python3 tools/seo.py
"""
import glob, html, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
URL = os.environ.get('SITE_URL', 'https://digilago.ma').rstrip('/')
OG = '/assets/og-digilago.jpg'
START, END = '<!--dg:seo-->', '<!--dg:seo-end-->'

ORG = {
    '@type': 'ProfessionalService',
    '@id': URL + '/#digilago',
    'name': 'Digilago',
    'url': URL + '/',
    'image': URL + OG,
    'logo': URL + OG,
    'description': 'Agence web à El Jadida : sites web, fiche Google, référencement et visibilité dans les IA '
                   'pour les entreprises marocaines, au Maroc comme à l’international.',
    'telephone': '+212649953813',
    'email': 'contact@digilago.ma',
    'address': {'@type': 'PostalAddress', 'addressLocality': 'El Jadida', 'addressCountry': 'MA'},
    'areaServed': [{'@type': 'Country', 'name': 'Maroc'}, 'International'],
    'openingHoursSpecification': [{
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        'opens': '09:00', 'closes': '19:00'}],
    'availableLanguage': ['fr', 'en', 'ar'],
    'sameAs': ['https://wa.me/212649953813'],
}


def text(s):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))).strip()


def faq(h):
    qa = re.findall(r'<details[^>]*><summary>(.*?)<i aria-hidden="true"></i></summary>(.*?)</details>', h, re.S)
    if not qa:
        return None
    return {'@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': text(q), 'acceptedAnswer': {'@type': 'Answer', 'text': text(a)}}
        for q, a in qa]}


def block(name, h):
    title = text(re.search(r'<title>(.*?)</title>', h, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', h).group(1))
    path = '/' if name == 'index.html' else '/' + name
    url = URL + path
    graph = [ORG] if name == 'index.html' else [{'@type': 'Organization', '@id': ORG['@id'], 'name': 'Digilago', 'url': URL + '/'}]
    if name.startswith('guide-'):
        graph.append({'@type': 'Article', 'headline': title.split(' | ')[0], 'description': desc,
                      'inLanguage': 'fr', 'mainEntityOfPage': url, 'image': URL + OG,
                      'author': {'@id': ORG['@id']}, 'publisher': {'@id': ORG['@id']}})
    elif name != '404.html':
        graph.append({'@type': 'WebPage', 'name': title, 'description': desc, 'url': url,
                      'inLanguage': 'fr', 'isPartOf': {'@type': 'WebSite', 'name': 'Digilago', 'url': URL + '/'}})
    f = faq(h)
    if f:
        graph.append(f)
    e = lambda s: html.escape(s, quote=True)
    tags = []
    if name != '404.html':
        tags.append('<link rel="canonical" href="%s">' % url)
    else:
        tags.append('<meta name="robots" content="noindex">')
    tags += [
        '<meta property="og:title" content="%s">' % e(title),
        '<meta property="og:description" content="%s">' % e(desc),
        '<meta property="og:url" content="%s">' % url,
        '<meta property="og:image" content="%s">' % (URL + OG),
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="%s">' % e(title),
        '<meta name="twitter:description" content="%s">' % e(desc),
        '<meta name="twitter:image" content="%s">' % (URL + OG),
        '<script type="application/ld+json">%s</script>' % json.dumps(
            {'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'),
    ]
    return START + ''.join(tags) + END


def main():
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        name = os.path.basename(f)
        h = open(f, encoding='utf-8').read()
        h = re.sub(r'\n?' + re.escape(START) + '.*?' + re.escape(END) + r'\n?', '\n', h, flags=re.S)
        b = block(name, h)
        # juste avant les polices (ou, à défaut, avant le premier <style>)
        i = h.find('<!--dg:fonts-->')
        if i < 0:
            i = h.find('<link rel="preconnect"')
        if i < 0:
            i = h.index('<style>')
        h = h[:i].rstrip('\n') + '\n' + b + '\n' + h[i:]
        open(f, 'w', encoding='utf-8').write(h)
        print(name.ljust(46), 'FAQ' if 'FAQPage' in b else '', 'Article' if 'Article' in b else '')
    # sitemap : pas de 404, URL de l'accueil propre
    sm = os.path.join(SITE, 'sitemap.xml')
    s = open(sm, encoding='utf-8').read()
    s = re.sub(r'<loc>https?://[^<]*/</loc>', '<loc>%s/</loc>' % URL, s)
    s = re.sub(r'https?://digilago\.ma', URL, s)
    open(sm, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    main()
