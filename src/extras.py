"""Fichiers pour les moteurs de recherche : sitemap.xml et robots.txt."""
import os, datetime
SITE=os.environ.get('SITE_DIR','../site')
URL=os.environ.get('SITE_URL','https://digilago.ma').rstrip('/')
today=datetime.date.today().isoformat()
pages=sorted(p for p in os.listdir(SITE) if p.endswith('.html') and p!='404.html')
prio={'index.html':'1.0','services.html':'0.9','demarrer.html':'0.9','realisations.html':'0.8','contact.html':'0.8','a-propos.html':'0.7','guides.html':'0.7'}
rows=''.join(f"  <url><loc>{URL}/{'' if p=='index.html' else p}</loc><lastmod>{today}</lastmod><priority>{prio.get(p,'0.6' if p.startswith('guide-') else '0.3')}</priority></url>\n" for p in pages)
open(os.path.join(SITE,'sitemap.xml'),'w').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}</urlset>\n')
open(os.path.join(SITE,'robots.txt'),'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {URL}/sitemap.xml\n')
open(os.path.join(SITE,'.nojekyll'),'w').write('')
print('sitemap.xml:', len(pages), 'pages')
