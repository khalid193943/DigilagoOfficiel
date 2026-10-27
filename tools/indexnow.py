"""Prévient Bing et les moteurs IndexNow que des pages sont nouvelles ou modifiées (IndexNow).

Les adresses viennent du sitemap ; la clé est le fichier site/<clé>.txt (créé par tools/analytics.py) : elle doit
déjà être EN LIGNE sur https://www.digilago.ma/<clé>.txt pour que l'envoi soit accepté.

Usage (depuis un terminal qui a accès à Internet, par exemple Codespaces) :
  python3 tools/indexnow.py              # envoie toutes les adresses du sitemap
  python3 tools/indexnow.py --dry-run    # affiche ce qui serait envoyé, sans rien envoyer
  python3 tools/indexnow.py URL [URL…]   # envoie seulement ces adresses
"""
import json, os, re, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
HOST = 'www.digilago.ma'


def main():
    key = open(os.path.join(ROOT, 'src', 'indexnow_key.txt'), encoding='utf-8').read().strip()
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if args:
        urls = args
    else:
        sm = open(os.path.join(ROOT, 'site', 'sitemap.xml'), encoding='utf-8').read()
        urls = re.findall(r'<loc>([^<]+)</loc>', sm)
    urls = [u for u in urls if u.startswith('https://' + HOST + '/')]
    body = {'host': HOST, 'key': key, 'keyLocation': 'https://%s/%s.txt' % (HOST, key), 'urlList': urls[:10000]}
    print('%d adresses, clé %s…' % (len(urls), key[:6]))
    if '--dry-run' in sys.argv:
        return
    req = urllib.request.Request('https://api.indexnow.org/indexnow', data=json.dumps(body).encode('utf-8'),
                                 headers={'Content-Type': 'application/json; charset=utf-8'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print('réponse', r.status, '(200 ou 202 = reçu)')
    except urllib.error.HTTPError as e:
        sys.exit('refusé : %s (403 = clé introuvable en ligne, 422 = adresses hors du site)' % e.code)


if __name__ == '__main__':
    main()
