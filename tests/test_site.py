"""Tests du site en conditions réelles : chaque page, chaque lien, les parcours clés."""
import os, re, pytest
SITE = os.path.join(os.path.dirname(__file__), '..', 'site')
PAGES = sorted(p for p in os.listdir(SITE) if p.endswith('.html'))
# pages Secteurs (plus de 200 pages générées sur le même modèle) : toutes sont vérifiées hors navigateur ;
# dans le navigateur, la page Secteurs, les 18 pages de secteur et un échantillon de pages métier
VZ_TYPES = [p for p in PAGES if 'data-vz="type"' in open(os.path.join(SITE, p), encoding='utf-8').read()]
BROWSER_PAGES = [p for p in PAGES if p not in VZ_TYPES] + VZ_TYPES[::12]
IGNORED = ('fonts.googleapis', 'fonts.gstatic', 'favicon')

def watch(page):
    errors = []
    page.on('pageerror', lambda e: errors.append(f'JS: {e}'))
    def failed(r):
        # le navigateur interrompt volontairement le chargement des vidéos (lecture à la demande) : ce n'est pas une erreur
        if any(x in r.url for x in IGNORED) or (r.url.endswith(('.mp4', '.webm')) and 'ABORTED' in (r.failure or '')):
            return
        errors.append(f'Réseau: {r.url} ({r.failure})')
    page.on('requestfailed', failed)
    return errors

@pytest.mark.parametrize('name', BROWSER_PAGES)
def test_page_charge_sans_erreur(page, base_url, name):
    errors = watch(page)
    resp = page.goto(f'{base_url}/{name}')
    assert resp.status == 200
    page.wait_for_timeout(1200)
    assert page.title().strip(), 'titre manquant'
    assert page.locator('h1').count() >= 1 or name == 'index.html', 'h1 manquant'
    assert page.locator('#foot').count() == 1, 'pied de page manquant'
    assert not errors, errors

@pytest.mark.parametrize('name', PAGES)
def test_liens_internes(name):
    html = open(os.path.join(SITE, name), encoding='utf-8').read()
    missing = [h for h in set(re.findall(r'href="([^"#:?]+\.html)', html)) if not os.path.exists(os.path.join(SITE, h))]
    assert not missing, f'liens cassés : {missing}'
    images = [s for s in set(re.findall(r'src="(assets/[^"]+)"', html)) if not os.path.exists(os.path.join(SITE, s))]
    assert not images, f'images manquantes : {images}'

def test_accueil_defile_jusqu_en_bas(page, base_url):
    errors = watch(page)
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2500)
    height = page.evaluate('document.documentElement.scrollHeight')
    for y in range(0, height, 700):
        page.evaluate(f'window.scrollTo(0,{y})'); page.wait_for_timeout(40)
    page.wait_for_timeout(800)
    assert page.locator('#giant').is_visible()
    assert not errors, errors

def test_reponses_changent_au_defilement(page, base_url):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2500)
    top, h = page.evaluate("(()=>{const e=document.getElementById('story');return [e.getBoundingClientRect().top+scrollY,e.offsetHeight]})()")
    page.evaluate(f'window.scrollTo(0,{int(top + (h - 900) * 0.9)})')
    page.wait_for_function("document.querySelector('#stSlides .st-sl.act') && document.querySelector('#stSlides .st-sl.act').dataset.s === '3'", timeout=15000)

def test_telephone_accueil(page, base_url):
    errors = watch(page)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2500)
    assert page.evaluate('document.documentElement.dataset.mode') == 'M'
    assert not errors, errors

def stub_open(page):
    page.add_init_script('window.__opened = []; window.open = function(u){ window.__opened.push(u); return null; };')

def lead_api(page, sent, ok=True):
    """Le serveur de gestion, simulé : on garde ce que la page envoie."""
    def handle(route, req):
        if req.method == 'OPTIONS':
            return route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type'})
        sent.append(req.post_data_json)
        route.fulfill(status=200 if ok else 500, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
                      body='{"ok":true,"id":1}' if ok else '{"ok":false}')
    page.route('**/api/leads', handle)


def test_demarrer_un_projet_envoie_a_la_gestion(page, base_url):
    """Démarrer : besoin, contact, moment de rappel ; la demande part dans l'espace de gestion (pas de
    redirection vers WhatsApp) et l'écran de confirmation dit quand on rappelle."""
    sent = []
    stub_open(page)
    lead_api(page, sent)
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/demarrer.html'); page.wait_for_timeout(800)
    assert page.locator('#wzCard .wz-step').count() == 3
    page.locator('#tNeeds .wtile').first.click()
    page.click('#wzNext'); page.wait_for_timeout(500)
    page.click('#wzNext'); page.wait_for_timeout(300)
    assert 'téléphone' in page.inner_text('#wzErr'), 'le téléphone est demandé'
    page.fill('#wFirst', 'Sara'); page.fill('#wTel', '0612345678')
    page.click('#wzNext'); page.wait_for_timeout(500)
    assert 'Sara, 0612345678' in page.inner_text('#recap')
    page.click('#wzNext'); page.wait_for_timeout(300)
    assert 'quand' in page.inner_text('#wzErr').lower(), 'le moment de rappel est demandé'
    page.click('#tCb [data-cb="day"]'); page.click('#cbSlot [data-slot="pm"]')
    page.click('#wzNext')
    page.wait_for_url('**/merci.html*', timeout=8000)  # après l'envoi : la page « Merci »
    page.wait_for_timeout(600)
    assert len(sent) == 1 and sent[0]['phone'] == '0612345678' and sent[0]['callback'] == 'day' and sent[0]['slot'] == 'pm'
    assert sent[0]['date'] and sent[0]['source'].startswith('Démarrer un projet (DG-')
    assert 'entre 14 h et 18 h' in page.inner_text('#mcWhen'), 'le moment du rappel choisi est rappelé'
    assert page.inner_text('#mcName') == 'Sara'
    assert page.inner_text('#mcRef').startswith('DG-')


def test_demarrer_echec_rien_ne_se_perd(page, base_url):
    """Si l'envoi échoue : un message clair, « Réessayer » et WhatsApp avec la demande complète."""
    sent = []
    lead_api(page, sent, ok=False)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{base_url}/demarrer.html'); page.wait_for_timeout(800)
    page.locator('#tNeeds .wtile').first.click(); page.click('#wzNext'); page.wait_for_timeout(400)
    page.fill('#wTel', '0612345678'); page.click('#wzNext'); page.wait_for_timeout(400)
    page.locator('#tCb .cbo:not([hidden])').first.click(); page.click('#wzNext'); page.wait_for_timeout(1200)
    assert page.locator('#wzFail').is_visible()
    assert not page.evaluate("document.getElementById('wzCard').classList.contains('sent')")
    assert '0612345678' in page.get_attribute('#wzFailWa', 'href')
    assert page.locator('#wzRetry').is_visible()


@pytest.mark.parametrize('lang', ['en', 'ar'])
def test_demarrer_traduit(page, base_url, lang):
    sent = []
    lead_api(page, sent)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{base_url}/{lang}/demarrer.html'); page.wait_for_timeout(800)
    page.locator('#tNeeds .wtile').first.click(); page.click('#wzNext'); page.wait_for_timeout(400)
    page.fill('#wTel', '0612345678'); page.click('#wzNext'); page.wait_for_timeout(400)
    page.click('#tCb [data-cb="day"]'); page.click('#wzNext')
    page.wait_for_url(f'**/{lang}/merci.html*', timeout=8000)  # la page « Merci » de la même langue
    page.wait_for_timeout(600)
    assert sent and sent[0]['lang'] == lang and sent[0]['source'].startswith('Démarrer un projet (')
    txt = page.inner_text('#mcWhen')
    assert ('Tomorrow' in txt) if lang == 'en' else ('غدًا' in txt), txt


def test_formulaire_contact_envoie_sur_whatsapp(page, base_url):
    stub_open(page)
    page.goto(f'{base_url}/contact.html'); page.wait_for_timeout(1500)
    page.fill('#cform input[name="nom"]', 'Sara Test')
    page.click('#cform button[type="submit"]'); page.wait_for_timeout(400)
    url = page.evaluate('window.__opened[0]')
    assert url.startswith('https://wa.me/212649953813') and 'Sara%20Test' in url

@pytest.mark.parametrize('name', ['index.html', 'services.html', 'contact.html'])
def test_menu_plein_ecran_telephone(page, base_url, name):
    errors = watch(page)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{base_url}/{name}'); page.wait_for_timeout(2000)
    page.evaluate('window.scrollTo(0, Math.max(1400, document.documentElement.scrollHeight * 0.3))'); page.wait_for_timeout(600)
    page.mouse.wheel(0, -300); page.wait_for_timeout(1200)
    assert page.locator('#dock').count() == 0
    page.click('#mb'); page.wait_for_timeout(1000)
    assert 'open' in page.locator('#sheet').get_attribute('class')
    assert page.locator('#sheet .fsm-nav a').count() == 7
    page.click('#closeBtn'); page.wait_for_timeout(900)
    assert 'open' not in page.locator('#sheet').get_attribute('class')
    assert not errors, errors

def test_modeles_se_parcourent_au_survol(page, base_url):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2000)
    page.evaluate("document.querySelector('#showcase .sw-wall').scrollIntoView({block: 'center'})"); page.wait_for_timeout(1500)
    cards = page.locator('#showcase .sw-wall .lp')
    assert cards.count() >= 26, 'tous les types de sites, mélangés sur trois rangées'
    page.click('#showcase .sw-play'); page.wait_for_timeout(300)   # pause : la carte reste sous la souris
    assert 'paused' in page.locator('#showcase .sw-wall').get_attribute('class')
    i = page.evaluate("""[...document.querySelectorAll('#showcase .sw-wall .lp')].findIndex(c => {
        const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2,
          img = c.querySelector('img'), v = c.querySelector('.lp-view');
        return img && img.getBoundingClientRect().height > 2 * v.clientHeight &&
          x > 250 && x < innerWidth - 250 && y > 150 && y < innerHeight - 150 })""")
    assert i >= 0
    box = cards.nth(i).bounding_box()
    page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.wait_for_timeout(600)
    dy = page.evaluate("i => parseFloat(getComputedStyle(document.querySelectorAll('#showcase .sw-wall .lp')[i]).getPropertyValue('--dy'))", i)
    assert dy > 500, 'la page devrait pouvoir défiler dans son cadre'

def test_explorateur_des_metiers(page, base_url):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/realisations.html'); page.wait_for_timeout(1500)
    assert page.locator('.st-sec').count() == 12
    page.fill('#xpQ', 'riad'); page.wait_for_timeout(300)
    page.keyboard.press('Enter'); page.wait_for_timeout(1000)
    assert page.url.endswith('#hotellerie/riad')
    assert page.locator('#xpMN').inner_text() == 'Riad'
    assert page.locator('.st-sec[data-s="hotellerie"]').get_attribute('class').find('open') > 0
    page.click('.st-sec[data-s="education"] .st-h'); page.wait_for_timeout(600)
    page.click('.st-ty[data-u="ecole-de-musique"]'); page.wait_for_timeout(600)
    assert page.locator('.xp-ex.on').get_attribute('data-e') == 'ecole-musique'
    assert 'metier=' in page.locator('#xpGo').get_attribute('href')
    page.click('.l3-sw [data-l="ar"]'); page.wait_for_timeout(500)
    assert page.locator('#l3Nav').get_attribute('dir') == 'rtl'

def test_recherche_intelligente(page, base_url):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/realisations.html'); page.wait_for_timeout(1500)
    assert page.locator('.smq-pop').count() >= 4
    page.click('#xpQ'); page.keyboard.type('dentst'); page.wait_for_timeout(700)
    assert 'dentiste' in page.locator('#ans h3').inner_text().lower()
    page.fill('#xpQ', ''); page.keyboard.type('boulangerie'); page.wait_for_timeout(700)
    assert 'boulangerie' in page.locator('#ans h3').inner_text().lower()
    assert page.locator('#ans .ans-go').get_attribute('href').startswith('demarrer.html?metier=')
    page.fill('#xpQ', ''); page.keyboard.type('lawyer'); page.wait_for_timeout(700)
    page.keyboard.press('Enter'); page.wait_for_timeout(800)
    assert page.url.endswith('#juridique/cabinet-davocats')

def test_metiers_aussi_pour(page, base_url):
    page.goto(f'{base_url}/realisations.html'); page.wait_for_timeout(1500)
    page.click('#xpQ'); page.keyboard.type('pizzeria'); page.wait_for_timeout(300)
    page.wait_for_timeout(500)
    assert 'pizzeria' in page.locator('#ans').inner_text().lower()
    page.keyboard.press('Enter'); page.wait_for_timeout(800)
    assert '#restauration/' in page.url
    assert page.locator('#stAl .st-also').count() == 1

def test_bon_moment(page, base_url):
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(1500)
    page.locator('#moment').scroll_into_view_if_needed(); page.wait_for_timeout(2500)
    assert 'go' in page.locator('#moment').get_attribute('class')
    assert page.locator('#moment .fin-cta .cta').get_attribute('href') == 'demarrer.html'

# ─── Versions anglaise et arabe ───────────────────────────────────────
LANG_PAGES = [(l, p) for l in ('en', 'ar') for p in PAGES]
LANG_BROWSER = [(l, p) for l in ('en', 'ar') for p in BROWSER_PAGES]

@pytest.mark.parametrize('lang,name', LANG_BROWSER)
def test_traduction_charge_sans_erreur(page, base_url, lang, name):
    errors = watch(page)
    resp = page.goto(f'{base_url}/{lang}/{name}')
    assert resp.status == 200
    page.wait_for_timeout(1200)
    assert page.evaluate('document.documentElement.lang') == lang
    assert page.locator('#foot').count() == 1, 'pied de page manquant'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'débordement horizontal'
    assert not errors, errors

@pytest.mark.parametrize('lang,name', LANG_PAGES)
def test_traduction_liens_et_images(lang, name):
    d = os.path.join(SITE, lang)
    html = open(os.path.join(d, name), encoding='utf-8').read()
    missing = [h for h in set(re.findall(r'href="([^"#:?]+\.html)', html)) if not os.path.exists(os.path.normpath(os.path.join(d, h)))]
    assert not missing, f'liens cassés : {missing}'
    images = [s for s in set(re.findall(r'src="(\.\./assets/[^"]+)"', html)) if not os.path.exists(os.path.normpath(os.path.join(d, s)))]
    assert not images, f'images manquantes : {images}'
    assert not re.search(r'(?<![./\w])assets/', re.sub(r'https?://\S+', '', html)), 'chemin d’image non corrigé'

def test_selecteur_de_langue(page, base_url):
    page.goto(f'{base_url}/services.html')
    assert page.locator('.f-lang a[hreflang="en"]').get_attribute('href') == 'en/services.html'
    page.goto(f'{base_url}/ar/services.html')
    assert page.locator('.f-lang a[hreflang="fr"]').get_attribute('href') == '../services.html'
    assert page.locator('link[hreflang="en"]').get_attribute('href').endswith('/en/services.html')

# ─── SEO / GEO, carte du hero, arabe ───────────────────────────────────
ARTICLES = ['creation-site-web-maroc.html', 'creer-boutique-en-ligne-maroc.html', 'shopify-maroc.html',
            'application-mobile-maroc.html', 'agence-web-maroc.html', 'referencement-seo-maroc.html', 'faq.html']

@pytest.mark.parametrize('name', ARTICLES)
def test_article_seo(name):
    html = open(os.path.join(SITE, name), encoding='utf-8').read()
    title = re.search(r'<title>(.*?)</title>', html, re.S).group(1)
    assert len(title) <= 70 and title.endswith('| Digilago')
    assert re.search(r'<meta name="description" content="[^"]{60,160}"', html)
    assert '<link rel="canonical" href="https://www.digilago.ma/%s">' % name in html
    assert '"FAQPage"' in html, 'FAQ absente des données structurées'
    if name != 'faq.html':
        assert '"Article"' in html and '"BreadcrumbList"' in html
    assert html.count('<details') >= 6

def test_robots_llms_sitemap():
    robots = open(os.path.join(SITE, 'robots.txt'), encoding='utf-8').read()
    for bot in ('GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'):
        assert 'User-agent: %s\nAllow: /' % bot in robots
    assert 'Sitemap: https://www.digilago.ma/sitemap.xml' in robots
    llms = open(os.path.join(SITE, 'llms.txt'), encoding='utf-8').read()
    assert llms.startswith('# Digilago') and llms.count('### ') >= 50
    sm = open(os.path.join(SITE, 'sitemap.xml'), encoding='utf-8').read()
    assert 'https://www.digilago.ma/shopify-maroc.html' in sm and 'https://digilago.ma/' not in sm

def test_carte_du_hero_dessinee(page, base_url):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(3500)
    # les deux canvas contiennent bien un dessin : le fond (tout le Maroc) et, au-dessus, les lumières
    drawn = page.evaluate("""['mcv0', 'mcv'].map(id => { const c = document.getElementById(id); const x = c.getContext('2d');
        const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
        for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) n++; return n; })""")
    assert drawn[0] > 500 and drawn[1] > 10, drawn
    # des cadres « votre-….ma — En ligne » apparaissent sur le Maroc
    page.wait_for_selector('#mwrap[data-fr*=".ma"]', timeout=9000)

def test_arabe_numeros_dans_le_bon_sens():
    html = open(os.path.join(SITE, 'ar', 'contact.html'), encoding='utf-8').read()
    assert '<bdi dir="ltr">+212 6 49 95 38 13</bdi>' in html
    assert '<bdi dir="ltr">contact@digilago.ma</bdi>' in html

def test_rappel_gratuit_envoie_une_demande(page, base_url):
    sent = []
    page.on('request', lambda r: sent.append(r.post_data) if r.url.endswith('/api/leads') and r.method == 'POST' else None)
    page.goto(f'{base_url}/services.html'); page.wait_for_timeout(800)
    form = page.locator('.cb-form').first
    form.scroll_into_view_if_needed()
    form.locator('button').click()
    assert 'err' in form.get_attribute('class'), 'un numéro est demandé'
    form.locator('input[name=n]').fill('Test')
    form.locator('input[name=p]').fill('06 12 34 56 78')
    form.locator('button').click(); page.wait_for_timeout(500)
    assert 'sent' in form.get_attribute('class')
    assert sent and '"phone":"06 12 34 56 78"' in sent[-1] and 'Rappel' in sent[-1]

def test_final_de_l_accueil(page, base_url):
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(800)
    order = page.evaluate("""(() => { const g = document.getElementById('guides'), m = document.getElementById('moment'), v = document.getElementById('vis');
        return [!!(g.compareDocumentPosition(m) & 4), !!(m.compareDocumentPosition(v) & 4)]; })()""")
    assert order == [True, True], 'le grand appel à l’action est entre les guides et « La vision »'
    assert page.locator('#moment .fin-cta .cta[href="demarrer.html"]').count() == 1

def test_metiers_ont_leur_photo(page, base_url):
    """« Tous les métiers » : les 12 cartes ont leur photo, et toutes sont chargées dès que la section approche."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(1500)
    imgs = page.locator('#metiers .mc2 .sp-ph .sp-img img')
    assert imgs.count() == 12
    assert all(a for a in imgs.evaluate_all('l => l.map(i => i.alt)')), 'chaque photo a sa description'
    top = page.evaluate("document.getElementById('metiers').getBoundingClientRect().top + scrollY")
    page.evaluate(f'window.scrollTo(0, {top})')
    page.wait_for_function("[...document.querySelectorAll('#metiers .sp-img img')].every(i => i.complete && i.naturalWidth > 0)", timeout=15000)

def test_telephone_barre_d_adresse(page, base_url):
    """Téléphone : quand la barre d'adresse se replie (l'écran grandit), le hero reste collé au bas de l'écran."""
    page.set_viewport_size({'width': 390, 'height': 764})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2000)
    page.evaluate('window.scrollTo(0, 460)'); page.wait_for_timeout(300)
    page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(500)
    bottom = page.evaluate("document.getElementById('hero').getBoundingClientRect().bottom")
    assert abs(bottom - 844) < 2, f'bande vide sous le hero : bas du hero à {bottom} px pour 844 px'

def test_telephone_la_carte_bouge_au_defilement(page, base_url):
    """Téléphone : pendant que le hero reste en place, la carte bouge (plus de zone morte)."""
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(3500)
    t0 = page.evaluate(MAP_SNAP)
    page.evaluate('window.scrollTo(0, 500)'); page.wait_for_timeout(900)
    assert page.evaluate(MAP_SNAP) != t0, 'la carte doit suivre le défilement'


# ─── Carte du hero : le voyage du Maroc vers le monde ────────────────────────────────────────────

# Empreinte du fond de la carte (canvas dessiné une fois par position de caméra) : deux positions de caméra
# identiques donnent la même empreinte.
MAP_SNAP = """(() => { const c = document.getElementById('mcv0'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h + ':' + getComputedStyle(c).transform; })()"""
# Le fond de la carte, échantillonné (pour comparer deux images à quelques nuances près : le moteur de dessin
# du navigateur peut arrondir un dégradé d'une nuance sur 255 d'un dessin à l'autre)
MAP_PIX = """(() => { const c = document.getElementById('mcv0'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const o = []; for (let i = 0; i < d.length; i += 4 * 13) o.push(d[i], d[i + 1], d[i + 2], d[i + 3]); return o; })()"""


def same_map(a, b):
    """Deux fonds de carte identiques à l'œil : aucun écart de plus de 8 nuances."""
    return len(a) == len(b) and max(abs(x - y) for x, y in zip(a, b)) <= 8


# Part du fond occupée par le bleu de la marque (le Maroc mis en valeur, vu de haut)
MAP_BRAND = """(() => { const c = document.getElementById('mcv0'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0, t = 0; for (let i = 0; i < d.length; i += 4 * 7) { t++; if (Math.abs(d[i] - 31) < 14 && Math.abs(d[i + 1] - 87) < 16 && Math.abs(d[i + 2] - 199) < 18 && d[i + 3] > 200) n++; }
    return n / t; })()"""
HERO_END = "document.getElementById('intro').offsetHeight - innerHeight * 1.75"


def test_carte_monde_projection_alignee():
    """Le monde (Natural Earth) est projeté exactement comme le Maroc de la carte : moins d'1 px d'écart."""
    import sys, json, math
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
    import hero_map as HM
    t, arcs = HM.topo(os.path.join(os.path.dirname(__file__), '..', 'src', 'geo', 'countries-50m.json'))
    pts = []
    for o in t['objects']['countries']['geometries']:
        if o.get('id') in ('504', '732'):
            pts += [HM.to_ground(lo, la) for lo, la in HM.topo_ring(arcs, o['arcs'][0])]
    ref = [tuple(map(float, p.split(','))) for p in re.findall(r'-?[\d.]+,-?[\d.]+', HM.M['outline'])]
    d = sorted(min(math.hypot(x - a, y - b) for a, b in pts) for x, y in ref)
    assert d[len(d) // 2] < 0.5 and d[-1] < 1, (d[len(d) // 2], d[-1])


@pytest.mark.parametrize('lang', ['', 'en/', 'ar/'])
def test_carte_monde_fichier_trouve(page, base_url, lang):
    """Le fichier du monde est trouvé depuis chaque langue, et il est léger."""
    page.goto(f'{base_url}/{lang}index.html')
    url = page.evaluate("new URL(document.getElementById('mgeo').dataset.world, location.href).href")
    r = page.request.get(url)
    assert r.ok and len(r.body()) < 120_000
    d = r.json()
    assert len(d['l']) > 100 and len(d['b']) > 100
    # les drapeaux des cadres : une seule petite image
    fl = page.request.get(page.evaluate("new URL(document.getElementById('mgeo').dataset.flags, location.href).href"))
    assert fl.ok and fl.body()[8:12] == b'WEBP' and len(fl.body()) < 20_000


@pytest.mark.parametrize('size', [(1440, 900), (820, 1180), (390, 844)])
def test_carte_du_maroc_au_monde(page, base_url, size):
    """Le défilement emmène la caméra du Maroc au monde (le Maroc prend la couleur de la marque),
    et la ramène exactement au Maroc quand on remonte."""
    w, h = size
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.set_viewport_size({'width': w, 'height': h})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(5500)
    start, brand0, pix0 = page.evaluate(MAP_SNAP), page.evaluate(MAP_BRAND), page.evaluate(MAP_PIX)
    end = page.evaluate(HERO_END)
    for k in range(1, 11):                      # défilement progressif, comme à la main
        page.evaluate(f'window.scrollTo(0, {end * k / 10})'); page.wait_for_timeout(120)
    page.wait_for_timeout(900)
    assert page.evaluate(MAP_SNAP) != start, 'la caméra a quitté le Maroc'
    brand1 = page.evaluate(MAP_BRAND)
    assert brand0 < 0.0003 < brand1, ('le Maroc est mis en valeur, vu de haut', brand0, brand1)
    for k in range(9, -1, -1):                  # on remonte : le voyage se fait à l'envers
        page.evaluate(f'window.scrollTo(0, {end * k / 10})'); page.wait_for_timeout(120)
    page.wait_for_timeout(900)
    assert same_map(page.evaluate(MAP_PIX), pix0), 'de retour en haut, la carte est revenue exactement sur le Maroc'
    assert not errs, errs


def test_carte_defilement_brusque(page, base_url):
    """Un défilement brusque (tout en bas du hero d'un coup, puis retour) ne casse rien et arrive au même état."""
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(5500)
    start = page.evaluate(MAP_PIX)
    end = page.evaluate(HERO_END)
    page.evaluate(f'window.scrollTo(0, {end})'); page.wait_for_timeout(1500)
    fast = page.evaluate(MAP_PIX)
    page.evaluate('window.scrollTo(0, 0)'); page.wait_for_timeout(1500)
    assert same_map(page.evaluate(MAP_PIX), start), 'retour au Maroc'
    for k in range(1, 11):
        page.evaluate(f'window.scrollTo(0, {end * k / 10})'); page.wait_for_timeout(120)
    page.wait_for_timeout(1500)
    assert same_map(page.evaluate(MAP_PIX), fast), 'même état final, quelle que soit la vitesse'
    assert not errs, errs


def test_carte_mouvement_reduit(browser, base_url):
    """Moins d'animations : la carte reste posée sur le Maroc pendant le défilement."""
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    page = ctx.new_page()
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2500)
    start = page.evaluate(MAP_SNAP)
    page.evaluate(f'window.scrollTo(0, {page.evaluate(HERO_END) * 0.9})'); page.wait_for_timeout(1200)
    assert page.evaluate(MAP_SNAP).split(':')[0] == start.split(':')[0]
    ctx.close()


def test_carte_sans_le_monde(page, base_url):
    """Si le fichier du monde n'arrive pas, la carte du Maroc reste entière, sans erreur."""
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.route('**/assets/geo-*.json', lambda route: route.abort())
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(5500)
    start = page.evaluate(MAP_PIX)
    page.evaluate(f'window.scrollTo(0, {page.evaluate(HERO_END) * 0.9})'); page.wait_for_timeout(1500)
    assert same_map(page.evaluate(MAP_PIX), start), 'la carte reste sur le Maroc'
    assert not errs, errs

# ─── Carte du hero : les cadres « votre-site — En ligne », au Maroc puis dans le monde ───────────────

FRAMES_SHOWN = "(document.getElementById('mwrap').dataset.fr || '').split(' ').filter(Boolean)"
TLD = {'ma': '.ma', 'es': '.es', 'dz': '.dz', 'tn': '.tn', 'it': '.it', 'fr': '.fr', 'sn': '.sn', 'de': '.de',
       'gb': '.co.uk', 'tr': '.com.tr', 'eg': '.eg', 'ci': '.ci', 'ae': '.ae', 'ru': '.ru', 'in': '.in',
       'ca': '.ca', 'us': '.us', 'jp': '.jp', 'br': '.com.br'}


def test_cadres_donnees():
    """Chaque cadre est un exemple (« votre-… », « your-… ») avec l'extension officielle de son pays et un vrai
    drapeau ; jamais plus de 8 cadres à la fois sur ordinateur, 4 sur téléphone."""
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
    import hero_map as HM
    HM.check_frames()
    for fr, en, flag, place, wd, wm in HM.FRAMES:
        assert fr.startswith('votre-') and en.startswith('your-'), fr
        assert fr.endswith(TLD[flag]) and en.endswith(TLD[flag]) and re.fullmatch(r'[a-z0-9.-]+', fr + en), fr
        assert os.path.exists(os.path.join(os.path.dirname(__file__), '..', 'src', 'flags', flag + '.svg'))
        assert isinstance(place, str) == (flag == 'ma'), fr
    assert sorted(HM.MA_RELAY) == sorted(f[3] for f in HM.FRAMES if f[2] == 'ma')
    lic = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'flags', 'LICENSE-flag-icons'), encoding='utf-8').read()
    assert 'MIT License' in lic
    # le drapeau du Maroc : rouge, avec l'étoile verte
    ma = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'flags', 'ma.svg'), encoding='utf-8').read()
    assert '#c1272d' in ma and '#006233' in ma
    hero = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
    hero = hero[hero.index('id="mlive"'):hero.index('id="hwash"')]
    assert 'Client Digilago' not in hero and 'Trouvé sur Google' not in hero and 'En direct' not in hero


@pytest.mark.parametrize('size,cap', [((1440, 900), 8), ((390, 844), 4)])
def test_cadres_du_maroc_au_monde(page, base_url, size, cap):
    """Au repos, des cadres « .ma » se relaient sur le Maroc ; pendant le voyage, des cadres du monde apparaissent
    (jamais plus de 8, ou 4 sur téléphone) ; à l'arrivée, le monde, sans cadre du Maroc."""
    w, h = size
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.set_viewport_size({'width': w, 'height': h})
    page.goto(f'{base_url}/index.html')
    page.wait_for_function(f"{FRAMES_SHOWN}.length > 0", timeout=9000)
    seen = set()
    full = 0
    for _ in range(12):                          # le relais : de nouveaux cadres arrivent, d'autres partent
        shown = page.evaluate(FRAMES_SHOWN)
        assert len(shown) <= cap and all(d.startswith('votre-') and d.endswith('.ma') for d in shown), shown
        full += bool(shown)
        seen |= set(shown)
        page.wait_for_timeout(500)
    assert full >= 9 and len(seen) >= 3, (full, seen)
    assert page.evaluate("getComputedStyle(document.querySelector('#mlive .ml1')).opacity") == '1'
    end = page.evaluate(HERO_END)
    for k in range(1, 31):                       # un défilement tranquille, d'une dizaine de secondes
        page.evaluate(f'window.scrollTo(0, {end * k / 30})'); page.wait_for_timeout(330)
        shown = page.evaluate(FRAMES_SHOWN)
        assert len(shown) <= cap, shown
        seen |= set(shown)
    page.wait_for_timeout(2500)
    final = page.evaluate(FRAMES_SHOWN)
    assert len(final) >= cap - 1 and not any(d.endswith('.ma') for d in final), final
    assert len({d.split('.', 1)[1] for d in seen if not d.endswith('.ma')}) >= 6, seen
    assert page.evaluate("getComputedStyle(document.querySelector('#mlive .ml2')).opacity") == '1'
    page.evaluate('window.scrollTo(0, 0)'); page.wait_for_timeout(2500)
    assert all(d.endswith('.ma') for d in page.evaluate(FRAMES_SHOWN)), 'de retour sur le Maroc'
    assert not errs, errs


@pytest.mark.parametrize('lang,prefix,online', [('en/', 'your-', 'Online'), ('ar/', 'your-', 'على الإنترنت')])
def test_cadres_traduits(page, base_url, lang, prefix, online):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/{lang}index.html')
    page.wait_for_function(f"{FRAMES_SHOWN}.length > 0", timeout=9000)
    assert all(d.startswith(prefix) for d in page.evaluate(FRAMES_SHOWN))
    assert page.evaluate("document.querySelector('#mdata b').textContent") == online


def test_cadres_mouvement_reduit(browser, base_url):
    """Moins d'animations : la carte du Maroc avec ses cadres, immobile, sans relais."""
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    page = ctx.new_page()
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2500)
    a = page.evaluate(FRAMES_SHOWN)
    page.wait_for_timeout(3000)
    assert a and a == page.evaluate(FRAMES_SHOWN) and all(d.endswith('.ma') for d in a), a
    ctx.close()


# ─── Finitions : arabe, sections de l'accueil, langue dans toutes les pages ──────────────────────────

def scroll_to(page, sel, offset=0):
    """Amène le haut de l'élément à `offset` px du haut de l'écran (la page s'allonge en route : on corrige)."""
    for _ in range(4):
        t = page.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().top")
        page.evaluate(f'window.scrollBy(0, {t - offset})'); page.wait_for_timeout(350)


@pytest.mark.parametrize('lang', ['', 'ar/'])
def test_rail_des_sections_au_bord_droit(page, base_url, lang):
    """Le rail des sections : tous les points alignés au bord droit, en français comme en arabe."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/{lang}index.html'); page.wait_for_timeout(1000)
    page.evaluate('window.scrollTo(0, 9000)'); page.wait_for_timeout(1200)
    xs = page.evaluate("[...document.querySelectorAll('#srail a i')].map(i => Math.round(i.getBoundingClientRect().right))")
    assert len(set(xs)) == 1 and 1390 < xs[0] <= 1440, xs
    lab = page.evaluate("(() => { const a = document.querySelector('#srail a.act'); return [a.querySelector('em').getBoundingClientRect().right, a.querySelector('i').getBoundingClientRect().left]; })()")
    assert lab[0] <= lab[1] + 1, 'l’étiquette est à gauche du point'


@pytest.mark.parametrize('lang', ['', 'ar/'])
def test_modeles_trois_rangees_pleines(page, base_url, lang):
    """« Nos modèles » : les trois rangées de sites remplissent la largeur de l'écran (aussi en arabe)."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/{lang}index.html'); page.wait_for_timeout(800)
    scroll_to(page, '#showcase .sw-wall', 100); page.wait_for_timeout(1500)
    cover = page.evaluate("""[...document.querySelectorAll('#showcase .sw-row')].map(r => {
        const xs = [...r.querySelectorAll('.lp')].map(l => l.getBoundingClientRect()).filter(b => b.right > 0 && b.left < innerWidth);
        return xs.length ? [Math.min(...xs.map(b => b.left)), Math.max(...xs.map(b => b.right))] : null; })""")
    assert len(cover) == 3 and all(c and c[0] < 80 and c[1] > 1360 for c in cover), cover


@pytest.mark.parametrize('size', [(1440, 900), (390, 844)])
def test_expertises_trois_onglets_empiles(page, base_url, size):
    """« Nos expertises » : en fin de défilement, 01 et 02 restent visibles en onglets au-dessus de 03."""
    page.set_viewport_size({'width': size[0], 'height': size[1]})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(800)
    scroll_to(page, '#stack')
    h = page.evaluate("document.getElementById('stack').offsetHeight")
    best = None
    for k in range(40):
        page.evaluate(f'window.scrollBy(0, {h / 40})'); page.wait_for_timeout(60)
        tops = page.evaluate("[...document.querySelectorAll('#stack .sc')].map(c => c.getBoundingClientRect().top)")
        if tops[2] - tops[1] > 20 and tops[1] - tops[0] > 20 and tops[0] >= 0 and abs(tops[2] - float(page.evaluate("parseFloat(document.querySelectorAll('#stack .sc')[2].style.top)"))) < 2:
            best = tops
            break
    assert best, 'la pile complète (01, 02 en onglets, 03 ouverte) est visible'
    # puis la pile part d'un seul bloc : les écarts entre onglets ne se referment pas
    for k in range(30):
        page.evaluate(f'window.scrollBy(0, {h / 40})'); page.wait_for_timeout(40)
        t = page.evaluate("[...document.querySelectorAll('#stack .sc')].map(c => c.getBoundingClientRect().top)")
        assert t[2] - t[1] > 15 and t[1] - t[0] > 15, t


def test_essayez_resultats_entiers(page, base_url):
    """« Essayez » : le panneau des résultats est entier dans la section (rien de coupé en bas)."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(800)
    scroll_to(page, '#sim')
    sec, card = page.evaluate("""[document.getElementById('sim').getBoundingClientRect().bottom,
        document.querySelector('#sim .simc').getBoundingClientRect().bottom]""")
    assert card + 40 < sec, (card, sec)


@pytest.mark.parametrize('lang', ['', 'en/', 'ar/'])
@pytest.mark.parametrize('size,pages', [((1440, 900), 4), ((390, 844), 5)])
def test_guides_carrousel(page, base_url, lang, size, pages):
    """« Nos guides » : cartes alignées (aucun décalage), un point par position, flèches jusqu'au bout."""
    page.set_viewport_size({'width': size[0], 'height': size[1]})
    page.goto(f'{base_url}/{lang}index.html'); page.wait_for_timeout(800)
    scroll_to(page, '#gdTrack', size[1] * 0.3); page.wait_for_timeout(900)
    assert page.evaluate("[...document.querySelectorAll('#gdDots .gd-dot')].filter(d => !d.hidden).length") == pages
    assert page.locator('#gdPrev').is_disabled()
    for k in range(pages - 1):
        page.click('#gdNext'); page.wait_for_timeout(800)
        tops = page.evaluate("[...document.querySelectorAll('#gdTrack .gd')].map(c => Math.round(c.getBoundingClientRect().top))")
        assert len(set(tops)) == 1, tops
        assert page.evaluate("[...document.querySelectorAll('#gdDots .gd-dot')].findIndex(d => d.classList.contains('on'))") == k + 1
    assert page.locator('#gdNext').is_disabled()


def test_mission_vision_titres_et_texte_automatique(page, base_url):
    """À propos : « Notre mission » et « Notre vision » en titres ; le texte s'allume seul (sans défiler)."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/ar/a-propos.html'); page.wait_for_timeout(800)
    assert page.evaluate("parseFloat(getComputedStyle(document.querySelector('.mv small')).fontSize)") > 24
    scroll_to(page, '.mv', 120)
    page.wait_for_timeout(3800)                       # aucun défilement pendant ce temps
    on, n = page.evaluate("[document.querySelectorAll('.mv .wd.on').length, document.querySelectorAll('.mv .wd').length]")
    assert n > 10 and on == n, (on, n)


@pytest.mark.parametrize('name', ['services.html', 'ar/contact.html', 'en/a-propos.html', 'index.html', 'guide-prix-site-web-maroc.html'])
def test_langue_dans_la_barre_du_haut(page, base_url, name):
    """Chaque page a le menu des langues dans sa barre du haut, qui mène à la même page dans l'autre langue."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/{name}'); page.wait_for_timeout(800)
    page.evaluate('window.scrollTo(0, 7000)'); page.wait_for_timeout(300)
    page.evaluate('window.scrollBy(0, -80)'); page.wait_for_timeout(900)   # en remontant, la barre revient
    page.click('#fnav .lsw-b'); page.wait_for_timeout(400)
    links = page.locator('#fnav .lsw-m a')
    assert links.count() == 2 and links.first.is_visible()
    base = name.split('/')[-1]
    assert all(h.endswith(base) for h in links.evaluate_all('l => l.map(a => a.getAttribute("href"))'))


# ─── Arabe : lecture de droite à gauche, sans faute d'affichage ─────────────────────────────────────

AR_PAGES = ['index.html', 'a-propos.html', 'services.html', 'demarrer.html', 'contact.html', 'faq.html',
            'guide-prix-site-web-maroc.html', 'wordpress-ou-sur-mesure-maroc.html', 'realisations.html']


@pytest.mark.parametrize('name', AR_PAGES)
def test_arabe_droite_a_gauche(page, base_url, name):
    """Chaque page arabe se lit de droite à gauche, et aucun texte arabe n'est aligné à gauche."""
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{base_url}/ar/{name}'); page.wait_for_timeout(800)
    assert page.evaluate('document.documentElement.dir') == 'rtl'
    bad = page.evaluate(r"""() => [...document.querySelectorAll('body *')].filter(e => {
        let own = ''; e.childNodes.forEach(n => { if (n.nodeType === 3) own += n.textContent; });
        if (!/[\u0600-\u06FF]/.test(own) || e.closest('[aria-hidden="true"],script,style')) return false;
        const c = getComputedStyle(e), r = e.getBoundingClientRect();
        return r.width > 60 && (c.direction === 'ltr' || c.textAlign === 'left');
      }).map(e => e.tagName + '.' + e.className + ' «' + e.textContent.trim().slice(0, 30) + '»').slice(0, 5)""")
    assert not bad, f'textes arabes de gauche à droite : {bad}'


def test_arabe_police_avec_points(page, base_url):
    """Police arabe : Noto Sans Arabic (le ي final garde ses points ; IBM Plex les retirait : « فى » pour « في »)."""
    page.goto(f'{base_url}/ar/index.html'); page.wait_for_timeout(800)
    css = page.content()
    assert 'Noto Sans Arabic' in css and 'IBM Plex Sans Arabic' not in css


def test_arabe_frise_en_miroir(page, base_url):
    """À propos : la ligne de la frise est à droite en arabe (à gauche en français)."""
    page.set_viewport_size({'width': 390, 'height': 844})
    pos = {}
    for lang in ('', 'ar/'):
        page.goto(f'{base_url}/{lang}a-propos.html'); page.wait_for_timeout(800)
        pos[lang] = page.evaluate("""(() => { const t = document.querySelector('.tl'), r = t.getBoundingClientRect(),
            b = parseFloat(getComputedStyle(t, '::before').left); return b - 0 < r.width / 2 ? 'gauche' : 'droite' })()""")
    assert pos == {'': 'gauche', 'ar/': 'droite'}, pos


def test_arabe_metiers_de_droite_a_gauche(page, base_url):
    """« Tous les métiers » en arabe : la première carte est au centre, la suivante à sa gauche."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/ar/index.html'); page.wait_for_timeout(1500)
    top = page.evaluate("document.getElementById('metiers').getBoundingClientRect().top + scrollY")
    page.evaluate(f'window.scrollTo(0, {top})'); page.wait_for_timeout(1200)
    c = page.evaluate("""[...document.querySelectorAll('#metiers .mc2')].slice(0, 2).map(e => {
        const r = e.getBoundingClientRect(); return (r.left + r.right) / 2 })""")
    assert abs(c[0] - 720) < 80 and c[1] < c[0], c


def test_arabe_etapes_demarrer(page, base_url):
    """« Démarrer » en arabe : la première étape est à droite, la dernière à gauche."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/ar/demarrer.html'); page.wait_for_timeout(800)
    x = page.evaluate("[...document.querySelectorAll('.rt-dot')].map(d => d.getBoundingClientRect().left)")
    assert x == sorted(x, reverse=True), x


# ─── Vitesse : navigation entre les pages, longueur de l'accueil ───────────────────────────────────

@pytest.mark.parametrize('name', ['index.html', 'services.html', 'ar/index.html'])
def test_pages_suivantes_chargees_d_avance(page, base_url, name):
    """Les liens du site sont préchargés (règles de spéculation) : le clic ouvre la page presque aussitôt."""
    page.goto(f'{base_url}/{name}'); page.wait_for_timeout(600)
    rules = page.evaluate("[...document.querySelectorAll('script[type=speculationrules]')].map(s => JSON.parse(s.textContent))")
    assert rules and rules[0].get('prefetch') and rules[0].get('prerender'), rules


def test_accueil_pas_trop_long_a_parcourir(page, base_url):
    """Téléphone : les sections qui épinglent l'écran restent courtes ; l'accueil se parcourt sans s'éterniser."""
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(1500)
    screens = page.evaluate('document.documentElement.scrollHeight / innerHeight')
    assert screens < 31, f'accueil de {screens:.1f} écrans'


# ─── Secteurs : tous les métiers du Maroc ───────────────────────────────
VZ_SECTORS = [p for p in PAGES if p.startswith('secteur-')]

def test_secteurs_nombre_de_pages():
    assert len(VZ_SECTORS) == 18
    assert len(VZ_TYPES) >= 180

@pytest.mark.parametrize('name', PAGES)
def test_menu_secteurs_partout(name):
    html = open(os.path.join(SITE, name), encoding='utf-8').read()
    assert '<a href="secteurs.html">Secteurs</a>' in html, 'lien « Secteurs » absent du menu'

@pytest.mark.parametrize('name', VZ_TYPES + VZ_SECTORS)
def test_secteurs_donnees_structurees(name):
    import json
    html = open(os.path.join(SITE, name), encoding='utf-8').read()
    data = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1))
    types = {g['@type'] for g in data['@graph']}
    assert {'Service', 'BreadcrumbList', 'FAQPage'} <= types, types
    service = next(g for g in data['@graph'] if g['@type'] == 'Service')
    assert len(service['areaServed']) > 20, 'villes desservies manquantes'

def test_secteurs_recherche_globale(page, base_url):
    errors = watch(page)
    page.goto(f'{base_url}/secteurs.html'); page.wait_for_timeout(800)
    page.fill('#vzHubQ', 'coffee'); page.wait_for_timeout(300)
    hrefs = page.eval_on_selector_all('#vzHubR a', 'els => els.map(e => e.getAttribute("href"))')
    assert 'site-web-coffee-shop-maroc.html' in hrefs
    assert hrefs[-1].startswith('demarrer.html?metier=')
    page.fill('#vzHubQ', 'plombier'); page.wait_for_timeout(300)
    assert page.locator('#vzHubR a').count() >= 2
    assert not errors, errors

def test_secteur_filtre_et_fenetre(page, base_url):
    errors = watch(page)
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/secteur-restauration-cafe-maroc.html'); page.wait_for_timeout(800)
    total = page.locator('.vz-card').count()
    page.click('.vz-chip[data-g="sucre"]'); page.wait_for_timeout(200)
    shown = page.locator('.vz-card:not([hidden])').count()
    assert 0 < shown < total
    page.click('.vz-chip[data-g=""]'); page.fill('.vz-find .vz-q input', 'zzzz'); page.wait_for_timeout(200)
    assert page.locator('.vz-none').is_visible()
    page.fill('.vz-find .vz-q input', ''); page.wait_for_timeout(200)
    page.click('#t-food-truck'); page.wait_for_timeout(600)
    assert page.evaluate('document.getElementById("vzDlg").open')
    assert 'metier=Food%20truck' in page.locator('.vz-dl-go').get_attribute('href')
    page.click('.vz-dl-x'); page.wait_for_timeout(300)
    assert not page.evaluate('document.getElementById("vzDlg").open')
    assert not errors, errors

def test_secteur_maquettes_et_animations(page, base_url):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/secteur-restauration-cafe-maroc.html'); page.wait_for_timeout(600)
    page.evaluate("document.querySelector('.mk-stage').scrollIntoView({block:'center'})"); page.wait_for_timeout(800)
    tabs = page.locator('.vz-tabs button')
    tabs.nth(2).click(); page.wait_for_timeout(500)
    on = page.eval_on_selector_all('.mk.on', 'els => els.map(e => e.dataset.t)')
    assert on == [tabs.nth(2).get_attribute('data-t')]
    page.evaluate("document.querySelector('.vz-g').scrollIntoView({block:'center'})")
    page.wait_for_function("document.querySelector('.vz-g').classList.contains('show')", timeout=8000)
    page.evaluate("document.querySelector('.vz-chat').scrollIntoView({block:'center'})")
    page.wait_for_function("document.querySelector('.vz-chat').classList.contains('ans')", timeout=12000)

def test_page_metier_demarrer_avec_le_metier(page, base_url):
    page.goto(f'{base_url}/site-web-coffee-shop-maroc.html'); page.wait_for_timeout(500)
    href = page.locator('.hcta a.cta').get_attribute('href')
    assert href.startswith('demarrer.html?metier=Coffee')
    page.goto(f'{base_url}/ar/site-web-coffee-shop-maroc.html'); page.wait_for_timeout(500)
    assert 'demarrer.html?metier=' in page.locator('.hcta a.cta').get_attribute('href')

@pytest.mark.parametrize('lang', ['fr', 'en', 'ar'])
def test_secteur_telephone_sans_debordement(page, base_url, lang):
    errors = watch(page)
    page.set_viewport_size({'width': 390, 'height': 844})
    pre = '' if lang == 'fr' else lang + '/'
    for name in ('secteurs.html', 'secteur-sante-medical-maroc.html', 'site-web-pediatre-maroc.html'):
        page.goto(f'{base_url}/{pre}{name}'); page.wait_for_timeout(900)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (lang, name)
    assert not errors, errors

def test_accueil_cartes_metiers_vers_secteurs():
    html = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
    links = re.findall(r'<a class="mc2-go" href="([^"]+)"', html)
    assert len(links) == 12 and all(os.path.exists(os.path.join(SITE, l)) for l in links)
    assert 'href="secteurs.html"' in html


def test_page_merci_trois_langues_hors_google():
    for pre in ('', 'en/', 'ar/'):
        h = open(os.path.join(SITE, pre + 'merci.html'), encoding='utf-8').read()
        assert '<meta name="robots" content="noindex">' in h, pre
        assert 'id="mcStamp"' in h and 'rel="canonical"' not in h
    sm = open(os.path.join(SITE, 'sitemap.xml'), encoding='utf-8').read()
    assert 'merci.html' not in sm and '404.html' not in sm, 'ni la page Merci ni la 404 dans le sitemap'
    ar = open(os.path.join(SITE, 'ar', 'merci.html'), encoding='utf-8').read()
    assert 'شكراً' in ar and 'dir="rtl"' in ar


def test_page_merci_texte_seulement(page, base_url):
    """Le prénom de l'adresse s'affiche comme du texte : jamais interprété comme du HTML."""
    page.goto(base_url + '/merci.html?n=%3Cimg%20src%3Dx%20onerror%3Dwindow.__x%3D1%3E&r=DG-1234'); page.wait_for_timeout(700)
    assert page.evaluate('window.__x') is None and page.locator('#mcName img').count() == 0
    assert page.inner_text('#mcRef') == 'DG-1234'
    page.goto(base_url + '/merci.html'); page.wait_for_timeout(500)
    assert page.locator('#mcNameRow').is_hidden() and page.locator('#mcRefRow').is_hidden()
    assert 'Le jour même' in page.inner_text('#mcWhen')


# ——— Mesure d'audience et consentement (loi 09-08) ———
def _avec_outils(page, base_url, name, ga4='G-TEST1234', gtm=''):
    """Sert la page avec des identifiants d’essai (jamais les vrais) ; Google est simulé (aucun accès réel)."""
    def rewrite(route):
        r = route.fetch()
        body = re.sub(r'data-ga4="[^"]*"', f'data-ga4="{ga4}"', r.text())
        body = re.sub(r'data-gtm="[^"]*"', f'data-gtm="{gtm}"', body)
        body = re.sub(r'data-clarity="[^"]*"', 'data-clarity=""', body)
        route.fulfill(response=r, body=body)
    page.route(f'{base_url}/{name}*', rewrite)
    page.route('https://www.googletagmanager.com/**', lambda route: route.fulfill(status=200, content_type='application/javascript', body=''))
    page.route('https://www.clarity.ms/**', lambda route: route.fulfill(status=200, content_type='application/javascript', body=''))


def test_rien_ne_part_vers_google_avant_le_choix(page, base_url):
    """Avec les vrais identifiants : le bandeau s’affiche et aucune requête ne part vers Google ou Clarity."""
    import json
    conf = json.load(open(os.path.join(os.path.dirname(SITE), 'src', 'analytics.json'), encoding='utf-8'))
    on = bool(conf['gtm'] or conf['ga4'] or conf['clarity'])
    asked = []
    page.on('request', lambda r: asked.append(r.url) if 'googletagmanager' in r.url or 'clarity.ms' in r.url else None)
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2800)
    assert not asked, asked
    assert page.locator('#dgc').is_visible() == on
    h = open(os.path.join(SITE, 'confidentialite.html'), encoding='utf-8').read()
    assert ('class="dgc-edit"' in h) == on
    if not on:
        assert 'Ce site n’utilise pas de cookies publicitaires' in h


@pytest.mark.parametrize('lang', ['fr', 'en', 'ar'])
def test_bandeau_refuser_ne_charge_rien(page, base_url, lang):
    name = 'contact.html' if lang == 'fr' else f'{lang}/contact.html'
    asked = []
    page.on('request', lambda r: asked.append(r.url) if 'googletagmanager' in r.url else None)
    _avec_outils(page, base_url, name)
    page.goto(f'{base_url}/{name}'); page.wait_for_timeout(2200)
    assert page.locator('#dgc').is_visible(), 'le bandeau s’affiche tant que le visiteur n’a pas choisi'
    assert not asked, 'rien n’est chargé avant le choix'
    assert page.locator('#dgc button').count() == 2
    txt = page.inner_text('#dgc')
    assert ('Refuser' in txt) if lang == 'fr' else ('Decline' in txt) if lang == 'en' else ('رفض' in txt), txt
    page.click('#dgc [data-c="no"]'); page.wait_for_timeout(700)
    assert page.locator('#dgc').is_hidden() and not asked
    assert page.evaluate("JSON.parse(localStorage.getItem('dg_consent')).a") == 0
    page.reload(); page.wait_for_timeout(2200)
    assert page.locator('#dgc').is_hidden() and not asked, 'le refus est mémorisé'


def test_bandeau_accepter_charge_google_et_mesure(page, base_url):
    asked = []
    page.on('request', lambda r: asked.append(r.url) if 'googletagmanager' in r.url else None)
    _avec_outils(page, base_url, 'merci.html', gtm='GTM-TEST123')
    page.goto(f'{base_url}/merci.html?f=demarrer'); page.wait_for_timeout(2200)
    assert not asked
    page.click('#dgc [data-c="yes"]'); page.wait_for_timeout(800)
    assert any('gtag/js?id=G-TEST1234' in u for u in asked), asked
    assert any('gtm.js?id=GTM-TEST123' in u for u in asked), 'Tag Manager est chargé en plus de GA4'
    assert page.evaluate("JSON.parse(localStorage.getItem('dg_consent')).a") == 1
    # le consentement n’autorise que la mesure : ni publicité, ni profilage
    consent = page.evaluate("window.dataLayer.filter(a => a[0] === 'consent').map(a => [a[1], JSON.stringify(a[2])])")
    assert consent[0][0] == 'default' and '"ad_storage":"denied"' in consent[0][1], consent
    # un clic WhatsApp est mesuré
    page.evaluate("document.querySelector('.hcta a.ghost').addEventListener('click', e => e.preventDefault())")
    page.locator('.hcta a.ghost').click(); page.wait_for_timeout(300)
    ev = page.evaluate("window.dataLayer.filter(a => a[0] === 'event').map(a => a[1])")
    assert 'click_whatsapp' in ev, ev
    # après un accord déjà donné, la page « Merci » compte la demande envoyée dès son arrivée
    page.goto(f'{base_url}/merci.html?f=demarrer'); page.wait_for_timeout(1500)
    ev = page.evaluate("window.dataLayer.filter(a => a[0] === 'event').map(a => a[1] + ':' + a[2].form)")
    assert 'generate_lead:demarrer' in ev, ev


def test_source_de_la_visite_jointe_a_la_demande(page, base_url):
    sent = []
    stub_open(page)
    lead_api(page, sent)
    page.goto(f'{base_url}/contact.html?utm_source=instagram&utm_medium=bio'); page.wait_for_timeout(1200)
    assert page.evaluate('window.dgSrc()') == ' · utm:instagram/bio'
    page.fill('#cform input[name="nom"]', 'Sara Test')
    page.click('#cform button[type="submit"]'); page.wait_for_timeout(500)
    assert sent and sent[0]['source'] == 'Formulaire de contact · utm:instagram/bio', sent


def test_politique_confidentialite_suit_les_outils():
    import importlib.util
    spec = importlib.util.spec_from_file_location('analytics_tool', os.path.join(os.path.dirname(SITE), 'tools', 'analytics.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    base = {'gtm': '', 'ga4': '', 'clarity': '', 'vercel': False}
    assert 'dgc-edit' not in m.privacy_block(base)
    b = m.privacy_block({**base, 'ga4': 'G-TEST1234', 'clarity': 'abcd1234ef'})
    assert 'Google Analytics' in b and 'Microsoft Clarity' in b and 'dgc-edit' in b and 'hors du Maroc' in b
    v = m.privacy_block({**base, 'vercel': True})
    assert 'Vercel Web Analytics' in v and 'dgc-edit' not in v, 'la mesure sans cookie n’exige pas de bandeau'
    assert m.ID_OK and not __import__('re').match(m.ID_OK['ga4'], 'UA-12345')


def test_indexnow_cle_en_ligne():
    key = open(os.path.join(os.path.dirname(SITE), 'src', 'indexnow_key.txt'), encoding='utf-8').read().strip()
    assert len(key) == 32 and open(os.path.join(SITE, key + '.txt'), encoding='utf-8').read() == key


def test_verification_search_console_dans_toutes_les_pages():
    for name in ('index.html', 'en/index.html', 'ar/index.html', 'secteurs.html', 'merci.html'):
        h = open(os.path.join(SITE, name), encoding='utf-8').read()
        head = h[:h.index('</head>')]
        assert head.count('<meta name="google-site-verification" content="HYvx4k2Wvut0rmCEfp6kXduTcaeWZMOm7UdS81qsR4s">') == 1, name
