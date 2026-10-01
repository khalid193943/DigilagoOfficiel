import random
F='''<svg class="sky-f" aria-hidden="true" focusable="false"><defs><filter id="skyF1" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="5" seed="4"/><feDisplacementMap in="SourceGraphic" scale="90"/><feGaussianBlur stdDeviation="2.5"/></filter><filter id="skyF2" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="4" seed="9"/><feDisplacementMap in="SourceGraphic" scale="80"/><feGaussianBlur stdDeviation="8"/></filter></defs></svg>'''
def cloud(x,y,w,h,o,dx,dd,seed):
    r=random.Random(seed); n=r.randint(5,7); puffs=[]
    for k in range(n):
        cx=0.12+0.76*k/(n-1)+r.uniform(-.05,.05); s=r.uniform(.38,.62)*(1.25 if 0<k<n-1 else .9); cy=0.62-s*0.35+r.uniform(-.06,.04)
        puffs.append((cx,cy,s))
    ps=''.join(f'<p style="left:{(cx-s/2)*100:.1f}%;top:{(cy-s/2)*100*w/h*0.5:.1f}%;width:{s*100:.1f}%;height:{s*100*w/h:.1f}%"></p>' for cx,cy,s in puffs)
    return f'<div class="cl" style="left:{x}%;top:{y}%;width:calc({w} * var(--u) * var(--cs,1));height:calc({h} * var(--u) * var(--cs,1));opacity:{o};--dx:{dx}px;--dd:{dd}s"><div class="sh">{ps}</div><div class="wh">{ps}</div></div>'
HERO=[(-20,8,560,290,.92,40,90,1),(84,34,420,220,.7,-30,110,4),(70,4,220,120,.45,20,80,5)]
BANK=[(-10,-46,460,190,.9,40,50,21),(12,-54,480,190,.8,-30,60,22),(34,-58,460,180,.7,30,55,23),(52,-58,480,180,.7,-30,65,24),(70,-54,480,190,.8,30,58,25),(88,-46,460,190,.9,-40,62,26)]
def bank():
    return '<div class="cbank" aria-hidden="true">'+''.join(cloud(*c).replace('class="cl"','class="cl cb" data-side="'+('l' if c[0]<45 else 'r')+'"',1) for c in BANK)+'</div>'
PAGE=[(-18,20,520,280,.85,30,90,11),(86,12,380,200,.6,-30,100,13),(62,78,260,140,.4,20,85,16)]
def sky(kind='hero', with_filter=True):
    L=HERO if kind=='hero' else PAGE
    return '<div class="sky" aria-hidden="true">'+(F if with_filter else '')+''.join(cloud(*c) for c in L)+'</div>'
CSS=r'''
/* ================= Le ciel de jour : nuages et bleu ciel ================= */
.sky{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.sky-f{position:absolute;width:0;height:0}
.cl{position:absolute;will-change:transform;animation:cloudDrift var(--dd,60s) ease-in-out infinite alternate}
.cl .sh,.cl .wh{position:absolute;inset:0}
.cl .sh{filter:url(#skyF2);transform:translateY(14%);opacity:.95;mix-blend-mode:multiply}
.cl .wh{filter:url(#skyF1)}
.cl p{position:absolute;margin:0;border-radius:50%}
.cl .wh p{background:radial-gradient(circle at 42% 32%,#fff 0%,rgba(255,255,255,.96) 22%,rgba(236,244,255,.78) 44%,rgba(214,230,252,.45) 58%,rgba(255,255,255,0) 71%)}
.cl .sh p{background:radial-gradient(circle at 50% 70%,rgba(70,120,195,.75) 0%,rgba(110,155,215,.4) 40%,rgba(150,185,230,0) 70%)}
@keyframes cloudDrift{from{transform:translateX(0)}to{transform:translateX(var(--dx,40px))}}
[data-mode="M"] .sky{--cs:.55}
/* Accueil : ciel de jour */
.hero{background:linear-gradient(180deg,#1B6BDB 0%,#2F84EC 38%,#5AA4F4 72%,#8CC4F8 100%)!important}
.hero .hbg{display:none!important}
.hero .nav,.hero .head,.hero .hstage{z-index:3}
.hero .head h1{color:#fff!important}
.hero .head h1 .ln + .ln{background:linear-gradient(180deg,#fff 10%,rgba(255,255,255,.45) 95%)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}
.hero .ti::after,.hero h1 .ti::before{background:#fff!important;color:#fff!important}
.hero .sub{color:rgba(255,255,255,.88)!important}
.hero .eyebrow{background:rgba(255,255,255,.18)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)!important;color:#fff!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.hero .eyebrow .live,.hero .eyebrow .live::after{background:#fff!important}
.hero .cta .arw,.hero .cta .lbl{background:#fff!important;color:#072021!important}
.hero .ghost{color:#fff!important;border-color:rgba(255,255,255,.6)!important}
.hero .rope path{stroke:rgba(255,255,255,.75)!important}
.hero .bulb{background:#fff!important;box-shadow:0 0 calc(10 * var(--u)) #fff,0 0 calc(22 * var(--u)) rgba(255,255,255,.8)!important}
.hero .clip{background:linear-gradient(180deg,#072021,#1B3B6B)!important}
.hero .hl-k{color:rgba(255,255,255,.75)!important}
.hero .hl-n{color:rgba(255,255,255,.9)!important}
.hero .gc{box-shadow:0 calc(30 * var(--u)) calc(50 * var(--u)) calc(-20 * var(--u)) rgba(10,40,90,.45),0 0 0 1px rgba(255,255,255,.6)!important}
.hero .nav .links a,.hero .nav .word{color:#fff!important}
.hero .nav .cta .arw,.hero .nav .cta .lbl{background:#fff!important;color:#072021!important}
.hero .nav .lang{background:rgba(255,255,255,.18)!important;color:#fff!important}
/* Pages intérieures : même ciel */
.phero{background:linear-gradient(180deg,#1B6BDB 0%,#2F84EC 40%,#5AA4F4 78%,#8CC4F8 100%)!important}
.phero::before{display:none!important}
.phero > *:not(.sky):not(.pollen){position:relative;z-index:2}
.phero h1{color:#fff}
.phero h1 .grad{background:linear-gradient(180deg,#fff 10%,rgba(255,255,255,.45) 95%)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}
.phero .lead{color:rgba(255,255,255,.9)!important}
.phero .eyebrow{background:rgba(255,255,255,.18)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)!important;color:#fff!important}
.phero .eyebrow .live,.phero .eyebrow .live::after{background:#fff!important}
.phero .cta .arw,.phero .cta .lbl{background:#fff!important;color:#072021!important}
.phero .ghost{color:#fff!important;border-color:rgba(255,255,255,.6)!important}
.phero .anchors a,.phero .stats{background:rgba(255,255,255,.16)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.phero .anchors a span{color:#fff!important}
.phero .stats div{box-shadow:inset -1px 0 0 rgba(255,255,255,.25)!important}
.phero .stats span{color:rgba(255,255,255,.85)!important}
/* Pied de page : la nuit, la lune et les étoiles */
.nstars{position:absolute;inset:0;pointer-events:none;z-index:0}
.nstars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.2;animation:tw3 4s ease-in-out infinite}
.nstars i.b{width:3px;height:3px;box-shadow:0 0 6px rgba(255,255,255,.8)}
@keyframes tw3{0%,100%{opacity:.15}50%{opacity:.95}}
.fmoon{position:absolute;right:9%;top:calc(70 * var(--u));width:calc(90 * var(--u));height:calc(90 * var(--u));border-radius:50%;z-index:0;background:radial-gradient(circle at 38% 36%,#FFFFFF 0%,#E8EEF8 45%,#C9D4E6 100%);box-shadow:0 0 calc(60 * var(--u)) rgba(220,232,255,.45),0 0 calc(160 * var(--u)) rgba(150,190,255,.25);animation:moonF 12s ease-in-out infinite alternate}
.fmoon::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 60%,rgba(160,175,200,.35) 0 8%,transparent 9%),radial-gradient(circle at 62% 30%,rgba(160,175,200,.3) 0 6%,transparent 7%),radial-gradient(circle at 58% 70%,rgba(160,175,200,.25) 0 10%,transparent 11%)}
@keyframes moonF{from{transform:translateY(0)}to{transform:translateY(calc(-14 * var(--u)))}}
[data-mode="M"] .fmoon{width:calc(54 * var(--u));height:calc(54 * var(--u));right:6%}
'''
def stars(n=70, seed=5):
    r=random.Random(seed)
    return '<div class="nstars" aria-hidden="true">'+''.join(f'<i class="{"b" if r.random()<.18 else ""}" style="left:{r.uniform(1,99):.1f}%;top:{r.uniform(1,70):.1f}%;animation-delay:{-r.uniform(0,4):.1f}s;animation-duration:{r.uniform(3,6):.1f}s"></i>' for _ in range(n))+'</div><span class="fmoon" aria-hidden="true"></span>'

DAYC=[(-16,0.12,520,260,.55,.06,30,101),(84,0.62,420,210,.42,.10,-30,104),(58,1.28,240,120,.3,.14,20,107),(-8,1.6,300,150,.35,.08,25,108)]
def dayclouds(mobile_hide=(2,3)):
    out=[]
    for i,(x,y,w,h,o,f,dx,seed) in enumerate(DAYC):
        c=cloud(x,0,w,h,o,dx,70+i*7,seed)
        c=c.replace('class="cl"',f'class="cl dcl{" mh" if i in mobile_hide else ""}" data-y="{y}" data-f="{f}"',1)
        out.append(c)
    return '<div class="dayclouds" id="dayclouds" aria-hidden="true">'+''.join(out)+'</div>'
