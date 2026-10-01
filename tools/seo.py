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


LANGS = {'fr': ('', 'fr_MA'), 'en': ('/en', 'en_US'), 'ar': ('/ar', 'ar_MA')}
ORG_DESC = {
    'fr': ORG['description'],
    'en': 'Web agency in El Jadida: websites, Google Business Profile, SEO and visibility in AI assistants '
          'for Moroccan businesses, in Morocco and abroad.',
    'ar': 'وكالة رقمية في الجديدة: مواقع إلكترونية، ملف Google التجاري، تحسين الظهور في محركات البحث '
          'والظهور في أدوات الذكاء الاصطناعي للشركات المغربية، داخل المغرب وخارجه.',
}


def page_url(name, lang):
    return URL + LANGS[lang][0] + ('/' if name == 'index.html' else '/' + name)


def block(name, h, lang='fr'):
    title = text(re.search(r'<title>(.*?)</title>', h, re.S).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', h).group(1))
    url = page_url(name, lang)
    org = dict(ORG, description=ORG_DESC[lang])
    graph = [org] if name == 'index.html' else [{'@type': 'Organization', '@id': ORG['@id'], 'name': 'Digilago', 'url': URL + '/'}]
    if name.startswith('guide-'):
        graph.append({'@type': 'Article', 'headline': title.split(' | ')[0], 'description': desc,
                      'inLanguage': lang, 'mainEntityOfPage': url, 'image': URL + OG,
                      'author': {'@id': ORG['@id']}, 'publisher': {'@id': ORG['@id']}})
    elif name != '404.html':
        graph.append({'@type': 'WebPage', 'name': title, 'description': desc, 'url': url,
                      'inLanguage': lang, 'isPartOf': {'@type': 'WebSite', 'name': 'Digilago', 'url': URL + '/'}})
    f = faq(h)
    if f:
        graph.append(f)
    e = lambda s: html.escape(s, quote=True)
    tags = []
    if name != '404.html':
        tags.append('<link rel="canonical" href="%s">' % url)
        # chaque langue annonce ses équivalents : Google sert la bonne version à chacun
        tags += ['<link rel="alternate" hreflang="%s" href="%s">' % (l, page_url(name, l)) for l in LANGS]
        tags.append('<link rel="alternate" hreflang="x-default" href="%s">' % page_url(name, 'fr'))
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


def files():
    for lang, (prefix, _) in LANGS.items():
        d = os.path.join(SITE, prefix.strip('/'))
        for f in sorted(glob.glob(os.path.join(d, '*.html'))):
            yield lang, f


def main():
    for lang, f in files():
        name = os.path.basename(f)
        h = open(f, encoding='utf-8').read()
        h = re.sub(r'\n?' + re.escape(START) + '.*?' + re.escape(END) + r'\n?', '\n', h, flags=re.S)
        h = re.sub(r'<meta property="og:locale" content="[^"]*">', '<meta property="og:locale" content="%s">' % LANGS[lang][1], h)
        b = block(name, h, lang)
        # juste avant les polices (ou, à défaut, avant le premier <style>)
        i = h.find('<!--dg:fonts-->')
        if i < 0:
            i = h.find('<link rel="preconnect"')
        if i < 0:
            i = h.index('<style>')
        h = h[:i].rstrip('\n') + '\n' + b + '\n' + h[i:]
        open(f, 'w', encoding='utf-8').write(h)
    # sitemap : chaque page dans les 3 langues, avec ses équivalents (pas de 404)
    import datetime
    today = datetime.date.today().isoformat()
    prio = {'index.html': '1.0', 'demarrer.html': '0.9', 'services.html': '0.9', 'realisations.html': '0.8',
            'contact.html': '0.8', 'a-propos.html': '0.7', 'guides.html': '0.7'}
    names = sorted(os.path.basename(f) for f in glob.glob(os.path.join(SITE, '*.html')) if not f.endswith('404.html'))
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for n in names:
        for lang in LANGS:
            alts = ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (l, page_url(n, l)) for l in LANGS)
            p = prio.get(n, '0.6' if n.startswith('guide-') else '0.3')
            out.append('  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority>%s</url>' % (page_url(n, lang), today, p, alts))
    out.append('</urlset>')
    open(os.path.join(SITE, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print('sitemap :', len(names) * len(LANGS), 'adresses')


if __name__ == '__main__':
    main()
