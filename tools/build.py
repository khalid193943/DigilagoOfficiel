"""Construit le site : applique toutes les optimisations sur les pages de site/.

Chaque étape est idempotente : on peut relancer autant de fois que l'on veut,
y compris après avoir régénéré les pages avec l'ancien générateur.

  1. simplify_map  carte du monde allégée et chargée à la demande
  2. design_html   retouches de contenu de l'accueil
  3. dedupe_pages  plus aucun bloc en double entre les pages
  4. fonts         polices hébergées sur le site
  5. inject        JavaScript (src/js) et CSS (src/css) minifiés dans chaque page
  6. i18n_build    versions anglaise (site/en/) et arabe (site/ar/), sélecteur de langue
  7. seo           canonique, hreflang, Open Graph, Schema.org, sitemap (3 langues)

Usage : python3 tools/build.py      (ou : npm run build / make build)
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = ['simplify_map', 'design_html', 'dedupe_pages', 'fonts', 'inject', 'i18n_build', 'seo']

for s in STEPS:
    print('──', s)
    r = subprocess.run([sys.executable, os.path.join(HERE, s + '.py')], cwd=os.path.join(HERE, '..'))
    if r.returncode and not (s == 'simplify_map' and r.returncode == 1):
        sys.exit('échec : ' + s)
print('── site/ prêt')
