"""Titres des pages (sauf l'accueil) : clairs, professionnels, qui donnent envie (idempotent).

Pour chaque page : le titre de l'onglet et de Google (<title>) et le grand titre (h1, deux lignes :
la première droite, la seconde en italique dégradé). Les traductions anglaise et arabe sont dans
src/i18n/en.json et ar.json.

Usage : python3 tools/titles.py
"""
import html, os, re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')

TITLES = {
    'services.html': ('Services : site web, fiche Google, SEO et IA au Maroc | Digilago',
                      'Site web, Google et IA :', 'tout pour gagner des clients.'),
    'realisations.html': ('Exemples de sites web par métier au Maroc | Digilago',
                          'Un site pour chaque métier.', 'Découvrez le vôtre en un clic.'),
    'a-propos.html': ('À propos de Digilago : agence web à El Jadida | Digilago',
                      'L’agence web d’El Jadida,', 'au service de tout le Maroc.'),
    'contact.html': ('Contactez Digilago : réponse le jour même | Digilago',
                     'Une question, un projet ?', 'Réponse le jour même.'),
    'demarrer.html': ('Démarrer votre projet : première version en 72 h | Digilago',
                      'Votre projet en ligne', 'en 5 étapes simples.'),
    'guides.html': ('Guides pratiques : site web, Google et IA au Maroc | Digilago',
                    'Les guides Digilago :', 'tout savoir avant de se lancer.'),
    'guide-prix-site-web-maroc.html': ('Prix d’un site web au Maroc en 2026 : le guide complet | Digilago',
                                       'Prix d’un site web au Maroc :', 'le guide 2026, sans surprise.'),
    'guide-fiche-google-business-maroc.html': ('Fiche Google Business au Maroc : apparaître sur Maps | Digilago',
                                               'Fiche Google Business :', 'apparaître sur Maps, pas à pas.'),
    'guide-google-chatgpt-maroc.html': ('Être trouvé sur Google et recommandé par ChatGPT au Maroc | Digilago',
                                        'Être trouvé sur Google', 'et recommandé par ChatGPT.'),
    'guide-site-vitrine-boutique-application.html': ('Site vitrine, boutique en ligne ou application : que choisir ? | Digilago',
                                                     'Site, boutique ou application :', 'lequel choisir pour vous ?'),
    'guide-bon-moment-maroc.html': ('Mettre son entreprise en ligne au Maroc : pourquoi maintenant | Digilago',
                                    'Votre entreprise en ligne :', 'pourquoi c’est le bon moment.'),
    'mentions-legales.html': ('Mentions légales | Digilago',
                              'Mentions légales', 'et informations sur l’éditeur.'),
    'confidentialite.html': ('Politique de confidentialité | Digilago',
                             'Confidentialité :', 'vos données restent les vôtres.'),
    '404.html': ('Page introuvable | Digilago',
                 'Page introuvable :', 'reprenons le bon chemin.'),
}


def main():
    for name, (title, l1, l2) in TITLES.items():
        p = os.path.join(SITE, name)
        h = open(p, encoding='utf-8').read()
        e = lambda s: html.escape(s, quote=False)
        h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % e(title), h, count=1, flags=re.S)
        h = re.sub(r'(<h1 class="hin">).*?(</h1>)',
                   lambda m: m.group(1) + '<span class="l"><span class="lx">%s</span></span><span class="l"><span class="grad">%s</span></span>' % (e(l1), e(l2)) + m.group(2),
                   h, count=1, flags=re.S)
        open(p, 'w', encoding='utf-8').write(h)
    print(len(TITLES), 'pages titrées')


if __name__ == '__main__':
    main()
