"""Accueil, diapositive « Il travaille pendant que vous dormez » : une nuit cohérente.

19:00 vous fermez (votre site, lui, reste ouvert) → 23:14 demande de devis → 01:52 rendez-vous → 06:30 avis
5 étoiles → 08:00 vous ouvrez avec 2 nouveaux clients et un avis. Sur le téléphone, l'horloge suit la nuit
(home.js, nightRun), chaque notification arrive à son heure, le jour se lève avec le résumé de la nuit.
Idempotent. Usage : python3 tools/story_night.py
"""
import os, re

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'index.html')
TEXT = [
    ('<b>Votre boutique ferme</b><span>Vous rentrez chez vous.</span>',
     '<b>Vous fermez</b><span>Votre site, lui, reste ouvert.</span>'),
    ('<b>Vous ouvrez : 3 nouveaux clients</b><span>Votre site a travaillé toute la nuit.</span>',
     '<b>Vous ouvrez : 2 nouveaux clients</b><span>Et un avis 5 étoiles, arrivés pendant la nuit.</span>'),
    ('08:00 : vous ouvrez avec trois nouveaux clients.', '08:00 : vous ouvrez avec deux nouveaux clients.'),
    ('<span class="lk-d">Samedi</span><span class="lk-t">02:07</span>',
     '<i class="lk-sky" aria-hidden="true"></i><span class="lk-d"><i class="d0">Vendredi</i><i class="d1">Samedi</i></span>'
     '<span class="lk-t">19:00</span>'),
]


def main():
    h = open(P, encoding='utf-8').read()
    for old, new in TEXT:
        h = h.replace(old, new)
    if 'class="lkn n3 sum"' not in h:
        # le soleil de la dernière ligne de la liste sert d'icône au résumé du matin
        sun = re.search(r'<span class="nt-ic sun">(<svg.*?</svg>)</span>', h, re.S).group(1)
        i = h.index('<div class="lkn n2"')
        j = h.index('</em></div>', i) + len('</em></div>')
        h = h[:j] + ('<div class="lkn n3 sum"><span class="lkn-ic sun">%s</span><div><b>Bonjour</b>'
                     '<span>Cette nuit : 2 nouveaux clients, 1 avis 5 étoiles</span></div><em>08:00</em></div>' % sun) + h[j:]
    open(P, 'w', encoding='utf-8').write(h)
    print('nuit du site : %s' % ('ok' if 'lk-sky' in h and 'n3 sum' in h else 'À VÉRIFIER'))


if __name__ == '__main__':
    main()
