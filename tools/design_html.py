"""Retouches de contenu HTML de l'accueil (idempotent).

- Carte du monde : la carte et ses étiquettes partagent un même cadre (.vstage)
  aux proportions exactes du dessin, pour que chaque étiquette tombe sur son pays,
  quelle que soit la taille de l'écran. Le cadre descend jusqu'à l'Amérique du Sud.
- Carte de Casablanca : les noms de quartiers cachés par une épingle passent
  juste sous la pointe de l'épingle.
- « Pourquoi ai-je besoin d'un site ? » : explications réécrites, plus concrètes.

Usage : python3 tools/design_html.py
"""
import os, re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
P = os.path.join(SITE, 'index.html')

OLD_VB = (430, 70, 1320, 560)
NEW_VB = (430, 70, 1320, 640)

STORY = [
    'Avant d’appeler ou de passer vous voir, ils tapent votre métier et votre ville sur Google. '
    'Si vous n’apparaissez pas, c’est un concurrent qu’ils appellent.',
    'Sur Google Maps, les entreprises avec une fiche complète, des photos, des avis et un site passent devant. '
    'Les autres sont invisibles.',
    'Vos services, vos prix, vos photos, les avis de vos clients : votre site répond aux questions '
    'et donne confiance avant même le premier appel.',
    'Le soir, le week-end, pendant les fêtes : votre site présente votre entreprise '
    'et reçoit les demandes, même quand vous êtes fermé.',
]


def vision(h):
    if 'class="vstage"' in h:
        return h
    old = '<svg viewBox="%d %d %d %d" aria-hidden="true">' % OLD_VB
    assert h.count(old) == 1, 'viewBox de la carte du monde introuvable'
    h = h.replace(old, '<div class="vstage" id="vstage"><svg viewBox="%d %d %d %d" aria-hidden="true">' % NEW_VB)

    h = re.sub(r'(<span class="vchip[^"]*" data-t="[^"]*" style=")left:([\d.]+)%;top:([\d.]+)%"',
               lambda m: m.group(1) + 'left:' + m.group(2) + '%;top:' + (
                   '%.2f' % ((OLD_VB[1] + float(m.group(3)) / 100 * OLD_VB[3] - NEW_VB[1]) / NEW_VB[3] * 100)) + '%"', h)
    # fermer le cadre après la dernière étiquette
    last = h.rfind('<span class="vchip')
    end = h.index('</span>', last) + len('</span>')
    more = ('<p class="vmore" aria-hidden="true">Et aussi&nbsp;: <b>les Amériques</b> · <b>le Golfe</b> · <b>l’Asie</b></p>')
    h = h[:end] + '</div>' + more + h[end:]
    return h


def pins(h):
    pinpos = [(float(a), float(b)) for a, b in
              re.findall(r'class="mpin2[^"]*"[^>]*style="left:([\d.]+)%;top:([\d.]+)%', h)]

    def fix(m):
        kind, x, y, name = m.group(1), float(m.group(2)), float(m.group(3)), m.group(4)
        if kind != 'q':
            return m.group(0)
        lw = len(name) * 0.52            # largeur approx. de l'étiquette, en % de la carte
        for _ in range(3):
            hit = [(px, py) for px, py in pinpos
                   if abs(px - x) < lw / 2 + 1.5 and py - 7.2 < y + 1.2 and y - 1.2 < py + 0.6]
            if not hit:
                break
            y = max(py for px, py in hit) + 2.9
        return '<span class="mlab q" style="left:%.2f%%;top:%.2f%%">%s<' % (x, y, name)

    return re.sub(r'<span class="mlab (\w+)" style="left:([\d.]+)%;top:([\d.]+)%">([^<]+)<', fix, h)


def story(h):
    arts = list(re.finditer(r'(<article class="st-sl[^"]*" data-s="(\d)".*?</h3>)(<p>)(.*?)(</p>)', h, re.S))
    for m in reversed(arts):
        i = int(m.group(2))
        h = h[:m.start(4)] + STORY[i] + h[m.end(4):]
    return h


def main():
    h = open(P, encoding='utf-8').read()
    h = vision(h)
    h = pins(h)
    h = story(h)
    open(P, 'w', encoding='utf-8').write(h)
    print('index.html mis à jour')


if __name__ == '__main__':
    main()
