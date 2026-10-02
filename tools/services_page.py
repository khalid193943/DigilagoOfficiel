"""Page Services : expertises en grille, clients, comparatif et garanties (idempotent).

Ajoute à services.html :
- sous le titre, trois garanties (prix écrit, première version en 72 h, réponse le jour même) ;
- « Nos expertises » : une grille de neuf expertises (site web, boutique en ligne, Shopify, application,
  fiche Google, SEO, IA, identité visuelle, hébergement), chacune reliée à son guide (maillage interne) ;
- les clients réels de Digilago ;
- « Sur mesure ou thème ? » : le comparatif d'un site Digilago et d'un site fait à partir d'un thème.

Usage : python3 tools/services_page.py
"""
import os, re
import brand_icons as BI

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
P = os.path.join(SITE, 'services.html')

I = {  # icônes au trait (24 × 24)
    'web': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9S14.6 18.2 12 21M12 3C9.4 5.8 8.1 8.8 8.1 12s1.3 6.2 3.9 9"/>',
    'shop': '<path d="M3 5h2.2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.4-1.1L20.6 8H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    'bag': '<path d="M5 8h14l-1.2 12.2a1.8 1.8 0 0 1-1.8 1.6H8a1.8 1.8 0 0 1-1.8-1.6z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
    'app': '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    'pin': '<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    'seo': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M7.5 12.5l2-2.2 2 1.6 2.5-3.2"/>',
    'ai': '<rect x="4.5" y="7" width="15" height="12" rx="3"/><path d="M12 7V4M9.5 12.5h.01M14.5 12.5h.01M9.5 16h5"/><circle cx="12" cy="3.4" r=".9"/>',
    'pen': '<path d="M4 20l4.2-1 10.4-10.4a2 2 0 0 0-2.8-2.8L5.4 16.2z"/><path d="M14.5 7.2l2.8 2.8"/>',
    'srv': '<rect x="3.5" y="4" width="17" height="6.5" rx="1.6"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.6"/><path d="M7 7.2h.01M7 16.7h.01M11 7.2h6M11 16.7h6"/>',
    'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'check': '<path d="M5 12.5l4.2 4.2L19 7"/>',
    'x': '<path d="M7 7l10 10M17 7 7 17"/>',
}


def ic(k, cls=''):
    return ('<svg class="%s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">%s</svg>') % (cls, I[k])


TILES = [  # (taille, icône, étiquette, titre, texte, puces, lien, texte du lien, image)
    ('xl', 'web', 'Site web', 'Création de site web sur mesure',
     'Vitrine, prise de rendez-vous ou site multilingue : un site rapide, beau sur téléphone et pensé pour Google dès le premier jour.',
     ['Design unique', 'Français · arabe · anglais', 'Première version en 72 h'], 'creation-site-web-maroc.html', 'Le guide de la création de site', '8058870faa'),
    ('wide', 'shop', 'E-commerce', 'Boutique en ligne et e-commerce',
     'Un catalogue clair, un parcours d’achat simple, le paiement par carte (CMI) ou à la livraison, et le suivi des commandes.',
     ['Catalogue et panier', 'Paiement à la livraison', 'Suivi des commandes'], 'creer-boutique-en-ligne-maroc.html', 'Créer sa boutique en ligne', '16d4918d6c'),
    ('', 'bag', 'Shopify', 'Boutique Shopify',
     'Mise en place, thème personnalisé à vos couleurs, boutique en français et en arabe.',
     [], 'shopify-maroc.html', 'Shopify au Maroc', ''),
    ('', 'app', 'Application', 'Application mobile',
     'iOS et Android : réservations, fidélité, commandes, de l’idée à la publication sur les stores.',
     [], 'application-mobile-maroc.html', 'Créer une application', ''),
    ('', 'pin', 'Google Maps', 'Fiche Google Business',
     'Apparaître sur la carte avec vos horaires, vos photos et vos avis.',
     [], 'guide-fiche-google-business-maroc.html', 'Le guide de la fiche Google', ''),
    ('', 'seo', 'SEO', 'Référencement SEO',
     'En tête des recherches de votre ville et de votre métier, durablement.',
     [], 'referencement-seo-maroc.html', 'Le guide du référencement', ''),
    ('', 'ai', 'GEO', 'Visibilité dans les IA',
     'ChatGPT, Gemini et Perplexity vous citent quand on leur demande conseil.',
     [], 'guide-google-chatgpt-maroc.html', 'Être cité par ChatGPT', ''),
    ('', 'pen', 'Identité', 'Logo et identité visuelle',
     'Une identité nette et reconnaissable, cohérente partout.',
     [], 'services.html#concevoir', 'Voir le détail', ''),
    ('wide', 'srv', 'Sérénité', 'Hébergement et maintenance',
     'Un site rapide, sécurisé et sauvegardé, des mises à jour suivies et une équipe joignable le jour même sur WhatsApp.',
     ['Certificat de sécurité', 'Sauvegardes', 'Mises à jour'], 'services.html#tourner', 'Voir le détail', ''),
]
CLIENTS = [('Académie Georges Claude', 'École privée, Sidi Bouzid', '7bb45a65f3'),
           ('Groupe scolaire Ange Bleu', 'École, El Jadida', '28230191c1'),
           ('Les Marronniers', 'Crèche et école, El Jadida', 'a16336b3d8'),
           ('Jardin Ange Bleu', 'Crèche et maternelle, El Jadida', 'fa2bebc12e')]
COMPARE = [  # (critère, site Digilago, site fait avec un thème)
    ('Design', 'Créé pour votre marque, jamais une copie', 'Le même thème que des milliers d’autres sites'),
    ('Vitesse', 'Optimisé pour s’afficher vite sur téléphone', 'Souvent lent, alourdi par des extensions'),
    ('Google', 'Structure SEO et données Schema.org dès le départ', 'À configurer soi-même, souvent difficile à bien référencer'),
    ('IA', 'Prêt à être cité par ChatGPT, Gemini et Perplexity', 'Rarement pensé pour les assistants IA'),
    ('Langues', 'Français, arabe et anglais, vraiment rédigés', 'Souvent une traduction automatique'),
    ('Prix', 'Annoncé par écrit avant de commencer', 'Licences, extensions et options qui s’ajoutent'),
    ('Après le lancement', 'Une équipe joignable le jour même', 'Vous êtes seul face aux mises à jour'),
]


def tiles():
    out = []
    for size, k, tag, title, text, chips, href, go, img in TILES:
        vis = ''
        if img:
            vis = ('<span class="bx-vis"><span class="bx-bar"><i></i><i></i><i></i></span><img src="assets/m-%s.webp" alt="" '
                   'width="400" height="250" loading="lazy" decoding="async"></span>') % img
        brand = {'pin': BI.MAPS, 'seo': BI.GOOGLE, 'ai': BI.CHATGPT}.get(k)
        out.append('<a class="bx rv%s" href="%s"><span class="bx-ic%s">%s</span><span class="bx-k">%s</span><b>%s</b>'
                   '<span class="bx-d">%s</span>%s<span class="bx-go">%s%s</span>%s</a>' % (
                       ' bx-' + size if size else '', href, ' brand' if brand else '', brand or ic(k), tag, title, text,
                       ('<span class="bx-tags">%s</span>' % ''.join('<i>%s</i>' % c for c in chips)) if chips else '',
                       go, ic('arrow'), vis))
    out.append('<a class="bx bx-cta rv" href="demarrer.html"><span class="bx-k">Sur mesure</span><b>Votre projet ne rentre '
               'dans aucune case ?</b><span class="bx-d">Décrivez-le en deux minutes : nous vous répondons le jour même avec '
               'une proposition écrite.</span><span class="bx-go">Démarrer mon projet%s</span></a>' % ic('arrow'))
    return ''.join(out)


def sections():
    bento = ('<section class="blk sx-bento" id="expertises"><div class="sh"><span class="pill rv"><span class="ic"></span>Expertises</span>'
             '<h2 class="rv d1"><span class="l"><span class="li">Tout ce qu’il faut</span></span><span class="l"><span class="li grad">'
             'pour être choisi en ligne.</span></span></h2><p class="rv d2">Site web, boutique, application, Google et IA : choisissez '
             'ce dont vous avez besoin aujourd’hui. Tout est pensé pour fonctionner ensemble.</p></div>'
             '<div class="bx-grid w">%s</div></section>') % tiles()
    clients = ('<section class="blk sx-clients"><div class="w cl-row rv"><p class="cl-h"><b>Ils nous ont confié leur site</b>'
               '<span>Des écoles d’El Jadida, en ligne avec Digilago.</span></p><div class="cl-list">%s</div>'
               '<a class="cl-more" href="realisations.html">Voir les réalisations%s</a></div></section>') % (
        ''.join('<span class="cl-i"><img src="assets/m-%s.webp" alt="" width="400" height="250" loading="lazy" decoding="async">'
                '<span><b>%s</b><small>%s</small></span></span>' % (img, n, k) for n, k, img in CLIENTS), ic('arrow'))
    compare = ('<section class="blk sx-cmp"><div class="sh"><span class="pill rv"><span class="ic"></span>Sur mesure ou thème ?</span>'
               '<h2 class="rv d1"><span class="l"><span class="li">Un site qui travaille pour vous,</span></span><span class="l">'
               '<span class="li grad">pas un modèle de plus.</span></span></h2><p class="rv d2">Un thème acheté coûte moins cher au '
               'départ. Voici ce qui change vraiment pour votre entreprise.</p></div><div class="cmp w nar rv" role="table" '
               'aria-label="Comparatif"><div class="cmp-h" role="row"><span role="columnheader"></span><span role="columnheader" '
               'class="cmp-d">Site Digilago</span><span role="columnheader">Site fait avec un thème</span></div>%s</div></section>') % ''.join(
        '<div class="cmp-r" role="row"><span role="rowheader">%s</span><span role="cell" class="cmp-d">%s%s</span>'
        '<span role="cell" class="cmp-t">%s%s</span></div>' % (c, ic('check', 'ok'), a, ic('x', 'no'), b) for c, a, b in COMPARE)
    return bento, clients, compare


def main():
    h = open(P, encoding='utf-8').read()
    h = re.sub(r'<!--dg:svc-[a-z]+-->.*?<!--/dg:svc-[a-z]+-->', '', h, flags=re.S)
    bento, clients, compare = sections()
    trust = ('<!--dg:svc-trust--><ul class="trust in2"><li>%sPrix écrit avant de commencer</li><li>%sPremière version en 72 h</li>'
             '<li>%sRéponse le jour même</li></ul><!--/dg:svc-trust-->') % (ic('check'), ic('check'), ic('check'))
    i = h.index('<nav class="anchors in2"')
    h = h[:i] + trust + h[i:]
    h = h.replace('<nav class="anchors in2" aria-label="Sur cette page"><a href="#concevoir"><span>01</span>Concevoir</a>',
                  '<nav class="anchors in2" aria-label="Sur cette page"><!--dg:svc-anc--><a href="#expertises"><span>00</span>Expertises</a><!--/dg:svc-anc--><a href="#concevoir"><span>01</span>Concevoir</a>')
    i = h.index('<section class="blk" id="concevoir">')
    h = h[:i] + '<!--dg:svc-top-->' + bento + clients + '<!--/dg:svc-top-->' + h[i:]
    i = h.index('<section class="blk" id="faq">')
    h = h[:i] + '<!--dg:svc-cmp-->' + compare + '<!--/dg:svc-cmp-->' + h[i:]
    open(P, 'w', encoding='utf-8').write(h)
    print('services : %d expertises, %d clients, comparatif de %d critères' % (len(TILES), len(CLIENTS), len(COMPARE)))


if __name__ == '__main__':
    main()
