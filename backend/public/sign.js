/* Signature électronique d'un devis, depuis un téléphone ou un ordinateur :
   1. qui signe, 2. code de vérification (si l'agence a réglé l'e-mail ou l'API WhatsApp), 3. signature tracée ou nom tapé.
   La signature est envoyée en PNG (fond transparent, recadrée), avec le texte d'engagement accepté. */
(function () {
  'use strict';
  var box = document.querySelector('.sg');
  if (!box || !window.fetch) return;
  var $ = function (s) { return box.querySelector(s); };
  var tok = box.getAttribute('data-token'), needCode = box.getAttribute('data-code') === '1';
  var name = $('input[name=name]'), role = $('input[name=role]'), contact = $('input[name=contact]'), code = $('input[name=code]'), ok = $('input[name=ok]');
  var codeBox = $('.sg-c'), sends = box.querySelectorAll('[data-send]'), msg = $('.sg-msg'), err = $('.sg-err'), go = $('[data-sign]'), shown = box.getAttribute('data-hash') || '';
  var pad = $('.sg-pad'), cv = pad.querySelector('canvas'), ctx = cv.getContext('2d'), hint = $('.sg-hint'), clear = $('.sg-clear');
  var INK = '#0E214E', FONT = '"Playfair Display", Georgia, serif';
  var mode = 'draw', strokes = [], cur = null, W = 0, H = 0, raf = 0;

  /* ---------- zone de signature ---------- */
  function fit() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (!r.width) return;
    if (W && r.width < W && strokes.length) { /* l'écran a rétréci (rotation) : on garde toute la signature visible */
      var k = r.width / W;
      strokes.forEach(function (s) { s.forEach(function (p) { p.x *= k; p.y *= k; p.w *= Math.max(k, 0.7); }); });
    }
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  function paint(c, k, ox, oy) {
    c.strokeStyle = c.fillStyle = INK; c.lineCap = c.lineJoin = 'round';
    strokes.forEach(function (s) {
      var P = function (p) { return { x: (p.x - ox) * k, y: (p.y - oy) * k }; };
      if (s.length === 1) { var d = P(s[0]); c.beginPath(); c.arc(d.x, d.y, s[0].w * k * 0.6, 0, 7); c.fill(); return; }
      var prev = P(s[0]);
      for (var i = 1; i < s.length; i++) {
        var a = P(s[i - 1]), b = P(s[i]), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        c.lineWidth = s[i].w * k; c.beginPath(); c.moveTo(prev.x, prev.y); c.quadraticCurveTo(a.x, a.y, m.x, m.y); c.stroke(); prev = m;
      }
      var L = P(s[s.length - 1]); c.lineWidth = s[s.length - 1].w * k; c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(L.x, L.y); c.stroke();
    });
  }
  var typed = function () { return (name.value || '').replace(/\s+/g, ' ').trim(); };
  function typedFont(c, size) { c.font = 'italic 500 ' + size + 'px ' + FONT; }
  function drawTyped(c, w, h) {
    var t = typed(); if (!t) return;
    var size = Math.min(54, h * 0.34); typedFont(c, size);
    var tw = c.measureText(t).width; if (tw > w - 48) { size = size * (w - 48) / tw; typedFont(c, size); }
    c.fillStyle = INK; c.textBaseline = 'alphabetic'; c.fillText(t, 24, h * 0.66 - 6);
  }
  function redraw() { ctx.clearRect(0, 0, W, H); if (mode === 'type') drawTyped(ctx, W, H); else paint(ctx, 1, 0, 0); }
  var later = function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; redraw(); }); };
  var hasInk = function () { return mode === 'type' ? typed().length >= 2 : strokes.length > 0; };

  function point(e) {
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, t = e.timeStamp || Date.now(), last = cur[cur.length - 1], w = 2.4;
    if (last) {
      var d = Math.sqrt((x - last.x) * (x - last.x) + (y - last.y) * (y - last.y)); if (d < 0.8) return;
      var target = e.pointerType === 'pen' && e.pressure ? 1 + e.pressure * 2.8 : Math.max(1.2, Math.min(3.4, 3.6 - (d / Math.max(1, t - last.t)) * 1.1));
      w = last.w * 0.65 + target * 0.35; /* le trait s'affine quand la main accélère, comme un stylo */
    }
    cur.push({ x: x, y: y, t: t, w: w });
  }
  cv.addEventListener('pointerdown', function (e) {
    if (mode !== 'draw' || (e.button && e.button !== 0)) return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ancien navigateur */ }
    cur = []; strokes.push(cur); point(e); pad.classList.add('on'); changed(); later();
  });
  cv.addEventListener('pointermove', function (e) {
    if (!cur) return; e.preventDefault();
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    (list && list.length ? list : [e]).forEach(point); later();
  });
  function end() { if (!cur) return; cur = null; pad.classList.remove('on'); changed(); }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  clear.addEventListener('click', function () { strokes = []; redraw(); changed(); });

  /* ---------- tracer ou taper son nom ---------- */
  function setMode(m) {
    mode = m;
    box.querySelectorAll('[data-mode]').forEach(function (b) { var on = b.getAttribute('data-mode') === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    pad.classList.toggle('typed', m === 'type');
    if (m === 'type' && document.fonts && document.fonts.load) document.fonts.load('italic 500 40px "Playfair Display"').then(redraw, redraw);
    redraw(); changed();
  }
  box.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
  name.addEventListener('input', function () { if (mode === 'type') later(); changed(); });
  if (code) code.addEventListener('input', function () { code.value = code.value.replace(/\D/g, '').slice(0, 6); changed(); });

  function changed() {
    var mark = function (k, on) { var el = box.querySelector('[data-step="' + k + '"]'); if (el) el.classList.toggle('done', !!on); };
    mark('who', typed().length >= 3); mark('code', code && /^\d{6}$/.test(code.value)); mark('ink', hasInk());
    pad.classList.toggle('has', hasInk());
    hint.textContent = mode === 'type' ? 'Votre nom s’affiche ici' : 'Signez ici';
  }

  /* ---------- image envoyée : recadrée sur le tracé, fond transparent ---------- */
  function image(k) {
    var out = document.createElement('canvas'), c, m = 10;
    if (mode === 'type') {
      var t = typed(); if (t.length < 2) return null;
      c = out.getContext('2d'); var size = 46 * k; typedFont(c, size);
      out.width = Math.ceil(c.measureText(t).width + 2 * m * k); out.height = Math.ceil(size * 1.45);
      c = out.getContext('2d'); typedFont(c, size); c.fillStyle = INK; c.textBaseline = 'alphabetic'; c.fillText(t, m * k, size * 1.05);
      return out.toDataURL('image/png');
    }
    if (!strokes.length) return null;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, len = 0;
    strokes.forEach(function (s) { s.forEach(function (p, i) {
      x0 = Math.min(x0, p.x - p.w); y0 = Math.min(y0, p.y - p.w); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.w);
      if (i) len += Math.sqrt(Math.pow(p.x - s[i - 1].x, 2) + Math.pow(p.y - s[i - 1].y, 2));
    }); });
    if (len < 40) return 'court';
    out.width = Math.ceil((x1 - x0 + 2 * m) * k); out.height = Math.ceil((y1 - y0 + 2 * m) * k);
    paint(out.getContext('2d'), k, x0 - m, y0 - m);
    return out.toDataURL('image/png');
  }

  /* ---------- messages ---------- */
  function say(t, bad) { if (!msg) return; msg.textContent = t; msg.classList.toggle('bad', !!bad); }
  function fail(t, el) {
    err.textContent = t; err.hidden = false;
    if (el === cv) { pad.classList.remove('need'); void pad.offsetWidth; pad.classList.add('need'); pad.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    else if (el) { el.focus(); }
    return false;
  }
  var json = function (r) { return r.json().catch(function () { return {}; }); };
  var post = function (url, body) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); };

  /* ---------- code de vérification : aux coordonnées du dossier (boutons), ou à l'adresse indiquée (champ) ---------- */
  function cooldown(btn, n) {
    var lab = function (b, t) { (b.firstElementChild || b).textContent = t; };
    var tick = function () {
      sends.forEach(function (b) { b.disabled = n > 0; });
      lab(btn, n > 0 ? 'Renvoyer (' + n + ' s)' : sends.length > 1 ? btn._label : 'Renvoyer le code');
      if (n-- <= 0) clearInterval(iv);
    };
    var iv = setInterval(tick, 1000); tick();
  }
  sends.forEach(function (send) {
    var span = send.firstElementChild; send._label = (span || send).textContent;
    send.addEventListener('click', function () {
      var body = {};
      if (contact) { var v = (contact.value || '').trim(); if (!v) { say('Indiquez où recevoir le code.', true); contact.focus(); return; } body.contact = v; }
      else body.via = send.getAttribute('data-via');
      sends.forEach(function (b) { b.disabled = true; }); (span || send).textContent = 'Envoi…'; say('', false);
      var undo = function () { sends.forEach(function (b) { b.disabled = false; }); (span || send).textContent = send._label; };
      post('/d/' + tok + '/code', body).then(function (r) { return json(r).then(function (j) { return { r: r, j: j }; }); }).then(function (x) {
        if (!x.r.ok || !x.j.ok) { say(x.j.error || 'Le code n’a pas pu être envoyé. Réessayez.', true); undo(); return; }
        say('Code envoyé par ' + x.j.via + ' à ' + x.j.to + '. Il est valable 10 minutes.', false);
        codeBox.hidden = false; code.focus(); cooldown(send, 30);
      }).catch(function () { say('Connexion impossible. Vérifiez votre réseau et réessayez.', true); undo(); });
    });
  });

  /* ---------- signer ---------- */
  go.addEventListener('click', function () {
    err.hidden = true;
    var nm = typed();
    if (nm.length < 3) return fail('Indiquez votre nom et prénom.', name);
    if (needCode && !/^\d{6}$/.test(code.value)) return codeBox.hidden ? fail('Recevez d’abord votre code de vérification.', sends[0]) : fail('Saisissez le code à 6 chiffres que vous avez reçu.', code);
    var img = image(2);
    if (img && img.length > 140000) img = image(1);
    if (!img) return fail(mode === 'type' ? 'Écrivez votre nom pour signer.' : 'Tracez votre signature dans le cadre.', cv);
    if (img === 'court') return fail('Votre signature est trop courte : tracez-la en entier.', cv);
    if (!ok.checked) return fail('Cochez la case d’engagement pour signer.', ok);
    var label = go.textContent; go.disabled = true; go.classList.add('busy'); go.textContent = 'Signature en cours…';
    post('/d/' + tok + '/signer', { name: nm, role: role ? role.value : '', code: code ? code.value : '', image: img, method: mode, hash: shown, ok: true })
      .then(function (r) { return json(r).then(function (j) { return { r: r, j: j }; }); }).then(function (x) {
        if (x.r.ok && x.j.ok) { go.textContent = 'Devis signé'; location.href = x.j.redirect; return; }
        fail(x.j.error || 'La signature n’a pas pu être enregistrée. Réessayez.');
        if (x.r.status === 409) setTimeout(function () { location.reload(); }, 2500);
        go.disabled = false; go.classList.remove('busy'); go.textContent = label;
      }).catch(function () { fail('Connexion impossible. Vérifiez votre réseau et réessayez.'); go.disabled = false; go.classList.remove('busy'); go.textContent = label; });
  });

  /* l'erreur affichée disparaît dès que la personne corrige */
  box.addEventListener('input', function () { err.hidden = true; });
  box.addEventListener('change', function () { err.hidden = true; });
  if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(pad);
  else window.addEventListener('resize', fit);
  fit(); changed();
})();
