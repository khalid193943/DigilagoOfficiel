"""Vérifie les fichiers de données des secteurs (src/secteurs/*.py) avant de construire les pages.

Usage : python3 tools/secteurs_check.py               (tous les secteurs)
        python3 tools/secteurs_check.py education      (un seul secteur)
Sortie : la liste des erreurs, ou « OK ». Code de retour 1 s'il y a des erreurs.
"""
import glob, importlib.util, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'src', 'secteurs')
SITE = os.path.join(ROOT, 'site')

# Icônes disponibles (dessinées dans tools/secteurs_icons.py) : n'utiliser que ces noms
ICONS = set('''
cup egg teapot glass beans parasol juice book cloche tajine fish sushi pizza flame globe umbrella store burger bowl scooter
wrap truck tray bread star8 icecream cake chef menu bag gift calendar wifi users camera star pin sparkle chart layers shield
clock briefcase file chat phone search card lock video mail bell check cart tag map key home building school cap baby music
translate laptop palette pencil trophy stethoscope tooth eye heart pill flask bone brain leaf paw cross ear pulse scissors
lotus drop mirror ball dumbbell racket wave bike mountain target car wrench gauge factory gear bolt sun crane hammer brick
roller ruler box warehouse recycle chip tractor wheat scale calculator bank coins handshake megaphone code cloud print shirt
diamond sofa lamp plant rug pot needle hanger compass tent suitcase bed ring ticket mic balloon bus plane anchor film glasses
'''.split())
PHOTOS = {'ecole', 'clinique', 'restaurant', 'hotel', 'commerce', 'industrie', 'juridique', 'immobilier', 'sport', 'beaute',
          'tourisme', 'btp', None}
WARN = []
ALLFILES = set()
HEX = re.compile(r'^#[0-9A-Fa-f]{6}$')


def load(path):
    spec = importlib.util.spec_from_file_location(os.path.basename(path)[:-3], path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def check(path, seen_files, seen_tr, errs):
    name = os.path.basename(path)
    E = lambda msg: errs.append('%s : %s' % (name, msg))
    try:
        m = load(path)
    except Exception as e:  # noqa
        E('ne se charge pas : %r' % e)
        return

    def tri(v, where, short=False):
        if not (isinstance(v, (tuple, list)) and len(v) == 3 and all(isinstance(x, str) and x.strip() for x in v)):
            E('%s : un triplet (fr, en, ar) de textes non vides est attendu, reçu %r' % (where, v))
            return
        fr, en, ar = v
        for x in v:
            if '<' in x or '>' in x:
                E('%s : pas de balise HTML (%r)' % (where, x))
            if x != x.strip() or '  ' in x:
                E('%s : espaces en trop (%r)' % (where, x))
        if "'" in fr:
            E('%s : apostrophe droite dans le français, utiliser ’ (%r)' % (where, fr))
        if not re.search('[؀-ۿ]', ar):
            E('%s : l’arabe ne contient pas de lettres arabes (%r)' % (where, ar))
        if fr in seen_tr and seen_tr[fr][0] != (en, ar):
            # même texte, autre traduction : la première rencontrée est gardée par le build (simple avertissement)
            WARN.append('%s : « %s » est déjà traduit autrement dans %s (%r ≠ %r)' % (where, fr, seen_tr[fr][1], seen_tr[fr][0], (en, ar)))
        seen_tr.setdefault(fr, ((en, ar), name))

    def icon(v, where):
        if v not in ICONS:
            E('%s : icône inconnue %r' % (where, v))

    def fname(f, where):
        if not re.match(r'^[a-z0-9-]+\.html$', f or ''):
            E('%s : nom de fichier invalide %r' % (where, f))
            return
        if f in seen_files:
            E('%s : fichier %s déjà utilisé par %s' % (where, f, seen_files[f]))
        seen_files[f] = name
        if os.path.exists(os.path.join(SITE, f)) and not os.path.exists(os.path.join(ROOT, 'src', 'secteurs', '.built', f)):
            # une page existante (article, guide…) : ne pas l'écraser
            if f not in getattr(m, '_OWN', ()):
                pass

    S = getattr(m, 'SECTOR', None)
    if not isinstance(S, dict):
        E('SECTOR manquant')
        return
    for k in ('id', 'file', 'icon', 'name', 'title', 'desc', 'eyebrow', 'h1', 'lead', 'met', 'groups', 'search', 'ai', 'faq', 'guides', 'themes'):
        if k not in S:
            E('SECTOR : clé %r manquante' % k)
    if errs and errs[-1].startswith(name + ' : SECTOR : clé'):
        return
    if S['id'] + '.py' != name:
        E('SECTOR id %r ≠ nom du fichier' % S['id'])
    fname(S['file'], 'SECTOR.file')
    if not S['file'].startswith('secteur-') or not S['file'].endswith('-maroc.html'):
        E('SECTOR.file doit être de la forme secteur-…-maroc.html')
    icon(S['icon'], 'SECTOR.icon')
    if S.get('photo') not in PHOTOS:
        E('SECTOR.photo inconnue %r' % S.get('photo'))
    for k in ('name', 'title', 'desc', 'eyebrow', 'lead', 'met'):
        tri(S[k], 'SECTOR.' + k)
    for i, x in enumerate(S['h1']):
        tri(x, 'SECTOR.h1[%d]' % i)
    gids = []
    for g in S['groups']:
        gids.append(g[0])
        tri(g[1], 'SECTOR.groups %s' % g[0])
    if len(S['search']) != 6:
        E('SECTOR.search : 6 recherches attendues')
    for x in S['search']:
        tri(x, 'SECTOR.search')
    if len(S['ai']) != 2:
        E('SECTOR.ai : 2 questions attendues')
    for x in S['ai']:
        tri(x, 'SECTOR.ai')
    if not 5 <= len(S['faq']) <= 7:
        E('SECTOR.faq : 5 à 7 questions attendues')
    for q, a in S['faq']:
        tri(q, 'SECTOR.faq q')
        tri(a, 'SECTOR.faq a')
    for g in S['guides']:
        if not os.path.exists(os.path.join(SITE, g)):
            E('SECTOR.guides : %s n’existe pas dans site/' % g)
    T = getattr(m, 'TYPES', [])
    C = getattr(m, 'CARDS', [])
    ids = [t['id'] for t in T] + [c['id'] for c in C]
    if len(set(ids)) != len(ids):
        E('identifiants de types en double')
    for th in S['themes']:
        if th not in [t['id'] for t in T]:
            E('SECTOR.themes : %r n’est pas un type avec page' % th)
    if len(S['themes']) != 4:
        E('SECTOR.themes : 4 thèmes attendus')
    for t in T:
        w = 'TYPES[%s]' % t.get('id')
        for k in ('id', 'file', 'group', 'icon', 'k', 'name', 'short', 'title', 'desc', 'h1', 'lead', 'mk', 'feats', 'search', 'ai', 'app', 'faq'):
            if k not in t:
                E('%s : clé %r manquante' % (w, k))
        if any(k not in t for k in ('file', 'group', 'mk', 'feats')):
            continue
        fname(t['file'], w + '.file')
        if not t['file'].startswith('site-web-') or not t['file'].endswith('-maroc.html'):
            E('%s.file doit être de la forme site-web-…-maroc.html' % w)
        if os.path.exists(os.path.join(SITE, t['file'])):
            h = open(os.path.join(SITE, t['file']), encoding='utf-8').read()
            if 'data-vz=' not in h:
                E('%s.file : %s existe déjà (article) ; utiliser une carte avec "href" vers cet article' % (w, t['file']))
        if t['group'] not in gids:
            E('%s : groupe inconnu %r' % (w, t['group']))
        icon(t['icon'], w + '.icon')
        for k in ('name', 'short', 'title', 'desc', 'lead'):
            tri(t[k], '%s.%s' % (w, k))
        for i, x in enumerate(t['h1']):
            tri(x, '%s.h1[%d]' % (w, i))
        if len(t['title'][0]) > 95:
            E('%s.title : trop long pour Google (%d caractères)' % (w, len(t['title'][0])))
        if not 110 <= len(t['desc'][0]) <= 200:
            E('%s.desc : 110 à 200 caractères attendus (%d)' % (w, len(t['desc'][0])))
        mk = t['mk']
        for k in ('pal', 'font', 'brand', 'kick', 'hero', 'sub', 'cta', 'cta2', 'items', 'info', 'toast'):
            if k not in mk:
                E('%s.mk : clé %r manquante' % (w, k))
        if len(mk.get('pal', ())) != 4 or not all(HEX.match(c) for c in mk.get('pal', ())):
            E('%s.mk.pal : 4 couleurs #RRGGBB attendues' % w)
        if mk.get('font') not in ('serif', 'sans'):
            E('%s.mk.font : serif ou sans' % w)
        for k in ('brand', 'kick', 'hero', 'sub', 'cta', 'cta2', 'info', 'toast'):
            if k in mk:
                tri(mk[k], '%s.mk.%s' % (w, k))
        if len(mk.get('items', [])) != 3:
            E('%s.mk.items : 3 éléments attendus' % w)
        for a, b in mk.get('items', []):
            tri(a, w + '.mk.items')
            tri(b, w + '.mk.items prix')
        if len(t['feats']) != 6:
            E('%s.feats : 6 fonctions attendues' % w)
        for f in t['feats']:
            icon(f[0], w + '.feats')
            tri(f[1], w + '.feats titre')
            tri(f[2], w + '.feats texte')
        if len(t['search']) != 6:
            E('%s.search : 6 recherches attendues' % w)
        for x in t['search']:
            tri(x, w + '.search')
        if len(t['ai']) != 2:
            E('%s.ai : 2 questions attendues' % w)
        for x in t['ai']:
            tri(x, w + '.ai')
        if len(t['app']) != 3:
            E('%s.app : 3 modules attendus' % w)
        for x in t['app']:
            tri(x, w + '.app')
        if len(t['faq']) != 3:
            E('%s.faq : 3 questions attendues' % w)
        for q, a in t['faq']:
            tri(q, w + '.faq q')
            tri(a, w + '.faq a')
    for c in C:
        w = 'CARDS[%s]' % c.get('id')
        for k in ('id', 'group', 'icon', 'k', 'name', 'short', 'tags'):
            if k not in c:
                E('%s : clé %r manquante' % (w, k))
        if c.get('group') not in gids:
            E('%s : groupe inconnu %r' % (w, c.get('group')))
        icon(c.get('icon'), w + '.icon')
        for k in ('name', 'short'):
            if k in c:
                tri(c[k], '%s.%s' % (w, k))
        if len(c.get('tags', [])) != 3:
            E('%s.tags : 3 étiquettes attendues' % w)
        for x in c.get('tags', []):
            tri(x, w + '.tags')
        if c.get('href') and not os.path.exists(os.path.join(SITE, c['href'])) and c['href'] not in ALLFILES:
            E('%s.href : %s n’existe pas' % (w, c['href']))
    if len(T) < 6:
        E('au moins 6 types avec page attendus')


def main():
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    files = sorted(glob.glob(os.path.join(SRC, '*.py')))
    seen_files, seen_tr, errs = {}, {}, []
    for f in files:  # toutes les pages de types, pour les liens d'une carte vers la page d'un autre secteur
        try:
            ALLFILES.update(t['file'] for t in load(f).TYPES)
        except Exception:  # noqa
            pass
    for f in files:
        if os.path.basename(f).startswith('_'):
            continue
        if only and os.path.basename(f)[:-3] not in only:
            # les autres secteurs comptent pour les doublons, sans afficher leurs erreurs
            check(f, seen_files, seen_tr, [])
            continue
        check(f, seen_files, seen_tr, errs)
    if WARN and '-v' in sys.argv:
        print('\n'.join('avertissement : ' + w for w in WARN))
    print('\n'.join(errs) if errs else 'OK (%d traductions variantes : la première est gardée)' % len(WARN))
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()
