"""Extrait tous les textes français à traduire vers src/i18n/strings.json.

Pour chaque texte : la version française, un contexte (la phrase ou le bloc
qui l'entoure, pour bien traduire un morceau de titre) et son type
(texte, attribut, données des métiers, script). Les traductions existantes
dans src/i18n/en.json et src/i18n/ar.json sont conservées ; seuls les
nouveaux textes restent à traduire.

Usage : python3 tools/i18n_extract.py
"""
import glob, hashlib, json, os, re
from html.parser import HTMLParser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
OUT = os.path.join(ROOT, 'src', 'i18n')

ATTRS = {'alt', 'title', 'aria-label', 'placeholder', 'data-q', 'data-need', 'data-met', 'data-when',
         'data-has', 'data-pref'}
BLOCKS = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'summary', 'dd', 'dt', 'blockquote', 'figcaption',
          'label', 'button', 'a', 'td', 'th', 'option', 'title', 'small', 'em', 'b'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
LETTERS = re.compile(r'[A-Za-zÀ-ÿ]')
# Textes identiques dans toutes les langues : marques, adresses, numéros.
KEEP = re.compile(r'^(d|g|i|lago|digilago|Digilago|Google|WhatsApp|ChatGPT|Gemini|Perplexity|Instagram|Facebook|LinkedIn|'
                  r'TikTok|Meta|Vercel|Cloudflare|GitHub|Stripe|CMI|FR|EN|Next\.js|React|Node\.js|PostgreSQL|'
                  r'Tailwind|Figma|Supabase|Lighthouse|SEO|GEO|[\w.+-]+@[\w.-]+|\+?[\d\s().-]+|[\w-]+\.ma)$')


def sid(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def wanted(t):
    return bool(t) and bool(LETTERS.search(t)) and not KEEP.match(t)


class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [tag, [textes du bloc]]
        self.items = []          # (texte, index du bloc)
        self.blocks = []
        self.attrs = []
        self.raw = 0             # dans <script>/<style>

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k, v in attrs:
            if v and (k in ATTRS or (k == 'content' and a.get('name') == 'description') or
                      (k == 'value' and tag == 'option')) and wanted(v.strip()):
                self.attrs.append((v.strip(), k))
        if tag in ('script', 'style'):
            self.raw += 1
        if tag in VOID:
            return
        self.stack.append([tag, None])
        if tag in BLOCKS:
            self.blocks.append([])
            self.stack[-1][1] = len(self.blocks) - 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.raw = max(0, self.raw - 1)
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.raw:
            return
        t = data.strip()
        if not wanted(t):
            return
        blk = next((s[1] for s in reversed(self.stack) if s[1] is not None), None)
        for s in self.stack:
            if s[1] is not None:
                self.blocks[s[1]].append(t)
        self.items.append((t, blk))


def main():
    os.makedirs(OUT, exist_ok=True)
    strings = {}

    def add(text, kind, ctx='', page=''):
        k = sid(text)
        e = strings.setdefault(k, {'fr': text, 'kind': kind, 'ctx': ctx, 'pages': []})
        if page and page not in e['pages']:
            e['pages'].append(page)
        if ctx and not e['ctx']:
            e['ctx'] = ctx

    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        name = os.path.basename(f)
        h = open(f, encoding='utf-8').read()
        h = re.sub(r'<!--dg:seo-->.*?<!--dg:seo-end-->', '', h, flags=re.S)
        c = Collector()
        c.feed(h)
        for t, blk in c.items:
            ctx = ' '.join(c.blocks[blk]) if blk is not None else ''
            add(t, 'text', ctx[:260] if ctx != t else '', name)
        for v, k in c.attrs:
            add(v, 'attr:' + k, '', name)
        # données des métiers (page Réalisations)
        m = re.search(r'<script[^>]*id="xpData"[^>]*>(.*?)</script>', h, re.S)
        if m:
            for s in json.loads(m.group(1))['s']:
                add(s['n'], 'json', 'nom d’un secteur d’activité', name)
                for x in s.get('f', []):
                    add(x, 'json', 'fonctionnalité d’un site pour le secteur « %s »' % s['n'], name)
                for x in s.get('a', []):
                    add(x, 'json', 'métier du secteur « %s »' % s['n'], name)
                if s.get('al'):
                    add(s['al'], 'json-html', 'paragraphe HTML (garder les balises)', name)
                for x in s['m']:
                    add(x['n'], 'json', 'métier du secteur « %s »' % s['n'], name)

    # phrases des scripts (liste tenue à la main : src/i18n/js_fr.json)
    for t in json.load(open(os.path.join(OUT, 'js_fr.json'), encoding='utf-8')):
        add(t, 'js', 'texte affiché par le script (garder balises HTML, espaces de début/fin et ponctuation)', 'js')

    json.dump(strings, open(os.path.join(OUT, 'strings.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for lang in ('en', 'ar'):
        p = os.path.join(OUT, lang + '.json')
        have = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
        todo = [k for k in strings if k not in have]
        print(lang, ':', len(strings), 'textes,', len(todo), 'à traduire')


if __name__ == '__main__':
    main()
