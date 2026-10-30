"""Liens vers les réseaux sociaux : pied de page de chaque page et page Contact (français ; EN/AR suivent via i18n).

Les adresses sont dans src/social.json (x, facebook, youtube, linkedin, instagram, google). Une adresse vide n'affiche rien :
pour ajouter Instagram ou la fiche Google plus tard, il suffit de remplir src/social.json et de relancer la chaîne.
Les mêmes adresses alimentent « sameAs » des données structurées (tools/seo.py).
Idempotent : le bloc est remplacé à chaque passage.

Usage : python3 tools/social.py
"""
import glob, hashlib, html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SITE = os.path.join(ROOT, 'site')
SRC = os.path.join(ROOT, 'src')
I18N = os.path.join(SRC, 'i18n')
TR = {}


def T(x):
    fr, en, ar = x
    TR.setdefault(fr, (en, ar))
    return html.escape(fr, quote=False)


def sid(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]


def save_tr():
    n = 0
    for lang, i in (('en', 0), ('ar', 1)):
        p = os.path.join(I18N, lang + '.json')
        d = json.load(open(p, encoding='utf-8'))
        for fr, tt in TR.items():
            k = sid(fr)
            if not d.get(k):
                d[k] = tt[i]
                n += 1
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(d.items())), f, ensure_ascii=False, indent=1)
            f.write('\n')
    return n


# nom affiché, icône (viewBox 24 × 24)
NETS = [
    ('x', 'X', 'M17.5 3h3.2l-7 8 8.3 10h-6.5l-5-6.2L4.8 21H1.6l7.5-8.6L1.2 3h6.6l4.6 5.7L17.5 3zm-1.1 16.2h1.8L6.7 4.7H4.8l11.6 14.5z'),
    ('facebook', 'Facebook', 'M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V13h2.8v8h3.2z'),
    ('instagram', 'Instagram', 'M7.5 3h9A4.5 4.5 0 0121 7.5v9a4.5 4.5 0 01-4.5 4.5h-9A4.5 4.5 0 013 16.5v-9A4.5 4.5 0 017.5 3zm0 1.8A2.7 2.7 0 004.8 7.5v9a2.7 2.7 0 002.7 2.7h9a2.7 2.7 0 002.7-2.7v-9a2.7 2.7 0 00-2.7-2.7h-9zM12 7.8a4.2 4.2 0 110 8.4 4.2 4.2 0 010-8.4zm0 1.8a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zm4.6-3.1a1 1 0 110 2 1 1 0 010-2z'),
    ('youtube', 'YouTube', 'M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z'),
    ('linkedin', 'LinkedIn', 'M5.2 8.6H2.1V21h3.1V8.6zM3.7 3a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM21.9 14.2c0-3.3-1.8-4.8-4.1-4.8-1.9 0-2.7 1-3.2 1.8V8.6h-3.1V21h3.1v-6.6c0-1.7.8-2.6 2.1-2.6 1.3 0 2 .9 2 2.6V21h3.1v-6.8z'),
    ('google', 'Google', 'M12 2.5a6.6 6.6 0 00-6.6 6.6c0 4.9 6.6 12.4 6.6 12.4s6.6-7.5 6.6-12.4A6.6 6.6 0 0012 2.5zm0 9a2.4 2.4 0 110-4.8 2.4 2.4 0 010 4.8z'),
]
FOLLOW = ('Suivez-nous', 'Follow us', 'تابعنا')


def links():
    cfg = json.load(open(os.path.join(SRC, 'social.json'), encoding='utf-8'))
    out = []
    for key, name, path in NETS:
        url = (cfg.get(key) or '').strip()
        if url:
            out.append((key, name, url, path))
    return out


def block(cls, nets):
    a = ''.join('<a href="%s" target="_blank" rel="me noopener noreferrer" aria-label="%s" title="%s">'
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="%s"/></svg></a>'
                % (html.escape(u, quote=True), html.escape(n), html.escape(n), p) for _, n, u, p in nets)
    return '<div class="%s"><span class="soc-l">%s</span><span class="soc-i">%s</span></div>' % (cls, T(FOLLOW), a)


def main():
    nets = links()
    n = 0
    f_blk = block('f-soc', nets) if nets else ''
    c_blk = block('soc-line w', nets) if nets else ''
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        t = open(f, encoding='utf-8').read()
        o = t
        t = re.sub(r'<div class="f-soc">.*?</span></div>', '', t, flags=re.S)
        t = re.sub(r'<div class="soc-line w">.*?</span></div>', '', t, flags=re.S)
        # pied de page : sous la colonne Contact
        m = re.search(r'(<div class="f-col"><h6>Contact</h6>.*?)(</div>\s*</div>\s*<div class="f-bot">)', t, flags=re.S)
        if m:
            t = t[:m.end(1)] + f_blk + t[m.end(1):]
        # page Contact : sous les quatre cartes
        if os.path.basename(f) == 'contact.html':
            t = re.sub(r'(<section class="blk"><div class="chan w">.*?</div>)(</section>)',
                       lambda mm: mm.group(1) + c_blk + mm.group(2), t, count=1, flags=re.S)
        if t != o:
            open(f, 'w', encoding='utf-8').write(t)
            n += 1
    print('liens sociaux :', len(nets), 'réseaux,', n, 'pages mises à jour,', save_tr(), 'traductions ajoutées')


if __name__ == '__main__':
    main()
