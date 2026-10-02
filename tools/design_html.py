"""Retouches de contenu HTML de l'accueil (idempotent).

- Carte du monde : la carte et ses étiquettes partagent un même cadre (.vstage)
  aux proportions exactes du dessin, pour que chaque étiquette tombe sur son pays,
  quelle que soit la taille de l'écran. Le cadre descend jusqu'à l'Amérique du Sud.
- Carte de Casablanca : les noms de quartiers cachés par une épingle passent
  juste sous la pointe de l'épingle.
- « Pourquoi ai-je besoin d'un site ? » : explications réécrites, plus concrètes.
- Ouverture : le compteur « 000 → 100 » est retiré ; l'entrée du haut de page
  (titre, texte, boutons, carte) sert d'animation d'ouverture, sans attente.

Usage : python3 tools/design_html.py
"""
import brand_icons as BI
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


def no_preloader(h):
    i = h.find('<div class="pre" id="pre"')
    if i < 0:
        return h
    # le bloc se termine par la barre de progression <span class="pl" id="pl"></span></div>
    j = h.index('<span class="pl" id="pl"></span></div>', i) + len('<span class="pl" id="pl"></span></div>')
    return h[:i] + h[j:].lstrip('\n')


# Icônes des notifications (téléphone verrouillé, slide « pendant que vous dormez »)
IC_WA = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 3.2a8.8 8.8 0 00-7.6 13.2L3.3 20.8l4.5-1.1A8.8 8.8 0 1012 3.2zm4.4 12.4c-.2.5-1.1 1-1.6 1.1-.4.1-.9.1-1.5-.1-.3-.1-.8-.3-1.4-.5-2.4-1-4-3.5-4.1-3.7-.1-.2-1-1.3-1-2.5s.6-1.7.8-2c.2-.2.5-.3.6-.3h.5c.1 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.2z"/></svg>')
IC_WEB = ('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">'
          '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M8 14l2.5 2.5L16 12"/></svg>')
IC_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/></svg>'
IC_SHOP = ('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
           '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3M10 20v-5h4v5"/></svg>')
IC_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/></svg>'
IC_SUN = ('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
          '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>')

NIGHT = ('<div class="n-info nt"><ol class="ntl">'
         '<li class="nt-off"><span class="nt-ic">' + IC_MOON + '</span><em>19:00</em><div><b>Votre boutique ferme</b><span>Vous rentrez chez vous.</span></div></li>'
         '<li><span class="nt-ic wa">' + IC_WA + '</span><em>23:14</em><div><b>Nouvelle demande de devis</b><span>Reçue sur WhatsApp, depuis votre site</span></div></li>'
         '<li><span class="nt-ic web">' + IC_WEB + '</span><em>01:52</em><div><b>Rendez-vous réservé pour mardi</b><span>Pris directement en ligne</span></div></li>'
         '<li><span class="nt-ic g">' + IC_STAR + '</span><em>06:30</em><div><b>Nouvel avis 5 étoiles</b><span>Publié sur Google</span></div></li>'
         '<li class="nt-on"><span class="nt-ic sun">' + IC_SUN + '</span><em>08:00</em><div><b>Vous ouvrez : 3 nouveaux clients</b><span>Votre site a travaillé toute la nuit.</span></div></li>'
         '</ol></div>')


def slides(h):
    """Slide 3 : un vrai site (cabinet dentaire) défile dans le navigateur ; photo dans le téléphone.
       Slide 4 : la nuit racontée heure par heure ; vraies icônes dans les notifications."""
    if 'class="n-info nt"' in h:
        return h.replace('<aside class="g-kp"><div class="kp-img"><span></span></div>',
                         '<aside class="g-kp"><div class="kp-img kp-photo"><img src="assets/vm-dent.webp" alt="" width="320" height="252" loading="lazy" decoding="async"></div>', 1)
    i = h.index('<div class="site-scroll vm">')
    j = h.index('<div class="s3toast">', i)
    h = h[:i] + ('<div class="site-scroll vm-real"><img src="assets/ca364f4df1.webp" alt="" width="760" height="3606" '
                 'loading="lazy" decoding="async"></div>') + h[j:]
    old_art = '<div class="vmm-hero"><div class="vm-art"><i></i><i></i><i></i><span></span></div>'
    assert old_art in h
    h = h.replace(old_art, '<div class="vmm-hero"><div class="vm-art vm-img"><img src="assets/vm-dent.webp" alt="" width="320" height="252" loading="lazy" decoding="async"></div>', 1)
    i = h.index('<div class="n-info">')
    j = h.index('<div class="rphone night">', i)
    h = h[:i] + NIGHT + h[j:]
    # résultat Google de la réponse 1 : la photo du cabinet plutôt qu'une sphère bleue
    h = h.replace('<aside class="g-kp"><div class="kp-img"><span></span></div>',
                  '<aside class="g-kp"><div class="kp-img kp-photo"><img src="assets/vm-dent.webp" alt="" width="320" height="252" loading="lazy" decoding="async"></div>', 1)
    for letter, cls, ic in (('W', 'wa', IC_WA), ('V', 'web', IC_WEB), ('G', 'g', IC_STAR)):
        h = h.replace('<span class="lkn-ic">%s</span>' % letter, '<span class="lkn-ic %s">%s</span>' % (cls, ic), 1)
    return h


# Réalisations de l'accueil : tous les types de sites mélangés, sur un mur de 3 rangées animées.
EXTRA = [  # (adresse, image, nom, type)
    ('auto-ecole.ma', '70d39f3dbf', 'Auto-école', 'Permis de conduire'),
    ('institut-beaute.ma', '8600fd681b', 'Institut de beauté', 'Soins et esthétique'),
    ('kine-reeducation.ma', 'e5a1acde64', 'Kinésithérapie', 'Cabinet de rééducation'),
    ('psychologue-conseil.ma', '2dab30659b', 'Psychologue', 'Cabinet de consultation'),
    ('pediatre-enfants.ma', '9d68960ad1', 'Pédiatre', 'Cabinet pédiatrique'),
    ('centre-vision.ma', '6b415f7c16', 'Ophtalmologie', 'Centre de la vue'),
    ('imagerie-medicale.ma', 'f4eb6b6a72', 'Radiologie', 'Centre d’imagerie'),
    ('cardio-sante.ma', '128a633682', 'Cardiologie', 'Cabinet de cardiologie'),
    ('centre-langues.ma', '544d524fe0', 'Centre de langues', 'Cours et certifications'),
    ('academie-en-ligne.ma', 'c9b548e8e1', 'Formation en ligne', 'Plateforme de cours'),
    ('pension-animaux.ma', '07e509734a', 'Pension pour animaux', 'Garde et soins'),
    ('parapharmacie.ma', '16d4918d6c', 'Parapharmacie', 'Boutique en ligne'),
    ('clinique-sante.ma', '548456113f', 'Clinique', 'Soins et urgences'),
]
HINT = ('<span class="lp-hint"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="2" width="6" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.3"/>'
        '<path d="M8 4.5v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5.5 13.5L8 15l2.5-1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><em>Parcourir la page</em></span>')
LOCK = ('<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="5.2" width="7" height="5.3" rx="1.2" fill="currentColor"/>'
        '<path d="M4 5.2V3.8a2 2 0 014 0v1.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>')
PAUSE = ('<button type="button" class="sw-play" aria-label="Mettre en pause le défilement" aria-pressed="false">'
         '<svg viewBox="0 0 16 16" aria-hidden="true" class="i-pause"><rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor"/><rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor"/></svg>'
         '<svg viewBox="0 0 16 16" aria-hidden="true" class="i-play"><path d="M5 3l8 5-8 5z" fill="currentColor"/></svg></button>')


def fig(url, img, name, kind, badge='Modèle'):
    return ('<figure class="lp" tabindex="0"><div class="lp-win"><div class="lp-bar"><i></i><i></i><i></i><span>' + LOCK + url + '</span></div>'
            '<div class="lp-view"><img src="assets/' + img + '.webp" alt="Aperçu du site : ' + name + '" loading="lazy" decoding="async" draggable="false"></div>'
            + HINT + '</div><figcaption><b>' + name + '</b><small>' + kind + '</small><i>' + badge + '</i></figcaption></figure>')


def showcase(h):
    if 'class="sw-wall"' in h:
        return h
    i = h.index('<section class="sec show" id="showcase"')
    a = h.index('<div class="scat" data-cat="medical">', i)
    z = h.index('</section>', a)
    old = h[a:z]
    figs = re.findall(r'<figure class="lp[^"]*".*?</figure>', old, re.S)
    med, edu = [f for f in figs[:7]], [f for f in figs[7:]]
    extra = [fig(*e) for e in EXTRA]
    # mélange : un métier de santé, une école, un autre type… jamais deux voisins du même univers
    pool, mixed = [med, edu, extra[:7], extra[7:]], []
    while any(pool):
        for p in pool:
            if p: mixed.append(p.pop(0))
    rows = [mixed[k::3] for k in range(3)]
    wall = ('<div class="sw-wall" data-n="' + str(len(mixed)) + '"><div class="sw-tilt">'
            + ''.join('<div class="scat sw-row%s"><div class="sc-wrap"><div class="sc-row">%s</div></div></div>' % (' rev' if k == 1 else '', ''.join(r)) for k, r in enumerate(rows))
            + '</div>' + PAUSE + '</div>')
    h = h[:a] + wall + h[z:]
    h = h.replace('Des sites pensés pour chaque métier. Survolez une page, ou touchez-la sur téléphone, pour la parcourir de haut en bas.',
                  'Clinique, école, auto-école, institut de beauté, boutique en ligne… Survolez une page, ou touchez-la sur téléphone, pour la parcourir de haut en bas.', 1)
    return h


STEPS = [  # sur téléphone : ce qui se passe à l'écran, en deux temps (remplace le paragraphe)
    ('Il tape « dentiste El Jadida » sur Google.', 'Votre site sort en premier : il vous appelle.'),
    ('Votre fiche s’affiche sur la carte.', 'Avis, horaires, itinéraire : il vient chez vous.'),
    ('Il découvre vos soins, vos photos, vos avis.', 'Il prend rendez-vous en un clic.'),
    ('23:14 : une demande de devis arrive.', '08:00 : vous ouvrez avec trois nouveaux clients.'),
]


def slide_steps(h):
    """Deux étapes numérotées sous le titre de chaque diapositive (affichées sur téléphone)."""
    h = re.sub(r'<ol class="st-steps".*?</ol>', '', h, flags=re.S)
    for k, (a, b) in enumerate(STEPS):
        i = h.index('<article class="st-sl' if k == 0 else 'data-s="%d"' % k)
        j = h.index('</p></div><div class="st-dev">', i) + len('</p>')
        h = h[:j] + '<ol class="st-steps"><li><i>1</i>%s</li><li><i>2</i>%s</li></ol>' % (a, b) + h[j:]
    return h


# Manifeste : les quatre petites images dans la phrase, colorées et liées au sens de chaque passage
ZEL = ('<svg viewBox="0 0 132 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>'
       '<pattern id="zlg" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#F6E7CB"/>'
       '<g fill="#0F8A6A"><path d="M0 -6l4.2 4.2H10v5.8L0 14l-10-10V-1.8h5.8z" transform="translate(0 0) scale(.6)"/>'
       '<path d="M0 -6l4.2 4.2H10v5.8L0 14l-10-10V-1.8h5.8z" transform="translate(24 0) scale(.6)"/>'
       '<path d="M0 -6l4.2 4.2H10v5.8L0 14l-10-10V-1.8h5.8z" transform="translate(0 24) scale(.6)"/>'
       '<path d="M0 -6l4.2 4.2H10v5.8L0 14l-10-10V-1.8h5.8z" transform="translate(24 24) scale(.6)"/></g>'
       '<rect x="6" y="6" width="12" height="12" fill="#1F57C7"/><rect x="6" y="6" width="12" height="12" fill="#1F57C7" transform="rotate(45 12 12)"/>'
       '<rect x="8.6" y="8.6" width="6.8" height="6.8" fill="#D2553A" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="2.2" fill="#F2B233"/>'
       '<circle cx="0" cy="12" r="1.6" fill="#D2553A"/><circle cx="24" cy="12" r="1.6" fill="#D2553A"/><circle cx="12" cy="0" r="1.6" fill="#D2553A"/><circle cx="12" cy="24" r="1.6" fill="#D2553A"/>'
       '</pattern></defs><rect class="zl-r" x="-24" y="-24" width="180" height="108" fill="url(#zlg)"/></svg>')
SEARCH_IP = BI.GOOGLE + '<span class="gs"><b></b><em></em></span>'
SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 0c1 6.5 5.5 11 12 12-6.5 1-11 5.5-12 12-1-6.5-5.5-11-12-12 6.5-1 11-5.5 12-12z" fill="#fff"/></svg>'
FACES = [('#F2B233', '#F5CBA7', '#B45309'), ('#1F57C7', '#C68642', '#0B2A6B'), ('#E8688A', '#FAD7B5', '#9D174D'), ('#0F8A6A', '#8D5524', '#064E3B')]


def face(bg, skin, shirt):
    return ('<i style="background:%s"><svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><circle cx="18" cy="14.5" r="6.6" fill="%s"/>'
            '<path d="M5.5 36a12.5 11 0 0 1 25 0z" fill="%s"/></svg></i>') % (bg, skin, shirt)


def sim_icons(h):
    """Simulateur « Tapez votre nom » : les vraies icônes Google, Google Maps et ChatGPT sur les trois aperçus."""
    for label, icon in (('Google</span>', BI.GOOGLE), ('Google Maps</span>', BI.MAPS), ('Réponse d’une IA</span>', BI.CHATGPT)):
        h = h.replace('<span class="sk2"><i></i>' + label, '<span class="sk2">' + icon + label)
    return h


def mani_pills(h):
    h = re.sub(r'<span class="ip zel" aria-hidden="true">.*?</span>(?= <span class="w">Pourtant)',
               '<span class="ip zel" aria-hidden="true">%s</span>' % ZEL, h, count=1, flags=re.S)
    h = re.sub(r'<span class="ip pin" aria-hidden="true">.*?</svg></span>|<span class="ip pin sq" aria-hidden="true">.*?</em></span></span>',
               '<span class="ip pin sq" aria-hidden="true">%s</span>' % SEARCH_IP, h, count=1, flags=re.S)
    h = re.sub(r'<span class="ip ai" aria-hidden="true">.*?</span>(?=<span class="w">,</span> <span class="w">et</span>)',
               '<span class="ip ai" aria-hidden="true">%s</span>' % (SPARK + BI.CHATGPT + SPARK), h, count=1, flags=re.S)
    h = re.sub(r'<span class="ip av" aria-hidden="true">.*?</span>(?= <span class="w">vous</span>)',
               '<span class="ip av" aria-hidden="true">%s<b>★★★★★</b></span>' % ''.join(face(*f) for f in FACES), h, count=1, flags=re.S)
    # l'illustration et la virgule qui la suit restent sur la même ligne
    for cls in ('ip pin sq', 'ip ai'):
        h = re.sub(r'(?<!<span class="nb">)(<span class="%s" aria-hidden="true">.*?</span>)(<span class="w">,</span>)' % cls,
                   lambda m: m.group(1) + m.group(2) if '<span class="nb">' + m.group(1) in h else '<span class="nb">' + m.group(1) + m.group(2) + '</span>',
                   h, count=1, flags=re.S)
    return h


# Final de l'accueil : « C'est maintenant » devient le grand appel à l'action, juste avant le pied de page
ARW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
       'stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
CHK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
       'stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')
WAI = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2'
       'a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1'
       'a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7'
       ' 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>')


def finale(h):
    m = re.search(r'<section class="(?:blk mom|fin mom)" id="moment">.*?</section>', h, re.S)
    if not m:
        return h
    old = m.group(0)
    vis = re.search(r'<div class="mom-vis rv d2" aria-hidden="true">.*?</span></div>\n?</div>', old, re.S)
    vis = vis.group(0) if vis else ''
    pts = re.findall(r'<b>([^<]+)</b></span></li>', old)[:3] or [
        'Vos clients cherchent déjà sur leur téléphone', 'Ailleurs, la première place se paie cher', 'Au Maroc, elle est encore libre']
    new = ('<section class="fin mom" id="moment"><div class="fin-sky" aria-hidden="true"><i class="a1"></i><i class="a2"></i></div>'
           '<div class="fin-in w"><div class="fin-txt"><span class="mom-k rv"><i></i>Le bon moment</span>'
           '<h2 class="rv d1">C’est maintenant, <em>pas quand tout le monde y sera.</em></h2>'
           '<p class="rv d2">Vos clients vous cherchent sur leur téléphone. Soyez le premier qu’ils trouvent.</p>'
           '<div class="fin-cta rv d3"><a class="fin-go" href="demarrer.html"><span>Démarrer mon projet</span><i>%s</i></a>'
           '<a class="fin-wa" href="https://wa.me/212649953813" target="_blank" rel="noopener noreferrer">%sWhatsApp</a></div>'
           '<ul class="fin-trust rv d3"><li>%sPrix écrit avant de commencer</li><li>%sPremière version en 72 h</li><li>%sRéponse le jour même</li></ul>'
           '</div>%s</div></section>') % (ARW, WAI, CHK, CHK, CHK, vis)
    h = h.replace(old, '', 1)
    i = h.index('<section class="sec" id="vis"')     # juste avant « La vision »
    h = h[:i] + new + '\n' + h[i:]
    # rail des sections : « Le bon moment » juste avant « La vision »
    m = re.search(r'<a href="#moment" data-t="moment">.*?</a>', h, re.S)
    if m:
        h = h.replace(m.group(0), '', 1)
        j = h.index('<a href="#vis" data-t="vis">')
        h = h[:j] + m.group(0) + h[j:]
    return h


# « Ils nous font confiance » devient « Plus qu'un site web » : le partenaire tech complet, preuves à l'appui
TPI = {
    'web': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9S14.6 18.2 12 21M12 3C9.4 5.8 8.1 8.8 8.1 12s1.3 6.2 3.9 9"/>',
    'app': '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    'sys': '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 9h4M7 12h7M15.5 8.5l1.5 1.5 2.5-2.5"/>',
    'auto': '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    'brand': '<path d="M4 20l4.2-1 10.4-10.4a2 2 0 0 0-2.8-2.8L5.4 16.2z"/><path d="M14.5 7.2l2.8 2.8"/>',
    'advice': '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
}
TP_CARDS = [
    ('web', 'Sites web et e-commerce', 'Vitrine, réservation, boutique en ligne : rapides, beaux et trouvés sur Google.'),
    ('app', 'Applications mobiles', 'iOS et Android : fidélité, réservations, commandes, espace client.'),
    ('sys', 'Systèmes de gestion sur mesure', 'Devis, factures, rendez-vous, inscriptions, stocks : un outil interne pensé pour votre métier.'),
    ('auto', 'Digitalisation et automatisation', 'WhatsApp automatisé, formulaires, paiements en ligne, tableaux de bord : moins de tâches répétitives.'),
    ('brand', 'Branding et identité', 'Logo, couleurs, typographies et supports : une marque reconnaissable partout.'),
    ('advice', 'Conseil tech', 'Choisir les bons outils, au bon prix, sans jargon : nous vous guidons à chaque décision.'),
]
TP_DOM = [('École', 'inscriptions, paiements, espace parents'), ('Clinique', 'rendez-vous, rappels, dossiers'),
          ('Restaurant', 'commandes, menu, livraisons'), ('Commerce', 'stock, caisse, livraisons'),
          ('Hôtel et riad', 'réservations directes, planning')]
TP_LOGOS = [
    ('gc', '<i>GC</i><span><b>Georges Claude</b><small>École privée · El Jadida</small></span>', 'academie-georgesclaude.ma'),
    ('ab', '<i>AB</i><span><b>Ange Bleu</b><small>El Jadida · depuis 1986</small></span>', 'angebleu.ma'),
    ('lm', '<span><b>LES</b><em>Marronniers</em></span>', 'lesmarronniers.ma'),
    ('ab jab', '<i>AB</i><span><b>Jardin Ange Bleu</b><small>Maternelle · El Jadida</small></span>', 'jardin-angebleu.ma'),
]
TP_STATS = [('11 ans', 'de terrain'), ('72 h', 'pour une première version'), ('3 langues', 'français, arabe, anglais'),
            ('Le jour même', 'pour vous répondre')]


def trust_section(h):
    m = re.search(r'<section class="sec lgs[^"]*" id="trust"[^>]*>.*?</section>', h, re.S)
    if not m:
        return h
    # les clients : leur logo (redessiné en blanc), leur domaine et le badge « site livré »
    band = ('<div class="tp-logos">%s</div>' % ''.join(
        '<a class="tl rv%s" href="realisations.html"><span class="tl-mark %s">%s</span><span class="tl-dom">%s</span>'
        '<span class="tl-ok"><i aria-hidden="true">✅</i>Site livré</span></a>' % (('', ' d1', ' d2', ' d3')[k], c, mark, dom)
        for k, (c, mark, dom) in enumerate(TP_LOGOS)))
    ico = lambda k: ('<span class="tp-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
                     'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg></span>') % TPI[k]
    cards = ''.join('<article class="tp-c rv%s">%s<b>%s</b><span>%s</span></article>' % (
        ('', ' d1', ' d2')[k % 3], ico(i), t, d) for k, (i, t, d) in enumerate(TP_CARDS))
    dom = ''.join('<li><b>%s</b><span>%s</span></li>' % x for x in TP_DOM)
    stats = ''.join('<div><b>%s</b><span>%s</span></div>' % x for x in TP_STATS)
    new = ('<section class="sec lgs tp" id="trust" aria-labelledby="t-trust"><div class="sh dark"><span class="pill rv"><span class="ic"></span>'
           'Plus qu’un site web</span><h2 id="t-trust" class="rv d1"><span class="l"><span class="li">Votre partenaire tech,</span></span>'
           '<span class="l"><span class="li grad">de l’idée au quotidien.</span></span></h2><p class="rv d2">Site, application, outils de gestion '
           'internes, automatisations, identité de marque et conseil : une seule équipe digitalise toute votre entreprise, avec le même soin du '
           'détail.</p></div><div class="tp-grid w">%s</div><div class="tp-dom w rv"><p><b>Un outil pour chaque métier</b>'
           '<span>Nous construisons le système dont votre activité a besoin.</span></p><ul>%s</ul></div>'
           '<div class="tp-proof w rv"><div class="tp-stats">%s</div><p class="tp-lab"><i aria-hidden="true">🏆</i>Ils nous font confiance</p>%s</div>'
           '<div class="tp-cta rv"><a class="tp-go" href="demarrer.html">Parlons de votre projet%s</a>'
           '<a class="lg-more" href="realisations.html">Voir les idées de sites%s</a></div></section>') % (
        cards, dom, stats, band, ARW, ARW)
    return h.replace(m.group(0), new, 1)


def main():
    h = open(P, encoding='utf-8').read()
    h = slides(h)
    h = slide_steps(h)
    h = mani_pills(h)
    h = sim_icons(h)
    h = finale(h)
    h = trust_section(h)
    h = showcase(h)
    h = no_preloader(h)
    h = vision(h)
    h = pins(h)
    h = story(h)
    # les 25 longues captures du mur des modèles se chargent à l'approche de la section, pas à l'ouverture
    # de la page (4 Mo de moins au démarrage, surtout sur téléphone)
    h = re.sub(r'(<div class="lp-view"><img [^>]*?)loading="eager"', r'\1loading="lazy"', h)
    open(P, 'w', encoding='utf-8').write(h)
    print('index.html mis à jour')


if __name__ == '__main__':
    main()
