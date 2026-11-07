// Vérifie que chaque passage difficile est franchissable : node bot.cjs
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOT = `window.__bot = async (steps) => {
  const E = ENGINE, G = E.G, IN = E.IN, t0 = performance.now(), land = [], h0 = G.hearts;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const rec = () => { if (G.pl.onG) { const y = Math.round(G.pl.y), x = Math.round(G.pl.x); const l = land[land.length - 1]; if (l && l.y === y) { l.x1 = Math.min(l.x1, x); l.x2 = Math.max(l.x2, x); } else land.push({ y, x1: x, x2: x }); } };
  const wait = async f => { while (!f(G) && performance.now() - t0 < 14000) { await frame(); rec(); } };
  for (const s of steps) {
    const [op, a, b] = s;
    if (op === 'tp') { E.debug.tp(a, b); for (let i = 0; i < 20; i++) await frame(); }
    else if (op === 'hold') IN[a] = 1;
    else if (op === 'rel') IN[a] = 0;
    else if (op === 'jump') { IN.j = 1; IN.jp = 1; const e = performance.now() + (a || 450); while (performance.now() < e) { await frame(); rec(); } IN.j = 0; }
    else if (op === 'act') { IN.ap = 1; await frame(); await frame(); }
    else if (op === 'ms') { const e = performance.now() + a; while (performance.now() < e) { await frame(); rec(); } }
    else if (op === 'until') { const f = new Function('G', 'return ' + a); await wait(f); }
  }
  IN.l = IN.r = IN.j = 0;
  return { x: Math.round(G.pl.x), y: Math.round(G.pl.y), onG: G.pl.onG, lost: h0 - G.hearts, land: land.filter(l => l.x2 - l.x1 > 0 || true).map(l => l.y + '@' + l.x1 + '-' + l.x2).join(' ') };
};`;
async function part(b, idx, abil, cases) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:4190/lago/');
  await p.evaluate(([idx, abil]) => localStorage.setItem('lago-allume-le-maroc-v2', JSON.stringify({ v: 2, intro: true, lvl: 0, part: idx, cur: null, abil, maxHearts: 3, stars: {}, done: {}, name: '' })), [idx, abil]);
  await p.reload();
  for (let i = 0; i < 60; i++) { const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Continuer/.test(b.textContent)); return b && !b.disabled; }); if (ok) break; await sleep(250); }
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Continuer/.test(b.textContent)).click());
  await sleep(1500);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /parti/.test(b.textContent)).click());
  await sleep(900);
  await p.evaluate(BOT);
  for (const [name, steps, ok] of cases) {
    await p.evaluate(() => { const G = ENGINE.G; G.hearts = G.maxHearts; G.P.npcs.forEach(n => { n.done = true; n.ok = true; }); G.P.shadows.forEach(s => s.alive = false); G.hold = false; });
    const r = await p.evaluate(s => window.__bot(s), steps);
    const pass = ok(r);
    console.log((pass ? 'OK   ' : 'ÉCHEC') + ' ' + name + '  →  fin ' + r.x + ',' + r.y + ' perdu:' + r.lost + '  sols: ' + r.land);
    if (!pass) await p.screenshot({ path: 'check/bot-' + name.replace(/\W+/g, '_') + '.png' });
  }
  if (errs.length) console.log('erreurs', errs);
  await p.close();
}
(async () => {
  const b = await chromium.launch();
  const lit = id => [['until', `(ENGINE.lightShop(G.P.shops.find(s=>s.id==='${id}')), true)`]];
  await part(b, 0, ['radar'], [
    ['médina auvents', [['tp', 900, 0], ['hold', 'r'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -100'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -200'], ['rel', 'r'], ['ms', 300]], r => r.y === -250 && !r.lost],
    ['médina trou 1980', [['tp', 1850, 0], ['hold', 'r'], ['until', 'G.pl.x > 1950'], ['jump'], ['until', 'G.pl.onG'], ['rel', 'r'], ['ms', 200]], r => r.x > 2160 && !r.lost],
    ['médina secret', [...lit('derb'), ['tp', 1560, 0], ['ms', 1200], ['hold', 'r'], ['jump'], ['until', 'G.pl.onG'], ['until', 'G.pl.x > 1770'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -200'], ['until', 'G.pl.x > 1930'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -350'], ['rel', 'r'], ['ms', 300]], r => r.y === -400 && !r.lost],
    ['médina balcons', [['tp', 3000, 0], ['hold', 'r'], ['until', 'G.pl.x > 3040'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -100'], ['until', 'G.pl.x > 3200'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -200'], ['until', 'G.pl.x > 3420'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -300'], ['rel', 'r'], ['ms', 300]], r => r.y === -340 && !r.lost],
    ['médina bulle', [['tp', 4150, 0], ['hold', 'r'], ['until', 'G.pl.x > 4200'], ['jump'], ['until', 'G.pl.x > 4240'], ['rel', 'r'], ['until', 'G.pl.onG'], ['ms', 300]], r => r.y === -440 && !r.lost],
    ['médina trou 4620', [['tp', 4500, 0], ['hold', 'r'], ['until', 'G.pl.x > 4590'], ['jump'], ['until', 'G.pl.onG && G.pl.x > 4800'], ['rel', 'r']], r => r.x > 4800 && !r.lost],
  ]);
  await part(b, 1, ['radar', 'double'], [
    ['corniche trou 1500 (double saut)', [['tp', 1380, 0], ['hold', 'r'], ['until', 'G.pl.x > 1480'], ['jump'], ['until', 'G.pl.vy > -50'], ['jump'], ['until', 'G.pl.onG'], ['rel', 'r'], ['ms', 200]], r => r.x > 1820 && r.y === 0 && !r.lost],
    ['corniche trou 2700', [['tp', 2560, 0], ['hold', 'r'], ['until', 'G.pl.x > 2680'], ['jump'], ['until', 'G.pl.vy > -50'], ['jump'], ['until', 'G.pl.onG'], ['rel', 'r']], r => r.x > 3000 && !r.lost],
    ['corniche mâts', [['tp', 3700, 0], ['hold', 'r'], ['until', 'G.pl.x > 3740'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -100'], ['until', 'G.pl.x > 3960'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -250'], ['until', 'G.pl.x > 4180'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -400'], ['rel', 'r'], ['ms', 200]], r => r.y === -430 && !r.lost],
    ['corniche trou 4800', [['tp', 4700, 0], ['hold', 'r'], ['until', 'G.pl.x > 4780'], ['jump'], ['until', 'G.pl.vy > -50'], ['jump'], ['until', 'G.pl.onG && G.pl.x > 5000'], ['rel', 'r']], r => r.x > 5000 && !r.lost],
  ]);
  await part(b, 2, ['radar', 'double', 'pin'], [
    ['affaires toit + ascenseur', [['tp', 900, 0], ['hold', 'r'], ['until', 'G.pl.x > 940'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -100'], ['rel', 'r'], ['until', 'G.P.movers[0].y > -145'], ['hold', 'r'], ['until', 'G.pl.x > 1340'], ['rel', 'r'], ['until', 'G.pl.onG && G.pl.y < -400'], ['hold', 'r'], ['ms', 600], ['rel', 'r'], ['ms', 200]], r => r.y === -430 && !r.lost],
    ['affaires cage d’ascenseur', [['tp', 1400, -60], ['until', 'G.pl.onG'], ['hold', 'l'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -100'], ['rel', 'l'], ['ms', 200]], r => r.y === -140 && !r.lost],
    ['affaires trou 1900', [['tp', 1800, -430], ['hold', 'r'], ['until', 'G.pl.x > 1880'], ['jump'], ['until', 'G.pl.vy > -50'], ['jump'], ['until', 'G.pl.onG'], ['rel', 'r'], ['ms', 200]], r => r.x > 2300 && r.y === -380 && !r.lost],
    ['affaires épingles', [['tp', 3200, -250], ['hold', 'r'], ['until', 'G.pl.x > 3280'], ['jump'], ['until', 'G.pl.vy > -100'], ['act'], ['until', 'G.pl.x > 3640 && G.pl.vx > 0'], ['act'], ['ms', 120], ['until', 'G.pl.vy > -150'], ['act'], ['until', 'G.pl.x > 4000 && G.pl.vx > 0'], ['act'], ['until', 'G.pl.onG'], ['rel', 'r'], ['ms', 200]], r => r.y === -300 && r.x > 4100 && !r.lost],
    ['affaires plateforme + toit 5110', [['tp', 4560, -300], ['until', 'G.P.movers[1].x < 4670'], ['hold', 'r'], ['until', 'G.pl.x > 4610'], ['jump'], ['until', 'G.pl.onG'], ['rel', 'r'], ['until', 'G.P.movers[1].x > 4900'], ['hold', 'r'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -350'], ['rel', 'r'], ['ms', 200]], r => r.y === -380 && !r.lost],
    ['affaires montée finale', [['tp', 5330, -380], ['hold', 'r'], ['until', 'G.pl.x > 5390'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -500'], ['rel', 'r'], ['hold', 'r'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -650'], ['rel', 'r'], ['hold', 'l'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -800'], ['rel', 'l'], ['hold', 'r'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -950'], ['rel', 'r'], ['hold', 'l'], ['jump'], ['until', 'G.pl.onG && G.pl.y < -1100'], ['rel', 'l'], ['hold', 'r'], ['ms', 350], ['jump'], ['until', 'G.pl.onG && G.pl.y < -1200'], ['rel', 'r'], ['ms', 300]], r => r.y === -1250 && !r.lost],
  ]);
  await b.close();
})();
