"""Dégradés entre les sections claires et sombres (calcule le CSS de src/css/gradients.css).

Les couleurs sont mélangées dans l'espace OKLab (perceptuel : pas de bande grise ni de bleu criard au
milieu), selon une courbe très douce aux deux extrémités (smootherstep), avec un léger surcroît de
saturation au milieu pour garder un bleu profond et riche. Le début est transparent : le ciel et les
nuages de la page passent dessous.

Usage : python3 tools/gradients.py
"""
import math, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'css', 'gradients.css')
LIGHT, DARK = '#EAF3FE', '#0E214E'


def srgb2lin(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def lin2srgb(c):
    c = max(0, min(1, c))
    return 12.92 * c if c <= .0031308 else 1.055 * c ** (1 / 2.4) - .055


def hex2oklab(h):
    r, g, b = (srgb2lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))
    l = .4122214708 * r + .5363325363 * g + .0514459929 * b
    m = .2119034982 * r + .6806995451 * g + .1073969566 * b
    s = .0883024619 * r + .2817188376 * g + .6299787005 * b
    l, m, s = (x ** (1 / 3) for x in (l, m, s))
    return (.2104542553 * l + .7936177850 * m - .0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + .4505937099 * s,
            .0259040371 * l + .7827717662 * m - .8086757660 * s)


def oklab2hex(L, a, b):
    l = (L + .3963377774 * a + .2158037573 * b) ** 3
    m = (L - .1055613458 * a - .0638541728 * b) ** 3
    s = (L - .0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + .2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s
    bb = -.0041960863 * l - .7034186147 * m + 1.7076926010 * s
    return '#%02x%02x%02x' % tuple(round(lin2srgb(x) * 255) for x in (r, g, bb))


def ease(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


def stops(length, flip=False, n=14):
    """Les arrêts du dégradé, du clair au sombre, sur `length` unités (var(--u))."""
    A, B = hex2oklab(LIGHT), hex2oklab(DARK)
    out = []
    for i in range(n + 1):
        t = i / n
        e = ease(t)
        L = A[0] + (B[0] - A[0]) * e
        a = A[1] + (B[1] - A[1]) * e
        b = A[2] + (B[2] - A[2]) * e
        # un peu plus de bleu au milieu (sinon le mélange paraît grisâtre)
        C = math.hypot(a, b) + .045 * math.sin(math.pi * e)
        hue = math.atan2(b, a)
        col = oklab2hex(L, C * math.cos(hue), C * math.sin(hue))
        alpha = min(1, t / .16)
        c = col if alpha >= 1 else 'rgba(%d,%d,%d,%.2f)' % (int(col[1:3], 16), int(col[3:5], 16), int(col[5:7], 16), alpha)
        pos = t * length
        out.append('%s %s' % (c, ('calc(100%% - %.0f * var(--u))' % pos) if flip else ('calc(%.0f * var(--u))' % pos)))
    return out


def grad(length):
    top = stops(length)
    bottom = list(reversed(stops(length, flip=True)))
    return 'linear-gradient(180deg,%s,%s)' % (','.join(top), ','.join(bottom))


def foot(length):
    return 'linear-gradient(180deg,%s,%s 100%%)' % (','.join(stops(length)), DARK)


def main():
    css = ['/* Généré par tools/gradients.py : passages ciel → nuit (OKLab, smootherstep) */',
           'html body .blk.dk{background:%s!important;padding-top:calc(370 * var(--u))!important;padding-bottom:calc(370 * var(--u))!important}' % grad(440),
           'html body .foot{background:%s!important;padding-top:calc(400 * var(--u))!important}' % foot(460),
           '[data-mode="M"] body .blk.dk{background:%s!important;padding-top:calc(270 * var(--u))!important;padding-bottom:calc(270 * var(--u))!important}' % grad(320),
           '[data-mode="M"] body .foot{background:%s!important;padding-top:calc(210 * var(--u))!important}' % foot(250),
           # une brume légère qui se dissout dans la nuit, au début de chaque passage
           '.blk.dk::before{content:"";position:absolute;left:0;right:0;top:calc(90 * var(--u));height:calc(300 * var(--u));pointer-events:none;z-index:0;'
           'background:radial-gradient(ellipse 34% 42% at 18% 48%,rgba(255,255,255,.22),rgba(255,255,255,0) 72%),'
           'radial-gradient(ellipse 30% 38% at 78% 38%,rgba(226,238,255,.2),rgba(226,238,255,0) 72%),'
           'radial-gradient(ellipse 46% 30% at 50% 70%,rgba(160,190,240,.14),rgba(160,190,240,0) 75%)}',
           # deux sections sombres qui se suivent : une seule nuit, sans repasser par le clair
           'html body .blk.dk:has(+ .blk.dk){background:linear-gradient(180deg,%s,%s 100%%)!important;padding-bottom:calc(110 * var(--u))!important}' % (','.join(stops(440)), DARK),
           'html body .blk.dk + .blk.dk{background:linear-gradient(180deg,%s 0,%s)!important;padding-top:calc(110 * var(--u))!important}' % (DARK, ','.join(reversed(stops(440, flip=True)))),
           'html body .blk.dk + .blk.dk:has(+ .blk.dk){background:%s!important}' % DARK,
           '[data-mode="M"] body .blk.dk:has(+ .blk.dk){background:linear-gradient(180deg,%s,%s 100%%)!important;padding-bottom:calc(80 * var(--u))!important}' % (','.join(stops(320)), DARK),
           '[data-mode="M"] body .blk.dk + .blk.dk{background:linear-gradient(180deg,%s 0,%s)!important;padding-top:calc(80 * var(--u))!important}' % (DARK, ','.join(reversed(stops(320, flip=True)))),
           '.blk.dk + .blk.dk::before{display:none}',
           '.blk.dk{position:relative;isolation:isolate}',
           '.blk.dk>*{position:relative;z-index:1}']
    open(OUT, 'w', encoding='utf-8').write('\n'.join(css) + '\n')
    print('écrit', OUT)


if __name__ == '__main__':
    main()
