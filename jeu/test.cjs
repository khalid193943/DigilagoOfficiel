// Partie complète automatique : node test.cjs [fichier.html] [dossier] [scale]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const file = path.resolve(process.argv[2] || path.join(__dirname, 'dist/jeu-lago.html'));
const out = path.resolve(process.argv[3] || path.join(__dirname, 'check/play'));
const scale = +(process.argv[4] || 1);
const only = process.env.ONLY ? +process.env.ONLY : 99;   // nombre de missions à jouer
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, hasTouch: false });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('file://' + file);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await sleep(900);
  let n = 0;
  const shot = async name => { await page.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '-' + name + '.png') }); };
  const clickText = async (t, timeout = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const ok = await page.evaluate(t => { const b = [...document.querySelectorAll('button,a')].reverse().find(e => e.textContent.trim().startsWith(t) && e.offsetParent && !e.disabled); if (b) { b.click(); return true; } return false; }, t);
      if (ok) return true;
      await sleep(150);
    }
    throw new Error('bouton introuvable : ' + t);
  };
  await shot('titre');
  await clickText('Jouer'); await sleep(700); await shot('intro1');
  await clickText('Suivant'); await sleep(500); await shot('intro2');
  await clickText('Suivant'); await sleep(500); await shot('intro3');
  await clickText('Suivant'); await sleep(500);
  await clickText('C’est parti'); await sleep(900); await shot('carte');
  await clickText('Aller à Casablanca'); await sleep(900); await shot('ville-nuit');

  const C = await page.evaluate(() => window.CONTENT);
  const order = C.businesses.map(b => b.id);
  let played = 0;
  for (const id of order) {
    if (played >= only) break;
    const b = C.businesses.find(x => x.id === id);
    // évènements de la ville (partenaire, recrutement, maintenance) : on répond avec le bon choix
    for (let k = 0; k < 12; k++) {
      const d = await page.evaluate(() => { const d = document.querySelector('.dialog.show'); return d ? [...d.querySelectorAll('.choice')].map(c => c.textContent) : null; });
      if (!d) break;
      const pick = d.find(t => /par écrit|vrais projets|Parlons|rencontre|Bien vu|Oui|Continuer|Aller au quartier|Faire la mise/.test(t)) || d[0];
      if (/Aller au quartier/.test(pick) && b.district === 'medina') { await page.evaluate(() => [...document.querySelectorAll('.dialog.show .choice')].pop().click()); }
      else await page.evaluate(t => [...document.querySelectorAll('.dialog.show .choice')].find(c => c.textContent === t).click(), pick);
      await sleep(900);
      if (k === 0) await shot('evenement-' + id);
    }
    // aller au bon quartier
    const district = await page.evaluate(() => document.querySelector('.tab.on') && document.querySelector('.tab.on').textContent);
    if (b.district === 'affaires' && !/affaires/.test(district || '')) { await clickText('Quartier d’affaires'); await sleep(900); await shot('quartier-affaires'); }
    if (b.district === 'medina' && /affaires/.test(district || '')) { await clickText('La médina'); await sleep(900); }
    await page.evaluate(id => document.querySelector(`.scene.on .biz[data-id="${id}"]`).click(), id);
    await sleep(700);
    await clickText('On s’en occupe');
    await sleep(700); await shot(id + '-radar');
    for (let i = 0; i < 3; i++) { const done = await page.evaluate(() => { const b = [...document.querySelectorAll('.mg button')].find(e => e.textContent === 'Scanner'); if (!b || b.disabled) return true; b.click(); return false; }); if (done) break; await sleep(400); }
    await sleep(900); await shot(id + '-radar-trouve');
    await clickText('On y va'); await sleep(1800); await shot(id + '-tenue');
    await clickText('Au travail'); await sleep(800); await shot(id + '-metier');
    // le jeu du métier
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      const st = await page.evaluate(async (args) => {
        const { quiz } = args;
        const mg = document.querySelector('.mg'); if (!mg) return 'none';
        if ([...mg.querySelectorAll('button')].some(b => b.textContent === 'Préparer le devis')) return 'done';
        const choice = mg.querySelector('button.choice.q'); if (choice) { choice.click(); return 'q'; }
        const verser = [...mg.querySelectorAll('button')].find(b => b.textContent === 'Verser');
        if (verser) { verser.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 1500)); verser.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); return 'the'; }
        const blocks = [...mg.querySelectorAll('.block')].filter(b => b.style.visibility !== 'hidden');
        if (blocks.length && /\d\d:\d\d/.test(blocks[0].textContent)) { blocks.sort((a, b) => a.textContent.localeCompare(b.textContent))[0].click(); return 'rdv'; }
        const prod = mg.querySelector('.mg-body button[style*="inset:8%"]'); if (prod && prod.onclick) { prod.click(); return 'p'; }
        const tir = [...mg.querySelectorAll('button')].find(b => b.textContent === 'Tirer'); if (tir) { tir.click(); return 'foot'; }
        const rc = [...mg.querySelectorAll('.choice')].find(c => quiz.includes(c.textContent)); if (rc && !mg.querySelector('.choice.ok,.choice.ko')) { rc.click(); return 'r'; }
        return 'wait';
      }, { quiz: C.quizReunion.map(q => q.a) });
      if (st === 'done' || st === 'none') break;
      if (st === 'foot') await sleep(1600); else await sleep(st === 'wait' ? 200 : 120);
      if (Date.now() - t0 > 3000 && Date.now() - t0 < 3300) await shot(id + '-metier-jeu');
    }
    await sleep(300); await shot(id + '-metier-fin');
    await clickText('Préparer le devis'); await sleep(700); await shot(id + '-devis');
    for (const k of b.needs) await page.evaluate(l => [...document.querySelectorAll('.offer')].find(o => o.textContent === l).click(), C.offers[k].label);
    await sleep(200); await shot(id + '-devis-choix');
    await clickText('Écrire le devis'); await sleep(1400); await shot(id + '-devis-signe');
    await clickText('Lancer les 72 heures'); await sleep(800);
    const good = ['Bien sûr, c’est fait aujourd’hui.', 'Oui, envoyez : je les ajoute tout de suite.', 'Oui, on prévoit l’arabe dès maintenant.', 'Oui, il est déjà sur le bouton.'];
    let shotBuild = false;
    const t1 = Date.now();
    while (Date.now() - t1 < 60000) {
      const st = await page.evaluate(good => {
        const mg = document.querySelector('.mg'); if (!mg) return 'none';
        if ([...mg.querySelectorAll('button')].some(b => b.textContent === 'Mettre en ligne')) return 'done';
        const msg = [...mg.querySelectorAll('.msgbubble .choice')].find(c => good.includes(c.textContent)); if (msg && !mg.querySelector('.msgbubble .choice.ok')) { msg.click(); return 'msg'; }
        const bug = mg.querySelector('.bug'); if (bug) { bug.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return 'bug'; }
        const cur = mg.querySelector('.slot.cur'); if (cur) { const k = [...mg.querySelectorAll('.block')].find(b => b.textContent === cur.textContent); if (k) { k.click(); return 'block'; } }
        return 'wait';
      }, good);
      if (st === 'done' || st === 'none') break;
      if (!shotBuild && Date.now() - t1 > 1500) { shotBuild = true; await shot(id + '-chantier'); }
      if (st === 'msg') await shot(id + '-message');
      await sleep(st === 'block' ? 700 : 250);
    }
    await sleep(300); await shot(id + '-chantier-fin');
    await clickText('Mettre en ligne', 15000); await sleep(4200); await shot(id + '-en-ligne');
    await clickText('Retour en ville', 8000); await sleep(1400); await shot(id + '-ville');
    played++;
  }
  await sleep(1500);
  const end = await page.evaluate(() => !!document.querySelector('input.name'));
  if (end) {
    await shot('fin');
    await page.fill('input.name', 'Mon Entreprise');
    await clickText('Allumer mon entreprise'); await sleep(1200); await shot('fin-allumee');
  }
  const S = await page.evaluate(() => window.GAME.S());
  console.log(JSON.stringify(S));
  console.log('erreurs :', errors.length ? errors.join('\n') : 'aucune');
  await browser.close();
})().catch(e => { console.error('ÉCHEC', e); process.exit(1); });
