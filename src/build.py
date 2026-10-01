import re
import json,sys
from recolor import recolor
from radius import soften
import os
OUT=os.environ.get('DEV_DIR','../dev'); os.makedirs(OUT,exist_ok=True)
w=json.load(open('world.json'))
html=open('head.html').read()+open('body.html').read()+open('script.html').read()
html=html.replace('__GRAT__',w['grat']).replace('__LAND__',w['land']).replace('__BORD__',w['borders']).replace('__MA__',w['morocco'])
html=html.replace('__WORLD__',json.dumps({'W':w['W'],'H':w['H'],'yMin':w['yMin'],'cities':w['cities']},ensure_ascii=False))
html=soften(recolor(html))
html=re.sub(r'(\d) h\b', '\\1\u00a0h', html)
html=html.replace('<html lang="fr">','<html lang="fr" data-api="'+os.environ.get('GESTION_URL','')+'">',1)
open(os.path.join(OUT,'index.html'),'w').write(html.replace('<!--LOCALFONTS-->',''))
print('index.html', len(html)//1024,'KB')
