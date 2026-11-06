// Son du jeu : tout est synthétisé (WebAudio), rien à télécharger. Musique en ré majeur, 100 BPM.
window.SND = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null, on = true, playing = false, nextT = 0, step = 0, timer = null, intensity = 0.3;
  try { on = localStorage.getItem('lago-sound') !== 'off'; } catch (e) {}
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.34; musicGain.connect(comp);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(comp);
  }
  function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, t, dur, type = 'sine', vol = 0.3, dest = sfxGain, a = 0.005) {
    if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.connect(g); g.connect(dest); env(g, t, a, vol, dur); o.start(t); o.stop(t + a + dur + 0.05); return o;
  }
  function mallet(m, t, vol = 0.22, dest = musicGain) {   // marimba : sinus + harmonique qui s'éteint vite
    tone(mtof(m), t, 0.5, 'sine', vol, dest); tone(mtof(m) * 4, t, 0.08, 'sine', vol * 0.25, dest);
  }
  function glock(m, t, vol = 0.18, dest = sfxGain) { tone(mtof(m), t, 0.9, 'sine', vol, dest); tone(mtof(m) * 2.76, t, 0.25, 'sine', vol * 0.3, dest); }
  function noise(t, dur, vol, f0 = 2000, f1 = 6000, dest = sfxGain, type = 'bandpass') {
    if (!ctx) return; const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = type;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); s.connect(f); f.connect(g); g.connect(dest);
    env(g, t, 0.01, vol, dur); s.start(t);
  }
  function kick(t, vol = 0.5) { if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); o.connect(g); g.connect(musicGain); env(g, t, 0.003, vol, 0.25); o.start(t); o.stop(t + 0.3); }
  // ------------------------------------------------------------------ musique
  const CH = [[50, 54, 57, 62], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]];   // D A Bm G
  const BEAT = 0.6, S16 = BEAT / 4;
  function schedule() {
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, ch = CH[bar];
      if (s % 2 === 0) {      // arpège en croches
        const arp = [ch[1], ch[2], ch[3], ch[2] + 12, ch[3], ch[2], ch[1] + 12, ch[3]];
        mallet(arp[(s / 2) % 8] + 12, nextT, 0.13 + 0.06 * intensity);
      }
      if (s === 0) { ch.slice(1).forEach(m => tone(mtof(m + 12), nextT, BEAT * 3.6, 'triangle', 0.035, musicGain, 0.4)); tone(mtof(ch[0] - 12), nextT, BEAT * 1.6, 'sine', 0.22, musicGain, 0.02); }
      if (s === 8) tone(mtof(ch[0] - 12 + 7), nextT, BEAT * 1.2, 'sine', 0.16, musicGain, 0.02);
      if (intensity > 0.45) { if (s === 0 || s === 8) kick(nextT, 0.32 * intensity); if (s % 4 === 2) noise(nextT, 0.04, 0.05 * intensity, 7000, 9000, musicGain, 'highpass'); }
      if (intensity > 0.75 && (s === 4 || s === 12)) noise(nextT, 0.12, 0.08, 1500, 3000, musicGain);
      if (bar === 3 && s === 12 && intensity > 0.6) [74, 78, 81].forEach((m, i) => glock(m, nextT + i * S16, 0.06, musicGain));
      nextT += S16; step++;
    }
  }
  function music(start = true) {
    init(); if (!ctx) return;
    if (start && !playing) { playing = true; nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 60); }
    if (!start && playing) { playing = false; clearInterval(timer); }
  }
  // ------------------------------------------------------------------ bruitages
  const now = () => ctx ? ctx.currentTime : 0;
  const fx = {
    tap: () => tone(880, now(), 0.06, 'sine', 0.15),
    pop: () => { const t = now(); const o = tone(520, t, 0.1, 'sine', 0.25); o && o.frequency.exponentialRampToValueAtTime(1100, t + 0.09); },
    ping: () => { const t = now(); tone(1320, t, 0.5, 'sine', 0.2); tone(1320, t + 0.16, 0.4, 'sine', 0.07); },
    sonar: () => { const t = now(); const o = tone(880, t, 0.6, 'sine', 0.12); o && o.frequency.exponentialRampToValueAtTime(840, t + 0.5); },
    miss: () => { const t = now(); tone(330, t, 0.14, 'triangle', 0.18); tone(247, t + 0.12, 0.2, 'triangle', 0.18); },
    stamp: () => { const t = now(); kick(t, 0.6); noise(t, 0.08, 0.3, 300, 2000); },
    whoosh: () => noise(now(), 0.45, 0.22, 400, 6000),
    chime: () => { const t = now(); [86, 90, 93].forEach((m, i) => glock(m, t + i * 0.06, 0.16)); },
    success: () => { const t = now(); [74, 78, 81, 86].forEach((m, i) => glock(m, t + i * 0.11, 0.22)); kick(t, 0.4); },
    star: () => { const t = now(); glock(93, t, 0.18); glock(98, t + 0.08, 0.12); },
    msg: () => { const t = now(); glock(88, t, 0.16); glock(93, t + 0.1, 0.16); },
    type: () => noise(now(), 0.03, 0.08, 2500, 6000),
    squash: () => { const t = now(); const o = tone(300, t, 0.12, 'square', 0.12); o && o.frequency.exponentialRampToValueAtTime(90, t + 0.1); },
    pour: () => noise(now(), 0.25, 0.08, 800, 1200, sfxGain, 'lowpass'),
    kickball: () => { kick(now(), 0.5); noise(now(), 0.06, 0.2, 1000, 3000); },
    goal: () => { const t = now(); noise(t, 0.8, 0.12, 800, 2400); [74, 78, 81, 86, 90].forEach((m, i) => glock(m, t + 0.1 + i * 0.07, 0.15)); },
    online: () => { const t = now(); kick(t, 0.5); [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => glock(m + 12, t + i * 0.07, 0.15)); noise(t, 1.2, 0.06, 6000, 9000); },
  };
  function play(name) { if (!on) return; init(); if (ctx && fx[name]) try { fx[name](); } catch (e) {} }
  function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); }
  function toggle() { on = !on; try { localStorage.setItem('lago-sound', on ? 'on' : 'off'); } catch (e) {} if (master) master.gain.value = on ? 0.8 : 0; return on; }
  return { unlock, music, play, setIntensity, toggle, get on() { return on; } };
})();
