#!/usr/bin/env python3
"""Dessins du jeu de plateforme LAGO → ../src/assets.js

Reprend les dessins du premier jeu (personnages, décors, façades, tours, carte) et ajoute les images
d'animation de Lago : course (2 images), saut, chute, lanterne levée, avec ou sans tenue (sport, cravate).
Les tenues sont posées DANS le groupe du corps : elles suivent l'inclinaison de chaque pose (pas de décalage).
"""
import json, re, sys, pathlib
HERE = pathlib.Path(__file__).parent
SCR = HERE.parent.parent
sys.path.insert(0, str(SCR / 'mascot'))
sys.path.insert(0, str(SCR / 'jeu'))
import lago2 as L2
from lago import NAVY

base = json.loads(re.match(r'window\.ASSETS = (.*);\s*$', (SCR / 'jeu' / 'src' / 'assets.js').read_text(), re.S).group(1))
import importlib.util
spec = importlib.util.spec_from_file_location('ba', SCR / 'jeu' / 'build_assets.py')
src = (SCR / 'jeu' / 'build_assets.py').read_text()
# on ne garde que la fonction costume() du premier générateur
ns = {'L2': L2, 'NAVY': NAVY}
exec(src[src.index('BOWL_CLIP ='):src.index('def lago(')], ns)
costume = ns['costume']

# Poses supplémentaires (mêmes conventions que lago2.POSES2)
L2.POSES2['run1'] = dict(body=(9, 1, 1, 12), legs='run',
                         L=dict(to=(-104, 70), bend=40, rot=230), R=dict(to=(96, 20), bend=-50, rot=20, front=True))
L2.POSES2['run2'] = dict(body=(8, 1.01, .99, 2), legs='run2',
                         L=dict(to=(-60, 120), bend=30, rot=205), R=dict(to=(70, 110), bend=-36, rot=150, front=True))
L2.POSES2['chute'] = dict(body=(-4, 1.02, .98, 60), legs='fall',
                          L=dict(to=(-130, -60), bend=-30, rot=-60), R=dict(to=(130, -70), bend=30, rot=60))
L2.POSES2['lanterne'] = dict(body=(-3, 1, 1, 0),
                             L=dict(to=(-30, 160), bend=18, rot=190), R=dict(to=(64, -160), bend=34, rot=10))

# jambes supplémentaires : on enrichit lago2 en remplaçant le choix des pieds
_orig = L2.lago2


def lago2x(expr, pose, extra_body=''):
    P = L2.POSES2[pose]
    legs = P.get('legs', 'stand')
    if legs in ('run2', 'fall'):
        P = dict(P)
        P['legs'] = 'run' if legs == 'run2' else 'jump'
        L2.POSES2['_tmp'] = P
        out = _orig(expr, '_tmp', cloud=False)
        g = L2.L.GROUND
        T = lambda p: L2.tf(p, *P.get('body', (0, 1, 1, 0)))
        hipl, hipr = T(L2.L.HIP_L), T(L2.L.HIP_R)
        if legs == 'run2':
            fl, fr, bl, br = (hipl[0] + 40, g - 24), (hipr[0] - 80, g - 56), -26, 36
        else:
            fl, fr, bl, br = (hipl[0] - 50, hipl[1] + 150), (hipr[0] + 56, hipr[1] + 130), 40, -40
        legs_svg = ('<g class="legs">' + L2.leg(hipl, fl, bl) + L2.leg(hipr, fr, br)
                    + L2.L.shoe(fl[0] - 6, fl[1] + 10, -1) + L2.L.shoe(fr[0] + 6, fr[1] + 10, 1) + '</g>')
        out = re.sub(r'<g class="legs">.*?</g></g>' if False else r'<g class="legs">(?:(?!<g class="arms-back">).)*', legs_svg, out, count=1, flags=re.S)
    else:
        out = _orig(expr, pose, cloud=False)
    if extra_body:
        # la tenue entre dans le groupe du corps : elle suit sa rotation et son étirement
        i = out.index('<g class="arms-front">')
        j = out.rindex('</g>', 0, i)
        out = out[:j] + f'<g transform="translate({-L2.BX} {-L2.BY})">{extra_body}</g>' + out[j:]
    return out


def strip(s):
    return re.sub(r'<defs>.*?</defs>', '', s, flags=re.S)


def lago_svg(expr, pose, kind=None):
    extra = costume(kind) if kind else ''
    s = strip(L2.svg2(lago2x(expr, pose, extra)))
    return s.split('>', 1)[1].rsplit('</svg>', 1)[0]


A = dict(base)
FRAMES = {'repos': ('sourire', 'repos'), 'run1': ('joie', 'run1'), 'run2': ('joie', 'run2'), 'saut': ('rire', 'saut'),
          'chute': ('surpris', 'chute'), 'lanterne': ('emerveille', 'lanterne')}
for k, (e, p) in FRAMES.items():
    A['p_' + k] = lago_svg(e, p)
    for c in ('sport', 'cravate'):
        A[f'p_{k}_{c}'] = lago_svg(e, p, c)
A['p_salut'] = lago_svg('joie', 'salut')
A['p_pouce'] = lago_svg('fier', 'pouce')
A['p_surpris'] = lago_svg('surpris', 'repos')
# le premier jeu n'a plus besoin de ses écrans de mini-jeux
for k in list(A):
    if k.startswith('lago_') and k not in ('lago_salut', 'lago_saut', 'lago_repos', 'lago_tablette', 'lago_pouce'):
        del A[k]
out = HERE.parent / 'src' / 'assets.js'
out.parent.mkdir(exist_ok=True)
out.write_text('window.ASSETS = ' + json.dumps(A, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(out, round(out.stat().st_size / 1024), 'KB', len(A), 'entrées')
