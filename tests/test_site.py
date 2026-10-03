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
    """Démarrer : trois étapes (besoin, contact, lancement) ; seul le téléphone est obligatoire."""
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.goto(f'{base_url}/demarrer.html'); page.wait_for_timeout(800)
    assert page.locator('#wzCard .wz-step').count() == 3
    page.locator('#tNeeds .wtile').first.click()
    page.click('#wzNext'); page.wait_for_timeout(500)
    page.click('#wzNext'); page.wait_for_timeout(300)
    assert 'téléphone' in page.inner_text('#wzErr'), 'le téléphone est demandé'
    page.fill('#wFirst', 'Sara'); page.fill('#wTel', '0612345678')
    page.click('#wzNext'); page.wait_for_timeout(500)
    assert page.inner_text('#wzCount').strip() == '3 / 3'
    assert 'Sara, 0612345678' in page.inner_text('#recap')
    page.click('#wzNext'); page.wait_for_timeout(1500)
    assert page.evaluate("document.getElementById('wzCard').classList.contains('sent')")
    assert 'wa.me/212649953813' in page.get_attribute('#wzWa', 'href')

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
    assert page.locator('#moment .fin-go').get_attribute('href') == 'demarrer.html'

# ─── Versions anglaise et arabe ───────────────────────────────────────
LANG_PAGES = [(l, p) for l in ('en', 'ar') for p in PAGES]

@pytest.mark.parametrize('lang,name', LANG_PAGES)
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
    # une recherche en direct apparaît (la bulle qui tape, puis la fiche trouvée)
    page.wait_for_selector('#mcard.on, #mq.on', timeout=9000)

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
    assert page.locator('#moment .fin-go[href="demarrer.html"]').count() == 1

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
    t0 = page.evaluate("getComputedStyle(document.getElementById('mwrap')).transform")
    page.evaluate('window.scrollTo(0, 500)'); page.wait_for_timeout(400)
    t1 = page.evaluate("getComputedStyle(document.getElementById('mwrap')).transform")
    assert t0 != t1, 'la carte doit suivre le défilement'

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
