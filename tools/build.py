"""Construit le site : applique toutes les optimisations sur les pages de site/.

Chaque étape est idempotente : on peut relancer autant de fois que l'on veut,
y compris après avoir régénéré les pages avec l'ancien générateur.

  1. simplify_map  carte du monde allégée et chargée à la demande
  2. design_html   retouches de contenu de l'accueil
     hero_map      carte du nord du Maroc et entreprises en ligne (haut de l'accueil)
     demarrer      formulaire « Démarrer » en trois étapes, le plus simple possible
     story_night   diapositive « il travaille pendant que vous dormez » : une nuit cohérente
     metiers       photos des 12 métiers dans la section « Tous les métiers » (src/metiers/)
  3. dedupe_pages  plus aucun bloc en double entre les pages
     articles      articles SEO / GEO (src/articles/*.json), page Guides, colonne Guides du pied de page
     services_page page Services : expertises, clients, comparatif, garanties
     cta_band      bandeau de fin de page « On vous rappelle » (rappel gratuit, WhatsApp, démarrer)
     contact_page  formulaire de contact simplifié (détails facultatifs repliés)
     gradients     dégradés ciel → nuit entre les sections (src/css/gradients.css)
     titles        titres des pages (onglet, Google et grand titre), sauf l'accueil
  4. fonts         polices hébergées sur le site
  5. inject        JavaScript (src/js) et CSS (src/css) minifiés dans chaque page
  6. i18n_build    versions anglaise (site/en/) et arabe (site/ar/), sélecteur de langue
  7. seo           canonique, hreflang, Open Graph, Schema.org, sitemap (3 langues)
  8. set_gestion_url  relie les formulaires à l'espace de gestion (src/gestion_url.txt)

Usage : python3 tools/build.py      (ou : npm run build / make build)
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = ['simplify_map', 'design_html', 'hero_map', 'metiers', 'story_night', 'dedupe_pages', 'articles', 'services_page', 'cta_band', 'contact_page', 'demarrer', 'titles', 'gradients', 'fonts', 'inject', 'i18n_build', 'seo', 'set_gestion_url']

for s in STEPS:
    print('──', s)
    r = subprocess.run([sys.executable, os.path.join(HERE, s + '.py')], cwd=os.path.join(HERE, '..'))
    if r.returncode and not (s == 'simplify_map' and r.returncode == 1):
        sys.exit('échec : ' + s)
print('── site/ prêt')
