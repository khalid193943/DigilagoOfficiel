"""Relie le site à l'espace de gestion : chaque formulaire (« Démarrer un projet », « Contact »)
arrive alors aussi dans « Demandes », en plus de WhatsApp.

Usage :
  python3 tools/set_gestion_url.py https://gestion.digilago.ma   # enregistre l'adresse et l'applique
  python3 tools/set_gestion_url.py                                # réapplique l'adresse enregistrée (utilisé par build.py)

L'adresse est gardée dans src/gestion_url.txt. Côté gestion, autorisez l'adresse du site avec la
variable SITE_ORIGIN (par défaut : https://digilago.ma, https://www.digilago.ma).
"""
import glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CONF = os.path.join(ROOT, 'src', 'gestion_url.txt')


def main():
    if len(sys.argv) > 1:
        url = sys.argv[1].strip().rstrip('/')
        if url and not re.match(r'^https?://[\w.-]+(:\d+)?(/[\w./-]*)?$', url):
            sys.exit('Adresse invalide : ' + url)
        open(CONF, 'w', encoding='utf-8').write(url + '\n')
    url = open(CONF, encoding='utf-8').read().strip() if os.path.exists(CONF) else os.environ.get('GESTION_URL', '').strip()
    pages = glob.glob(os.path.join(ROOT, 'site', '*.html')) + glob.glob(os.path.join(ROOT, 'site', '*', '*.html'))
    for f in pages:
        h = open(f, encoding='utf-8').read()
        h2 = re.sub(r'(<html\b[^>]*?)\sdata-api="[^"]*"', r'\1', h, count=1)
        h2 = re.sub(r'<html\b([^>]*)>', lambda m: '<html%s data-api="%s">' % (m.group(1), url), h2, count=1) if url else h2
        if h2 != h:
            open(f, 'w', encoding='utf-8').write(h2)
    print('gestion :', url or '(non reliée)', '—', len(pages), 'pages')


if __name__ == '__main__':
    main()
