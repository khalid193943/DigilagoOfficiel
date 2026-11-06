#!/usr/bin/env python3
"""Assemble le jeu en une seule page.

  dist/lago/index.html   la version du site (https://www.digilago.ma/lago/) : polices du site, mesure d'audience
                         seulement si le visiteur l'a acceptée sur digilago.ma (même bandeau que le site)
  dist/jeu-lago.html     la version autonome (aperçu, artefact) : polices Google, aucune mesure

Dans le dépôt du site, la version du site est aussi copiée dans site/lago/index.html.
src/assets.js (les dessins) est produit à part, par les générateurs de personnages (build_assets.py, hors dépôt).

Usage : python3 jeu/build.py      (test : node jeu/test.cjs jeu/dist/jeu-lago.html)
"""
import json, pathlib, re

HERE = pathlib.Path(__file__).parent
SRC, DIST = HERE / 'src', HERE / 'dist'
URL = 'https://www.digilago.ma/lago/'
OG = 'https://www.digilago.ma/assets/lab/og-lago.jpg'
TITLE = 'LAGO, allume le Maroc : le jeu gratuit de Digilago'
TITLE_ALONE = 'LAGO, allume le Maroc'
DESC = ('Un jeu gratuit pour téléphone et ordinateur : aidez Lago, Radar et Gestion à mettre en ligne les entreprises '
        'de Casablanca. Devis écrit, site en 72 heures, réponse le jour même. Sans inscription, sans publicité.')

ASSETS = json.loads(re.match(r'window\.ASSETS = (.*);\s*$', (SRC / 'assets.js').read_text(), re.S).group(1))

LD = {
    '@context': 'https://schema.org',
    '@graph': [
        {'@type': 'Game', '@id': URL + '#jeu', 'name': 'LAGO, allume le Maroc', 'alternateName': 'LAGO',
         'url': URL, 'image': OG, 'description': DESC, 'inLanguage': 'fr', 'genre': ['Jeu de gestion', 'Jeu éducatif'],
         'isAccessibleForFree': True, 'numberOfPlayers': {'@type': 'QuantitativeValue', 'value': 1},
         'author': {'@id': 'https://www.digilago.ma/#digilago'}, 'publisher': {'@id': 'https://www.digilago.ma/#digilago'},
         'character': [{'@type': 'Person', 'name': n} for n in ('Lago', 'Radar', 'Gestion', 'Cumulus')],
         'gameLocation': {'@type': 'Place', 'name': 'Casablanca', 'address': {'@type': 'PostalAddress', 'addressCountry': 'MA'}},
         'subjectOf': {'@type': 'WebPage', 'url': 'https://www.digilago.ma/lab-lago.html'},
         'isPartOf': {'@type': 'WebSite', 'name': 'Digilago', 'url': 'https://www.digilago.ma/'}},
        {'@type': 'Organization', '@id': 'https://www.digilago.ma/#digilago', 'name': 'Digilago', 'url': 'https://www.digilago.ma/'},
    ],
}

FAVICON = ('data:image/svg+xml,' + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23071433"/>'
           '<g transform="translate(17 12) scale(.82) translate(-14 -8)"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="%232F84EC"/>'
           '<path d="M28 10A22 22 0 0 1 28 54Z" fill="%23F5B83D"/></g></svg>').replace('"', "'")


def fonts(kind):
    if kind == 'site':
        f = lambda fam, w, file: ("@font-face{font-family:'%s';font-weight:%s;font-display:swap;src:url(../assets/fonts/%s.woff2) format('woff2')}"
                                 % (fam, w, file))
        return ('<link rel="preload" href="../assets/fonts/sora-500.woff2" as="font" type="font/woff2" crossorigin>'
                '<style>' + f('Sora', '400 600', 'sora-500') + f('Instrument Sans', '400 600', 'instrument-sans-400') + '</style>')
    return ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            '<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Sora:wght@500;600&display=swap" rel="stylesheet">')


# Mesure d'audience : seulement si le visiteur l'a acceptée sur digilago.ma (clé « dg_consent », même origine).
# Aucun bandeau ici : sans accord, rien n'est chargé et rien n'est envoyé.
MEASURE = """(function(){var cfg={ga4:'G-2CHFLEQ0ZP'},ok=false;
try{var c=JSON.parse(localStorage.getItem('dg_consent')||'null');ok=!!(c&&c.a&&Date.now()-c.t<365*864e5);}catch(e){}
window.track=function(n,p){if(!ok)return;try{gtag('event',n,p||{});}catch(e){}};
if(!ok)return;var dl=window.dataLayer=window.dataLayer||[];window.gtag=function(){dl.push(arguments);};
gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());gtag('config',cfg.ga4);var s=document.createElement('script');s.async=true;
s.src='https://www.googletagmanager.com/gtag/js?id='+cfg.ga4;document.head.appendChild(s);})();"""


def page(kind):
    css = (SRC / 'style.css').read_text()
    js = [(SRC / n).read_text() for n in ('assets.js', 'content.js', 'audio.js', 'engine.js', 'minigames.js')]
    cta = '/demarrer.html?source=jeu-lago' if kind == 'site' else 'https://www.digilago.ma/demarrer.html?source=jeu-lago'
    js[3] = js[3].replace("'https://digilago.ma/demarrer.html?source=jeu-lago'", repr(cta))
    measure = MEASURE if kind == 'site' else 'window.track=function(){};'
    canon = URL if kind == 'site' else 'https://www.digilago.ma/lab-lago.html'
    head = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{TITLE if kind == 'site' else TITLE_ALONE}</title>
<meta name="description" content="{DESC}">
<link rel="canonical" href="{canon}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#071433">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="LAGO">
<link rel="icon" href="{FAVICON}"><link rel="apple-touch-icon" href="https://www.digilago.ma/assets/brand/apple-touch-icon-lab.png">
<meta property="og:type" content="website"><meta property="og:site_name" content="Digilago"><meta property="og:locale" content="fr_MA">
<meta property="og:title" content="{TITLE}"><meta property="og:description" content="{DESC}"><meta property="og:url" content="{URL}">
<meta property="og:image" content="{OG}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Lago, le D de Digilago, devant les entreprises de Casablanca qui s’allument">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{TITLE}"><meta name="twitter:description" content="{DESC}"><meta name="twitter:image" content="{OG}">
<script type="application/ld+json">{json.dumps(LD, ensure_ascii=False, separators=(',', ':'))}</script>
{fonts(kind)}
<style>{css}
.vh{{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}
noscript p{{color:#fff;font:16px/1.5 system-ui;max-width:32em;margin:20vh auto;padding:0 16px}}</style>
<script>{measure}</script>
</head>
<body>
<h1 class="vh">LAGO, allume le Maroc</h1>
<p class="vh">{DESC} Un jeu du Digilago Lab : les entreprises sont fictives.</p>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>{ASSETS['defs']}</defs></svg>
<div id="stage" role="application" aria-label="Jeu LAGO, allume le Maroc"></div>
<noscript><p>Ce jeu a besoin de JavaScript. Découvrez-le sur <a style="color:#F5B83D" href="https://www.digilago.ma/lab-lago.html">la page du Digilago Lab</a>.</p></noscript>
"""
    body = ''.join('<script>%s</script>\n' % s.replace('</script', '<\\/script') for s in js)
    return head + body + '</body>\n</html>\n'


def artifact():
    """La version autonome sans squelette de document (l'hébergeur d'artefacts ajoute le sien)."""
    h = page('alone').replace('<link rel="icon" href="%s">' % FAVICON, '')
    h = re.sub(r'<!doctype html>|</?html[^>]*>|</?head>|</?body>|<meta [^>]*>|<link rel="(?:icon|apple-touch-icon|canonical)"[^>]*>', '', h)
    h = re.sub(r'<script type="application/ld\+json">.*?</script>', '', h, flags=re.S)
    return h.strip() + '\n'


if __name__ == '__main__':
    (DIST / 'artefact.html').parent.mkdir(parents=True, exist_ok=True)
    (DIST / 'artefact.html').write_text(artifact())
    (DIST / 'lago').mkdir(parents=True, exist_ok=True)
    for kind, out in (('site', DIST / 'lago' / 'index.html'), ('alone', DIST / 'jeu-lago.html')):
        out.write_text(page(kind))
        print(out, round(out.stat().st_size / 1024), 'KB')
    site = HERE.parent / 'site'
    if (site / 'index.html').exists():
        (site / 'lago').mkdir(exist_ok=True)
        (site / 'lago' / 'index.html').write_text(page('site'))
        print(site / 'lago' / 'index.html')
