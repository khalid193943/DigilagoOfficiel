"""Génère l'image de partage (1200 × 630) à partir du haut de l'accueil.

Usage : python3 tools/og_image.py   (le site doit tourner : npm run start)
"""
import asyncio, os
from playwright.async_api import async_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'site', 'assets', 'og-digilago.jpg')
URL = os.environ.get('LOCAL_URL', 'http://127.0.0.1:4173/')


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        await pg.goto(URL)
        await pg.wait_for_timeout(4500)          # préchargement + apparition du titre
        await pg.add_style_tag(content='#cur,.srail,.dock,.grain{display:none!important}')
        await pg.screenshot(path=OUT, type='jpeg', quality=82)
        await b.close()
    print('écrit', OUT, os.path.getsize(OUT), 'octets')

asyncio.run(main())
