"""Carte du haut de l'accueil : le Maroc vu du ciel, puis le monde, avec des sites en ligne (idempotent).

La carte est dessinée en perspective par le script de l'accueil (canvas) : le Maroc, la grille de
« l'infrastructure digitale », les autoroutes où circule la lumière, et des centaines de points lumineux.
Sur la carte apparaissent de petits cadres, comme la barre d'adresse d'un navigateur : le drapeau du pays,
un cadenas, un nom de domaine (« votre-hotel.ma ») et « En ligne ». Ce sont des exemples (le « votre- » le dit) :
le message est « votre site, en ligne, où que soient vos clients ». Les vrais clients sont présentés plus bas.
D'abord partout au Maroc (de Tanger à Dakhla), puis, quand la caméra s'éloigne vers le monde, dans d'autres
pays, chacun avec son extension officielle (.fr, .ae, .ca…) ; une fine ligne dorée part d'El Jadida vers chacun.

Ce script écrit dans la page :
- les contours (Maroc et pays voisins), les autoroutes et les villes, en JSON (#mgeo) ;
- les noms de villes, les cadres et « En ligne », en HTML caché : la construction traduit les textes (EN, AR) ;
  les noms de domaine existent en deux versions (« votre-… » en français, « your-… » en anglais et en arabe) ;
- le canvas et la phrase posée au-dessus de la carte.

Le voyage « du Maroc vers le monde » : pendant que le hero reste en place, la caméra s'éloigne du Maroc
(Méditerranée, puis Europe, Afrique et Moyen-Orient, puis le monde). Le monde est dessiné à partir de
Natural Earth 1:50m (domaine public, via le paquet world-atlas, licence ISC : src/geo/), projeté dans la même
projection de Mercator que le Maroc de la carte (34,456 px par degré) : le Maroc reste exactement à sa place.
Ce script écrit aussi assets/geo-<empreinte>.json (terres et frontières), chargé à part par la page.

Les drapeaux viennent du paquet flag-icons (licence MIT : src/flags/) ; ils sont réunis une fois pour toutes
dans une petite image (assets/flags-<empreinte>.webp), refaite seulement si la liste des drapeaux change
(il faut alors Playwright, déjà utilisé par les tests).

Usage : python3 tools/hero_map.py
"""
import glob, gzip, hashlib, json, math, os, re

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

# Les cadres : (domaine en français, en anglais, drapeau, lieu, fenêtres ordinateur et téléphone).
# Le lieu : une ville du Maroc de la carte, ou (longitude, latitude). Une fenêtre (début, fin) dit quand le cadre
# est affiché pendant le voyage (0 : le Maroc, 1 : le monde) ; None : jamais sur cet écran. Au plus 8 cadres
# à la fois sur ordinateur, 4 sur téléphone (vérifié par check_frames). Les cadres du Maroc se relaient aussi
# quand le visiteur ne fait pas défiler, dans l'ordre de MA_RELAY.
FRAMES = [
    ('votre-hotel.ma', 'your-hotel.ma', 'ma', 'Tanger', (.03, .27), (.03, .22)),
    ('votre-boutique.ma', 'your-shop.ma', 'ma', 'Tétouan', None, None),
    ('votre-pharmacie.ma', 'your-pharmacy.ma', 'ma', 'Oujda', (.045, .28), None),
    ('votre-ecole.ma', 'your-school.ma', 'ma', 'Kénitra', None, None),
    ('votre-cabinet.ma', 'your-practice.ma', 'ma', 'Rabat', (.06, .29), None),
    ('votre-clinique.ma', 'your-clinic.ma', 'ma', 'Casablanca', (.09, .31), (.07, .26)),
    ('votre-restaurant.ma', 'your-restaurant.ma', 'ma', 'Meknès', None, None),
    ('votre-riad.ma', 'your-riad.ma', 'ma', 'Fès', (.075, .30), None),
    ('votre-spa.ma', 'your-spa.ma', 'ma', 'Marrakech', (.105, .33), (.11, .30)),
    ('votre-galerie.ma', 'your-gallery.ma', 'ma', 'Essaouira', None, None),
    ('votre-bivouac.ma', 'your-camp.ma', 'ma', 'Ouarzazate', None, None),
    ('votre-desert.ma', 'your-desert.ma', 'ma', 'Merzouga', None, None),
    ('votre-surf.ma', 'your-surf.ma', 'ma', 'Agadir', (.12, .345), None),
    ('votre-agence.ma', 'your-agency.ma', 'ma', 'Laâyoune', None, None),
    ('votre-kitesurf.ma', 'your-kitesurf.ma', 'ma', 'Dakhla', (.135, .36), (.15, .33)),
    # la Méditerranée
    ('votre-restaurant.es', 'your-restaurant.es', 'es', (-3.70, 40.42), (.275, .50), (.27, .45)),
    ('votre-entreprise.dz', 'your-company.dz', 'dz', (3.06, 36.75), (.29, .52), (.31, .48)),
    ('votre-clinique.tn', 'your-clinic.tn', 'tn', (10.18, 36.81), (.32, .54), None),
    ('votre-atelier.it', 'your-workshop.it', 'it', (12.50, 41.90), (.35, .58), None),
    # l'Europe, l'Afrique et le Moyen-Orient
    ('votre-boutique.fr', 'your-shop.fr', 'fr', (2.35, 48.86), (.42, 1.01), (.40, .78)),
    ('votre-cabinet.sn', 'your-firm.sn', 'sn', (-17.45, 14.69), (.46, 1.01), (.45, .62)),
    ('votre-studio.de', 'your-studio.de', 'de', (13.40, 52.52), (.48, .66), None),
    ('votre-agence.co.uk', 'your-agency.co.uk', 'gb', (-0.13, 51.51), (.50, .68), None),
    ('votre-hotel.com.tr', 'your-hotel.com.tr', 'tr', (28.98, 41.01), (.53, 1.01), (.50, .68)),
    ('votre-voyage.eg', 'your-travel.eg', 'eg', (31.24, 30.04), (.56, .72), None),
    ('votre-commerce.ci', 'your-store.ci', 'ci', (-4.01, 5.32), (.60, .76), None),
    ('votre-immobilier.ae', 'your-property.ae', 'ae', (55.27, 25.20), (.62, 1.01), (.64, 1.01)),
    # le monde
    ('votre-site.ru', 'your-site.ru', 'ru', (37.62, 55.76), (.70, 1.01), (.74, 1.01)),
    ('votre-startup.in', 'your-startup.in', 'in', (72.88, 19.08), (.74, .84), (.70, .80)),
    ('votre-entreprise.ca', 'your-business.ca', 'ca', (-73.57, 45.50), (.77, 1.01), (.78, 1.01)),
    ('votre-marque.us', 'your-brand.us', 'us', (-74.01, 40.71), (.79, .86), None),
    ('votre-boutique.jp', 'your-shop.jp', 'jp', (139.69, 35.69), (.84, 1.01), None),
    ('votre-academie.com.br', 'your-academy.com.br', 'br', (-46.63, -23.55), (.87, 1.01), (.84, 1.01)),
]
MA_RELAY = ['Casablanca', 'Marrakech', 'Fès', 'Agadir', 'Tanger', 'Dakhla', 'Rabat', 'Ouarzazate', 'Oujda',
            'Laâyoune', 'Tétouan', 'Essaouira', 'Meknès', 'Merzouga', 'Kénitra']
CAP = {'d': 8, 'm': 4}
FLAG_W, FLAG_H = 48, 36        # une case de l'image des drapeaux (4:3), avec 1 px de marge autour
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
LEGEND = ('<p class="mlive" id="mlive"><i aria-hidden="true"></i><b><span class="ml1">Des sites en ligne partout au Maroc…</span>'
          '<span class="ml2">…et dans le monde.</span></b></p>')


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


# ——— Le monde, pour le voyage du Maroc vers le monde ———
# Projection de la carte (retrouvée sur 10 villes, écart < 1 px) : Mercator, 34,456 px par degré.
KX, X0, KY, Y0 = 34.4564, 613.025, 34.4362, 1350.021
CX, CY = 300, 320              # centre du Maroc, sur le sol de la carte
WQ = 0.25                      # précision du fichier (px du sol)


def to_ground(lon, lat):
    la = max(-85.0, min(85.0, lat))
    m = math.degrees(math.log(math.tan(math.pi / 4 + math.radians(la) / 2)))
    return KX * lon + X0, Y0 - KY * m


def topo(path):
    t = json.load(open(path, encoding='utf-8'))
    (sx, sy), (tx, ty) = t['transform']['scale'], t['transform']['translate']
    arcs = []
    for a in t['arcs']:
        x = y = 0
        out = []
        for dx, dy in a:
            x += dx
            y += dy
            out.append((x * sx + tx, y * sy + ty))
        arcs.append(out)
    return t, arcs


def topo_ring(arcs, idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def unwrap(ll):
    """Un contour qui passe la ligne de changement de date (180°) devient continu ; la partie qui dépasse
    est aussi recopiée de l'autre côté du monde. Sinon le contour saute d'un bord à l'autre de la carte."""
    out, off, prev = [], 0, None
    for lo, la in ll:
        if prev is not None and abs(lo + off - prev) > 180:
            off += -360 if lo + off - prev > 0 else 360
        prev = lo + off
        out.append((prev, la))
    copies = [out]
    if max(p[0] for p in out) - min(p[0] for p in out) > 90:
        return copies                                 # un continent (l'Eurasie) : pas de copie entière
    if min(p[0] for p in out) < -180:
        copies.append([(lo + 360, la) for lo, la in out])
    if max(p[0] for p in out) > 180:
        copies.append([(lo - 360, la) for lo, la in out])
    return copies


def wtol(x, y, base, cap):
    """Précision voulue : fine près du Maroc (la caméra y est proche), plus large au loin
    (on ne le voit que de haut, en entier)."""
    return min(cap, base + (math.hypot(x - CX, y - CY) / 950) ** 2)


def wrdp(pts, base, cap):
    n = len(pts)
    if n < 3:
        return pts
    keep = [False] * n
    keep[0] = keep[-1] = True
    st = [(0, n - 1)]
    while st:
        a, b = st.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-9
        best, idx = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L
            if d > best:
                best, idx = d, i
        if idx >= 0 and best > wtol(*pts[idx], base, cap):
            keep[idx] = True
            st += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def wenc(pts):
    """Coordonnées au quart de pixel, en écarts successifs (petits entiers : fichier léger)."""
    out, px, py = [], 0, 0
    for x, y in pts:
        qx, qy = round(x / WQ), round(y / WQ)
        out += [qx - px, qy - py]
        px, py = qx, qy
    return out


def land_ring(land, gp):
    """Une terre : simplifiée selon sa distance au Maroc ; les îles trop petites pour être vues sont retirées."""
    xs, ys = [p[0] for p in gp], [p[1] for p in gp]
    tol = wtol((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, .3, 12)
    if (max(xs) - min(xs)) * (max(ys) - min(ys)) < (tol * 5) ** 2:
        return
    far = max(range(len(gp)), key=lambda i: (gp[i][0] - gp[0][0]) ** 2 + (gp[i][1] - gp[0][1]) ** 2)
    s = wrdp(gp[:far + 1], .3, 12)[:-1] + wrdp(gp[far:] + [gp[0]], .3, 12)[:-1]
    if len(s) >= 4:
        land.append(wenc(s))


def world():
    t, arcs = topo(os.path.join(ROOT, 'src', 'geo', 'countries-50m.json'))
    land = []
    for o in t['objects']['land']['geometries']:
        polys = o['arcs'] if o['type'] == 'MultiPolygon' else [o['arcs']]
        for poly in polys:
            for r in poly:                           # contour, puis trous (mer Caspienne…)
                ll0 = topo_ring(arcs, r)
                if max(la for lo, la in ll0) < -56:
                    continue                         # l'Antarctique : hors du cadre
                for ll in unwrap(ll0):
                    land_ring(land, [to_ground(lo, la) for lo, la in ll])
    # frontières : les tracés partagés par deux pays, sauf ceux du Maroc (dessiné par la carte elle-même)
    use = {}
    for o in t['objects']['countries']['geometries']:
        polys = o['arcs'] if o['type'] == 'MultiPolygon' else ([o['arcs']] if o['type'] == 'Polygon' else [])
        for poly in polys:
            for r in poly:
                for i in r:
                    use.setdefault(i if i >= 0 else ~i, set()).add(o.get('id'))
    bord = []
    for i in sorted(use):
        ids = use[i]
        if len(ids) < 2 or ids & {'504', '732'} or max(la for lo, la in arcs[i]) < -56:
            continue
        for ll in unwrap(arcs[i]):
            s = wrdp([to_ground(lo, la) for lo, la in ll], .75, 24)
            if len(s) >= 2:
                bord.append(wenc(s))
    return {'q': WQ, 'l': land, 'b': bord}


def world_asset():
    js = json.dumps(world(), separators=(',', ':'))
    name = 'geo-%s.json' % hashlib.sha1(js.encode()).hexdigest()[:10]
    dst = os.path.join(SITE, 'assets', name)
    for f in glob.glob(os.path.join(SITE, 'assets', 'geo-*.json')):
        if os.path.basename(f) != name:
            os.remove(f)
    if not os.path.exists(dst):
        open(dst, 'w', encoding='utf-8').write(js)
    return name, len(js), len(gzip.compress(js.encode(), 9))


HQ_LL = (-8.5007, 33.2316)     # El Jadida : le départ des lignes dorées


def frame_codes():
    out = []
    for f in FRAMES:
        if f[2] not in out:
            out.append(f[2])
    return out


def flags_asset():
    """Les drapeaux des cadres, réunis dans une image (une case de FLAG_W × FLAG_H par pays, dans l'ordre de
    frame_codes). Refaite seulement si les drapeaux changent : la construction marche sans Playwright."""
    codes = frame_codes()
    svgs = [open(os.path.join(ROOT, 'src', 'flags', c + '.svg'), encoding='utf-8').read() for c in codes]
    key = hashlib.sha1(('%d,%d|' % (FLAG_W, FLAG_H) + '|'.join(codes) + '|'.join(svgs)).encode()).hexdigest()[:10]
    name = 'flags-%s.webp' % key
    dst = os.path.join(SITE, 'assets', name)
    for f in glob.glob(os.path.join(SITE, 'assets', 'flags-*.webp')):
        if os.path.basename(f) != name:
            os.remove(f)
    if not os.path.exists(dst):
        import base64, io
        from PIL import Image
        from playwright.sync_api import sync_playwright
        cw, ch = FLAG_W + 2, FLAG_H + 2
        imgs = ''.join('<img style="position:absolute;left:%dpx;top:1px;width:%dpx;height:%dpx" src="data:image/svg+xml;base64,%s">'
                       % (i * cw + 1, FLAG_W, FLAG_H, base64.b64encode(v.encode()).decode()) for i, v in enumerate(svgs))
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page(viewport={'width': cw * len(codes), 'height': ch})
            pg.set_content('<html><body style="margin:0;background:transparent">%s</body></html>' % imgs)
            pg.wait_for_function('[...document.images].every(i => i.complete && i.naturalWidth)')
            png = pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': cw * len(codes), 'height': ch})
            br.close()
        Image.open(io.BytesIO(png)).save(dst, 'WEBP', lossless=True, method=6)
    return name, codes


def check_frames():
    """Jamais plus de CAP cadres voulus en même temps pendant le voyage (sinon des cadres se chasseraient)."""
    for k, scr in ((4, 'd'), (5, 'm')):
        for i in range(0, 1001):
            j = i / 1000
            n = sum(1 for f in FRAMES if f[k] and f[k][0] <= j < f[k][1])
            assert n <= CAP[scr], 'trop de cadres (%s) à %.3f : %d' % (scr, j, n)


def build(world_name='', flags=('', [])):
    geo_d = geo()
    geo_d['hl'] = list(HQ_LL)
    g = json.dumps(geo_d, separators=(',', ':'))
    labels = ''.join('<i data-xy="%s,%s" data-r="%d">%s</i>' % (*city(n), r, n) for n, r in LABELS)
    labels += ''.join('<i data-xy="%s,%s" data-r="0">%s</i>' % (x, y, n) for n, x, y in SEAS)
    fr = []
    for dfr, den, flag, place, wd, wm in FRAMES:
        if isinstance(place, str):
            x, y = city(place)
            extra = ' data-o="%d"' % MA_RELAY.index(place)
        else:
            x, y = to_ground(*place)
            extra = ' data-ll="%s,%s"' % place
        for nm, w in (('d', wd), ('m', wm)):
            if w:
                extra += ' data-%s="%s,%s"' % (nm, w[0], w[1])
        fr.append('<s data-xy="%.1f,%.1f" data-f="%d" data-fr="%s" data-en="%s"%s></s>'
                  % (x, y, flags[1].index(flag), dfr, den, extra))
    # deux canvas : le fond (dessiné une fois) et, au-dessus, ce qui vit (lumières, lignes, cadres, noms)
    attrs = (' data-world="assets/%s"' % world_name if world_name else '') + \
            (' data-flags="assets/%s"' % flags[0] if flags[0] else '')
    return ('<div class="groundmap" id="hb"><div class="mwrap" id="mwrap">'
            '<canvas class="mcv mcv0" id="mcv0" aria-hidden="true"></canvas><canvas class="mcv" id="mcv" aria-hidden="true"></canvas></div>'
            '<script type="application/json" id="mgeo"%s>%s</script><div class="mdata" id="mdata" hidden>%s%s'
            '<b>En ligne</b></div>'
            '%%CBANK%%<div class="hwash" id="hwash"></div></div>') % (attrs, g, labels, ''.join(fr))


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
    check_frames()
    wname, wsize, wgz = world_asset()
    flags = flags_asset()
    h = h[:a] + build(wname, flags).replace('%CBANK%', old[c0:i]) + h[b:]
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
    print('carte du Maroc vu du ciel :', len(FRAMES), 'cadres,', len(flags[1]), 'drapeaux (assets/%s),' % flags[0],
          len(LABELS), 'villes ; le monde :', 'assets/%s (%d Ko, %d Ko compressé)' % (wname, wsize // 1024, wgz // 1024))


if __name__ == '__main__':
    main()
