"""Retire les blocs en double entre les pages (idempotent).

Chaque bloc n'existe plus qu'à un seul endroit, là où il est le plus utile :
- « Nos standards techniques » : gardé sur Services, retiré d'À propos et de Réalisations.
- « C'est maintenant, pas quand tout le monde y sera » : gardé sur l'accueil,
  retiré de Réalisations.
- La FAQ de Contact reprenait celle de Services : remplacée par un lien vers
  la FAQ complète.

Usage : python3 tools/dedupe_pages.py
"""
import os, re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')


def section_span(h, start):
    """Début et fin de la <section> qui commence à `start` (gère l'imbrication)."""
    depth, i = 0, start
    for m in re.finditer(r'<(/?)section\b', h[start:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            end = h.index('>', start + m.start()) + 1
            return start, end
    raise ValueError('section non fermée')


def drop(h, opening):
    i = h.find(opening)
    if i < 0:
        return h, False
    a, b = section_span(h, i)
    return h[:a] + h[b:], True


FAQ_LINK = ('<section class="blk faq-link"><p class="rv">Une question sur les prix, les délais ou les langues&nbsp;? '
            '<a href="services.html#faq">Toutes les réponses sont ici'
            '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" '
            'stroke="currentColor" stroke-width="1.6"/></svg></a></p></section>')


def main():
    for name, ops in (
        ('a-propos.html', ['<section class="blk dk tech tech2"']),
        ('realisations.html', ['<section class="blk dk tech tech2"', '<section class="blk mom" id="moment"']),
    ):
        p = os.path.join(SITE, name)
        h = open(p, encoding='utf-8').read()
        for op in ops:
            h, done = drop(h, op)
            print(name, op, 'retiré' if done else 'déjà absent')
        open(p, 'w', encoding='utf-8').write(h)

    p = os.path.join(SITE, 'contact.html')
    h = open(p, encoding='utf-8').read()
    if 'faq-link' not in h:
        i = h.find('<div class="faq w nar mt"')
        j = h.rfind('<section', 0, i)
        a, b = section_span(h, j)
        h = h[:a] + FAQ_LINK + h[b:]
        print('contact.html FAQ remplacée par un lien')
    open(p, 'w', encoding='utf-8').write(h)


if __name__ == '__main__':
    main()
