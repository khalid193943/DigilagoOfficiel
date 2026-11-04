"""Images de partage (1200 × 630) des pages Digilago Lab : assets/lab/og-lab.jpg, og-radar.jpg, og-gestion.jpg.

Même nuit que les pages du Lab, les vraies captures (données de démonstration) dans leurs cadres.
Chaque image porte sa marque (le soleil du Lab, le radar, le registre). Pas de phrase dans l'image : seulement les noms (Digilago Lab, Radar, Gestion) et les codes,
pour que la même image serve en français, en anglais et en arabe (le titre traduit s'affiche dessous).

Usage : python3 tools/og_lab.py   (le site doit tourner : npm run start, ou LOCAL_URL=…)
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand import MARKS  # noqa: E402  (la famille de logos : le soleil du Lab, le radar, le registre)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'site', 'assets', 'lab')
URL = os.environ.get('LOCAL_URL', 'http://127.0.0.1:4173/').rstrip('/') + '/'

CSS = """
@font-face{font-family:Sora;font-weight:500;src:url(assets/fonts/sora-500.woff2) format('woff2')}
@font-face{font-family:'Playfair Display';font-style:italic;font-weight:500;src:url(assets/fonts/playfair-display-500i.woff2) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(assets/fonts/jetbrains-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;color:#F2F7FF;font-family:Sora,sans-serif;
  background:radial-gradient(70% 60% at 28% -12%,rgba(47,132,236,.42),rgba(47,132,236,0) 70%),
             radial-gradient(55% 60% at 96% 78%,rgba(31,87,199,.3),rgba(31,87,199,0) 70%),
             linear-gradient(180deg,#071637 0%,#050E27 55%,#040A1C 100%)}
body::before{content:"";position:absolute;inset:0;opacity:.7;background-image:
  radial-gradient(1.3px 1.3px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 63% 9%,#DDEBFF,transparent),
  radial-gradient(1.5px 1.5px at 82% 41%,#fff,transparent),radial-gradient(1px 1px at 37% 66%,#9FC8FF,transparent),
  radial-gradient(1px 1px at 91% 83%,#fff,transparent),radial-gradient(1.4px 1.4px at 24% 92%,#DDEBFF,transparent);
  background-size:300px 300px}
.hz{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(180deg,rgba(95,159,249,0),rgba(95,159,249,.1))}
.side{position:absolute;left:72px;top:64px;bottom:60px;display:flex;flex-direction:column;z-index:2}
.mark{display:flex;align-items:center;gap:9px;font-size:27px;letter-spacing:-.03em}
.mark svg{flex:none;height:40px;width:auto;margin-right:6px}
.sun{display:block;width:150px;height:auto;filter:drop-shadow(0 0 40px rgba(245,184,61,.45))}
.it{font-family:'Playfair Display',serif;font-style:italic;font-weight:500;letter-spacing:-.01em;
  background:linear-gradient(100deg,#DDEBFF 10%,#9FC8FF 55%,#5F9FF9 100%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.08em}
.code{display:inline-block;align-self:flex-start;margin-top:auto;font:400 17px/1 'JetBrains Mono',monospace;letter-spacing:.1em;color:#9FC8FF;
  padding:11px 14px;border-radius:9px;box-shadow:inset 0 0 0 1px rgba(159,200,255,.3)}
h1{font-weight:500;font-size:122px;line-height:.9;letter-spacing:-.055em;margin-top:18px}
h1.big{font-size:132px;margin-top:auto}
h1.big .it{display:block;font-size:150px;line-height:1;margin-top:-.02em}
.url{font:400 17px/1 'JetBrains Mono',monospace;color:rgba(159,200,255,.8);margin-top:26px}
.codes{display:flex;gap:12px;margin-top:30px}
.codes span{font:400 16px/1 'JetBrains Mono',monospace;letter-spacing:.06em;color:#DDEBFF;padding:11px 14px;border-radius:9px;
  background:rgba(95,159,249,.1);box-shadow:inset 0 0 0 1px rgba(95,159,249,.34)}
.codes b{font-weight:400;color:#9FC8FF;margin-right:10px}
.br{position:absolute;border-radius:16px;overflow:hidden;background:#0B1A3E;
  box-shadow:0 0 0 1px rgba(159,200,255,.22),0 40px 80px -30px rgba(0,0,0,.8),0 0 120px -40px rgba(95,159,249,.6)}
.br b{display:flex;align-items:center;gap:7px;height:34px;padding:0 14px;background:rgba(255,255,255,.05);border-bottom:1px solid rgba(159,200,255,.14)}
.br b i{width:10px;height:10px;border-radius:50%;background:rgba(221,235,255,.22)}
.br img{display:block;width:100%}
.ph{position:absolute;width:212px;padding:9px;border-radius:38px;background:#0B1A3E;
  box-shadow:0 0 0 1px rgba(159,200,255,.3),0 40px 70px -24px rgba(0,0,0,.85)}
.ph img{display:block;width:100%;border-radius:30px}
"""


def mk(kind, cls=''):
    vb = '-2 -2 48 40' if kind == 'lab' else '14 8 38 48'
    return '<svg%s viewBox="%s" aria-hidden="true">%s</svg>' % (' class="%s"' % cls if cls else '', vb, MARKS[kind])


def frame(img, style):
    return '<div class="br" style="%s"><b><i></i><i></i><i></i></b><img src="assets/lab/%s-1600.webp" alt=""></div>' % (style, img)


def phone(img, style):
    return '<div class="ph" style="%s"><img src="assets/lab/%s-600.webp" alt=""></div>' % (style, img)


def project(code, name, shot, mob, at, kind):
    return ('<div class="hz"></div>'
            + frame(shot, 'left:612px;top:92px;width:760px;transform:perspective(1600px) rotateY(-14deg) rotateX(4deg);transform-origin:0 50%')
            + phone(mob, at)
            + '<div class="side"><div class="mark">%sDigilago <span class="it">Lab</span></div>'
              '<span class="code">%s</span><h1>%s</h1><p class="url">digilago.ma</p></div>' % (mk(kind), code, name))


CARDS = {
    'og-lab': '<div class="hz"></div>'
              + frame('gestion-tableau', 'left:720px;top:40px;width:640px;opacity:.75;transform:perspective(1600px) rotateY(-16deg) rotateX(6deg)')
              + frame('radar-carte', 'left:600px;top:190px;width:680px;transform:perspective(1600px) rotateY(-16deg) rotateX(6deg)')
              + '<div class="side">' + mk('lab', 'sun') + '<h1 class="big">Digilago<span class="it">Lab</span></h1>'
                '<div class="codes"><span><b>LAB-01</b>Radar</span><span><b>LAB-02</b>Gestion</span></div>'
                '<p class="url">digilago.ma/lab</p></div>',
    'og-radar': project('LAB-01', 'Radar', 'radar-carte', 'radar-terrain', 'left:520px;top:236px;transform:rotate(-3deg)', 'radar'),
    'og-gestion': project('LAB-02', 'Gestion', 'gestion-tableau', 'gestion-suivi', 'left:930px;top:232px;transform:rotate(3deg)', 'gestion'),
}


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        await pg.goto(URL + 'lab.html')
        for name, body in CARDS.items():
            await pg.set_content('<!doctype html><html><head><meta charset="utf-8"><base href="%s"><style>%s</style></head>'
                                 '<body>%s</body></html>' % (URL, CSS, body), wait_until='load')
            await pg.evaluate('document.fonts.ready')
            await pg.wait_for_timeout(300)
            out = os.path.join(OUT, name + '.jpg')
            await pg.screenshot(path=out, type='jpeg', quality=84)
            print('écrit', out, os.path.getsize(out), 'octets')
        await b.close()

asyncio.run(main())
