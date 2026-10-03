"""Héberge les polices sur le site au lieu de Google Fonts (idempotent).

- Télécharge une seule fois les fichiers woff2 (sous-ensemble « latin », qui couvre
  le français) dans site/assets/fonts/.
- Remplace dans chaque page le lien Google Fonts et les préconnexions par des
  @font-face en ligne, et précharge les 3 polices visibles dès l'arrivée
  (titre Sora, italique Playfair, texte Instrument Sans).

Résultat : deux connexions réseau en moins (fonts.googleapis.com et
fonts.gstatic.com), polices disponibles avant le premier affichage, plus de
saut du titre quand la police arrive.

Usage : python3 tools/fonts.py
"""
import glob, os, re, subprocess

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
FONTS = os.path.join(SITE, 'assets', 'fonts')
GF = ('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500'
      '&family=Playfair+Display:ital,wght@0,500;1,500&family=Sora:wght@500;600&display=swap')
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/124.0 Safari/537.36')
PRELOAD = ['sora-500', 'playfair-display-500i', 'instrument-sans-400']
START, END = '<!--dg:fonts-->', '<!--dg:fonts-end-->'


def get(url):
    # curl utilise les certificats du système (le Python de python.org n'en a pas toujours)
    return subprocess.run(['curl', '-sSfL', '--max-time', '30', '-A', UA, url], check=True, capture_output=True).stdout


CACHE = os.path.join(ROOT, 'src', 'fonts.css')


def build():
    os.makedirs(FONTS, exist_ok=True)
    # La feuille Google est gardée dans src/fonts.css : la construction marche hors ligne.
    if os.path.exists(CACHE):
        css = open(CACHE, encoding='utf-8').read()
    else:
        css = get(GF).decode()
        open(CACHE, 'w', encoding='utf-8').write(css)
    faces, seen = [], {}
    for sub, body in re.findall(r'/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S):
        if sub != 'latin':
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        style = re.search(r'font-style:\s*(\w+)', body).group(1)
        weight = re.search(r'font-weight:\s*(\d+)', body).group(1)
        src = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)
        rng = re.search(r'unicode-range:\s*([^;]+);', body).group(1).strip()
        name = '%s-%s%s' % (fam.lower().replace(' ', '-'), weight, 'i' if style == 'italic' else '')
        # Polices variables : plusieurs graisses partagent le même fichier → un seul téléchargement.
        file = seen.setdefault(src, name)
        path = os.path.join(FONTS, file + '.woff2')
        if not os.path.exists(path):
            open(path, 'wb').write(get(src))
        faces.append((file, "@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;"
                            "src:url(assets/fonts/%s.woff2) format('woff2');unicode-range:%s}"
                      % (fam, style, weight, file, rng)))
    # Ménage : les polices latines plus utilisées partent, mais jamais les polices arabes
    # (src/fonts-ar.css) : sans elles, la version arabe devait tout retélécharger à chaque construction
    # (et la construction échouait hors ligne).
    keep = set(seen.values()) | ar_names()
    for f in os.listdir(FONTS):
        if f[:-6] not in keep:
            os.remove(os.path.join(FONTS, f))
    return faces


def ar_names():
    """Noms des fichiers des polices arabes (même règle de nommage que tools/i18n_build.py)."""
    path = os.path.join(ROOT, 'src', 'fonts-ar.css')
    if not os.path.exists(path):
        return set()
    css = open(path, encoding='utf-8').read()
    out = set()
    for sub, body in re.findall(r'/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S):
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        w = re.search(r'font-weight:\s*(\d+)', body).group(1)
        out.add('%s-%s' % (fam.lower().replace(' ', '-'), w))
    return out


def main():
    faces = build()
    names = [n for n, _ in faces]
    for p in PRELOAD:
        assert p in names, p
    tags = ''.join('<link rel="preload" href="assets/fonts/%s.woff2" as="font" type="font/woff2" crossorigin>' % p
                   for p in PRELOAD)
    style = '<style>' + ''.join(f for _, f in faces) + '</style>'
    block = START + tags + style + END
    for f in sorted(glob.glob(os.path.join(SITE, '*.html'))):
        h = open(f, encoding='utf-8').read()
        h = re.sub(re.escape(START) + '.*?' + re.escape(END), '', h, flags=re.S)
        h = re.sub(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"( crossorigin)?>\n?', '', h)
        h = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]*">\n?', block, h)
        if block not in h:  # première exécution déjà faite : on remet le bloc avant le premier <style>
            i = h.index('<style>')
            h = h[:i] + block + h[i:]
        open(f, 'w', encoding='utf-8').write(h)
    total = sum(os.path.getsize(os.path.join(FONTS, n + '.woff2')) for n in set(names))
    print(len(names), 'styles,', len(set(names)), 'fichiers,', round(total / 1024), 'Ko au total ; préchargées :', ', '.join(PRELOAD))


if __name__ == '__main__':
    main()
