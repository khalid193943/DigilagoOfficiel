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


def main():
    h = open(P, encoding='utf-8').read()
    h = slides(h)
    h = slide_steps(h)
    h = showcase(h)
    h = no_preloader(h)
    h = vision(h)
    h = pins(h)
    h = story(h)
    open(P, 'w', encoding='utf-8').write(h)
    print('index.html mis à jour')


if __name__ == '__main__':
    main()
