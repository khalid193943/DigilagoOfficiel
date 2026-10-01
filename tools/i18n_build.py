"""Génère les versions anglaise (site/en/) et arabe (site/ar/) à partir des pages françaises.

- Textes, attributs (alt, aria-label…), données des métiers et messages des scripts
  traduits grâce à src/i18n/en.json et src/i18n/ar.json (clés : src/i18n/strings.json).
- Sélecteur de langue réel (FR · EN · عربي) sur toutes les pages, françaises comprises.
- Arabe : polices arabes (IBM Plex Sans Arabic, Noto Naskh Arabic pour les accents
  en italique), texte de droite à gauche, sans espacement de lettres.
- Les balises SEO (hreflang, canonique, Schema.org) sont ajoutées ensuite par seo.py.

Idempotent. Usage : python3 tools/i18n_build.py
"""
import glob, html, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
I18N = os.path.join(ROOT, 'src', 'i18n')
sys.path.insert(0, HERE)
from inject import terser, read as read_src  # noqa: E402
from fonts import get  # noqa: E402

LANGS = ['fr', 'en', 'ar']
LABEL = {'fr': 'FR', 'en': 'EN', 'ar': 'عربي'}
NAME = {'fr': 'Français', 'en': 'English', 'ar': 'العربية'}
ATTRS = r'alt|title|aria-label|placeholder|data-q|data-need|data-met|data-when|data-has|data-pref|content|value'

# Lignes du grand titre de l'accueil (construites par le script, avec le point du « i » animé).
LINES_FR = '''  var LINES = {
    D: ["On crée votre s" + I + "te web.", "Vos clients vous trouvent."],
    M: ["On crée votre s" + I + "te.", "Vos clients", "vous trouvent."],
  };'''
LINES = {
    'en': '''  var LINES = {
    D: ["We build your webs" + I + "te.", "Your clients find you."],
    M: ["We build your s" + I + "te.", "Your clients", "find you."],
  };''',
    'ar': '''  var LINES = {
    D: ["نصمّم موقعك الإلكتروني.", "وعملاؤك يجدونك."],
    M: ["نصمّم موقعك.", "وعملاؤك", "يجدونك."],
  };''',
}


def esc_text(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def esc_attr(s):
    return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')


# Domaines d'exemple des maquettes (non extraits car ils ressemblent à de vraies adresses).
DOMAINS = {'votre-marque.ma': 'your-brand.ma', 'votre-entreprise.ma': 'your-business.ma'}


def load(lang):
    strings = json.load(open(os.path.join(I18N, 'strings.json'), encoding='utf-8'))
    tr = json.load(open(os.path.join(I18N, lang + '.json'), encoding='utf-8'))
    d = {v['fr']: tr[k] for k, v in strings.items() if tr.get(k)}
    d.update(DOMAINS)
    return d


# ─── sélecteur de langue ───────────────────────────────────────────────

def href(page, frm, to):
    """Lien vers `page` dans la langue `to`, depuis une page en langue `frm`."""
    up = '' if frm == 'fr' else '../'
    return up + ('' if to == 'fr' else to + '/') + page


def switchers(h, page, lang):
    other = [l for l in LANGS if l != lang]

    def a(l, inner):
        return '<a href="%s" hreflang="%s" lang="%s">%s</a>' % (href(page, lang, l), l, l, inner)

    # menu plein écran
    fsm = '<span class="fsm-lang"><b>%s</b>%s</span>' % (
        LABEL[lang], ''.join(a(l, '<i%s>%s</i>' % (' lang="ar"' if l == 'ar' else '', LABEL[l])) for l in other))
    h = re.sub(r'<span class="fsm-lang">.*?</span>(?=<button)', lambda m: fsm, h, count=1, flags=re.S)
    # pied de page
    parts = [('<b>%s</b>' % LABEL[l]) if l == lang else a(l, LABEL[l]) for l in LANGS]
    fl = '<span class="f-lang">' + ' <i></i> '.join(parts) + '</span>'
    h = re.sub(r'<span class="f-lang">.*?</span>(?=</div>\s*</footer>)', lambda m: fl, h, count=1, flags=re.S)
    # bouton de langue de la barre du haut (accueil) : petit menu déroulant
    m = re.search(r'<!--dg:lang-->.*?<!--/dg:lang-->|<a href="#" class="sq mono" id="lang"[^>]*>[^<]*</a>', h, re.S)
    if m:
        menu = ''.join(a(l, LABEL[l]) for l in other)
        btn = ('<!--dg:lang--><span class="lsw" id="lsw"><a href="#" class="sq mono" id="lang" aria-haspopup="true" '
               'aria-expanded="false" aria-label="%s">%s</a><span class="lsw-m">%s</span></span><!--/dg:lang-->'
               % ({'fr': 'Langue : français', 'en': 'Language: English', 'ar': 'اللغة: العربية'}[lang], LABEL[lang], menu))
        h = h[:m.start()] + btn + h[m.end():]
    return h


# ─── traduction d'une page ─────────────────────────────────────────────

TOK = re.compile(r'(<!--.*?-->|<script\b.*?</script>|<style\b.*?</style>|<[^>]+>)', re.S)


# Ponctuation isolée (mot à mot du manifeste) : règles de chaque langue.
PUNCT = {'ar': {',': '،', '?': '؟', ';': '؛'}, 'en': {}}


def translate_html(h, TR, lang):
    parts = TOK.split(h)
    for i, p in enumerate(parts):
        if i % 2 == 0:                                    # texte
            t = html.unescape(p)
            s = t.strip()
            if s and s in ',:;?!':
                # anglais et arabe : pas d'espace avant la ponctuation (règle française)
                parts[i] = esc_text(PUNCT[lang].get(s, s)) + t[len(t.rstrip()):]
                # l'espace avant la ponctuation est souvent un nœud à part entre deux mots
                j = i - 2
                while j >= 0 and parts[j] == '':
                    j -= 2
                if j >= 0 and parts[j].strip() == '':
                    parts[j] = ''
                elif j >= 0:
                    parts[j] = parts[j].rstrip(' \xa0')
                continue
            if s and s in TR:
                lead, trail = t[:len(t) - len(t.lstrip())], t[len(t.rstrip()):]
                parts[i] = lead + esc_text(TR[s]) + trail
        elif p.startswith('<script'):
            if 'id="xpData"' in p:
                parts[i] = translate_xp(p, TR)
        elif p.startswith('<') and not p.startswith('<!--') and not p.startswith('<style'):
            def at(m):
                v = html.unescape(m.group(3)).strip()
                return m.group(1) + m.group(2) + '="' + esc_attr(TR[v]) + '"' if v in TR else m.group(0)
            parts[i] = re.sub(r'(\s)(' + ATTRS + r')="([^"]*)"', at, p)
    return ''.join(parts)


def translate_xp(block, TR):
    m = re.match(r'(<script[^>]*>)(.*)(</script>)$', block, re.S)
    d = json.loads(m.group(2))
    t = lambda s: TR.get(s, s)
    for s in d['s']:
        s['n'] = t(s['n'])
        s['f'] = [t(x) for x in s.get('f', [])]
        if 'a' in s:
            s['a'] = [t(x) for x in s['a']]
        if s.get('al'):
            s['al'] = t(s['al'])
        for x in s['m']:
            x['n'] = t(x['n'])
    return m.group(1) + json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + m.group(3)


# ─── scripts traduits ──────────────────────────────────────────────────

def js_bundle(kind, TR, lang):
    src = read_src('js/common.js') + '\n' + read_src('js/home.js' if kind == 'home' else 'js/pages.js')
    if kind == 'home':
        assert LINES_FR in src, 'LINES introuvable dans home.js'
        src = src.replace(LINES_FR, LINES[lang])
    fr_js = json.load(open(os.path.join(I18N, 'js_fr.json'), encoding='utf-8'))
    for fr in sorted(fr_js, key=len, reverse=True):
        if fr not in TR:
            continue
        new = json.dumps(TR[fr], ensure_ascii=False)
        src = src.replace(json.dumps(fr, ensure_ascii=False), new).replace("'" + fr + "'", new)
    # sélecteur qui contient un texte traduit
    if 'Site web' in TR:
        src = src.replace('[data-need="Site web"]', '[data-need="%s"]' % TR['Site web'].replace('"', '\\"'))
    return terser(src)


# ─── polices et styles arabes ──────────────────────────────────────────

AR_CACHE = os.path.join(ROOT, 'src', 'fonts-ar.css')
AR_URL = ('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600'
          '&family=Noto+Naskh+Arabic:wght@500&display=swap')
# famille latine du site → police arabe qui la prolonge (même nom de famille, plage arabe seulement)
AR_MAP = [('Sora', 'normal', '500', 'IBM Plex Sans Arabic', '500'),
          ('Sora', 'normal', '600', 'IBM Plex Sans Arabic', '600'),
          ('Instrument Sans', 'normal', '400', 'IBM Plex Sans Arabic', '400'),
          ('Instrument Sans', 'normal', '500', 'IBM Plex Sans Arabic', '500'),
          ('JetBrains Mono', 'normal', '400', 'IBM Plex Sans Arabic', '400'),
          ('JetBrains Mono', 'normal', '500', 'IBM Plex Sans Arabic', '500'),
          ('Playfair Display', 'normal', '500', 'Noto Naskh Arabic', '500'),
          ('Playfair Display', 'italic', '500', 'Noto Naskh Arabic', '500')]

AR_CSS = (
    # texte de droite à gauche, sans toucher aux mises en page animées
    'html[lang="ar"] :is(p,h1,h2,h3,h4,h5,h6,li,dd,dt,summary,blockquote,figcaption,label,small,b,em,strong,a,'
    'button,span,td,th,option,input,textarea,select){direction:rtl}'
    # l'arabe ne s'espace pas lettre par lettre (les lettres doivent rester liées)
    'html[lang="ar"] :is(h1,h2,h3,h4,h5,h6,p,li,span,a,b,em,i,small,button,dd,dt,summary,label,strong,div){'
    'letter-spacing:0!important;text-transform:none!important}'
    'html[lang="ar"] :is(.logo,.fl-logo,.fsm-top>a,.f-brand>a){direction:ltr}'
    'html[lang="ar"] .giant,html[lang="ar"] .word,html[lang="ar"] .fl-logo b,html[lang="ar"] .logo b{'
    'direction:ltr;letter-spacing:-.04em!important}'
    # menus, pied de page et rangées de boutons en miroir (lecture de droite à gauche)
    'html[lang="ar"] :is(.nav,.links,.tools,.fnav,.fl,.f-grid,.f-col,.f-bot,.fsm-top,.fsm-nav,.hcta,.f-cta,'
    '.fbtn,.cta,.mom-cta,.ans-c,.wz-nav,.st4,.incl,.eng,.vals,.obj,.share,.chan,.svs,.flt,.gd-row,.st-tabs){direction:rtl}'
    'html[lang="ar"] :is(.arw svg,.cta svg,.more svg,.ans-go svg,.faq-link svg){transform:scaleX(-1)}'
    'html[lang="ar"] body{line-height:1.6}'
    'html[lang="ar"] :is(h1,h2,h3,h4){line-height:1.3!important}'
)

LSW_CSS = (
    '.lsw{position:relative;display:inline-flex}'
    '.lsw-m{position:absolute;top:calc(100% + 8px);left:50%;transform:translate(-50%,-4px);display:flex;'
    'flex-direction:column;gap:2px;padding:5px;border-radius:12px;background:rgba(255,255,255,.92);'
    'box-shadow:0 12px 30px -12px rgba(14,33,78,.45),0 0 0 1px rgba(14,33,78,.08);opacity:0;'
    'pointer-events:none;transition:opacity .2s,transform .2s;z-index:20}'
    '.lsw:hover .lsw-m,.lsw:focus-within .lsw-m,.lsw.open .lsw-m{opacity:1;transform:translate(-50%,0);pointer-events:auto}'
    '.lsw-m a{display:block;padding:7px 12px;border-radius:8px;font:500 12px/1 "JetBrains Mono",monospace;'
    'color:#0e214e;text-decoration:none;white-space:nowrap;text-align:center}'
    '.lsw-m a:hover{background:#eaf3fe}.lsw-m a[lang="ar"]{font-family:"IBM Plex Sans Arabic",Arial,sans-serif;font-size:13px}'
    '.fsm-lang a{text-decoration:none}.f-lang a{color:inherit;text-decoration:none;opacity:.75}'
    '.f-lang a:hover{opacity:1}.f-lang b{font-weight:600;color:#fff}'
)


def ar_fonts(prefix):
    css = open(AR_CACHE, encoding='utf-8').read() if os.path.exists(AR_CACHE) else get(AR_URL).decode()
    if not os.path.exists(AR_CACHE):
        open(AR_CACHE, 'w', encoding='utf-8').write(css)
    files = {}
    for sub, body in re.findall(r'/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S):
        if sub != 'arabic':
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        w = re.search(r'font-weight:\s*(\d+)', body).group(1)
        src = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)
        rng = re.search(r'unicode-range:\s*([^;]+);', body).group(1).strip()
        name = '%s-%s' % (fam.lower().replace(' ', '-'), w)
        path = os.path.join(SITE, 'assets', 'fonts', name + '.woff2')
        if not os.path.exists(path):
            open(path, 'wb').write(get(src))
        files[(fam, w)] = (name, rng)
    faces = ''
    for fam, style, w, afam, aw in AR_MAP:
        name, rng = files[(afam, aw)]
        faces += ("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;"
                  "src:url(%sassets/fonts/%s.woff2) format('woff2');unicode-range:%s}" % (fam, style, w, prefix, name, rng))
    pre = ''.join('<link rel="preload" href="%sassets/fonts/%s.woff2" as="font" type="font/woff2" crossorigin>'
                  % (prefix, files[k][0]) for k in [('IBM Plex Sans Arabic', '500'), ('Noto Naskh Arabic', '500')])
    return '<!--dg:ar-->' + pre + '<style>' + faces + AR_CSS + '</style><!--/dg:ar-->'


# ─── construction ──────────────────────────────────────────────────────

def lsw_css(h):
    h = re.sub(r'/\*dg:lsw\*/.*?/\*dg:lsw-end\*/', '', h, flags=re.S)
    i = h.index('/*dg:end*/')
    return h[:i] + '/*dg:lsw*/' + LSW_CSS + '/*dg:lsw-end*/' + h[i:]


def main():
    pages = sorted(os.path.basename(f) for f in glob.glob(os.path.join(SITE, '*.html')))
    TRS = {l: load(l) for l in ('en', 'ar')}
    bundles = {(l, k): js_bundle(k, TRS[l], l) for l in TRS for k in ('home', 'pages')}
    for lang in ('en', 'ar'):
        out = os.path.join(SITE, lang)
        shutil.rmtree(out, ignore_errors=True)
        os.makedirs(out)
    for page in pages:
        p = os.path.join(SITE, page)
        h = open(p, encoding='utf-8').read()
        h = re.sub(r'\n?<!--dg:seo-->.*?<!--dg:seo-end-->', '', h, flags=re.S)
        fr = lsw_css(switchers(h, page, 'fr'))
        open(p, 'w', encoding='utf-8').write(fr)
        for lang in ('en', 'ar'):
            TR = TRS[lang]
            t = translate_html(fr, TR, lang)
            t = switchers(t, page, lang)
            t = t.replace('<html lang="fr"', '<html lang="%s"' % lang, 1)
            t = re.sub(r'(?<![./\w])assets/', '../assets/', t)
            kind = 'home' if page == 'index.html' else 'pages'
            tag = '<script data-dg="app">' + bundles[(lang, kind)].replace('</script', '<\\/script') + '</script>'
            t = re.sub(r'<script data-dg="app">.*?</script>', lambda m: tag, t, count=1, flags=re.S)
            if lang == 'ar':
                t = re.sub(r'<!--dg:ar-->.*?<!--/dg:ar-->', '', t, flags=re.S)
                t = t.replace('<!--dg:fonts-->', ar_fonts('../') + '<!--dg:fonts-->', 1)
            open(os.path.join(SITE, lang, page), 'w', encoding='utf-8').write(t)
    for lang in ('en', 'ar'):
        left = []
        for page in pages:
            t = open(os.path.join(SITE, lang, page), encoding='utf-8').read()
            body = re.sub(r'<script\b.*?</script>|<style\b.*?</style>', '', t, flags=re.S)
            left += [w for w in ('Démarrer mon projet', 'Réalisations', 'Votre site', 'entreprises marocaines') if w in body]
        print(lang, ':', len(pages), 'pages', '— restes en français :', sorted(set(left)) or 'aucun')


if __name__ == '__main__':
    main()
