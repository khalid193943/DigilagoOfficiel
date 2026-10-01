from anicons import AI
ARW='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>'
BACK='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>'
PLANE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.5L3 5l3.5 7.5L3 20z" fill="#1F57C7"/><path d="M6.5 12.5H21" stroke="#fff" stroke-width="1.2"/></svg>'
CHECK='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3l2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
NEEDS=[('globe','Site web','Vitrine, rendez-vous, pages métiers'),('cart','Boutique en ligne','Catalogue, panier, livraison'),('phone','Application mobile','iOS et Android'),('pin','Fiche Google','Être sur la carte, avec vos avis'),('bot','Visibilité dans les IA','Être recommandé par ChatGPT'),('pen','Branding et logo','Une identité nette'),('search','Je ne sais pas encore','On vous conseille')]
METS=['École','Santé','Restaurant','Hôtellerie','Commerce','Industrie','Juridique','Immobilier','Beauté','Sport','Tourisme','Autre']
STYLES=[('elegant','Élégant','#0B1B3A','#C9A45C','#F7F3EA'),('frais','Frais','#1F57C7','#8CC4F8','#F2F7FF'),('chaleureux','Chaleureux','#8E3B1E','#E0892B','#FBF1E6'),('audacieux','Audacieux','#3B1C8C','#F2B233','#F5F2FF')]
WHEN=[('asap','Le plus vite possible','Première version en 72 h'),('mois','Dans le mois','On planifie ensemble'),('info','Je me renseigne','Sans engagement')]
ROUTE=['Besoin','Entreprise','Rythme','Contact','Décollage']
def tiles(items, name, multi=True):
    return ''.join(f'<button type="button" class="wtile" data-{name}="{t}" aria-pressed="false"><span class="t-ic">{AI(k)}</span><b>{t}</b><small>{d}</small><i class="t-ck">{CHECK}</i></button>' for k,t,d in items)
def build():
    route=''.join(f'<span class="rt-dot" data-k="{i}" style="left:{i*25}%"><i></i><em>{t}</em></span>' for i,t in enumerate(ROUTE))
    st_tiles=''.join(f'<button type="button" class="sty" data-sty="{k}" data-a="{a}" data-b="{bb}" data-c="{c}" aria-pressed="false"><span class="sty-v" style="background:{c}"><i style="background:{a}"></i><i style="background:{bb}"></i><span style="background:{a}"></span></span><b>{t}</b><i class="t-ck">{CHECK}</i></button>' for k,t,a,bb,c in STYLES)
    when=''.join(f'<button type="button" class="wtile sm" data-when="{t}" aria-pressed="false"><b>{t}</b><small>{d}</small><i class="t-ck">{CHECK}</i></button>' for k,t,d in WHEN)
    mets=''.join(f'<button type="button" class="wchip" data-met="{m}" aria-pressed="false">{m}</button>' for m in METS)
    steps=f'''
<div class="wz-step on" data-step="0"><span class="wz-k">Étape 1 sur 5</span><h3>Qu’est-ce qu’on <em>construit ensemble ?</em></h3><p class="wz-h">Choisissez tout ce qui vous parle. Vous pourrez changer d’avis.</p><div class="wtiles" id="tNeeds">{tiles(NEEDS,'need')}</div></div>
<div class="wz-step" data-step="1"><span class="wz-k">Étape 2 sur 5</span><h3>Parlez-nous de <em>votre entreprise.</em></h3><p class="wz-h">Son nom et sa ville suffisent pour commencer.</p><label class="big-in"><span>Nom de l’entreprise</span><input id="wName" type="text" maxlength="40" autocomplete="organization" placeholder="Ex. : Clinique Azur"></label><div class="wz-sub">Votre métier</div><div class="wchips" id="tMet">{mets}</div><label class="big-in sm"><span>Ville</span><input id="wCity" type="text" maxlength="30" value="El Jadida"></label></div>
<div class="wz-step" data-step="2"><span class="wz-k">Étape 3 sur 5</span><h3>Quand voulez-vous <em>être en ligne ?</em></h3><p class="wz-h">Et avez-vous déjà un site ?</p><div class="wtiles three" id="tWhen">{when}</div><div class="wz-sub">Un site existe déjà ?</div><div class="wchips" id="tHas"><button type="button" class="wchip" data-has="Non" aria-pressed="false">Non, c’est le premier</button><button type="button" class="wchip" data-has="Oui" aria-pressed="false">Oui, à refaire</button></div></div>
<div class="wz-step" data-step="3"><span class="wz-k">Étape 4 sur 5</span><h3>Où peut-on <em>vous répondre ?</em></h3><p class="wz-h">Réponse le jour même, du lundi au samedi.</p><div class="duo2"><label class="big-in sm"><span>Votre prénom</span><input id="wFirst" type="text" autocomplete="given-name" placeholder="Prénom"></label><label class="big-in sm"><span>WhatsApp ou téléphone</span><input id="wTel" type="tel" autocomplete="tel" placeholder="+212 6 …"></label></div><label class="big-in sm"><span>E-mail (facultatif)</span><input id="wMail" type="email" autocomplete="email" placeholder="vous@exemple.ma"></label><div class="wz-sub">On vous contacte par</div><div class="wchips" id="tPref"><button type="button" class="wchip on" data-pref="WhatsApp" aria-pressed="true">WhatsApp</button><button type="button" class="wchip" data-pref="Appel" aria-pressed="false">Appel</button><button type="button" class="wchip" data-pref="E-mail" aria-pressed="false">E-mail</button></div></div>
<div class="wz-step" data-step="4"><span class="wz-k">Étape 5 sur 5</span><h3>Tout est prêt pour <em>le décollage.</em></h3><p class="wz-h">Vérifiez, puis lancez. Vous ne payez que si la première version vous plaît.</p><dl class="recap" id="recap"></dl></div>
<div class="wz-done" id="wzDone"><span class="done-ic">{CHECK}</span><span class="wz-k" id="wzRef"></span><h3>Projet lancé. <em>À tout de suite.</em></h3><p>Votre demande s’ouvre dans WhatsApp, prête à envoyer. Nous vous répondons aujourd’hui.</p><ol class="done-tl"><li class="on"><b>H+0</b><span>Demande envoyée</span></li><li><b>Aujourd’hui</b><span>Appel de dix minutes</span></li><li><b>H+72</b><span>Votre première version</span></li><li><b>Jour J</b><span>En ligne, et trouvé</span></li></ol><a class="wz-wa" id="wzWa" href="https://wa.me/212649953813" target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp à nouveau</a></div>'''
    main=f'''<section class="wz-sec" id="wzSec"><div class="wz-route rv" aria-hidden="true"><div class="rt-line"><i id="rtFill"></i></div>{route}<span class="rt-plane" id="rtPlane">{PLANE}</span></div>
<div class="wz" id="wz"><div class="wz-card rv d1" id="wzCard"><div class="wz-steps">{steps}</div><div class="wz-err" id="wzErr" role="alert"></div><div class="wz-nav" id="wzNav"><button type="button" class="wz-back" id="wzBack">{BACK}Retour</button><span class="wz-count" id="wzCount">1 / 5</span><button type="button" class="wz-next" id="wzNext">Continuer{ARW}</button></div></div>
</div></section>
<section class="blk" id="apres"><div class="sh"><span class="pill rv"><span class="ic"></span>Et ensuite</span><h2 class="rv d1"><span class="l"><span class="li">Vous lancez,</span></span><span class="l"><span class="li grad">on s’occupe du reste.</span></span></h2></div><div class="st4 w mt"><div class="rv"><b>01</b><h5>On vous répond aujourd’hui</h5><p>Un échange de dix minutes pour bien comprendre votre besoin.</p></div><div class="rv"><b>02</b><h5>Première version en 72 h</h5><p>Un vrai site, avec vos informations, vos couleurs et vos textes.</p></div><div class="rv"><b>03</b><h5>Vous validez, on affine</h5><p>Vous ne payez que si elle vous plaît. Trois séries de retouches incluses.</p></div><div class="rv"><b>04</b><h5>En ligne, et trouvé</h5><p>Site, fiche Google, référencement et IA : vos clients vous trouvent.</p></div></div></section>'''
    return main
CSS=r'''
.wz{grid-template-columns:1fr!important;width:calc(1120 * var(--u))!important}
.wz-card{min-height:calc(540 * var(--u))!important;padding:calc(54 * var(--u)) calc(64 * var(--u)) calc(36 * var(--u))!important}
.wz-step h3,.wz-done h3{font-size:calc(52 * var(--u))!important}
.wz-h{font-size:calc(17.5 * var(--u))!important}
.wtiles{grid-template-columns:repeat(4,1fr)!important;gap:calc(14 * var(--u))!important}
.wtiles.three{grid-template-columns:repeat(3,1fr)!important}
.wtile{padding:calc(24 * var(--u))!important;min-height:calc(160 * var(--u))}
.wtile.sm{min-height:0}
.wtile .t-ic .ai{width:calc(50 * var(--u))!important;height:calc(50 * var(--u))!important}
.wtile b{font-size:calc(18 * var(--u))!important}
.wtile small{font-size:calc(13.5 * var(--u))!important}
.big-in input{font-size:calc(38 * var(--u))!important}
.big-in.sm input{font-size:calc(24 * var(--u))!important}
.wz-route{width:calc(1000 * var(--u))!important}
.recap{grid-template-columns:repeat(3,1fr)!important}
#wzRef{display:block;margin-top:calc(18 * var(--u))}
[data-mode="M"] .wtiles,[data-mode="M"] .wtiles.three{grid-template-columns:1fr 1fr!important}
[data-mode="M"] .wz-card{padding:calc(24 * var(--u)) calc(18 * var(--u))!important}
[data-mode="M"] .wz-step h3,[data-mode="M"] .wz-done h3{font-size:calc(28 * var(--u))!important}
[data-mode="M"] .recap{grid-template-columns:1fr!important}
[data-mode="M"] .big-in input{font-size:calc(26 * var(--u))!important}
[data-mode="M"] .wtile{min-height:0}

/* ================= Démarrer un projet : le décollage ================= */
.wz-sec{position:relative;padding:calc(40 * var(--u)) calc(24 * var(--u)) calc(90 * var(--u))}
.wz-route{position:relative;width:calc(900 * var(--u));max-width:calc(100% - 40px);height:calc(64 * var(--u));margin:0 auto calc(34 * var(--u))}
.rt-line{position:absolute;left:0;right:0;top:calc(16 * var(--u));height:3px;border-radius:3px;background:rgba(31,87,199,.15);overflow:hidden}
.rt-line i{display:block;height:100%;width:0;background:linear-gradient(90deg,#1F57C7,#5F9FF9);transition:width .9s cubic-bezier(.65,0,.35,1)}
.rt-dot{position:absolute;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:calc(10 * var(--u))}
.rt-dot i{width:calc(34 * var(--u));height:calc(34 * var(--u));border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(31,87,199,.2);transition:background .5s,box-shadow .5s,transform .5s cubic-bezier(.34,1.56,.64,1)}
.rt-dot em{font-style:normal;font-family:"JetBrains Mono",monospace;font-size:calc(10.5 * var(--u));letter-spacing:.12em;text-transform:uppercase;color:#6A7FA3;white-space:nowrap;transition:color .4s}
.rt-dot.done i{background:#1F57C7;box-shadow:0 0 0 2px #1F57C7}
.rt-dot.on i{background:#fff;box-shadow:0 0 0 3px #1F57C7,0 0 0 calc(9 * var(--u)) rgba(31,87,199,.15);transform:scale(1.1)}
.rt-dot.on em,.rt-dot.done em{color:#0B1B3A}
.rt-plane{position:absolute;top:calc(2 * var(--u));width:calc(30 * var(--u));height:calc(30 * var(--u));margin-left:calc(-15 * var(--u));left:0;transition:left .9s cubic-bezier(.65,0,.35,1),transform .9s;z-index:2;filter:drop-shadow(0 4px 8px rgba(31,87,199,.4))}
.rt-plane svg{width:100%;height:100%}
.wz{display:grid;grid-template-columns:1fr calc(420 * var(--u));gap:calc(28 * var(--u));width:calc(1184 * var(--u));max-width:100%;margin:0 auto;align-items:start}
.wz-card{position:relative;min-height:calc(560 * var(--u));padding:calc(44 * var(--u)) calc(46 * var(--u)) calc(30 * var(--u));border-radius:calc(22 * var(--u));background:rgba(255,255,255,.72);-webkit-backdrop-filter:blur(22px) saturate(1.3);backdrop-filter:blur(22px) saturate(1.3);box-shadow:0 0 0 1px rgba(255,255,255,.8),0 calc(50 * var(--u)) calc(100 * var(--u)) calc(-50 * var(--u)) rgba(20,50,110,.45);display:flex;flex-direction:column}
.wz-steps{position:relative;flex:1}
.wz-step{display:none;animation:stepIn .7s cubic-bezier(.16,1,.3,1) both}
.wz-step.on{display:block}
.wz-step.back{animation-name:stepBack}
@keyframes stepIn{from{opacity:0;transform:translateX(40px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes stepBack{from{opacity:0;transform:translateX(-40px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
.wz-k{font-family:"JetBrains Mono",monospace;font-size:calc(11 * var(--u));letter-spacing:.14em;text-transform:uppercase;color:#1F57C7}
.wz-step h3,.wz-done h3{margin:calc(12 * var(--u)) 0 0;font-family:Sora,sans-serif;font-weight:500;font-size:calc(40 * var(--u));line-height:1.05;letter-spacing:-.045em;color:#072021}
.wz-step h3 em,.wz-done h3 em{font-family:"Playfair Display",Georgia,serif;font-weight:500;color:#1F57C7}
.wz-h{margin:calc(10 * var(--u)) 0 calc(26 * var(--u));font-size:calc(16 * var(--u));color:#3A4E72}
.wtiles{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(12 * var(--u))}
.wtiles.three{grid-template-columns:repeat(3,1fr)}
.wtile{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:calc(6 * var(--u));padding:calc(18 * var(--u));border:0;border-radius:calc(16 * var(--u));background:rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(31,87,199,.12);font:inherit;text-align:left;color:#072021;cursor:pointer;transition:transform .45s cubic-bezier(.34,1.56,.64,1),background .35s,color .35s,box-shadow .35s}
.wtile:hover{transform:translateY(-3px);box-shadow:0 0 0 1.5px #5F9FF9,0 calc(18 * var(--u)) calc(34 * var(--u)) calc(-18 * var(--u)) rgba(20,50,110,.4)}
.wtile .t-ic{color:#1F57C7;margin-bottom:calc(6 * var(--u))}
.wtile .t-ic .ai{width:calc(42 * var(--u));height:calc(42 * var(--u))}
.wtile b{font-family:Sora,sans-serif;font-weight:500;font-size:calc(16.5 * var(--u));letter-spacing:-.02em}
.wtile small{font-size:calc(12.5 * var(--u));color:#5B6B85;line-height:1.4}
.t-ck{position:absolute;right:calc(12 * var(--u));top:calc(12 * var(--u));width:calc(24 * var(--u));height:calc(24 * var(--u));border-radius:50%;background:#fff;color:#1F57C7;display:flex;align-items:center;justify-content:center;transform:scale(0);transition:transform .45s cubic-bezier(.34,1.56,.64,1)}
.t-ck svg{width:calc(12 * var(--u))}
.wtile[aria-pressed="true"],.sty[aria-pressed="true"]{background:#0B1B3A;color:#fff;box-shadow:0 calc(20 * var(--u)) calc(40 * var(--u)) calc(-20 * var(--u)) rgba(11,27,58,.6)}
.wtile[aria-pressed="true"] small{color:#A9BCDD}
.wtile[aria-pressed="true"] .t-ic{color:#9FC8FF}
.wtile[aria-pressed="true"] .t-ck,.sty[aria-pressed="true"] .t-ck{transform:scale(1)}
.wtile.sm{padding:calc(22 * var(--u))}
.big-in{display:flex;flex-direction:column;gap:calc(8 * var(--u));margin-bottom:calc(18 * var(--u))}
.big-in span{font-family:"JetBrains Mono",monospace;font-size:calc(10.5 * var(--u));letter-spacing:.12em;text-transform:uppercase;color:#5B6B85}
.big-in input{font:inherit;font-family:Sora,sans-serif;font-size:calc(30 * var(--u));font-weight:500;letter-spacing:-.03em;color:#072021;border:0;border-radius:0;background:transparent;box-shadow:inset 0 -2px 0 rgba(31,87,199,.2);padding:calc(8 * var(--u)) 0;outline:none;transition:box-shadow .3s}
.big-in input:focus{box-shadow:inset 0 -3px 0 #1F57C7}
.big-in input::placeholder{color:rgba(58,78,114,.35)}
.big-in.sm input{font-size:calc(20 * var(--u))}
.duo2{display:grid;grid-template-columns:1fr 1fr;gap:calc(20 * var(--u))}
.wz-sub{margin:calc(8 * var(--u)) 0 calc(10 * var(--u));font-family:"JetBrains Mono",monospace;font-size:calc(10.5 * var(--u));letter-spacing:.12em;text-transform:uppercase;color:#5B6B85}
.wchips{display:flex;flex-wrap:wrap;gap:calc(8 * var(--u));margin-bottom:calc(18 * var(--u))}
.wchip{height:calc(40 * var(--u));padding:0 calc(16 * var(--u));border:0;border-radius:999px;background:rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(31,87,199,.14);font:inherit;font-size:calc(14.5 * var(--u));color:#072021;cursor:pointer;transition:background .3s,color .3s,transform .35s cubic-bezier(.34,1.56,.64,1)}
.wchip:hover{transform:translateY(-2px)}
.wchip[aria-pressed="true"],.wchip.on{background:#0B1B3A;color:#fff;box-shadow:none}
.stys{display:grid;grid-template-columns:repeat(4,1fr);gap:calc(12 * var(--u))}
.sty{position:relative;display:flex;flex-direction:column;gap:calc(10 * var(--u));padding:calc(10 * var(--u)) calc(10 * var(--u)) calc(14 * var(--u));border:0;border-radius:calc(16 * var(--u));background:rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(31,87,199,.12);font:inherit;color:#072021;cursor:pointer;text-align:left;transition:transform .45s cubic-bezier(.34,1.56,.64,1),background .35s,color .35s}
.sty:hover{transform:translateY(-3px)}
.sty-v{position:relative;display:block;height:calc(120 * var(--u));border-radius:calc(12 * var(--u));overflow:hidden}
.sty-v i{position:absolute;border-radius:50%}
.sty-v i:nth-child(1){width:54%;aspect-ratio:1;right:-8%;top:-10%}
.sty-v i:nth-child(2){width:26%;aspect-ratio:1;right:34%;bottom:10%;opacity:.9}
.sty-v span{position:absolute;left:12%;bottom:16%;width:38%;height:12%;border-radius:999px}
.sty b{padding:0 calc(6 * var(--u));font-family:Sora,sans-serif;font-weight:500;font-size:calc(16 * var(--u))}
.recap{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:calc(10 * var(--u))}
.recap div{padding:calc(14 * var(--u)) calc(16 * var(--u));border-radius:calc(14 * var(--u));background:rgba(255,255,255,.8);box-shadow:0 0 0 1px rgba(31,87,199,.1);cursor:pointer;transition:background .3s}
.recap div:hover{background:#fff}
.recap dt{font-family:"JetBrains Mono",monospace;font-size:calc(10 * var(--u));letter-spacing:.12em;text-transform:uppercase;color:#1F57C7}
.recap dd{margin:calc(4 * var(--u)) 0 0;font-size:calc(15 * var(--u));font-weight:500;color:#072021}
.wz-err{min-height:calc(20 * var(--u));margin-top:calc(10 * var(--u));font-size:calc(13.5 * var(--u));color:#C0392B}
.wz-card.shake{animation:shake .5s}
@keyframes shake{20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
.wz-nav{display:flex;align-items:center;justify-content:space-between;gap:calc(12 * var(--u));margin-top:calc(16 * var(--u))}
.wz-back{display:inline-flex;align-items:center;gap:calc(8 * var(--u));height:calc(48 * var(--u));padding:0 calc(16 * var(--u));border:0;border-radius:999px;background:transparent;font:inherit;font-size:calc(14.5 * var(--u));color:#3A4E72;cursor:pointer;transition:opacity .3s}
.wz-back svg,.wz-next svg{width:calc(14 * var(--u))}
.wz-back[disabled]{opacity:0;pointer-events:none}
.wz-count{font-family:"JetBrains Mono",monospace;font-size:calc(12 * var(--u));color:#5B6B85}
.wz-next{display:inline-flex;align-items:center;gap:calc(10 * var(--u));height:calc(56 * var(--u));padding:0 calc(26 * var(--u));border:0;border-radius:999px;background:#0B1B3A;color:#fff;font:inherit;font-size:calc(15.5 * var(--u));font-weight:500;cursor:pointer;transition:background .3s,transform .35s cubic-bezier(.34,1.56,.64,1)}
.wz-next:hover{background:#1F57C7;transform:translateY(-2px)}
.wz-next.launch{background:linear-gradient(90deg,#1F57C7,#5F9FF9);box-shadow:0 calc(18 * var(--u)) calc(36 * var(--u)) calc(-14 * var(--u)) rgba(31,87,199,.7)}
.wz-done{display:none;text-align:left;animation:stepIn .8s cubic-bezier(.16,1,.3,1) both}
.wz-card.sent .wz-steps > .wz-step{display:none!important}
.wz-card.sent .wz-done{display:block}
.wz-card.sent .wz-nav,.wz-card.sent .wz-err{display:none}
.done-ic{display:flex;width:calc(64 * var(--u));height:calc(64 * var(--u));border-radius:50%;background:#1F57C7;color:#fff;align-items:center;justify-content:center;box-shadow:0 0 0 calc(10 * var(--u)) rgba(31,87,199,.15);animation:pinDrop .8s cubic-bezier(.34,1.56,.64,1) both}
.done-ic svg{width:calc(28 * var(--u))}
.wz-done p{margin:calc(12 * var(--u)) 0 0;font-size:calc(16.5 * var(--u));color:#3A4E72;max-width:calc(520 * var(--u))}
.done-tl{list-style:none;margin:calc(28 * var(--u)) 0 0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:calc(10 * var(--u))}
.done-tl li{padding:calc(16 * var(--u));border-radius:calc(14 * var(--u));background:rgba(255,255,255,.8)}
.done-tl li.on{background:#0B1B3A;color:#fff}
.done-tl b{display:block;font-family:Sora,sans-serif;font-weight:600;font-size:calc(20 * var(--u));letter-spacing:-.03em}
.done-tl span{font-size:calc(12.5 * var(--u));opacity:.8}
.wz-wa{display:inline-block;margin-top:calc(22 * var(--u));font-size:calc(14 * var(--u));font-weight:500;color:#1F57C7;border-bottom:1px solid currentColor}
/* l'aperçu en direct */
.wz-prev{position:sticky;top:calc(96 * var(--u));display:flex;flex-direction:column;gap:calc(14 * var(--u))}
.wp-head{display:flex;align-items:center;gap:calc(10 * var(--u));font-size:calc(13 * var(--u));color:#3A4E72}
.wp-head b{font-family:"JetBrains Mono",monospace;font-weight:500;color:#0B1B3A}
.wp-head em{margin-left:auto;font-style:normal;font-size:calc(11.5 * var(--u));font-weight:600;padding:calc(5 * var(--u)) calc(10 * var(--u));border-radius:999px;background:rgba(31,87,199,.12);color:#1F57C7}
.wp-head em.go{background:#1F57C7;color:#fff}
.wp-site{--a:#1F57C7;--b:#8CC4F8;--c:#F2F7FF;border-radius:calc(16 * var(--u));overflow:hidden;background:#fff;box-shadow:0 calc(40 * var(--u)) calc(80 * var(--u)) calc(-36 * var(--u)) rgba(20,50,110,.5),0 0 0 1px rgba(31,87,199,.08)}
.wp-bar{display:flex;align-items:center;gap:6px;height:calc(32 * var(--u));padding:0 calc(12 * var(--u));background:#F3F7FD}
.wp-bar i{width:7px;height:7px;border-radius:50%;background:#D4DDEB}
.wp-bar span{margin-left:calc(8 * var(--u));font-size:calc(11 * var(--u));color:#5B6B85;background:#fff;border-radius:999px;padding:calc(3 * var(--u)) calc(10 * var(--u))}
.wp-body{position:relative;background:var(--c);transition:background .6s;padding-bottom:calc(20 * var(--u));overflow:hidden}
.wp-nav{display:flex;align-items:center;justify-content:space-between;padding:calc(14 * var(--u)) calc(18 * var(--u))}
.wp-lg{display:flex;align-items:center;gap:calc(8 * var(--u))}
.wp-lg i{width:calc(28 * var(--u));height:calc(28 * var(--u));border-radius:calc(8 * var(--u));background:var(--a);color:#fff;display:flex;align-items:center;justify-content:center;font-style:italic;font-family:"Playfair Display",Georgia,serif;font-size:calc(11 * var(--u));transition:background .6s}
.wp-lg b{font-family:Sora,sans-serif;font-size:calc(13.5 * var(--u));color:#0B1B3A;max-width:calc(170 * var(--u));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wp-lk{display:flex;gap:calc(8 * var(--u))}.wp-lk i{width:calc(26 * var(--u));height:calc(6 * var(--u));border-radius:6px;background:rgba(11,27,58,.12)}
.wp-hero{position:relative;z-index:2;display:flex;flex-direction:column;align-items:flex-start;gap:calc(8 * var(--u));padding:calc(18 * var(--u)) calc(18 * var(--u)) 0;max-width:68%}
.wp-k{font-family:"JetBrains Mono",monospace;font-size:calc(9.5 * var(--u));letter-spacing:.14em;text-transform:uppercase;color:var(--a);transition:color .6s}
.wp-hero h5{margin:0;font-family:Sora,sans-serif;font-weight:500;font-size:calc(24 * var(--u));line-height:1.08;letter-spacing:-.04em;color:#0B1B3A}
.wp-hero h5 em{font-family:"Playfair Display",Georgia,serif;color:var(--a);transition:color .6s}
.wp-sub{font-size:calc(12 * var(--u));color:#51607A}
.wp-cta{margin-top:calc(6 * var(--u));padding:calc(8 * var(--u)) calc(14 * var(--u));border-radius:999px;background:var(--a);color:#fff;font-size:calc(11.5 * var(--u));font-weight:500;transition:background .6s}
.wp-art{position:absolute;right:-10%;top:18%;width:48%;aspect-ratio:1}
.wp-art i{position:absolute;border-radius:50%;transition:background .6s}
.wp-art i:nth-child(1){inset:0;background:radial-gradient(circle at 32% 28%,#fff,var(--b) 40%,var(--a) 85%)}
.wp-art i:nth-child(2){width:34%;aspect-ratio:1;left:-14%;bottom:-8%;background:radial-gradient(circle at 32% 28%,#fff,var(--b) 60%)}
.wp-body.pop{animation:pvPop .6s cubic-bezier(.34,1.56,.64,1)}
@keyframes pvPop{40%{transform:scale(1.02)}}
.wp-chips{display:flex;flex-wrap:wrap;gap:calc(6 * var(--u));min-height:calc(34 * var(--u))}
.wp-chips span{padding:calc(6 * var(--u)) calc(12 * var(--u));border-radius:999px;background:rgba(255,255,255,.8);box-shadow:0 0 0 1px rgba(31,87,199,.12);font-size:calc(12.5 * var(--u));color:#0B1B3A;animation:pinDrop .5s cubic-bezier(.34,1.56,.64,1) both}
.wp-chips .wp-empty{background:none;box-shadow:none;color:#6A7FA3;padding-left:0;animation:none}
.wp-tl{display:flex;align-items:center;gap:calc(8 * var(--u));font-family:"JetBrains Mono",monospace;font-size:calc(10.5 * var(--u));letter-spacing:.08em;text-transform:uppercase;color:#6A7FA3}
.wp-tl i{flex:1;height:2px;border-radius:2px;background:rgba(31,87,199,.18)}
.wp-tl .on{color:#1F57C7}
[data-mode="M"] .wz{grid-template-columns:1fr}
[data-mode="M"] .wz-prev{display:none}
[data-mode="M"] .wz-card{padding:calc(24 * var(--u)) calc(18 * var(--u)) calc(18 * var(--u));min-height:0}
[data-mode="M"] .wz-step h3,[data-mode="M"] .wz-done h3{font-size:calc(28 * var(--u))}
[data-mode="M"] .wtiles,[data-mode="M"] .wtiles.three{grid-template-columns:1fr 1fr}
[data-mode="M"] .stys{grid-template-columns:1fr 1fr}
[data-mode="M"] .rt-dot em{display:none}
[data-mode="M"] .duo2,[data-mode="M"] .recap{grid-template-columns:1fr}
[data-mode="M"] .done-tl{grid-template-columns:1fr 1fr}
[data-mode="M"] .big-in input{font-size:calc(24 * var(--u))}
'''
JS=r'''
  /* ---------- Démarrer un projet : le parcours en six étapes ---------- */
  var wz = document.getElementById('wz');
  if (wz) (function(){
    var card = $('wzCard'), steps = card.querySelectorAll('.wz-step'), dots = document.querySelectorAll('.rt-dot'), cur = 0, N = steps.length;
    var st = { needs: [], name: '', met: '', city: 'El Jadida', when: '', has: '', first: '', tel: '', mail: '', pref: 'WhatsApp' };
    var ref = 'DG-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    function preview(){}
    function pop(){}
    function go(i, back){
      if (i < 0 || i >= N) return;
      steps[cur].classList.remove('on', 'back'); cur = i; steps[cur].classList.toggle('back', !!back); steps[cur].classList.add('on');
      $('wzBack').disabled = cur === 0; $('wzCount').textContent = (cur + 1) + ' / ' + N; $('wzErr').textContent = '';
      var nx = $('wzNext'); nx.classList.toggle('launch', cur === N - 1); nx.firstChild.textContent = cur === N - 1 ? 'Lancer mon projet ' : 'Continuer';
      dots.forEach(function(d, k){ d.classList.toggle('done', k < cur); d.classList.toggle('on', k === cur); });
      $('rtFill').style.width = (cur / (N - 1) * 100) + '%'; $('rtPlane').style.left = (cur / (N - 1) * 100) + '%';
      if (cur === N - 1) recap();
      var t = steps[cur].querySelector('input'); if (t && window.matchMedia('(pointer:fine)').matches) setTimeout(function(){ t.focus({ preventScroll: true }); }, 350);
      var r = card.getBoundingClientRect(); if (r.top < 60) window.scrollTo({ top: window.scrollY + r.top - 110, behavior: 'smooth' });
    }
    function err(m){ $('wzErr').textContent = m; card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    function valid(){
      if (cur === 0 && !st.needs.length) { err('Choisissez au moins une option, même « Je ne sais pas encore ».'); return false; }
      if (cur === 1 && !st.name.trim()) { err('Le nom de votre entreprise, s’il vous plaît.'); $('wName').focus(); return false; }
      if (cur === 3 && st.tel.replace(/\D/g, '').length < 8) { err('Un numéro de téléphone ou WhatsApp pour vous répondre.'); $('wTel').focus(); return false; }
      return true;
    }
    function recap(){
      var rows = [['Besoin', st.needs.join(', ') || '—', 0], ['Entreprise', (st.name || '—') + (st.met ? ', ' + st.met : ''), 1], ['Ville', st.city || '—', 1], ['Délai', st.when || 'À définir', 2], ['Site existant', st.has || 'À préciser', 2], ['Contact', (st.first ? st.first + ', ' : '') + (st.tel || '—'), 3], ['Préférence', st.pref, 3]];
      $('recap').innerHTML = rows.map(function(r){ return '<div data-go="' + r[2] + '"><dt>' + r[0] + '</dt><dd></dd></div>'; }).join('');
      $('recap').querySelectorAll('dd').forEach(function(dd, k){ dd.textContent = rows[k][1]; });
      $('recap').querySelectorAll('div').forEach(function(dv){ dv.addEventListener('click', function(){ go(+dv.dataset.go, true); }); });
    }

    function dgLead(o){ try { var api = (document.documentElement.getAttribute('data-api') || '').replace(/\/$/, ''); if (!api) return; fetch(api + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o), keepalive: true }).catch(function(){}); } catch (e) {} }
    function launch(){
      var L = ['Bonjour Digilago, je démarre un projet.', '', 'Référence : ' + ref, 'Besoin : ' + st.needs.join(', '), 'Entreprise : ' + st.name + (st.met ? ' (' + st.met + ')' : ''), 'Ville : ' + (st.city || 'El Jadida'), 'Délai : ' + (st.when || 'À définir'), 'Site existant : ' + (st.has || 'À préciser'), '', 'Contact : ' + (st.first ? st.first + ', ' : '') + st.tel + (st.mail ? ', ' + st.mail : ''), 'Préférence : ' + st.pref];
      var url = 'https://wa.me/212649953813?text=' + encodeURIComponent(L.join('\n'));
      dgLead({ name: st.first || st.name, company: st.name, phone: st.tel, email: st.mail, need: st.needs.join(', ') + (st.met ? ' (' + st.met + ')' : ''), message: L.join('\n'), source: 'Démarrer un projet ' + ref });
      $('wzWa').href = url; window.open(url, '_blank', 'noopener');
      card.classList.add('sent'); $('wzRef').textContent = 'Référence ' + ref;
      dots.forEach(function(d){ d.classList.add('done'); d.classList.remove('on'); }); $('rtFill').style.width = '100%'; $('rtPlane').style.left = '100%'; $('rtPlane').style.transform = 'translateY(-26px) rotate(-18deg)';
    }
    $('wzNext').addEventListener('click', function(){ if (!valid()) return; if (cur === N - 1) launch(); else go(cur + 1); });
    $('wzBack').addEventListener('click', function(){ go(cur - 1, true); });
    card.addEventListener('keydown', function(e){ if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('wzNext').click(); } });
    document.querySelectorAll('#tNeeds .wtile').forEach(function(b){ b.addEventListener('click', function(){ var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); var v = b.dataset.need; st.needs = st.needs.filter(function(x){ return x !== v; }); if (on) st.needs.push(v); preview(); pop(); }); });
    function single(sel, key, attr, cb){ document.querySelectorAll(sel).forEach(function(b){ b.addEventListener('click', function(){ document.querySelectorAll(sel).forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); x.classList.toggle('on', x === b); }); st[key] = b.dataset[attr] || b.textContent; if (cb) cb(b); preview(); pop(); }); }); }
    single('#tMet .wchip', 'met', 'met');
    single('#tWhen .wtile', 'when', 'when');
    single('#tHas .wchip', 'has', 'has');
    single('#tPref .wchip', 'pref', 'pref');
    [['wName', 'name'], ['wCity', 'city'], ['wFirst', 'first'], ['wTel', 'tel'], ['wMail', 'mail']].forEach(function(p){ $(p[0]).addEventListener('input', function(){ st[p[1]] = this.value; preview(); }); });
    var pn = new URLSearchParams(location.search).get('nom'); if (pn) { st.name = pn; var wn = document.getElementById('wName'); if (wn) wn.value = pn; }
    var pm = new URLSearchParams(location.search).get('metier'); if (pm) { st.met = pm; if (!st.needs.length) { st.needs.push('Site web'); var sw = document.querySelector('#tNeeds [data-need="Site web"]'); if (sw) sw.setAttribute('aria-pressed', 'true'); } }
    preview(); go(0);
  })();
'''
