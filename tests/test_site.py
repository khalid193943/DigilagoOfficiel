"""Tests du site en conditions réelles : chaque page, chaque lien, les parcours clés."""
import os, re, pytest
SITE = os.path.join(os.path.dirname(__file__), '..', 'site')
PAGES = sorted(p for p in os.listdir(SITE) if p.endswith('.html'))
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

@pytest.mark.parametrize('name', PAGES)
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

def test_demarrer_un_projet_envoie_sur_whatsapp(page, base_url):
    stub_open(page)
    page.goto(f'{base_url}/demarrer.html'); page.wait_for_timeout(1500)
    page.locator('#wzSec').scroll_into_view_if_needed(); page.wait_for_timeout(800)
    page.click('[data-need="Site web"]'); page.click('#wzNext')
    page.fill('#wName', 'Clinique Test'); page.click('[data-met="Santé"]'); page.click('#wzNext')
    page.click('[data-when="Le plus vite possible"]'); page.click('#wzNext')
    page.fill('#wTel', '+212 600 000 000'); page.click('#wzNext')
    page.click('#wzNext'); page.wait_for_timeout(600)
    url = page.evaluate('window.__opened[0]')
    assert url.startswith('https://wa.me/212649953813')
    assert 'Clinique%20Test' in url

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
    assert page.locator('#sheet .fsm-nav a').count() == 6
    page.click('#closeBtn'); page.wait_for_timeout(900)
    assert 'open' not in page.locator('#sheet').get_attribute('class')
    assert not errors, errors

def test_modeles_se_parcourent_au_survol(page, base_url):
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/index.html'); page.wait_for_timeout(2000)
    page.locator('#showcase').scroll_into_view_if_needed(); page.wait_for_timeout(1500)
    cards = page.locator('#showcase .scat[data-cat="medical"] .lp')
    assert cards.count() >= 14
    box = cards.nth(0).bounding_box()
    page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.wait_for_timeout(600)
    dy = page.evaluate("parseFloat(getComputedStyle(document.querySelector('#showcase .lp')).getPropertyValue('--dy'))")
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
    assert page.locator('#moment .mom-go').get_attribute('href') == 'guide-bon-moment-maroc.html'
