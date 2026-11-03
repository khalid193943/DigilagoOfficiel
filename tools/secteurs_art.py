"""Illustrations animées des cartes « métier » (pages Secteurs).

Chaque carte reçoit une petite scène en SVG : l'emblème octogonal de la marque, posé sur un socle,
avec l'icône du métier qui se dessine à l'apparition, un anneau en orbite, et à droite un décor propre
au secteur (pouls pour la santé, vapeur pour la restauration, grue pour le BTP, guirlande pour les
mariages…). Au repos tout est immobile ; la scène s'anime quand la carte a le focus : survol, clavier,
ou, sur téléphone, quand la carte passe au centre de l'écran. « Moins d'animations » : rien ne bouge.

Couleurs de la marque (bleus) ; une seule note chaude (ambre) et un vert pour le seul secteur agricole.
Les dégradés et l'ombre sont définis une fois par page (DEFS).
"""
import math

from secteurs_icons import P

B1, B2, B3, B4, PALE, W, G, INK, GREEN = '#1F57C7', '#2F84EC', '#5F9FF9', '#BFD6FF', '#DCE7FB', '#FFFFFF', '#F5B547', '#0E214E', '#22A06B'

DEFS = ('<svg class="vz-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>'
        '<linearGradient id="vzBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7F0FF"/><stop offset=".7" stop-color="#EEF4FF" stop-opacity=".75"/><stop offset="1" stop-color="#F4F8FF" stop-opacity="0"/></linearGradient>'
        '<radialGradient id="vzHalo" cx="62" cy="50" r="70" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
        '<radialGradient id="vzOct" cx="62" cy="44" r="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#93BEFF"/>'
        '<stop offset=".46" stop-color="#3B76F6"/><stop offset="1" stop-color="#1D46B4"/></radialGradient>'
        '<linearGradient id="vzTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DDE8FC"/></linearGradient>'
        '<linearGradient id="vzSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C3D5F5"/><stop offset="1" stop-color="#9FBAEB"/></linearGradient>'
        '<radialGradient id="vzDrop"><stop offset="0" stop-color="#0E214E" stop-opacity=".28"/><stop offset="1" stop-color="#0E214E" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="vzGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        '<filter id="vzSh" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#14348C" flood-opacity=".32"/></filter>'
        '</defs></svg>')


def _r(x):
    return ('%.1f' % x).rstrip('0').rstrip('.')


def octagram(cx, cy, side, fill, cls='', extra=''):
    """Étoile à huit branches de la marque : deux carrés arrondis, l'un tourné de 45°."""
    x, y = cx - side / 2, cy - side / 2
    sq = '<rect x="%s" y="%s" width="%s" height="%s" rx="%s"%s/>' % (_r(x), _r(y), _r(side), _r(side), _r(side * .14), '%s')
    return '<g%s fill="%s"%s>%s%s</g>' % (' class="%s"' % cls if cls else '', fill, extra,
                                          sq % (' transform="rotate(45 %s %s)"' % (_r(cx), _r(cy))), sq % '')


def gear(cx, cy, r, teeth, depth):
    pts = []
    n = teeth * 4
    for i in range(n):
        a = 2 * math.pi * i / n - math.pi / 2
        rr = r if i % 4 in (0, 1) else r - depth
        pts.append('%s %s' % (_r(cx + rr * math.cos(a)), _r(cy + rr * math.sin(a))))
    return 'M' + ' L'.join(pts) + 'Z'


def sparkle(cx, cy, s):
    """Étincelle à quatre branches courbes."""
    return ('M{x} {a}Q{x} {y} {b} {y}Q{x} {y} {x} {c}Q{x} {y} {d} {y}Q{x} {y} {x} {a}Z'
            .format(x=_r(cx), y=_r(cy), a=_r(cy - s), b=_r(cx + s), c=_r(cy + s), d=_r(cx - s)))


def bezier(p0, p1, p2, t):
    return tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c for a, b, c in zip(p0, p1, p2))


def d(i):
    """Décalage d'une animation (secondes), écrit dans le style de l'élément."""
    return ' style="animation-delay:%ss"' % _r(i)


# ─── décor de chaque secteur (zone de droite, x 136 → 316) ──────────────

def _sante():
    ecg = 'M136 68H168l7-21 9 40 8-31 6 12h21l5-9 6 13 4-4h61'
    return ('<path d="%s" fill="none" stroke="%s" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
            '<path class="a a-pulse" d="%s" pathLength="1" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
            '<g class="a a-float"><circle cx="266" cy="30" r="13" fill="%s"/><path d="M266 23.5v13M259.5 30h13" stroke="%s" stroke-width="3" stroke-linecap="round"/></g>'
            '<g class="a a-float"%s><circle cx="296" cy="94" r="8.5" fill="%s"/><path d="M296 90v8M292 94h8" stroke="%s" stroke-width="2.4" stroke-linecap="round"/></g>'
            % (ecg, B4, ecg, B2, W, B1, d(.8), W, G))


def _restauration():
    wisps = ''.join('<path class="a a-rise" d="M%s 66c-5-6 5-10 0-16s5-10 0-16" fill="none" stroke="%s" stroke-width="2.2" stroke-linecap="round"%s/>'
                    % (x, B3, d(i * .55)) for i, x in enumerate((210, 226, 242)))
    return ('<ellipse cx="226" cy="101" rx="54" ry="6.5" fill="%s" opacity=".7"/>%s'
            '<path d="M186 76h80c0 15-18 25-40 25s-40-10-40-25z" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
            '<ellipse cx="226" cy="76" rx="40" ry="5" fill="%s"/>'
            '<path class="a a-float" d="M290 30c8 0 12 6 12 12-8 0-12-6-12-12zM290 30c-1 9 4 15 10 16" fill="%s" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>'
            % (PALE, wisps, W, B3, PALE, '#BDE8D2', GREEN))


def _hotellerie():
    stars = ''.join('<path class="a a-twinkle" d="%s" fill="%s"%s/>' % (sparkle(x, y, s), c, d(i * .45))
                    for i, (x, y, s, c) in enumerate(((212, 32, 6, B3), (302, 70, 5, G), (232, 86, 4.5, B2), (290, 22, 3.5, B3))))
    return ('<g class="a a-drift"><rect x="168" y="58" width="44" height="12" rx="6" fill="%s"/><rect x="180" y="50" width="22" height="12" rx="6" fill="%s"/></g>'
            '<path class="a a-float" d="M270 22a17 17 0 1 0 0 32 13.5 13.5 0 1 1 0-32z" fill="%s"/>%s' % (W, W, G, stars))


def _tourisme():
    rays = ''.join('<path d="M%s %sL%s %s" stroke="%s" stroke-width="2" stroke-linecap="round"/>' % (
        _r(176 + 13 * math.cos(a)), _r(36 + 13 * math.sin(a)), _r(176 + 18 * math.cos(a)), _r(36 + 18 * math.sin(a)), G)
        for a in [i * math.pi / 4 for i in range(8)])
    plane = ('M0-1.6h7.5L12-7h2.2l-2.6 5.4H16l2-2.2h1.6l-1 3.8 1 3.8H18l-2-2.2h-4.4L14.2 7H12L7.5 1.6H0c-1.2 0-1.2-3.2 0-3.2z')
    return ('<g class="a a-spin" style="animation-duration:14s">%s</g><circle cx="176" cy="36" r="9" fill="%s"/>'
            '<path class="a a-flow" d="M146 100C190 46 242 24 292 30" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 7"/>'
            '<g transform="translate(292 30) rotate(-14)"><g class="a a-glide"><path d="%s" fill="%s"/></g></g>'
            '<path d="M226 104c10-12 22-12 32 0z" fill="%s"/><path d="M248 104c8-9 18-9 26 0z" fill="%s"/>'
            % (rays, G, B3, plane, B1, PALE, B4))


def _beaute():
    return ('<path class="a a-twinkle" d="%s" fill="%s" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>'
            '<path class="a a-twinkle" d="%s" fill="%s"%s/><path class="a a-twinkle" d="%s" fill="%s"%s/>'
            '<path class="a a-float" d="M196 60c7 10 11 15 11 21a11 11 0 0 1-22 0c0-6 4-11 11-21z" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
            '<path d="M191 82a5 5 0 0 0 4 5" fill="none" stroke="%s" stroke-width="1.8" stroke-linecap="round"/>'
            % (sparkle(244, 50, 17), W, B3, sparkle(290, 30, 9), G, d(.5), sparkle(280, 88, 6.5), B2, d(1), W, B3, B4))


def _btp():
    lattice = ''.join('<path d="M249 %sl6 8M255 %sl-6 8" stroke="%s" stroke-width="1.2"/>' % (y, y, B3) for y in range(32, 104, 8))
    bricks = ''.join('<rect x="%s" y="%s" width="16" height="8" rx="1.5" fill="%s" stroke="%s" stroke-width="1"/>' % (x, y, PALE, W)
                     for x, y in ((146, 96), (163, 96), (180, 96), (154, 87), (171, 87), (162, 78)))
    return ('%s<rect x="248" y="28" width="8" height="76" rx="1" fill="none" stroke="%s" stroke-width="2"/>%s'
            '<path d="M212 28h96" stroke="%s" stroke-width="3" stroke-linecap="round"/><rect x="212" y="28" width="15" height="9" rx="1.5" fill="%s"/>'
            '<rect x="244" y="22" width="16" height="12" rx="2" fill="%s"/><path d="M252 22l-8 6M252 22l50 6" stroke="%s" stroke-width="1.4"/>'
            '<g class="a a-swing"><path d="M290 29v30" stroke="%s" stroke-width="1.6"/><path d="M290 59c0 6 7 6 7 1" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round"/>'
            '<rect x="278" y="64" width="26" height="9" rx="2" fill="%s"/></g>'
            % (bricks, B1, lattice, B1, B1, B2, B3, INK, INK, G))


def _education():
    return ('<path class="a a-flow" d="M146 96c26 2 40-30 66-26s34-16 46-22" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 6"/>'
            '<g class="a a-glide"><path d="M258 46l34-14-12 30-8-10z" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
            '<path d="M272 52l20-20" stroke="%s" stroke-width="1.6"/></g>'
            '<path class="a a-twinkle" d="%s" fill="%s"%s/><path class="a a-twinkle" d="%s" fill="%s"%s/>'
            % (B3, W, B1, B3, sparkle(298, 86, 7), G, d(.4), sparkle(226, 30, 4.5), B3, d(1)))


def _immobilier():
    return ('<path d="M150 104V82l22-17 22 17v22z" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/><rect x="167" y="90" width="10" height="14" rx="1.5" fill="%s"/>'
            '<path d="M196 104V72l28-22 28 22v32z" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
            '<rect x="206" y="78" width="10" height="10" rx="1.5" fill="%s"/><rect x="232" y="78" width="10" height="10" rx="1.5" fill="%s"/><rect x="219" y="90" width="10" height="14" rx="1.5" fill="%s"/>'
            '<g class="a a-swing"><path d="M292 16v14" stroke="%s" stroke-width="1.6"/><circle cx="292" cy="38" r="7.5" fill="none" stroke="%s" stroke-width="3.2"/>'
            '<path d="M292 45.5v26M292 64h7M292 70.5h5" fill="none" stroke="%s" stroke-width="3.2" stroke-linecap="round"/></g>'
            % (W, B3, B4, W, B1, B4, B4, B2, INK, G, G))


def _evenementiel():
    p0, p1, p2 = (140, 20), (226, 60), (312, 20)
    bulbs = ''.join('<circle class="a a-blink" cx="%s" cy="%s" r="4.2" fill="%s"%s/>' % (
        _r(x), _r(y + 4), c, d(i * .3)) for i, (t, c) in enumerate(((.08, G), (.24, W), (.4, B3), (.56, G), (.72, W), (.88, B3)))
        for x, y in [bezier(p0, p1, p2, t)])
    confetti = ''.join('<rect class="a a-fall" x="%s" y="%s" width="5" height="9" rx="1.2" fill="%s" transform="rotate(%s %s %s)"%s/>' % (
        x, y, c, r, x + 2.5, y + 4.5, d(i * .35)) for i, (x, y, c, r) in enumerate(
        ((170, 62, G, 20), (196, 82, B2, -30), (232, 70, B3, 40), (258, 90, G, -15), (288, 64, B1, 25), (214, 96, B4, 60), (300, 98, G, -40))))
    return '<path d="M140 20Q226 60 312 20" fill="none" stroke="%s" stroke-width="1.6"/>%s%s' % (B4, bulbs, confetti)


def _automobile():
    return ('<rect x="138" y="88" width="180" height="18" rx="9" fill="%s"/>'
            '<path class="a a-flow-r" d="M150 97H314" stroke="%s" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="10 9"/>'
            '<g class="a a-bob"><path d="M200 84h46c4 0 6-2 6-5v-5l-9-11h-28l-11 11h-5c-2 0-3 1.2-3 3v4c0 2 1.8 3 4 3z" fill="%s"/>'
            '<path d="M219 66h11v8h-18zM233 66h8l6 8h-14z" fill="%s"/><circle cx="212" cy="85" r="5.5" fill="%s"/><circle cx="240" cy="85" r="5.5" fill="%s"/>'
            '<circle cx="212" cy="85" r="2" fill="%s"/><circle cx="240" cy="85" r="2" fill="%s"/></g>'
            '<path class="a a-blink" d="M188 70h-16M192 78h-24" stroke="%s" stroke-width="2" stroke-linecap="round"/>'
            '<g class="a a-float"><path d="M290 22a10 10 0 0 1 10 10c0 8-10 17-10 17s-10-9-10-17a10 10 0 0 1 10-10z" fill="%s"/><circle cx="290" cy="32" r="3.6" fill="%s"/></g>'
            % (PALE, W, B1, B4, INK, INK, W, W, B3, B2, W))


def _sport():
    return ('<ellipse class="a a-squash" cx="238" cy="102" rx="15" ry="3.2" fill="url(#vzDrop)"/>'
            '<g class="a a-bounce"><circle cx="238" cy="44" r="15" fill="%s" stroke="%s" stroke-width="2"/>'
            '<path d="M226 34c6 6 6 14 0 20M250 34c-6 6-6 14 0 20M223 44h30" fill="none" stroke="%s" stroke-width="1.8" stroke-linecap="round"/></g>'
            '<path d="M200 38h-16M204 48h-24" stroke="%s" stroke-width="2" stroke-linecap="round"/>'
            '<path class="a a-twinkle" d="%s" fill="%s"/><path d="M282 104V70l18-8v42" fill="none" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
            % (W, B1, B1, B4, sparkle(296, 30, 7), G, B4))


def _commerce():
    return ('<path d="M206 54h44l-4 46h-36z" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
            '<path d="M218 54v-6a10 10 0 0 1 20 0v6" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round"/>'
            '<path d="M168 70h30l-3 32h-24z" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
            '<g class="a a-swing"><path d="M286 14v14" stroke="%s" stroke-width="1.6"/>'
            '<path d="M276 30h20l8 10v28h-36V40z" fill="%s"/><circle cx="286" cy="38" r="2.6" fill="%s"/>'
            '<path d="M279 60l14-12" stroke="%s" stroke-width="2" stroke-linecap="round"/><circle cx="280.5" cy="50" r="2.2" fill="%s"/><circle cx="291.5" cy="58" r="2.2" fill="%s"/></g>'
            % (W, B1, B1, PALE, B3, INK, G, W, W, W, W))


def _industrie():
    return ('<g class="a a-spin" style="animation-duration:12s"><path d="%s" fill="%s"/><circle cx="222" cy="68" r="9" fill="%s"/></g>'
            '<g class="a a-spin-r" style="animation-duration:7.8s"><path d="%s" fill="%s"/><circle cx="268" cy="38" r="5.5" fill="%s"/></g>'
            '<path d="M290 104V80l10 6v-6l10 6v18z" fill="%s"/>'
            % (gear(222, 68, 28, 10, 6), B1, '#E8F0FF', gear(268, 38, 17.5, 7, 5), B3, '#E8F0FF', B4))


def _artisanat():
    return ('<path class="a a-flow" d="M146 102c20-22 40 8 62-12s30 4 46-6" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 5"/>'
            '%s%s%s<circle cx="276" cy="86" r="4.5" fill="%s"/>'
            % (B4, octagram(218, 56, 26, B1, 'a a-spin', ' style="animation-duration:22s"'),
               octagram(262, 34, 17, G, 'a a-spin-r', ' style="animation-duration:16s"'),
               octagram(276, 86, 20, B3, 'a a-spin', ' style="animation-duration:18s"'), W))


def _agriculture():
    sprout = ('<g class="a a-sway"%s><path d="M%s 104V%s" stroke="%s" stroke-width="2.4" stroke-linecap="round"/>'
              '<path d="M{x} {y1}c-11-2-17-11-17-19 11 0 17 9 17 19zM{x} {y2}c11-2 17-11 17-19-11 0-17 9-17 19z" fill="%s"/></g>')
    s1 = (sprout.replace('{x}', '206').replace('{y1}', '86').replace('{y2}', '78')) % ('', 206, 66, GREEN, '#3FBF86')
    s2 = (sprout.replace('{x}', '246').replace('{y1}', '94').replace('{y2}', '88')) % (d(.6), 246, 80, GREEN, '#7FD6AE')
    rays = ''.join('<path d="M%s %sL%s %s" stroke="%s" stroke-width="2" stroke-linecap="round"/>' % (
        _r(288 + 13 * math.cos(a)), _r(30 + 13 * math.sin(a)), _r(288 + 18 * math.cos(a)), _r(30 + 18 * math.sin(a)), G)
        for a in [i * math.pi / 4 for i in range(8)])
    return ('<path d="M142 104h176" stroke="%s" stroke-width="2.4" stroke-linecap="round"/>%s%s'
            '<g class="a a-spin" style="animation-duration:16s">%s</g><circle cx="288" cy="30" r="9" fill="%s"/>' % (B4, s1, s2, rays, G))


def _conseil():
    bars = ''.join('<rect class="a a-grow" x="%s" y="%s" width="15" height="%s" rx="2.5" fill="%s"%s/>' % (x, 104 - h, h, c, d(i * .25))
                   for i, (x, h, c) in enumerate(((184, 22, B4), (206, 36, B3), (228, 30, B2), (250, 52, B1))))
    return ('%s<path d="M176 104h104" stroke="%s" stroke-width="2" stroke-linecap="round"/>'
            '<path d="M182 80l24-16 22 6 30-26" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
            '<path d="M250 42h9v9" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
            '<g class="a a-float"><circle cx="296" cy="30" r="12" fill="%s"/><path d="M290.5 30.5l4 4 7.5-8" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>'
            % (bars, B4, G, G, W, B1))


def _services():
    lines = ''.join('<rect x="198" y="%s" width="%s" height="5" rx="2.5" fill="%s"/><rect class="a a-type" x="198" y="%s" width="%s" height="5" rx="2.5" fill="%s"%s/>' % (
        y, w, PALE, y, w, c, d(i * .35)) for i, (y, w, c) in enumerate(((56, 46, B3), (66, 66, B2), (76, 34, G), (86, 56, B3))))
    return ('<rect x="186" y="30" width="112" height="72" rx="9" fill="%s" stroke="%s" stroke-width="2"/>'
            '<path d="M186 45h112" stroke="%s" stroke-width="1.6"/><circle cx="196" cy="38" r="2.6" fill="%s"/><circle cx="204" cy="38" r="2.6" fill="%s"/><circle cx="212" cy="38" r="2.6" fill="%s"/>'
            '%s<rect class="a a-blink" x="258" y="85" width="2.4" height="8" rx="1" fill="%s"/>'
            '<path class="a a-blink" d="M302 22a14 14 0 0 1 10 10M302 14a22 22 0 0 1 16 16" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round"%s/>'
            % (W, B4, B4, G, B3, B4, lines, B1, B3, d(.5)))


def _transport():
    boxes = ''.join('<g class="a a-slide"%s><rect x="%s" y="74" width="24" height="20" rx="2.5" fill="%s" stroke="%s" stroke-width="1.6"/>'
                    '<path d="M%s 74v8" stroke="%s" stroke-width="2"/></g>' % (d(i * .9), x, c, B1, x + 12, B1)
                    for i, (x, c) in enumerate(((150, G), (196, W), (242, B4))))
    rollers = ''.join('<circle cx="%s" cy="99" r="2.2" fill="%s"/>' % (x, W) for x in range(154, 304, 14))
    return ('<rect x="142" y="94" width="170" height="10" rx="5" fill="%s"/>%s%s'
            '<g class="a a-float"><path d="M292 18a10 10 0 0 1 10 10c0 8-10 17-10 17s-10-9-10-17a10 10 0 0 1 10-10z" fill="%s"/><circle cx="292" cy="28" r="3.6" fill="%s"/></g>'
            '<path class="a a-flow" d="M282 52c-14 8-30 4-44 12" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 6"/>'
            % (B1, rollers, boxes, B1, W, B3))


ACCENT = {'sante': _sante, 'restauration': _restauration, 'hotellerie': _hotellerie, 'tourisme': _tourisme, 'beaute': _beaute,
          'btp': _btp, 'education': _education, 'immobilier': _immobilier, 'evenementiel': _evenementiel, 'automobile': _automobile,
          'sport': _sport, 'commerce': _commerce, 'industrie': _industrie, 'artisanat': _artisanat, 'agriculture': _agriculture,
          'conseil': _conseil, 'services': _services, 'transport': _transport}
_CACHE = {}


def accent(sector):
    if sector not in _CACHE:
        f = ACCENT.get(sector)
        _CACHE[sector] = f() if f else ''
    return _CACHE[sector]


# ─── scène commune : fond, socle, anneau, emblème ───────────────────────

STAGE = ('<rect width="320" height="120" fill="url(#vzBg)"/><circle cx="62" cy="50" r="70" fill="url(#vzHalo)"/>'
         +
         '<ellipse cx="62" cy="102" rx="34" ry="7" fill="url(#vzDrop)"/>'
         '<path d="M20 94 62 108 104 94v6L62 114 20 100z" fill="url(#vzSide)"/>'
         '<path d="M62 80 104 94 62 108 20 94z" fill="url(#vzTop)" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>'
         '<path class="a s-ring" d="M14 46A48 13 0 0 1 110 46" fill="none" stroke="%s" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="2.5 6"/>' % B3)
RING_FRONT = '<path class="a s-ring" d="M110 46A48 13 0 0 1 14 46" fill="none" stroke="%s" stroke-width="1.8" stroke-dasharray="2.5 6"/>' % B2


def art(icon, sector, extra=''):
    """Scène d'une carte métier. La petite icône (.vz-ic) reste dans la carte, cachée : la fenêtre de détail la reprend."""
    badge = ('<g class="s-pop"><g class="s-lift" filter="url(#vzSh)">%s'
             '<ellipse cx="62" cy="30" rx="16" ry="8" fill="url(#vzGloss)"/>'
             '<g transform="translate(44.6 27.6) scale(1.45)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
             '<path class="s-draw" d="%s"/></g></g></g>') % (octagram(62, 44, 50, 'url(#vzOct)'), P[icon])
    return ('<span class="vz-art" data-s="%s" aria-hidden="true"><svg class="vz-stage" viewBox="0 0 320 120" preserveAspectRatio="xMinYMid meet" '
            'focusable="false">%s<g class="s-acc">%s</g>%s%s</svg>%s</span>') % (sector, STAGE, accent(sector), badge, RING_FRONT, extra)
