"""Allège la carte du monde de la section « La vision ».

Les tracés landPath / bordPath (près de 900 Ko) sont simplifiés (Ramer-Douglas-Peucker),
les îles invisibles retirées, et le tout est écrit dans un fichier à part
(assets/world-<hash>.svg) que la page charge seulement quand on approche de la carte.

Usage : python3 tools/simplify_map.py  (depuis la racine du dépôt)
"""
import hashlib, os, re, sys

SITE = os.path.join(os.path.dirname(__file__), '..', 'site')
VIEW = (430, 70, 1750, 630)   # viewBox de #vmap, avec une marge ci-dessous
MARGIN = 120
TOL = 0.32                    # ≈ 0,4 px à l'écran : invisible


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = (dx * dx + dy * dy) ** .5 or 1e-9
        best, idx = 0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > best:
                best, idx = d, i
        if best > eps:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return s if s != '-0' else '0'


def simplify(d, closed_min_area=0.6):
    out = []
    for sub in re.findall(r'M[^M]+', d):
        closed = sub.rstrip().endswith('Z')
        pts = [tuple(map(float, p.split(','))) for p in re.findall(r'-?[\d.]+,-?[\d.]+', sub)]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        if max(xs) < VIEW[0] - MARGIN or min(xs) > VIEW[2] + MARGIN or max(ys) < VIEW[1] - MARGIN or min(ys) > VIEW[3] + MARGIN:
            continue  # hors du cadre visible
        if closed and (max(xs) - min(xs)) * (max(ys) - min(ys)) < closed_min_area:
            continue  # îlot plus petit qu'un pixel
        if closed and len(pts) > 3:
            # RDP sur un anneau : on coupe au point le plus éloigné du premier
            far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
            s = rdp(pts[:far + 1], TOL)[:-1] + rdp(pts[far:] + [pts[0]], TOL)[:-1]
        else:
            s = rdp(pts, TOL)
        if len(s) < (3 if closed else 2):
            continue
        out.append('M' + 'L'.join(fmt(x) + ',' + fmt(y) for x, y in s) + ('Z' if closed else ''))
    return ''.join(out)


def main():
    path = os.path.join(SITE, 'index.html')
    h = open(path, encoding='utf-8').read()
    m = re.search(r'<svg width="0" height="0"[^>]*>(<defs>.*?</defs>)</svg>', h, re.S)
    if not m:
        sys.exit('Carte déjà externalisée (rien à faire).')
    defs = m.group(1)
    for pid in ('landPath', 'bordPath'):
        d = re.search(r'<path id="%s" d="([^"]+)"' % pid, defs).group(1)
        nd = simplify(d)
        print(pid, len(d), '->', len(nd))
        defs = defs.replace(d, nd)
    svg = '<svg xmlns="http://www.w3.org/2000/svg">' + defs + '</svg>'
    name = 'world-' + hashlib.sha1(svg.encode()).hexdigest()[:10] + '.svg'
    open(os.path.join(SITE, 'assets', name), 'w', encoding='utf-8').write(svg)
    # Conteneur vide : le script y injecte les tracés quand la carte approche
    h = h.replace(m.group(0), '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false" id="worldDefs" data-src="assets/%s"></svg>' % name)
    open(path, 'w', encoding='utf-8').write(h)
    print('écrit assets/' + name, len(svg), 'octets ; index.html =', len(h))


if __name__ == '__main__':
    main()
