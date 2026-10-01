"""Balises SEO et partage pour toutes les pages (idempotent).

Ajoute dans le <head> de chaque page :
- l'URL canonique ;
- Open Graph et Twitter (aperçu quand on partage le lien sur WhatsApp,
  Facebook, LinkedIn, X…) avec l'image assets/og-digilago.jpg ;
- les données structurées Schema.org (JSON-LD), lues par Google et les IA :
  l'entreprise (ProfessionalService) sur l'accueil, Article sur chaque guide,
  FAQPage là où il y a une FAQ, et WebPage partout ailleurs.

Toutes les informations viennent du site lui-même (pied de page, titres, FAQ).

Usage : python3 tools/seo.py   (SITE_URL=https://www.digilago.ma par défaut : l'adresse finale, sans redirection)
"""
import glob, html, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
URL = os.environ.get('SITE_URL', 'https://www.digilago.ma').rstrip('/')
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
    'knowsAbout': ['Création de site web', 'Développement web', 'Site e-commerce', 'Boutique en ligne', 'Shopify',
                   'Application mobile', 'Référencement SEO', 'Fiche Google Business', 'Visibilité dans les IA (GEO)',
                   'Hébergement et maintenance de sites web'],
    'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': 'Services Digilago', 'itemListElement': [
        {'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': n, 'areaServed': 'MA'}} for n in (
            'Création de site web sur mesure', 'Boutique en ligne et e-commerce', 'Application mobile et web',
            'Fiche Google Business et référencement local', 'Référencement SEO', 'Visibilité dans les assistants IA (GEO)',
            'Hébergement et maintenance')]},
}
# Articles : date de publication (les plus récents ont été écrits le 1er octobre 2026)
ARTICLES = {'creation-site-web-maroc.html': '2026-10-01', 'creer-boutique-en-ligne-maroc.html': '2026-10-01',
            'shopify-maroc.html': '2026-10-01', 'application-mobile-maroc.html': '2026-10-01',
            'agence-web-maroc.html': '2026-10-01', 'referencement-seo-maroc.html': '2026-10-01'}
CRUMB = {'fr': ('Accueil', 'Guides'), 'en': ('Home', 'Guides'), 'ar': ('الرئيسية', 'أدلّة')}


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
    if name.startswith('guide-') or name in ARTICLES:
        day = ARTICLES.get(name, '2026-09-27')
        graph.append({'@type': 'Article', 'headline': title.split(' | ')[0], 'description': desc,
                      'inLanguage': lang, 'mainEntityOfPage': url, 'image': URL + OG,
                      'datePublished': day, 'dateModified': '2026-10-01',
                      'author': {'@id': ORG['@id']}, 'publisher': {'@id': ORG['@id']}})
        graph.append({'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': CRUMB[lang][0], 'item': page_url('index.html', lang)},
            {'@type': 'ListItem', 'position': 2, 'name': CRUMB[lang][1], 'item': page_url('guides.html', lang)},
            {'@type': 'ListItem', 'position': 3, 'name': title.split(' | ')[0], 'item': url}]})
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


def llms(names):
    """llms.txt : la fiche de Digilago et le plan du site, écrits pour les assistants IA (ChatGPT, Claude,
    Perplexity…), avec les questions fréquentes en clair. Tout vient des pages du site."""
    def info(n):
        h = open(os.path.join(SITE, n), encoding='utf-8').read()
        t = text(re.search(r'<title>(.*?)</title>', h, re.S).group(1)).split(' | ')[0]
        d = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', h).group(1))
        return t, d, h
    out = ['# Digilago', '',
           '> ' + ORG['description'] + ' Studio à El Jadida, clients dans tout le Maroc et à l’international. '
           'Sites en français, arabe et anglais.', '',
           '- Téléphone et WhatsApp : +212 6 49 95 38 13', '- E-mail : contact@digilago.ma',
           '- Horaires : du lundi au samedi, de 9 h à 19 h', '- Site : ' + URL + '/', '',
           '## Services', '']
    out += ['- ' + o['itemOffered']['name'] for o in ORG['hasOfferCatalog']['itemListElement']]
    for title, pick in (('Pages principales', lambda n: not (n.startswith('guide-') or n in ARTICLES or n == 'faq.html')),
                        ('Guides', lambda n: n.startswith('guide-') or n in ARTICLES or n == 'faq.html')):
        out += ['', '## ' + title, '']
        for n in names:
            if pick(n) and n not in ('mentions-legales.html', 'confidentialite.html'):
                t, d, _ = info(n)
                out.append('- [%s](%s): %s' % (t, page_url(n, 'fr'), d))
    out += ['', '## Autres langues', '', '- English: %s/en/' % URL, '- العربية: %s/ar/' % URL, '', '## Questions fréquentes', '']
    seen = set()
    for n in ['faq.html'] + names:
        if not os.path.exists(os.path.join(SITE, n)):
            continue
        for q, a in re.findall(r'<details[^>]*><summary>(.*?)<i aria-hidden="true"></i></summary>(.*?)</details>',
                               info(n)[2], re.S):
            q, a = text(q), text(a)
            if q not in seen:
                seen.add(q)
                out += ['### ' + q, '', a, '']
    open(os.path.join(SITE, 'llms.txt'), 'w', encoding='utf-8').write('\n'.join(out).rstrip() + '\n')
    print('llms.txt :', len(seen), 'questions')


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
    llms(names)
    # robots.txt : tout est ouvert, y compris aux robots des assistants IA (ils citent les sites qu'ils lisent)
    bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot',
            'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot']
    open(os.path.join(SITE, 'robots.txt'), 'w', encoding='utf-8').write(
        'User-agent: *\nAllow: /\n\n' + ''.join('User-agent: %s\nAllow: /\n\n' % b for b in bots)
        + 'Sitemap: %s/sitemap.xml\n' % URL)
    print('sitemap :', len(names) * len(LANGS), 'adresses')


if __name__ == '__main__':
    main()
