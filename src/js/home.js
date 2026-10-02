(function () {
  var RMZ =
      window.matchMedia &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    RM = false;
  var $ = function (id) {
    return document.getElementById(id);
  };
  function px(n, u) {
    return n * u + "px";
  }
  function css(el, o) {
    for (var k in o) el.style[k] = o[k];
  }
  var clamp01 = function (x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  };
  // Écrit un style seulement s'il change : pas de travail inutile à chaque image.
  var SR = [],
    LATE = [];
  function S(el, k, v) {
    var c = el._s;
    if (!c) {
      c = el._s = {};
      SR.push(el);
    }
    if (c[k] !== v) {
      c[k] = v;
      el.style[k] = v;
    }
  }
  // Positions mesurées une fois (au chargement, au redimensionnement),
  // jamais pendant le défilement.
  var CW = 0,
    docH = 0,
    introH = 0,
    POS = {},
    lastSY = -1,
    rafId = 0;
  function req() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
  function absBox(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, h: r.height };
  }
  var ease = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var hero = $("hero"),
    hb = $("hb"),
    hp = $("hp"),
    hcs = $("hcs");
  var CFG = {
    D: {
      W: 1440,
      navPad: 48,
      headTop: 132,
      gapHead: 22,
      titleW: 1150,
      tmax: 86,
      bw: 900,
      gapStage: 52,
    },
    M: {
      W: 390,
      navPad: 20,
      headTop: 96,
      gapHead: 14,
      titleW: 346,
      tmax: 46,
      bw: 350,
      gapStage: 34,
    },
  };
  var I = '<span class="ti">i</span>';
  var LINES = {
    D: ["On crée votre s" + I + "te web.", "Vos clients vous trouvent."],
    M: ["On crée votre s" + I + "te.", "Vos clients", "vous trouvent."],
  };
  var HOLD = 0,
    PAN = 0,
    G = {
      w: 1,
      h: 1,
      cw: 200,
      gap: 40,
      y0: 20,
      sag: 60,
      off: 0,
      last: 0,
      speed: 1,
      hover: false,
    },
    OS = 1,
    VF = 0.26,
    SATS = null,
    mode = "D",
    u = 1,
    lastKey = "",
    vh = 0,
    HH = 0,
    VH = 0,
    T = 0,
    ST = 0,
    BW = 0,
    SCR = 0,
    BAR = 0;
  function layout(force) {
    var W = document.documentElement.clientWidth,
      Hn = window.innerHeight;
    var nm = W < 760 || W / Hn < 0.78 ? "M" : "D",
      C = CFG[nm];
    var key = nm + "|" + W + (nm === "D" ? "|" + Hn : "");
    if (key !== lastKey || force) vh = Hn;
    lastKey = key;
    var H = vh;
    u = nm === "M" ? W / 390 : Math.min(W / 1440, H / 900);
    mode = nm;
    hero.dataset.mode = mode;
    document.documentElement.dataset.mode = mode;
    document.documentElement.style.setProperty("--u", u + "px");
    var nav = $("nav"),
      head = $("head");
    css(nav, {
      height: px(mode === "D" ? 92 : 72, u),
      padding: "0 " + px(C.navPad, u),
    });
    if (mode === "D") {
      css($("mark"), { width: px(20, u), height: px(25, u) });
      $("word").style.fontSize = px(22, u);
      css($("links"), { gap: px(44, u), fontSize: px(15, u) });
      $("tools").style.gap = px(12, u);
      css($("lang"), {
        width: px(38, u),
        height: px(38, u),
        fontSize: px(11.5, u),
      });
      css($("cta").children[0], { width: px(38, u), height: px(38, u) });
      css($("cta").children[1], {
        height: px(38, u),
        padding: "0 " + px(18, u),
        fontSize: px(11.5, u),
      });
      $("cta").querySelector("svg").style.width = px(15, u);
    } else {
      css($("mark"), { width: px(18, u), height: px(22, u) });
      $("word").style.fontSize = px(20, u);
      $("tools").style.gap = px(8, u);
      css($("lang"), {
        width: px(44, u),
        height: px(44, u),
        fontSize: px(11.5, u),
      });
      css($("menuBtn"), { width: px(44, u), height: px(44, u) });
      $("menuBtn").querySelector("svg").style.width = px(18, u);
    }
    css(head, {
      top: px(C.headTop, u),
      width: px(C.W, u),
      gap: px(C.gapHead, u),
      padding: mode === "M" ? "0 " + px(22, u) : "0",
    });
    var cb = mode === "M" ? 46 : 50;
    css($("cta2").children[0], { width: px(cb, u), height: px(cb, u) });
    css($("cta2").children[1], {
      height: px(cb, u),
      padding: "0 " + px(20, u),
      fontSize: px(11.5, u),
    });
    $("cta2").querySelector("svg").style.width = px(15, u);
    css($("eyebrow"), {
      fontSize: px(mode === "M" ? 12 : 13.5, u),
      maxWidth: "none",
      lineHeight: "1.3",
    });
    var h1 = $("h1");
    h1.innerHTML = LINES[mode]
      .map(function (l) {
        return '<span class="ln" aria-hidden="true">' + l + "</span>";
      })
      .join("");
    h1.style.fontSize = "100px";
    var wmax = 0;
    Array.prototype.forEach.call(h1.children, function (sp) {
      wmax = Math.max(wmax, sp.getBoundingClientRect().width);
    });
    h1.style.fontSize =
      Math.min((100 * C.titleW * u) / wmax, C.tmax * u) + "px";
    var fsz = parseFloat(h1.style.fontSize),
      sp = h1.querySelector(".ti");
    if (sp) {
      var cx2 = document.createElement("canvas").getContext("2d");
      cx2.font = "500 " + fsz + "px " + getComputedStyle(h1).fontFamily;
      var xh = cx2.measureText("x").actualBoundingBoxAscent || fsz * 0.53;
      var probe = document.createElement("span");
      probe.style.cssText =
        "display:inline-block;width:0;height:0;vertical-align:baseline";
      sp.parentNode.insertBefore(probe, sp.nextSibling);
      var r0 = sp.getBoundingClientRect(),
        base = probe.getBoundingClientRect().top;
      probe.remove();
      h1.style.setProperty(
        "--ti-clip",
        Math.max(0, r0.height - (base - xh - fsz * 0.045 - r0.top)) + "px",
      );
    }
    ST = head.offsetTop + head.offsetHeight + C.gapStage * u;
    var st = $("hstage");
    st.style.top = ST + "px";
    var Wd = document.documentElement.clientWidth,
      MH = mode === "M" ? 560 * u : Wd / 1.8,
      MW = Wd;
    var GT = (mode === "M" ? 10 : -30) * u;
    css(hb, {
      top: GT + "px",
      height: MH + "px",
      width: MW + "px",
      left: (Wd - MW) / 2 + "px",
      transformOrigin: "50% 45%",
    });
    css(hcs, { top: GT + (mode === "M" ? 40 : 64) * u + "px" });
    BW = MW;
    BAR = 0;
    SCR = MH;
    ST = ST + GT;
    HH = Math.round(Math.max(H, ST + MH * (mode === "M" ? 0.95 : 0.92)));
    VH = H;
    T = H * 0.7;
    HOLD = H * 0.75;
    MAP.layout(MW, MH, mode === "M");
    hero.style.height = HH + "px";
    hero.style.top = H - HH + "px";
    $("intro").style.height = HH + HOLD + T + "px";
    css($("dawn"), { top: HH - H + "px", height: H + "px" });
    $("dawnDot").style.top = HH - H + H * 0.46 + "px";
    layoutMore(H);
    layoutWhy(H);
    mtLayout(H);
    SR.forEach(function (e) {
      e._s = null;
    });
    SR = [];
    measure();
    hero.classList.add("ready");
  }
  function measure() {
    CW = document.documentElement.clientWidth;
    docH = document.documentElement.scrollHeight;
    introH = $("intro").offsetHeight;
    POS.story = absBox(story);
    POS.mt = absBox(mtSec);
    POS.mani = absBox(mani);
    POS.vw = absBox($("vwrap"));
    POS.rz = absBox($("rzCols"));
    POS.stack = absBox($("stack"));
    wi.top = absBox(wi).top;
    dayLayout();
    railLayout();
    lastSY = -1;
    req();
  }
  // ——— Carte du haut : le Maroc vu du ciel, qui s'allume ———
  // Dessinée en perspective dans un canvas : le pays, la grille de « l'infrastructure digitale »,
  // les autoroutes où circule la lumière et des centaines de points lumineux (chacun une entreprise
  // que ses clients trouvent en ligne). Toutes les 3,6 s, une vraie recherche fait s'allumer une
  // entreprise et sa petite fiche. Au défilement, on survole le pays vers le nord ; à la fin du hero,
  // la caméra monte dans les nuages. Les parties fixes (terre, grille, routes, noms) sont dessinées
  // une fois dans un calque mis en cache, redessiné seulement quand la caméra bouge.
  var MAP = (function () {
    var cv = $("mcv"),
      ctx = cv && cv.getContext("2d"),
      geoEl = $("mgeo");
    var none = { step: function () {}, layout: function () {} };
    if (!ctx || !geoEl) return none;
    var G = JSON.parse(geoEl.textContent),
      mq = $("mq"),
      mqt = mq.querySelector("span"),
      mcard = $("mcard"),
      RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function xy(e) {
      var p = e.getAttribute("data-xy").split(",");
      return [+p[0], +p[1]];
    }
    var LAB = [].map.call(document.querySelectorAll("#mdata i"), function (e) {
      var p = xy(e);
      return { x: p[0], y: p[1], r: +e.getAttribute("data-r"), t: e.textContent };
    });
    // le nom d'El Jadida est porté par l'étiquette du studio (« Digilago · El Jadida »)
    var HQL = "";
    LAB.forEach(function (l) {
      if (Math.abs(l.x - G.hq[0]) < 0.2 && Math.abs(l.y - G.hq[1]) < 0.2) {
        l.hq = true;
        HQL = l.t;
      }
    });
    var EV = [].map.call(
      document.querySelectorAll("#mdata template"),
      function (e) {
        var p = xy(e);
        return { x: p[0], y: p[1], el: e, q: e.content.querySelector("em").textContent };
      },
    );
    // Lumières : réparties autour des villes, toujours au même endroit (pseudo-aléatoire stable).
    var seed = 11;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    var LT = [];
    G.c.forEach(function (c) {
      var s = 0.5 + Math.sqrt(c[2]) * 0.38;
      for (var i = 0; i < c[2]; i++) {
        var a = rnd() * 6.2832,
          d = Math.sqrt(-2 * Math.log(rnd() + 1e-6)) * s * 0.6;
        LT.push({
          x: c[0] + Math.cos(a) * d,
          y: c[1] + Math.sin(a) * d,
          ph: rnd() * 6.2832,
          sp: 0.5 + rnd() * 1.5,
          g: rnd() < 0.18,
        });
      }
    });
    // Petits sprites de lumière (dessinés une fois) : bleu et or
    function sprite(c1, c2) {
      var s = document.createElement("canvas"),
        x = s.getContext("2d");
      s.width = s.height = 64;
      var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.16, c1);
      g.addColorStop(0.42, c2);
      g.addColorStop(1, "rgba(31,87,199,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return s;
    }
    var SPB = sprite("rgba(31,100,230,1)", "rgba(47,132,236,.32)"),
      SPG = sprite("rgba(255,200,80,1)", "rgba(242,178,51,.3)");
    var W = 1,
      H = 1,
      DPR = 1,
      F = 1,
      MOB = false,
      cache = document.createElement("canvas"),
      cx2 = cache.getContext("2d"),
      camKey = "",
      lastStatic = 0,
      cacheRef = null,
      cacheRefP = [0, 0],
      cacheRefD = 0;
    var cam = { x: 0, y: 0, h: 0, d: 0, c: 1, s: 0, hy: 0 };
    var P = { x: 0, y: 0, z: 0, k: 0 };
    function proj(x, y, alt) {
      var X = x - cam.x,
        D = cam.y - y,
        Hh = cam.h - (alt || 0),
        zc = D * cam.c + Hh * cam.s,
        yc = Hh * cam.c - D * cam.s;
      P.z = zc;
      if (zc < 1) return false;
      P.k = F / zc;
      P.x = W / 2 + X * P.k;
      P.y = cam.hy + yc * P.k;
      return true;
    }
    function fog(z) {
      return Math.max(0, Math.min(1, 1.55 - z / (cam.d * 1.05)));
    }
    function path(c, pts) {
      var ok = 0;
      for (var i = 0; i < pts.length; i += 2) {
        if (!proj(pts[i], pts[i + 1])) continue;
        if (ok++) c.lineTo(P.x, P.y);
        else c.moveTo(P.x, P.y);
      }
      return ok;
    }
    function layout(w, h, m) {
      MOB = m;
      DPR = Math.min(window.devicePixelRatio || 1, m ? 1.5 : 2);
      W = w;
      H = h;
      cv.width = cache.width = Math.round(w * DPR);
      cv.height = cache.height = Math.round(h * DPR);
      F = (m ? 1.05 : 0.62) * w;
      camKey = "";
      cacheRef = null;
      LBL = {};
      HQW = 0;
    }
    // La caméra : une cible au sol (tx, ty), regardée sous un angle th, à une distance R.
    function setCam(tx, ty, R, th, hy) {
      cam.c = Math.cos(th);
      cam.s = Math.sin(th);
      cam.x = tx;
      cam.y = ty + R * cam.c;
      cam.h = R * cam.s;
      cam.d = R;
      cam.hy = hy;
    }
    // Les noms de lieux : dessinés une fois (texte et halo blanc) dans une petite image, puis réutilisés.
    var LBL = {};
    function label(l, s) {
      var k = l.t + "|" + l.r + "|" + s,
        im = LBL[k];
      if (im) return im;
      var big = l.r === 3,
        sea = l.r === 0,
        fs = (sea ? 15 * (MOB ? 0.8 : 1) : (big ? 22 : l.r === 2 ? 12.5 : 10.5) * (MOB ? 0.82 : 1)) * s,
        font = sea || big
          ? "italic 500 " + fs + "px 'Playfair Display', Georgia, serif"
          : "600 " + fs + "px 'Instrument Sans', system-ui, sans-serif";
      im = document.createElement("canvas");
      var x = im.getContext("2d");
      x.font = font;
      var w = Math.ceil(x.measureText(l.t).width) + 12,
        h = Math.ceil(fs * 1.5) + 8;
      im.width = w * DPR;
      im.height = h * DPR;
      x = im.getContext("2d");
      x.scale(DPR, DPR);
      x.font = font;
      x.textAlign = "center";
      x.textBaseline = "middle";
      if (sea) x.fillStyle = "rgba(255,255,255,.7)";
      else {
        x.lineWidth = 4;
        x.lineJoin = "round";
        x.strokeStyle = "rgba(255,255,255,.9)";
        x.strokeText(l.t, w / 2, h / 2);
        x.fillStyle = big ? "#17366F" : "rgba(52,84,140,.95)";
      }
      x.fillText(l.t, w / 2, h / 2);
      im.cw = w;
      im.ch = h;
      im.dy = sea ? -h / 2 / s : big ? 14 - h / 2 / s : 10 - h / 2 / s;
      return (LBL[k] = im);
    }
    var HQW = 0;
    // une police arrivée après coup : on refait les étiquettes avec la bonne
    if (document.fonts && document.fonts.addEventListener)
      document.fonts.addEventListener("loadingdone", function () {
        LBL = {};
        HQW = 0;
        camKey = "";
      });
    function drawStatic(c) {
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      c.clearRect(0, 0, W, H);
      // la mer : un bleu un peu plus profond que le ciel, qui se fond vers le haut
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(16,70,170,0)");
      g.addColorStop(0.35, "rgba(16,70,170,.14)");
      g.addColorStop(1, "rgba(12,58,150,.3)");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // les pays voisins (Espagne, Algérie) : en retrait
      c.fillStyle = "rgba(235,243,255,.5)";
      G.a.forEach(function (pts) {
        c.beginPath();
        if (path(c, pts) > 2) {
          c.closePath();
          c.fill();
        }
      });
      // le Maroc
      c.beginPath();
      path(c, G.o);
      c.closePath();
      var lg = c.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, "rgba(226,237,253,.78)");
      lg.addColorStop(0.5, "rgba(240,246,255,.97)");
      lg.addColorStop(1, "#F7FAFF");
      c.fillStyle = lg;
      c.fill();
      c.save();
      c.clip();
      // la grille de l'infrastructure digitale (tous les 4 unités), plus marquée au premier plan
      c.lineWidth = 1;
      var GS = MOB ? 8 : 4,
        x0 = Math.floor((cam.x - 200) / GS) * GS,
        y0 = Math.floor((cam.y - cam.d * 3) / GS) * GS,
        y1 = cam.y + 10;
      for (var gx = x0; gx < cam.x + 200; gx += GS) {
        c.beginPath();
        if (path(c, [gx, y0, gx, y1]) === 2) {
          c.strokeStyle = gx % 20 === 0 ? "rgba(31,87,199,.13)" : "rgba(31,87,199,.06)";
          c.stroke();
        }
      }
      for (var gy = y0; gy < y1; gy += GS) {
        if (!proj(cam.x, gy)) continue;
        c.beginPath();
        path(c, [cam.x - 220, gy, cam.x + 220, gy]);
        c.strokeStyle = gy % 20 === 0 ? "rgba(31,87,199,.13)" : "rgba(31,87,199,.06)";
        c.stroke();
      }
      // le relief (Rif, Moyen et Haut Atlas) : des ombres douces ; puis le halo bleu des villes
      [[445, 58, 34, 1], [432, 138, 30, 0.9], [330, 228, 60, 1.1], [395, 190, 36, 0.8]].forEach(function (m) {
        if (!proj(m[0], m[1])) return;
        var rr = m[2] * P.k,
          rg = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, rr);
        rg.addColorStop(0, "rgba(64,105,180," + 0.14 * m[3] * fog(P.z) + ")");
        rg.addColorStop(1, "rgba(64,105,180,0)");
        c.fillStyle = rg;
        c.save();
        c.translate(P.x, P.y);
        c.scale(1, cam.s * 0.9 + 0.1);
        c.translate(-P.x, -P.y);
        c.fillRect(P.x - rr, P.y - rr, rr * 2, rr * 2);
        c.restore();
      });
      G.c.forEach(function (ci) {
        if (ci[2] < (MOB ? 12 : 6) || !proj(ci[0], ci[1])) return;
        var rr = (2.2 + Math.sqrt(ci[2]) * 0.75) * P.k,
          rg = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, rr);
        rg.addColorStop(0, "rgba(47,132,236," + 0.3 * fog(P.z) + ")");
        rg.addColorStop(1, "rgba(47,132,236,0)");
        c.fillStyle = rg;
        c.save();
        c.translate(P.x, P.y);
        c.scale(1, cam.s * 0.9 + 0.1);
        c.translate(-P.x, -P.y);
        c.fillRect(P.x - rr, P.y - rr, rr * 2, rr * 2);
        c.restore();
      });
      c.restore();
      // la côte et la frontière : un trait fin
      c.beginPath();
      path(c, G.o);
      c.closePath();
      c.lineWidth = 1.4;
      c.strokeStyle = "rgba(255,255,255,.95)";
      c.stroke();
      c.lineWidth = 0.8;
      c.strokeStyle = "rgba(31,87,199,.35)";
      c.stroke();
      // les autoroutes
      c.lineCap = "round";
      G.r.forEach(function (pts) {
        c.beginPath();
        path(c, pts);
        c.lineWidth = 3;
        c.strokeStyle = "rgba(255,255,255,.7)";
        c.stroke();
        c.lineWidth = 1.2;
        c.strokeStyle = "rgba(31,87,199,.32)";
        c.stroke();
      });
      // les villes : un point net
      G.c.forEach(function (ci) {
        if (!proj(ci[0], ci[1])) return;
        var a = fog(P.z);
        if (a <= 0.02) return;
        var r = ci[2] > 25 ? 3 : ci[2] > 8 ? 2.2 : 1.5;
        c.beginPath();
        c.arc(P.x, P.y, r * Math.min(1.3, P.k / 7), 0, 6.2832);
        c.fillStyle = "rgba(31,87,199," + a + ")";
        c.fill();
        c.lineWidth = 1.2;
        c.strokeStyle = "rgba(255,255,255," + a + ")";
        c.stroke();
      });
    }
    // Recherches en direct
    var evI = -1,
      evT = -1e9,
      ev = null,
      EVD = 3600;
    function pick(now, band) {
      for (var n = 0; n < EV.length; n++) {
        var e = EV[(evI + 1 + n) % EV.length];
        if (!proj(e.x, e.y)) continue;
        if (P.x > W * 0.12 && P.x < W * 0.88 && P.y > band[0] + 110 * u && P.y < band[1] - 30 * u) {
          evI = EV.indexOf(e);
          ev = e;
          evT = now;
          mcard.innerHTML = e.el.innerHTML;
          mcard.classList.toggle("cl", e.el.hasAttribute("data-cl"));
          mqt.textContent = RM ? e.q : "";
          return;
        }
      }
      ev = null;
      evT = now;
    }
    var last = 0,
      skip = false;
    function step(now, sy, PAN2, DAWN2) {
      // la bande du canvas réellement visible (le hero remonte, puis reste en place)
      var top = ST + Math.max(VH - HH, -sy),
        b0 = Math.max(H * 0.1, -top),
        b1 = Math.min(H, VH - top),
        band = [b0, b1];
      var pe = PAN2 * PAN2 * (3 - 2 * PAN2),
        t = now / 1000,
        dr = RM ? 0 : 1;
      var tx = MOB ? 336 + pe * 78 : 356 + pe * 50,
        ty = 128 - pe * 82,
        R = (MOB ? 68 : 128) * (1 + DAWN2 * 0.9),
        th = 0.66 + DAWN2 * 0.35;
      // caméra immobile au repos : le fond n'est redessiné que pendant le défilement
      setCam(tx, ty, R, th, Math.round(b0 + (b1 - b0) * 0.5));
      var key = [
        cam.x.toFixed(2),
        cam.y.toFixed(2),
        cam.h.toFixed(2),
        cam.hy.toFixed(1),
        W,
      ].join();
      // sur téléphone : 30 images par seconde suffisent pour les lumières
      if (MOB && key === camKey) {
        skip = !skip;
        if (skip) return;
      }
      // Le fond (terre, grille, routes, noms) est redessiné quand la caméra bouge, mais au plus toutes
      // les 90 ms sur téléphone (40 ms sur ordinateur) : entre deux, l'image en cache est simplement
      // décalée et agrandie pour suivre la caméra (l'œil ne voit pas la différence en mouvement).
      var tx2 = cam.x,
        ty2 = cam.y - cam.d * cam.c,
        sx = 1,
        ox = 0,
        oy = 0;
      if (key !== camKey) {
        if (now - lastStatic > (MOB ? 90 : 70) || !camKey) {
          camKey = key;
          lastStatic = now;
          drawStatic(cx2);
          cacheRef = [tx2, ty2];
        } else if (cacheRef && proj(cacheRef[0], cacheRef[1])) {
          // où se trouvent maintenant deux repères dessinés dans le cache ?
          var a1x = P.x,
            a1y = P.y;
          if (proj(cacheRef[0], cacheRef[1] - 20)) {
            var b1y = P.y,
              d0 = cacheRefD;
            sx = d0 ? Math.max(0.8, Math.min(1.25, (a1y - b1y) / d0)) : 1;
            ox = a1x - cacheRefP[0] * sx;
            oy = a1y - cacheRefP[1] * sx;
          }
        }
      }
      if (cacheRef && sx === 1 && ox === 0 && oy === 0 && key === camKey) {
        // repères du cache, mesurés juste après son dessin
        if (proj(cacheRef[0], cacheRef[1])) {
          cacheRefP = [P.x, P.y];
          if (proj(cacheRef[0], cacheRef[1] - 20)) cacheRefD = cacheRefP[1] - P.y;
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (sx === 1 && ox === 0 && oy === 0) ctx.drawImage(cache, 0, 0);
      else ctx.drawImage(cache, ox * DPR, oy * DPR, cv.width * sx, cv.height * sx);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      // les entreprises : des points qui scintillent doucement
      var i, l, a, r;
      for (i = 0; i < LT.length; i += MOB ? 2 : 1) {
        l = LT[i];
        if (!proj(l.x, l.y)) continue;
        if (P.x < -10 || P.x > W + 10 || P.y < b0 - 10 || P.y > b1 + 10) continue;
        a = fog(P.z);
        if (a <= 0.03) continue;
        a *= RM ? 0.85 : 0.55 + 0.45 * Math.sin(t * l.sp + l.ph);
        r = Math.max(3.6, Math.min(13, P.k * 1.35));
        ctx.globalAlpha = a;
        ctx.drawImage(l.g ? SPG : SPB, P.x - r, P.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      // les noms de lieux, au-dessus des lumières (petites images en cache)
      LAB.forEach(function (l) {
        if (l.hq || !proj(l.x, l.y)) return;
        var a = fog(P.z);
        if (a <= 0.02 || P.x < -80 || P.x > W + 80 || P.y < b0 - 30 || P.y > b1 + 20) return;
        var s = Math.min(1.35, Math.max(0.7, P.k / (MOB ? 4.6 : 7))),
          img = label(l, Math.round(s * 10) / 10);
        ctx.globalAlpha = a;
        ctx.drawImage(img, P.x - img.cw / 2, P.y + img.dy * s, img.cw, img.ch);
      });
      ctx.globalAlpha = 1;
      // la lumière circule sur les autoroutes
      if (!RM)
        G.r.forEach(function (pts, k) {
          var n = pts.length / 2 - 1;
          for (var j = 0; j < 2; j++) {
            var f = ((t * 0.045 + k * 0.37 + j * 0.5) % 1) * n,
              q = Math.floor(f) * 2,
              w = f % 1;
            if (!proj(pts[q] + (pts[q + 2] - pts[q]) * w, pts[q + 1] + (pts[q + 3] - pts[q + 1]) * w)) continue;
            if (P.y < b0 || P.y > b1) continue;
            r = Math.max(3, Math.min(8, P.k * 0.9));
            ctx.globalAlpha = fog(P.z);
            ctx.drawImage(SPB, P.x - r, P.y - r, r * 2, r * 2);
          }
        });
      ctx.globalAlpha = 1;
      // le studio, à El Jadida : des arcs vers tout le Maroc
      var hq = G.hq;
      G.arcs.forEach(function (d, k) {
        var dx = d[0] - hq[0],
          dy = d[1] - hq[1],
          len = Math.sqrt(dx * dx + dy * dy),
          hgt = len * 0.22,
          prog = RM ? 1 : ((t * 0.32 + k * 0.29) % 1.6) / 1.2;
        ctx.beginPath();
        var on = 0;
        for (var s = 0; s <= 24; s++) {
          var u2 = s / 24;
          if (!proj(hq[0] + dx * u2, hq[1] + dy * u2, Math.sin(Math.PI * u2) * hgt)) continue;
          if (on++) ctx.lineTo(P.x, P.y);
          else ctx.moveTo(P.x, P.y);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(31,87,199,.22)";
        ctx.stroke();
        if (prog > 0 && prog < 1) {
          var u3 = Math.min(1, prog);
          if (proj(hq[0] + dx * u3, hq[1] + dy * u3, Math.sin(Math.PI * u3) * hgt)) {
            r = Math.max(3, Math.min(7, P.k * 0.8));
            ctx.globalAlpha = Math.sin(Math.PI * u3) * fog(P.z);
            ctx.drawImage(SPG, P.x - r, P.y - r, r * 2, r * 2);
            ctx.globalAlpha = 1;
          }
        }
      });
      if (proj(hq[0], hq[1])) {
        var hx = P.x,
          hy2 = P.y,
          pk = Math.min(1.3, P.k / (MOB ? 4.6 : 7));
        for (var rr = 0; rr < 2; rr++) {
          var ph = RM ? 0.4 : (t * 0.6 + rr * 0.5) % 1;
          ctx.beginPath();
          ctx.arc(hx, hy2, (6 + ph * 26) * pk, 0, 6.2832);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(31,87,199," + 0.5 * (1 - ph) + ")";
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(hx, hy2, 5 * pk, 0, 6.2832);
        ctx.fillStyle = "#1F57C7";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = "600 " + 11 * pk + "px 'Instrument Sans', system-ui, sans-serif";
        var HQT = "Digilago" + (HQL ? " · " + HQL : "");
        if (!HQW) HQW = ctx.measureText(HQT).width / pk;
        var tw = HQW * pk + 14 * pk;
        ctx.fillStyle = "#0B1B3A";
        var bx = hx - tw - 12 * pk,
          by = hy2 - 9 * pk;
        if (bx < 8) bx = hx + 12 * pk; // pas la place à gauche : l'étiquette passe à droite
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, tw, 18 * pk, 9 * pk);
        else ctx.rect(bx, by, tw, 18 * pk);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(HQT, bx + tw / 2, by + 12.5 * pk);
      }
      // une recherche, puis l'entreprise trouvée s'allume avec sa fiche
      // dès que la caméra monte dans les nuages, la recherche et la fiche s'effacent
      if (DAWN2 > 0.03) ev = null;
      else if (now - evT > EVD) pick(now, band);
      var e = ev,
        el = now - evT;
      if (e && proj(e.x, e.y)) {
        var px = P.x,
          py = P.y;
        if (el > 900) {
          var rp = Math.min(1, (el - 900) / 900);
          for (var k2 = 0; k2 < 2; k2++) {
            var q2 = Math.min(1, rp * 1.4 - k2 * 0.3);
            if (q2 <= 0) continue;
            ctx.beginPath();
            ctx.arc(px, py, 4 + q2 * 24, 0, 6.2832);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(242,178,51," + (1 - q2) * 0.9 + ")";
            ctx.stroke();
          }
          ctx.drawImage(SPG, px - 10, py - 10, 20, 20);
          var bm = ctx.createLinearGradient(0, py - 54, 0, py);
          bm.addColorStop(0, "rgba(255,211,106,0)");
          bm.addColorStop(1, "rgba(255,211,106,.85)");
          ctx.fillStyle = bm;
          ctx.fillRect(px - 1.5, py - 54, 3, 54);
        }
        if (!RM) {
          var nq = Math.max(0, Math.min(e.q.length, Math.round((el - 150) / 38)));
          if (mqt.textContent.length !== nq) mqt.textContent = e.q.slice(0, nq);
        }
        var cw = mcard.offsetWidth || 0,
          fx = Math.max(12 - (px - cw / 2), Math.min(0, W - 12 - (px + cw / 2)));
        S(mq, "transform", "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)");
        S(mcard, "transform", "translate3d(" + (px + fx).toFixed(1) + "px," + py.toFixed(1) + "px,0)");
        if (mcard._ax !== fx) mcard.style.setProperty("--ax", (-(mcard._ax = fx)).toFixed(1) + "px");
        mq.classList.toggle("on", el > 60 && el < 1250);
        mcard.classList.toggle("on", el > 1050 && el < EVD - 250);
      } else {
        mq.classList.remove("on");
        mcard.classList.remove("on");
      }
    }
    return { step: step, layout: layout };
  })();
  var DAWN = 0;
  function mapStep(now) {
    MAP.step(now, window.scrollY, PAN, DAWN);
  }
  var mliveEl = $("mlive"),
    headEl = $("head"),
    navEl = $("nav"),
    veil = $("veil"),
    vbase = veil.querySelector(".vbase"),
    VCL = veil.querySelectorAll(".cl"),
    introEl = $("intro");
  ["hwash", "dawn", "dawnDot"].forEach(function (id) {
    if ($(id)) $(id).style.opacity = 0;
  });
  function dawnStep(sy) {
    var s0 = HH - VH + HOLD,
      p = clamp01((sy - s0) / T),
      v = (sy - s0) / (VH * 1.35),
      W = CW;
    PAN = clamp01(sy / (Math.max(0, HH - VH) + HOLD));
    DAWN = p;
    var h = 1 - clamp01(p / 0.5);
    S(headEl, "opacity", h.toFixed(3));
    S(
      headEl,
      "transform",
      "translateX(-50%) translateY(" + (-70 * u * (1 - h)).toFixed(1) + "px)",
    );
    S(navEl, "opacity", (1 - clamp01(p / 0.3)).toFixed(3));
    S(hcs, "opacity", (1 - clamp01(p / 0.35)).toFixed(3));
    if (mliveEl) S(mliveEl, "opacity", (1 - clamp01(p / 0.2)).toFixed(3));
    S(
      hb,
      "transform",
      p > 0
        ? "translate3d(0," +
            (-p * 90 * u).toFixed(1) +
            "px,0) scale(" +
            (1 + p * 0.05).toFixed(4) +
            ")"
        : "",
    );
    if (v <= 0 || v >= 1) {
      S(veil, "visibility", "hidden");
    } else {
      S(veil, "visibility", "visible");
      var rise = ease(clamp01(v / 0.45)),
        part = ease(clamp01((v - 0.58) / 0.42));
      S(
        veil,
        "transform",
        "translate3d(0," + ((1 - rise) * 105).toFixed(2) + "%,0)",
      );
      S(vbase, "opacity", (1 - clamp01((v - 0.55) / 0.2)).toFixed(3));
      VCL.forEach(function (c) {
        var sd = c.dataset.side,
          dx = sd === "l" ? -1 : sd === "r" ? 1 : 0;
        S(
          c,
          "transform",
          "translate3d(" +
            (dx * part * W * 0.7).toFixed(1) +
            "px," +
            (-part * (sd === "c" ? 0.9 : 0.35) * VH).toFixed(1) +
            "px,0) scale(" +
            (1 + part * 0.25).toFixed(4) +
            ")",
        );
        S(c, "opacity", (1 - part * 0.95).toFixed(3));
      });
    }
    S(introEl, "zIndex", v >= 0.5 ? "4" : "6");
    S(introEl, "visibility", v >= 0.5 ? "hidden" : "visible");
  }
  var why = $("why"),
    wi = $("wi"),
    wiStage = $("wiStage"),
    h2 = $("why-title");
  var WI_H = 1.2,
    I0 = null;
  var story = $("story"),
    sCur = -1;
  var DUR = [7000, 5600, 7000, 7600];
  var sBars = document.querySelectorAll("#sBars .sbar2"),
    sFills = document.querySelectorAll("#sBars i");
  function layoutWhy(H) {
    var W = document.documentElement.clientWidth,
      M = mode === "M";
    why.style.marginTop = -H - T + 0.675 * H + "px";
    wi.style.height = WI_H * H + "px";
    wiStage.style.height = H + "px";
    h2.style.transform = "none";
    h2.style.filter = "none";
    var sr = wiStage.getBoundingClientRect(),
      hr = h2.getBoundingClientRect();
    I0 = { cy: hr.top - sr.top + hr.height / 2, dotY: H * 0.46 };
    layoutStory(H, W, M);
    wi.top = wi.getBoundingClientRect().top + window.scrollY;
  }
  var ST2 = document.querySelectorAll("#stSlides .st-sl"),
    NS = ST2.length;
  function layoutStory(H, W, M) {
    story.style.height = Math.round(H * (1 + NS * 0.9)) + "px";
  }
  function typeQuery(sl) {
    var q = "dentiste el jadida";
    sl.querySelectorAll(".tq").forEach(function (t) {
      t.textContent = "";
    });
    sl.classList.remove("typed");
    var k = 0,
      iv = setInterval(function () {
        k++;
        sl.querySelectorAll(".tq").forEach(function (t) {
          t.textContent = q.slice(0, k);
        });
        if (k >= q.length) {
          clearInterval(iv);
          setTimeout(function () {
            sl.classList.add("typed");
          }, 120);
        }
      }, 34);
  }
  function setSlide(i) {
    if (i === sCur) return;
    var prev = sCur;
    sCur = i;
    ST2.forEach(function (el, k) {
      el.classList.toggle("act", k === i);
      el.classList.toggle("out", k < i);
      el.setAttribute("aria-hidden", k === i ? "false" : "true");
      if (k === i) {
        el.classList.remove("run");
        void el.offsetWidth;
        el.classList.add("run");
      }
    });
    sBars.forEach(function (b, k) {
      b.classList.toggle("on", k === i);
    });
    if (i === 0) typeQuery(ST2[0]);
  }
  function storyTop() {
    return story.getBoundingClientRect().top + window.scrollY;
  }
  function goSlide(i) {
    i = Math.max(0, Math.min(NS - 1, i));
    window.scrollTo({
      top: storyTop() + ((i + 0.35) / NS) * (story.offsetHeight - VH),
      behavior: "smooth",
    });
  }
  sFills.forEach(function (el) {
    el.style.width = "100%";
    el.style.transformOrigin = "0 50%";
  });
  function storyStep(sy) {
    var B = POS.story,
      top = B.top - sy;
    if (top + B.h < 0 || top > VH) return;
    var p = clamp01(-top / Math.max(1, B.h - VH)),
      f = p * NS,
      i = Math.min(NS - 1, Math.floor(f));
    setSlide(i);
    sFills.forEach(function (el, k) {
      S(
        el,
        "transform",
        "scaleX(" + (k < i ? 1 : k === i ? clamp01(f - i) : 0).toFixed(4) + ")",
      );
    });
  }
  sBars.forEach(function (b) {
    b.addEventListener("click", function () {
      goSlide(+b.dataset.s);
    });
  });
  var wiDot = $("wiDot"),
    qmEl = $("qm"),
    q2El = $("q2"),
    wpill = $("wpill"),
    wsub = $("wsub"),
    cueEl = $("cue");
  qmEl.style.display = "inline-block";
  function whyStep(sy) {
    if (!I0) return;
    var H = VH;
    var a = clamp01(
      (sy - (wi.top - H * 0.75)) / (H * 0.75 + (WI_H - 1) * H * 0.5),
    );
    var m = RM ? 1 : ease(clamp01(a / 0.4));
    var sc = 0.04 + 0.96 * m;
    S(
      h2,
      "transform",
      "translate3d(0," +
        ((I0.dotY - I0.cy) * (1 - m)).toFixed(1) +
        "px,0) scale(" +
        sc.toFixed(4) +
        ")",
    );
    // Flou léger seulement sur ordinateur, et seulement pendant l'apparition.
    S(
      h2,
      "filter",
      m < 0.98 && mode === "D"
        ? "blur(" + ((1 - m) * 10).toFixed(1) + "px)"
        : "none",
    );
    S(h2, "opacity", clamp01(m * 3).toFixed(3));
    S(wiDot, "opacity", (1 - clamp01((a - 0.08) / 0.2)).toFixed(3));
    S(wiDot, "transform", "scale(" + (1 + 2 * clamp01(a / 0.3)).toFixed(3) + ")");
    var qp = clamp01((a - 0.36) / 0.1);
    S(qmEl, "transform", "scale(" + (0.3 + 0.7 * ease(qp)).toFixed(3) + ")");
    S(qmEl, "opacity", qp.toFixed(3));
    var r2 = clamp01((a - 0.42) / 0.16);
    S(q2El, "clipPath", "inset(-10% " + ((1 - r2) * 100).toFixed(1) + "% -20% 0)");
    var ui = clamp01((a - 0.52) / 0.16);
    S(wpill, "opacity", ui.toFixed(3));
    S(wsub, "opacity", ui.toFixed(3));
    S(wpill, "transform", "translate3d(0," + ((1 - ui) * 10).toFixed(1) + "px,0)");
    S(wsub, "transform", "translate3d(0," + ((1 - ui) * 10).toFixed(1) + "px,0)");
    S(cueEl, "opacity", clamp01((a - 0.66) / 0.12).toFixed(3));
  }
  var mtSec = $("metiers"),
    mtTrack = $("mtTrack"),
    MC = Array.prototype.slice.call(document.querySelectorAll("#mtTrack .mc2")),
    mtCur = -1,
    mtCW = 0,
    mtGap = 0;
  function mtLayout(H) {
    if (!MC.length) return;
    mtCW = MC[0].offsetWidth;
    mtGap =
      parseFloat(
        getComputedStyle(mtTrack).columnGap || getComputedStyle(mtTrack).gap,
      ) || 0;
    mtSec.style.height =
      Math.round(H + (MC.length - 1) * (mtCW + mtGap) * 0.9) + "px";
  }
  var mtFill = $("mtFill");
  if (mtFill) mtFill.style.transformOrigin = "0 50%";
  function sxStep(sy) {
    if (!MC.length) return;
    var B = POS.mt,
      top = B.top - sy;
    if (top + B.h < 0 || top > VH) return;
    var p = clamp01(-top / Math.max(1, B.h - VH)),
      W = CW;
    var step = mtCW + mtGap,
      x = W / 2 - mtCW / 2 - p * (MC.length - 1) * step;
    S(mtTrack, "transform", "translate3d(" + x.toFixed(1) + "px,0,0)");
    var f = p * (MC.length - 1),
      i = Math.round(f);
    MC.forEach(function (c, k) {
      var d = Math.min(1, Math.abs(k - f));
      S(
        c,
        "transform",
        "scale(" +
          (1 - d * 0.08).toFixed(3) +
          ") translate3d(0," +
          (d * 14 * u).toFixed(1) +
          "px,0)",
      );
      S(c, "opacity", (1 - d * 0.35).toFixed(3));
    });
    if (mtFill) {
      S(mtFill, "width", "100%");
      S(mtFill, "transform", "scaleX(" + p.toFixed(4) + ")");
    }
    if (i !== mtCur) {
      mtCur = i;
      MC.forEach(function (c, k) {
        c.classList.toggle("on", k === i);
      });
      $("mtIdx").textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
      var nm = $("mtName"),
        t = MC[i].querySelector("h4").textContent;
      nm.classList.add("sw");
      setTimeout(function () {
        nm.textContent = t;
        nm.classList.remove("sw");
      }, 180);
    }
  }
  var TXT = [
    "Invisible",
    "Presque invisible",
    "À moitié visible",
    "Parfaitement visible",
  ];
  document.querySelectorAll(".tgl").forEach(function (t) {
    t.addEventListener("click", function () {
      var on = !t.classList.contains("on");
      t.classList.toggle("on", on);
      t.setAttribute("aria-pressed", on ? "true" : "false");
      $("so" + t.dataset.k).classList.toggle("off", !on);
      var n = document.querySelectorAll(".tgl.on").length;
      $("simFill").style.width = (n / 3) * 100 + "%";
      $("mtTxt").textContent = TXT[n];
    });
  });
  var mani = $("mani"),
    maniStage = $("maniStage"),
    mw = document.querySelectorAll("#maniT .w, #maniT .ip");
  var cards = document.querySelectorAll("#stack .sc"),
    cardH = 600;
  var vas = document.querySelectorAll("#vmap .va"),
    vds = document.querySelectorAll("#vmap .vd"),
    vchips = document.querySelectorAll("#vmap .vchip");
  function layoutMore(H) {
    var M = mode === "M";
    mani.style.height = 2.4 * H + "px";
    maniStage.style.height = H + "px";
    cardH = M ? Math.min(H - 110 * u, 760 * u) : Math.min(H - 160 * u, 640 * u);
    cards.forEach(function (c, i) {
      c.style.top = (M ? 70 : 110) * u + i * (M ? 14 : 26) * u + "px";
      c.style.height = M ? "auto" : cardH + "px";
      c.style.minHeight = M ? cardH * 0.9 + "px" : "";
    });
    (function () {
      var g = document.getElementById("giant");
      if (!g) return;
      var W = document.documentElement.clientWidth,
        pad = W < 760 ? 40 : Math.min(96, W * 0.066);
      g.style.fontSize = "100px";
      var w = g.getBoundingClientRect().width || 1;
      g.style.fontSize = (100 * (W - pad * 2)) / w + "px";
    })();
  }
  // Assombrissement des cartes empilées : un calque noir dont on change
  // l'opacité (composé par la carte graphique) au lieu d'un filtre « brightness »
  // qui repeignait toute la carte à chaque image.
  var cardDim = Array.prototype.map.call(cards, function (c) {
      var d = document.createElement("i");
      d.className = "sc-dim";
      d.setAttribute("aria-hidden", "true");
      c.appendChild(d);
      return d;
    }),
    cardTops = null,
    fnavEl0 = $("fnav"),
    vsvg = $("vstage") || $("vmap").querySelector("svg");
  function readCards(sy) {
    var B = POS.stack;
    cardTops = null;
    if (!B || B.top - sy > VH || B.top + B.h - sy < 0) return;
    cardTops = Array.prototype.map.call(cards, function (c) {
      return c.getBoundingClientRect().top;
    });
  }
  // Zoom de départ de la carte du monde : plus fort sur téléphone.
  var ZS = 1.28;
  function moreStep(sy) {
    ZS = mode === "M" ? 1.45 : 1.28;
    var H = VH;
    fnavEl0.classList.toggle("on", sy > introH - H * 0.1);
    var mt = POS.mani.top - sy;
    if (mt < H && mt + POS.mani.h > 0) {
      var pm = RM ? 1 : clamp01((-mt / (POS.mani.h - H)) * 1.15 + 0.04),
        n = Math.floor(pm * mw.length);
      if (n !== moreStep.n) {
        moreStep.n = n;
        mw.forEach(function (w, i) {
          w.classList.toggle("on", i < n);
        });
      }
    }
    if (cardTops)
      cards.forEach(function (c, i) {
        if (!cards[i + 1]) return;
        var t = clamp01(
          1 - (cardTops[i + 1] - parseFloat(cards[i + 1].style.top)) / cardH,
        );
        S(c, "transform", "scale(" + (1 - 0.05 * t).toFixed(4) + ")");
        S(cardDim[i], "opacity", (0.25 * t).toFixed(3));
      });
    var vt = POS.vw.top - sy;
    if (vt < H && vt + POS.vw.h > 0) {
      var pv = RM ? 1 : clamp01((H * 0.35 - vt) / Math.max(1, POS.vw.h - H * 0.9));
      if (vsvg)
        S(
          vsvg,
          "transform",
          "translate3d(-50%,-50%,0) scale(" +
            (ZS - (ZS - 1) * ease(pv)).toFixed(4) +
            ")",
        );
      vas.forEach(function (a, i) {
        var p = ease(clamp01((pv - 0.08 - i * 0.025) / 0.28));
        a.setAttribute("stroke-dashoffset", (1 - p).toFixed(4));
        vds[i].setAttribute("opacity", p > 0.96 ? 1 : 0);
      });
      vchips.forEach(function (c) {
        c.classList.toggle("on", pv > 0.1 + +c.dataset.t * 0.75);
      });
    }
  }
  function slugify(t) {
    return (
      t
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "votre-entreprise"
    );
  }
  function initials(t) {
    var w = t.split(/\s+/).filter(Boolean);
    return (
      (w[0] || "V")[0] + ((w[1] || w[0] || "E")[w[1] ? 0 : 1] || "")
    ).toUpperCase();
  }
  var simT = null;
  function simUpd(flash) {
    var n = $("sName").value.trim() || "Votre entreprise",
      m = $("sMet").value,
      v = $("sVil").value;
    var ml = m.charAt(0).toLowerCase() + m.slice(1);
    $("gFav").textContent = initials(n);
    $("gSite").textContent = n;
    $("gDom").textContent = slugify(n) + ".ma";
    $("gTitle").textContent = n + " | " + m + " à " + v;
    $("gDesc").textContent =
      m +
      " à " +
      v +
      ". Découvrez nos services, nos horaires et contactez-nous en un clic.";
    $("mName").textContent = n;
    $("mMeta").textContent = m + ", " + v;
    $("aQ").textContent = "Je cherche : " + ml + ", " + v + ".";
    var aA = $("aA");
    aA.textContent = "Je vous conseille ";
    var bb = document.createElement("b");
    bb.textContent = n;
    aA.appendChild(bb);
    aA.appendChild(
      document.createTextNode(
        " : présentation claire, avis clients et contact en un clic sur son site.",
      ),
    );
    if (flash)
      ["soG", "soM", "soA"].forEach(function (id, i) {
        var el = $(id);
        el.classList.remove("flash");
        void el.offsetWidth;
        setTimeout(function () {
          el.classList.add("flash");
        }, i * 90);
      });
  }
  $("sName").addEventListener("input", function () {
    clearTimeout(simT);
    simT = setTimeout(function () {
      simUpd(true);
    }, 120);
  });
  $("sMet").addEventListener("change", function () {
    simUpd(true);
  });
  $("sVil").addEventListener("change", function () {
    simUpd(true);
  });
  simUpd(false);
  // Démonstration : quand la section arrive à l'écran, un nom s'écrit tout seul et les trois
  // aperçus se construisent (seulement si le visiteur n'a encore rien tapé).
  (function () {
    var inp = $("sName"),
      sec = $("sim"),
      touched = false,
      DEMO = "Atlas Dentaire";
    if (!inp || !sec || !("IntersectionObserver" in window)) return;
    ["focus", "keydown", "pointerdown"].forEach(function (ev) {
      inp.addEventListener(ev, function () {
        touched = true;
      });
    });
    var o = new IntersectionObserver(
      function (es) {
        if (!es[0].isIntersecting) return;
        o.disconnect();
        if (touched || inp.value) return;
        $("sMet").selectedIndex = 1;
        $("sVil").selectedIndex = 1;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          inp.value = DEMO;
          simUpd(true);
          return;
        }
        var k = 0,
          iv = setInterval(function () {
            if (touched) return clearInterval(iv);
            inp.value = DEMO.slice(0, ++k);
            simUpd(k >= DEMO.length);
            if (k >= DEMO.length) clearInterval(iv);
          }, 90);
      },
      { threshold: 0.4 },
    );
    o.observe(sec);
  })();
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    document.querySelectorAll(".rv, #cmp, .ai").forEach(function (el) {
      io.observe(el);
    });
    var fo = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) $("foot").classList.add("open");
        });
      },
      { threshold: 0.35 },
    );
    fo.observe($("foot"));
  } else {
    document.querySelectorAll(".rv, #cmp").forEach(function (el) {
      el.classList.add("in");
    });
    $("foot").classList.add("open");
  }
  (function () {
    var pre = $("pre");
    if (!pre) return;
    // L'intro « 000 → 100 » : une fois par visite, et jamais sur un appareil lent
    // ou en mode économie de données (le titre s'affiche alors immédiatement).
    var seen = false;
    try {
      seen = sessionStorage.getItem("dg-intro") === "1";
      sessionStorage.setItem("dg-intro", "1");
    } catch (e) {}
    var slow =
      (navigator.connection && navigator.connection.saveData) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    if (RM || RMZ || seen || slow) {
      pre.remove();
      return;
    }
    document.documentElement.classList.add("loading");
    setTimeout(function () {
      document.documentElement.classList.remove("loading");
      if (pre.parentNode) pre.remove();
    }, 4000);
    var t0 = performance.now(),
      ready = false,
      done = false;
    (document.fonts && document.fonts.ready
      ? document.fonts.ready
      : Promise.resolve()
    ).then(function () {
      ready = true;
    });
    setTimeout(function () {
      ready = true;
    }, 700);
    function tick(now) {
      if (!pre.parentNode) return;
      var k = clamp01((now - t0) / 520);
      if (!ready) k = Math.min(k, 0.86);
      var v = Math.round(ease(k) * 100);
      $("pcn").textContent = ("00" + v).slice(-3);
      $("pl").style.width = v + "%";
      if (k >= 1 && !done) {
        done = true;
        setTimeout(function () {
          pre.classList.add("out");
          document.documentElement.classList.remove("loading");
          setTimeout(function () {
            pre.remove();
          }, 1100);
        }, 180);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
  var fine = window.matchMedia && matchMedia("(pointer:fine)").matches,
    cur = $("cur"),
    cx = -100,
    cy = -100,
    tx2 = -100,
    ty2 = -100;
  if (fine && !RM) {
    window.addEventListener(
      "pointermove",
      function (e) {
        tx2 = e.clientX;
        ty2 = e.clientY;
        curMoving = true;
        req();
        cur.classList.add("on");
        var t =
          e.target.closest &&
          e.target.closest("a, button, select, input, .mc, .wt, .band");
        cur.classList.toggle("big", !!t);
      },
      { passive: true },
    );
    document.addEventListener("pointerleave", function () {
      cur.classList.remove("on");
    });
    document
      .querySelectorAll(".cta, .wcta a, .sc a.more, .foot .wa")
      .forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.transform =
            "translate(" +
            (e.clientX - r.left - r.width / 2) * 0.22 +
            "px," +
            (e.clientY - r.top - r.height / 2) * 0.3 +
            "px)";
        });
        el.addEventListener("pointerleave", function () {
          el.style.transform = "";
        });
        el.style.transition = "transform .45s cubic-bezier(.16,1,.3,1)";
      });
  } else if (cur) cur.remove();
  var curMoving = false,
    dockTick = function () {};
  function curStep() {
    if (!fine || RM || !cur || !curMoving) return;
    cx += (tx2 - cx) * 0.2;
    cy += (ty2 - cy) * 0.2;
    cur.style.transform =
      "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
    curMoving = Math.abs(tx2 - cx) + Math.abs(ty2 - cy) > 0.3;
  }
  function addPollen(el, n) {
    if (!el || el.querySelector(":scope > .pollen")) return;
    var d = document.createElement("div");
    d.className = "pollen";
    d.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) {
      var i = document.createElement("i");
      i.style.left = (Math.random() * 98 + 1).toFixed(1) + "%";
      i.style.animationDelay = (-Math.random() * 14).toFixed(1) + "s";
      i.style.animationDuration = (9 + Math.random() * 8).toFixed(1) + "s";
      i.style.setProperty("--s", (0.5 + Math.random() * 0.9).toFixed(2));
      d.appendChild(i);
    }
    el.insertBefore(d, el.firstChild);
  }
  LATE.push(function () {
    document.querySelectorAll("#gen, #vis").forEach(function (el) {
      addPollen(el, 26);
    });
  });
  var dcEl = $("dayclock"),
    dcT = $("dcTime"),
    dcL = $("dcLab");
  function clockStep(sy) {
    if (!dcEl) return;
    var H = VH,
      doc = docH - H,
      p = doc > 0 ? Math.min(1, sy / doc) : 0;
    dcEl.classList.toggle("on", sy > HH * 0.5);
    var mins = Math.round((7 * 60 + p * 16 * 60) / 5) * 5,
      h = Math.floor(mins / 60),
      m = mins % 60;
    var txt = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    if (dcT.textContent !== txt) dcT.textContent = txt;
    var lab =
      h < 11
        ? "Le matin"
        : h < 14
          ? "Midi"
          : h < 17
            ? "L’après-midi"
            : h < 19
              ? "Le coucher du soleil"
              : h < 21
                ? "Le soir"
                : "La nuit";
    if (dcL.textContent !== lab) dcL.textContent = lab;
    dcEl.classList.toggle("dcn", h >= 19);
  }
  var DAY = [
      ["mani", "#E6F1FE", "#E3EFFD"],
      ["wi", "#E3EFFD", "#DFEDFD"],
      ["story", "#DFEDFD", "#C8DFFB"],
      ["svc", "#C8DFFB", "#B7D4F9"],
      ["metiers", "#B7D4F9", "#A6C9F6"],
      ["showcase", "#A6C9F6", "#9CC2F5"],
      ["sim", "#9CC2F5", "#4577D0"],
      ["trust", "#4577D0", "#2F5FB8"],
      ["gen", "#2A56B0", "#1F4592"],
      ["guides", "#1F4592", "#1A3D84"],
      ["moment", "#1A3D84", "#15306E"],
      ["vis", "#15306E", "#0E214E"],
    ],
    DA = [];
  function hex2(c) {
    return [
      parseInt(c.slice(1, 3), 16),
      parseInt(c.slice(3, 5), 16),
      parseInt(c.slice(5, 7), 16),
    ];
  }
  function dayLayout() {
    DA = [];
    DAY.forEach(function (d, i) {
      var el = $(d[0]);
      if (!el) return;
      var top = el.getBoundingClientRect().top + window.scrollY,
        bot = top + el.offsetHeight;
      DA.push([top, hex2(d[1])]);
      DA.push([bot, hex2(d[2])]);
    });
    DA.sort(function (a, b) {
      return a[0] - b[0];
    });
  }
  var daybg = $("daybg"),
    dayclouds = $("dayclouds"),
    DAYC = [255, 255, 255];
  function dayStep(sy) {
    if (!DA.length) return;
    var y = sy + VH * 0.55,
      c = DA[0][1];
    if (y >= DA[DA.length - 1][0]) c = DA[DA.length - 1][1];
    else
      for (var i = 0; i < DA.length - 1; i++) {
        if (y >= DA[i][0] && y < DA[i + 1][0]) {
          var k = (y - DA[i][0]) / Math.max(1, DA[i + 1][0] - DA[i][0]);
          c = [0, 1, 2].map(function (j) {
            return Math.round(
              DA[i][1][j] + (DA[i + 1][1][j] - DA[i][1][j]) * k,
            );
          });
          break;
        }
      }
    DAYC = c;
    S(daybg, "backgroundColor", "rgb(" + c.join(",") + ")");
    cloudsStep(sy, c);
  }
  var DCL = document.querySelectorAll("#dayclouds .cl");
  // « translate » se compose avec l'animation de dérive (transform) des nuages
  // et ne déclenche ni mise en page ni décalage visuel (CLS).
  function cloudsStep(sy, rgb) {
    var H = VH,
      span = H * 1.9;
    DCL.forEach(function (c) {
      var y =
        ((((+c.dataset.y * H - sy * +c.dataset.f) % span) + span) % span) -
        H * 0.45;
      S(c, "translate", "0 " + y.toFixed(1) + "px");
    });
    var L = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    S(dayclouds, "opacity", Math.max(0, Math.min(1, (L - 0.42) / 0.3)).toFixed(3));
  }
  var fnavEl = $("fnav"),
    rail = $("srail"),
    lastY = window.scrollY,
    accY = 0,
    RA = Array.prototype.slice.call(rail.querySelectorAll("a")),
    RT = [];
  function railLayout() {
    RT = RA.map(function (a) {
      var el = $(a.dataset.t);
      return el ? el.getBoundingClientRect().top + window.scrollY : 1e9;
    });
  }
  RA.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var el = $(a.dataset.t);
      if (!el) return;
      var y =
        el.getBoundingClientRect().top +
        window.scrollY +
        (a.dataset.t === "story" ? VH * 0.15 : 0);
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });
  function navStep(y) {
    var d = y - lastY;
    lastY = y;
    accY = d > 0 === accY > 0 ? accY + d : d;
    if (accY > 40 && y > HH + VH) fnavEl.classList.add("away");
    if (accY < -24 || y < HH + VH) fnavEl.classList.remove("away");
    rail.classList.toggle("on", y > HH + T * 0.5);
    var mid = y + VH * 0.45,
      act = -1;
    for (var i = 0; i < RT.length; i++) if (RT[i] <= mid) act = i;
    if (act !== navStep.act) {
      navStep.act = act;
      RA.forEach(function (a, i) {
        a.classList.toggle("act", i === act);
      });
    }
    var bg = DAYC,
      L = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
    rail.classList.toggle("dk", L < 0.45 || act >= RA.length - 1);
  }
  var RZ = document.querySelectorAll("#rzCols .rz-col");
  function rzStep(sy) {
    if (!RZ.length || mode === "M" || !POS.rz) return;
    var top = POS.rz.top - sy,
      h = POS.rz.h;
    if (top + h < -200 || top > VH + 200) return;
    var c = top + h / 2 - VH / 2;
    RZ.forEach(function (col) {
      S(col, "transform", "translate3d(0," + (c * +col.dataset.k).toFixed(1) + "px,0)");
    });
  }
  var gdT = $("gdTrack"),
    gdD = document.querySelectorAll("#gdDots .gd-dot");
  if (gdT) {
    var gdStep = function () {
      var c = gdT.querySelector(".gd");
      return c
        ? c.offsetWidth + parseFloat(getComputedStyle(gdT).columnGap || 0)
        : 300;
    };
    var gdSync = function () {
      var i = Math.round(gdT.scrollLeft / gdStep());
      gdD.forEach(function (d, k) {
        d.classList.toggle("on", k === i);
      });
      $("gdPrev").disabled = gdT.scrollLeft < 8;
      $("gdNext").disabled =
        gdT.scrollLeft > gdT.scrollWidth - gdT.clientWidth - 8;
    };
    $("gdPrev").addEventListener("click", function () {
      gdT.scrollBy({ left: -gdStep(), behavior: "smooth" });
    });
    $("gdNext").addEventListener("click", function () {
      gdT.scrollBy({ left: gdStep(), behavior: "smooth" });
    });
    gdD.forEach(function (d, k) {
      d.addEventListener("click", function () {
        gdT.scrollTo({ left: k * gdStep(), behavior: "smooth" });
      });
    });
    gdT.addEventListener(
      "scroll",
      function () {
        requestAnimationFrame(gdSync);
      },
      { passive: true },
    );
    gdSync();
  }
  (function () {
    var d = document.getElementById("dock");
    if (!d) return;
    var here = location.pathname.split("/").pop() || "index.html";
    d.querySelectorAll("a[data-p]").forEach(function (a) {
      if (a.dataset.p === here) a.classList.add("cur");
    });
    // Appelé par la boucle principale : pas de lecture de position en plus.
    dockTick = function (y) {
      d.classList.toggle("on", y > VH * 0.9);
    };
  })();
  // Préparé après le premier affichage : le haut de page s'affiche d'abord.
  LATE.push(function () {
    document.querySelectorAll(".scat").forEach(function (cat) {
      var wrap = cat.querySelector(".sc-wrap"),
        row = cat.querySelector(".sc-row");
      if (!row) return;
      var items = Array.prototype.slice.call(row.children),
        W = window.innerWidth,
        reps = 1;
      var setW =
        items.reduce(function (s, el) {
          return s + el.getBoundingClientRect().width;
        }, 0) || items.length * 360;
      while ((reps + 1) * setW < W * 1.6) reps++;
      for (var r = 1; r < reps; r++)
        items.forEach(function (el) {
          row.appendChild(el.cloneNode(true));
        });
      Array.prototype.slice.call(row.children).forEach(function (el) {
        var c = el.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        c.removeAttribute("tabindex");
        row.appendChild(c);
      });
      row.style.setProperty(
        "--dur",
        Math.max(40, row.children.length * 4.2) + "s",
      );
      var btn = cat.querySelector(".sc-play");
      if (btn)
        btn.addEventListener("click", function () {
          var p = btn.getAttribute("aria-pressed") !== "true";
          btn.setAttribute("aria-pressed", p);
          btn.setAttribute(
            "aria-label",
            p ? "Relancer le défilement" : "Mettre en pause le défilement",
          );
          wrap.classList.toggle("paused", p);
        });
      function measure(lp) {
        var img = lp.querySelector("img"),
          view = lp.querySelector(".lp-view");
        if (!img || !view) return;
        var dy = Math.max(
          0,
          img.getBoundingClientRect().height - view.clientHeight,
        );
        lp.style.setProperty("--dy", dy + "px");
        lp.style.setProperty(
          "--t",
          Math.max(2.5, Math.min(14, dy / 420)) + "s",
        );
      }
      row.querySelectorAll(".lp").forEach(function (lp) {
        var img = lp.querySelector("img");
        if (img) {
          if (img.complete) measure(lp);
          else
            img.addEventListener("load", function () {
              measure(lp);
            });
        }
        lp.addEventListener("click", function () {
          var on = !lp.classList.contains("on");
          row.querySelectorAll(".lp.on").forEach(function (x) {
            x.classList.remove("on");
          });
          lp.classList.toggle("on", on);
          wrap.classList.toggle("hold", on);
        });
      });
      window.addEventListener("resize", function () {
        row.querySelectorAll(".lp").forEach(measure);
      });
    });
  });
  (function () {
    var vids = function () {
      return document.querySelectorAll(".lpv video");
    };
    if (!("IntersectionObserver" in window)) {
      vids().forEach(function (v) {
        v.play().catch(function () {});
      });
      return;
    }
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          var v = en.target;
          if (en.isIntersecting) {
            v.play().catch(function () {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.2 },
    );
    setTimeout(function () {
      vids().forEach(function (v) {
        v.muted = true;
        io.observe(v);
      });
    }, 300);
  })();
  (function () {
    var m = document.getElementById("moment");
    if (!m) return;
    if (!("IntersectionObserver" in window)) {
      m.classList.add("go");
      return;
    }
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) {
            m.classList.add("go");
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 },
    );
    io.observe(m);
  })();
  /* mur des réalisations : un seul bouton met les trois rangées en pause */
  document.querySelectorAll(".sw-play").forEach(function (b) {
    b.addEventListener("click", function () {
      var p = b.getAttribute("aria-pressed") !== "true",
        w = b.closest(".sw-wall");
      b.setAttribute("aria-pressed", p ? "true" : "false");
      b.setAttribute("aria-label", p ? "Relancer le défilement" : "Mettre en pause le défilement");
      if (w) w.classList.toggle("paused", p);
    });
  });
  LATE.push(function () {
    var r = document.getElementById("lgRow");
    if (!r) return;
    var items = Array.prototype.slice.call(r.children);
    var W = window.innerWidth * 1.4,
      w = r.scrollWidth || 1,
      n = Math.max(1, Math.ceil(W / w));
    for (var k = 1; k < n; k++)
      items.forEach(function (el) {
        r.appendChild(el.cloneNode(true));
      });
    Array.prototype.slice.call(r.children).forEach(function (el) {
      var c = el.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      r.appendChild(c);
    });
  });
  // Boucle principale : elle ne tourne que lorsqu'il y a quelque chose à faire
  // (défilement, souris, ou carte du haut visible). Au repos : zéro travail.
  function frame(now) {
    rafId = 0;
    var sy = window.scrollY,
      heroOn = sy <= HH + T && !document.hidden;
    // 1) lectures (avant toute écriture)
    var moved = sy !== lastSY;
    if (moved) readCards(sy);
    // 2) écritures
    if (heroOn) mapStep(now);
    if (moved) {
      lastSY = sy;
      dawnStep(sy);
      whyStep(sy);
      storyStep(sy);
      moreStep(sy);
      clockStep(sy);
      navStep(sy);
      rzStep(sy);
      dayStep(sy);
      sxStep(sy);
      dockTick(sy);
    }
    curStep();
    if (heroOn || curMoving) req();
  }
  window.addEventListener("scroll", req, { passive: true });
  document.addEventListener("visibilitychange", req);
  var raf;
  window.addEventListener("resize", function () {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      layout(false);
    });
  });
  layout(true);
  requestAnimationFrame(function () {
    setTimeout(function () {
      LATE.forEach(function (f) {
        f();
      });
      measure();
    }, 0);
  });
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(function () {
      layout(true);
    });
  // La hauteur de la page change quand les images arrivent : on remesure.
  if ("ResizeObserver" in window) {
    var roT = 0;
    new ResizeObserver(function () {
      clearTimeout(roT);
      roT = setTimeout(function () {
        if (Math.abs(document.documentElement.scrollHeight - docH) > 1) measure();
      }, 120);
    }).observe(document.body);
  }
  var sheet = $("sheet"),
    btn = $("menuBtn");
  function setMenu(on) {
    sheet.classList.toggle("open", on);
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    document.documentElement.style.overflow = on ? "hidden" : "";
    if (on) $("closeBtn").focus();
  }
  btn.addEventListener("click", function () {
    setMenu(true);
  });
  if ($("mb"))
    $("mb").addEventListener("click", function () {
      setMenu(true);
    });
  sheet.querySelectorAll(".fsm-nav a").forEach(function (a) {
    a.addEventListener("click", function () {
      setMenu(false);
    });
  });
  $("closeBtn").addEventListener("click", function () {
    setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sheet.classList.contains("open")) setMenu(false);
  });
})();
