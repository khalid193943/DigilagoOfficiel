"""Articles écrits directement en trois langues : src/articles_tri/*.py → src/articles/<page>.json (français).

Chaque texte du module est un triplet (français, anglais, arabe), avec les mêmes balises dans le même ordre
(<strong>, <a href>…). Le script écrit l'article français (lu ensuite par tools/articles.py) et range les
traductions dans src/i18n/en.json et ar.json, morceau de texte par morceau de texte, exactement comme
tools/i18n_extract.py découpe les pages : les versions anglaise et arabe sont donc complètes dès le build.
Une traduction déjà présente (relue) n'est jamais écrasée.

Usage : python3 tools/articles_tri.py
"""
import glob, hashlib, importlib.util, json, os, re, sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'src', 'articles_tri')
OUT = os.path.join(ROOT, 'src', 'articles')
I18N = os.path.join(ROOT, 'src', 'i18n')
sys.path.insert(0, HERE)
from i18n_extract import wanted  # noqa: E402


class Nodes(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []

    def handle_data(self, data):
        t = data.strip()
        if t:
            self.out.append(t)


def nodes(s):
    p = Nodes()
    p.feed(s)
    p.close()
    return p.out


def sid(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def is_tri(x):
    return isinstance(x, tuple) and len(x) == 3 and all(isinstance(v, str) for v in x)


def typo(fr):
    """Espaces insécables du français avant ? ! ; : (le signe ne passe jamais seul à la ligne)."""
    return re.sub(r' ([?!;])', '\u202f\\1', re.sub(r' :(?=\s|$|<)', '\u00a0:', fr))


def walk(obj, pairs, where):
    if is_tri(obj):
        fr, en, ar = obj
        fr = typo(fr)
        nf, ne, na = nodes(fr), nodes(en), nodes(ar)
        if not len(nf) == len(ne) == len(na):
            raise SystemExit('%s : découpage différent selon la langue (%d / %d / %d morceaux)\n  FR %s\n  EN %s\n  AR %s'
                             % (where, len(nf), len(ne), len(na), nf, ne, na))
        pairs += [(a, b, c) for a, b, c in zip(nf, ne, na) if wanted(a)]
        return fr
    if isinstance(obj, dict):
        return {k: walk(v, pairs, '%s.%s' % (where, k)) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [walk(v, pairs, '%s[%d]' % (where, i)) for i, v in enumerate(obj)]
    return obj


def main():
    pairs, n = [], 0
    for f in sorted(glob.glob(os.path.join(SRC, '*.py'))):
        spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        art = walk(m.ART, pairs, os.path.basename(f))
        with open(os.path.join(OUT, art['file'].replace('.html', '.json')), 'w', encoding='utf-8') as o:
            json.dump(art, o, ensure_ascii=False, indent=1)
            o.write('\n')
        n += 1
    added = 0
    for lang, i in (('en', 1), ('ar', 2)):
        p = os.path.join(I18N, lang + '.json')
        d = json.load(open(p, encoding='utf-8'))
        # un petit morceau déjà traduit ailleurs autrement (« Le », « Pour ») serait remplacé par l'autre traduction
        for t in pairs:
            old = d.get(sid(t[0]))
            if old and old != t[i] and len(t[0].split()) <= 2:
                print('attention (%s) : « %s » est déjà traduit « %s », pas « %s » : reformulez' % (lang, t[0], old, t[i]))
        for t in pairs:
            k = sid(t[0])
            if not d.get(k):
                d[k] = t[i]
                added += 1
        with open(p, 'w', encoding='utf-8') as o:
            json.dump(dict(sorted(d.items())), o, ensure_ascii=False, indent=1)
            o.write('\n')
    print(n, 'articles en trois langues ;', added, 'traductions ajoutées')


if __name__ == '__main__':
    main()
