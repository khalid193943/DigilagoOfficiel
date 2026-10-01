"""Injecte les sources lisibles de src/js et src/css dans les pages de site/.

  src/js/common.js  → au début du script de chaque page
  src/js/home.js    → script de l'accueil (index.html)
  src/js/pages.js   → script de toutes les autres pages
  src/css/perf.css + src/css/design.css → ajoutés à la fin du <style> de chaque page

Le JavaScript est minifié avec terser (npx), le CSS avec un minifieur simple.
Le script est idempotent : on peut le relancer autant de fois que l'on veut.

Usage : python3 tools/inject.py   (depuis la racine du dépôt)
"""
import glob, os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
SRC = os.path.join(ROOT, 'src')

HOME_SIG = '(function(){var RMZ='
PAGES_SIG = '(function(){var $=function(id)'


def read(p):
    return open(os.path.join(SRC, p), encoding='utf-8').read()


def terser(code):
    r = subprocess.run(['npx', '-y', 'terser@5', '--compress', 'passes=2', '--mangle', '--ecma', '2017'],
                       input=code, capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        sys.exit('terser : ' + r.stderr)
    return r.stdout.strip()


def mincss(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{}:;,>])\s*', r'\1', css)
    return css.replace(';}', '}').strip()


def main():
    common = read('js/common.js')
    js = {'home': terser(common + '\n' + read('js/home.js')),
          'pages': terser(common + '\n' + read('js/pages.js'))}
    css = '/*dg:perf*/' + mincss(read('css/perf.css') + read('css/design.css')) + '/*dg:end*/'
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        name = os.path.basename(f)
        h = open(f, encoding='utf-8').read()
        kind = 'home' if name == 'index.html' else 'pages'
        tag = '<script data-dg="app">' + js[kind].replace('</script', '<\\/script') + '</script>'
        if '<script data-dg="app">' in h:
            h = re.sub(r'<script data-dg="app">.*?</script>', lambda m: tag, h, count=1, flags=re.S)
        else:
            sig = HOME_SIG if kind == 'home' else PAGES_SIG
            m = re.search(r'<script>' + re.escape(sig) + r'.*?</script>', h, re.S)
            if not m:
                sys.exit(name + ' : script principal introuvable')
            h = h[:m.start()] + tag + h[m.end():]
        # CSS
        if '/*dg:perf*/' in h:
            h = re.sub(r'/\*dg:perf\*/.*?/\*dg:end\*/', lambda m: css, h, count=1, flags=re.S)
        else:
            i = h.index('</style>')
            h = h[:i] + css + h[i:]
        # Corrections HTML
        if kind == 'home':
            # deux éléments portaient l'id « mtFill » : la jauge du simulateur devient « simFill »
            h = h.replace('<span class="mt-b"><i id="mtFill"></i></span>', '<span class="mt-b"><i id="simFill"></i></span>')
        # préconnexions en double
        dup = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        while h.count(dup) > 1:
            h = h.replace(dup, '', 1)
        open(f, 'w', encoding='utf-8').write(h)
        print(name.ljust(46), round(len(h) / 1024), 'Ko')


if __name__ == '__main__':
    main()
