"""Carte du haut de l'accueil : le Maroc vu du ciel, qui s'allume (idempotent).

La carte est dessinée en perspective par le script de l'accueil (canvas) : le Maroc, la grille de
« l'infrastructure digitale », les autoroutes où circule la lumière, et des centaines de points lumineux,
chacun une entreprise que ses clients trouvent en ligne. Toutes les quelques secondes, une vraie recherche
(« dentiste Casablanca ») fait s'allumer l'entreprise trouvée, avec sa petite fiche.
Tout le pays est visible, de Tanger à Dakhla ; à l'arrivée, la caméra se pose doucement sur le Maroc, puis, à la
fin du hero, monte dans les nuages.

Ce script écrit dans la page :
- les contours (Maroc et pays voisins), les autoroutes et les villes, en JSON (#mgeo) ;
- les noms de villes et les fiches des entreprises, en HTML caché : la construction les traduit (EN, AR) ;
- le canvas, la bulle de recherche, la fiche et la légende.

Usage : python3 tools/hero_map.py
"""
import json, os, re
import brand_icons as BI

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
P = os.path.join(SITE, 'index.html')
M = json.load(open(os.path.join(ROOT, 'backend', 'lib', 'maroc.json'), encoding='utf-8'))

# Noms affichés sur la carte : 3 = grande ville (serif), 2 = ville, 1 = petite ville, 0 = mer / continent
LABELS = [('Casablanca', 3), ('Rabat', 3), ('Fès', 3), ('Tanger', 3), ('Marrakech', 3), ('Agadir', 3),
          ('Laâyoune', 3), ('Dakhla', 3),
          ('Meknès', 2), ('El Jadida', 2), ('Kénitra', 2), ('Tétouan', 2), ('Oujda', 2), ('Nador', 2),
          ('Al Hoceïma', 2), ('Chefchaouen', 2), ('Béni Mellal', 2), ('Safi', 2), ('Essaouira', 2),
          ('Ouarzazate', 2), ('Errachidia', 2), ('Guelmim', 2),
          ('Larache', 1), ('Ifrane', 1), ('Taza', 1), ('Settat', 1), ('Khouribga', 1), ('Asilah', 1),
          ('Mohammedia', 1), ('Berkane', 1), ('Khémisset', 1), ('Tiznit', 1), ('Taroudant', 1), ('Tan-Tan', 1),
          ('Smara', 1), ('Boujdour', 1), ('Zagora', 1), ('Merzouga', 1)]
SEAS = [('Océan Atlantique', 120, 230), ('Méditerranée', 500, 12), ('Europe', 470, -95)]
# Nombre de points lumineux autour de chaque ville (les autres villes en ont quelques-uns)
WEIGHT = {'Casablanca': 70, 'Rabat': 34, 'Salé': 16, 'Fès': 32, 'Marrakech': 34, 'Tanger': 30, 'Meknès': 18,
          'Agadir': 18, 'El Jadida': 22, 'Kénitra': 14, 'Tétouan': 13, 'Oujda': 13, 'Mohammedia': 10, 'Témara': 8,
          'Nador': 9, 'Safi': 9, 'Béni Mellal': 9, 'Settat': 7, 'Khouribga': 7, 'Essaouira': 7, 'Taza': 6,
          'Laâyoune': 14, 'Dakhla': 9, 'Inezgane': 8, 'Aït Melloul': 6, 'Ouarzazate': 7, 'Guelmim': 6,
          'Taroudant': 6, 'Tiznit': 5, 'Errachidia': 6, 'Tan-Tan': 4, 'Khénifra': 4, 'Smara': 3, 'Zagora': 3,
          'Tinghir': 3, 'Midelt': 3, 'Boujdour': 3}

# Les recherches en direct : (requête tapée, ville, décalage, nom, type, image, client Digilago ?)
EVENTS = [
    ('école privée El Jadida', 'El Jadida', (-1.2, -.8), 'Académie Georges Claude', 'École privée, Sidi Bouzid', '7bb45a65f3', True),
    ('dentiste Casablanca', 'Casablanca', (1.4, -1), 'Cabinet dentaire', 'Dentiste, Casablanca', 'ca364f4df1', False),
    ('pédiatre Rabat', 'Rabat', (.8, .9), 'Pédiatre', 'Cabinet pédiatrique, Rabat', '9d68960ad1', False),
    ('crèche El Jadida', 'El Jadida', (.9, .6), 'Les Marronniers', 'Crèche et école, El Jadida', 'a16336b3d8', True),
    ('médecin généraliste Fès', 'Fès', (-.8, .7), 'Médecine familiale', 'Cabinet de médecine générale, Fès', 'f49a84675a', False),
    ('institut de beauté Casablanca', 'Casablanca', (-1.6, .8), 'Institut de beauté', 'Soins et esthétique, Casablanca', '8600fd681b', False),
    ('auto-école Kénitra', 'Kénitra', (.6, -.6), 'Auto-école', 'Permis de conduire, Kénitra', '70d39f3dbf', False),
    ('école primaire El Jadida', 'El Jadida', (.2, -1.4), 'Groupe scolaire Ange Bleu', 'École, El Jadida', '28230191c1', True),
    ('ophtalmologue Meknès', 'Meknès', (.7, -.5), 'Ophtalmologie', 'Centre de la vue, Meknès', '6b415f7c16', False),
    ('clinique Tanger', 'Tanger', (-.6, .8), 'Centre médical', 'Clinique pluridisciplinaire, Tanger', '8058870faa', False),
    ('dentiste Tétouan', 'Tétouan', (.6, .5), 'Cabinet dentaire', 'Soins dentaires, Tétouan', '4c1f45d0b9', False),
    ('maternelle El Jadida', 'El Jadida', (-.4, 1.2), 'Jardin Ange Bleu', 'Crèche et maternelle, El Jadida', 'fa2bebc12e', True),
    ('laboratoire d’analyses Fès', 'Fès', (1.1, -.4), 'Laboratoire d’analyses', 'Analyses médicales, Fès', 'b90444ba80', False),
    ('cours d’anglais Rabat', 'Rabat', (-.9, -.7), 'Centre de langues', 'Cours et certifications, Rabat', '544d524fe0', False),
    ('dermatologue Marrakech', 'Marrakech', (.8, -.6), 'Dermatologie', 'Cabinet de dermatologie, Marrakech', 'd447a72f84', False),
    ('parapharmacie en ligne', 'Casablanca', (.4, 1.5), 'Parapharmacie', 'Boutique en ligne, Casablanca', '16d4918d6c', False),
    ('psychologue Tanger', 'Tanger', (.9, -.4), 'Psychologue', 'Cabinet de consultation, Tanger', '2dab30659b', False),
    ('radiologie Taza', 'Taza', (.5, .4), 'Radiologie', 'Centre d’imagerie, Taza', 'f4eb6b6a72', False),
    ('dentiste Agadir', 'Agadir', (.8, -.6), 'Clinique dentaire', 'Soins et implants, Agadir', 'fe08b0e7cb', False),
    ('école privée Laâyoune', 'Laâyoune', (-.5, .5), 'École internationale', 'Établissement scolaire, Laâyoune', 'a2def9b421', False),
    ('kinésithérapeute Marrakech', 'Marrakech', (-.9, .7), 'Kinésithérapie', 'Cabinet de rééducation, Marrakech', 'e5a1acde64', False),
]
# Arcs depuis El Jadida (le studio) : « pour tout le Maroc »
ARCS = ['Casablanca', 'Rabat', 'Fès', 'Tanger', 'Marrakech', 'Oujda', 'Agadir', 'Laâyoune', 'Dakhla', 'Ouarzazate']
ROADS = [
    ['Tanger', 'Asilah', 'Larache', 'Ksar El Kébir', 'Kénitra', 'Salé', 'Rabat', 'Skhirat', 'Mohammedia', 'Casablanca', 'El Jadida', 'Safi'],
    ['Rabat', 'Khémisset', 'Meknès', 'Fès', 'Taza', 'Taourirt', 'Oujda'],
    ['Casablanca', 'Berrechid', 'Settat', 'El Kelâa des Sraghna', 'Marrakech', 'Chichaoua', 'Agadir'],
    ['Tanger', 'Tétouan', 'Chefchaouen'],
    ['Berrechid', 'Khouribga', 'Fquih Ben Salah', 'Béni Mellal'],
    ['Fès', 'Sefrou', 'Ifrane', 'Azrou'],
    ['Taourirt', 'Nador'],
    ['Marrakech', 'Essaouira'],
    ['Agadir', 'Tiznit', 'Guelmim', 'Tan-Tan', 'Laâyoune', 'Boujdour', 'Dakhla'],
    ['Marrakech', 'Ouarzazate', 'Tinghir', 'Errachidia'],
]
LEGEND = ('<p class="mlive" id="mlive"><i aria-hidden="true"></i><span>En direct</span>'
          'Chaque point lumineux est une entreprise que ses clients trouvent en ligne.</p>')
SEARCH = ('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" '
          'stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>')


def city(n):
    c = M['cities'][n]
    return round(c['x'], 1), round(c['y'], 1)


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        a, b = st.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        L = (dx * dx + dy * dy) ** .5 or 1e-9
        best, idx = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L
            if d > best:
                best, idx = d, i
        if best > eps:
            keep[idx] = True
            st += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def polys(d, eps, box):
    out = []
    for sub in re.findall(r'M[^M]+', d):
        pts = [tuple(map(float, p.split(','))) for p in re.findall(r'-?[\d.]+,-?[\d.]+', sub)]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        if max(xs) < box[0] or min(xs) > box[2] or max(ys) < box[1] or min(ys) > box[3] or len(pts) < 8:
            continue
        s = rdp(pts, eps)
        out.append([v for p in s for v in (round(p[0], 1), round(p[1], 1))])
    return out


def smooth(points, n=6):
    """Échantillonne une courbe douce (Catmull-Rom) passant par les villes."""
    out = []
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(round(.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                         + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3), 1) for j in (0, 1)))
    out.append(points[-1])
    return [v for p in out for v in p]


def geo():
    box = (-200, -360, 900, 760)
    return {
        'o': polys(M['outline'], .35, box)[0],
        'a': polys(M['around'], .6, box),
        'r': [smooth([city(n) for n in r]) for r in ROADS],
        'c': [[*city(n), WEIGHT.get(n, 3)] for n in M['cities']],
        'hq': list(city('El Jadida')),
        'arcs': [list(city(n)) for n in ARCS],
    }


def build():
    g = json.dumps(geo(), separators=(',', ':'))
    labels = ''.join('<i data-xy="%s,%s" data-r="%d">%s</i>' % (*city(n), r, n) for n, r in LABELS)
    labels += ''.join('<i data-xy="%s,%s" data-r="0">%s</i>' % (x, y, n) for n, x, y in SEAS)
    ev = []
    for q, c, (dx, dy), name, kind, img, client in EVENTS:
        x, y = city(c)
        ev.append(('<template data-xy="%.1f,%.1f"%s><span class="mc-v"><img src="assets/m-%s.webp" alt="" width="400" height="250" '
                   'decoding="async"></span><span class="mc-b"><span class="mc-t">%s</span><b>%s</b><small>%s</small>'
                   '<span class="mc-f">' + BI.GOOGLE.replace('%', '%%') + 'Trouvé sur Google</span></span><em>%s</em></template>')
                  % (x + dx, y + dy, ' data-cl="1"' if client else '', img, 'Client Digilago' if client else 'Exemple',
                     name, kind, q))
    # deux canvas : le fond (dessiné une fois) et, au-dessus, ce qui vit (lumières, arcs, noms)
    return ('<div class="groundmap" id="hb"><div class="mwrap" id="mwrap">'
            '<canvas class="mcv mcv0" id="mcv0" aria-hidden="true"></canvas><canvas class="mcv" id="mcv" aria-hidden="true"></canvas>'
            '<div class="mfx" id="mfx" aria-hidden="true"><div class="mq" id="mq">%s<span></span></div>'
            '<div class="mcard" id="mcard"></div></div></div>'
            '<script type="application/json" id="mgeo">%s</script><div class="mdata" id="mdata" hidden>%s%s</div>'
            '%%CBANK%%<div class="hwash" id="hwash"></div></div>') % (SEARCH, g, labels, ''.join(ev))


def main():
    h = open(P, encoding='utf-8').read()
    a = h.index('<div class="groundmap" id="hb">')
    end = '<div class="hwash" id="hwash"></div></div>'
    b = h.index(end, a) + len(end)
    old = h[a:b]
    # les nuages posés sur l'horizon de la carte sont conservés
    c0 = old.index('<div class="cbank"')
    depth, i = 0, c0
    for m in re.finditer(r'<div\b|</div>', old[c0:]):
        depth += 1 if m.group(0) == '<div' else -1
        if depth == 0:
            i = c0 + m.end()
            break
    h = h[:a] + build().replace('%CBANK%', old[c0:i]) + h[b:]
    # la légende, hors de la carte (pas de fondu) : juste au-dessus, dans la scène du hero
    h = re.sub(r'<p class="mlive".*?</p>', '', h, flags=re.S)
    a = h.index('<div class="groundmap" id="hb">')
    h = h[:a] + LEGEND + h[a:]
    # l'ancien filtre par métier n'a plus lieu d'être
    if '<div class="mfilter" id="hcs" hidden></div>' not in h:
        a = h.index('<div class="mfilter" id="hcs"')
        b = h.index('</div>', a) + len('</div>')
        h = h[:a] + '<div class="mfilter" id="hcs" hidden></div>' + h[b:]
    open(P, 'w', encoding='utf-8').write(h)
    print('carte du Maroc vu du ciel :', len(EVENTS), 'recherches,', len(LABELS), 'villes')


if __name__ == '__main__':
    main()
