(function () {
  // arabe : la page se lit de droite à gauche (les progressions horizontales partent de la droite)
  var RTL = document.documentElement.dir === "rtl";
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
    // sur téléphone, la barre d'adresse qui se replie au défilement change la hauteur de la fenêtre :
    // rien ne bouge dans la mise en page (elle se base sur la hauteur de départ), on ne refait rien
    if (!force && key === lastKey) return;
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
    // le temps où le hero reste en place : la caméra survole le pays (plus court sur téléphone)
    HOLD = H * (mode === "M" ? 0.6 : 0.75);
    MAP.layout(MW, MH, mode === "M");
    hero.style.height = HH + "px";
    hero.style.top = H - HH + "px";
    // Téléphone : quand la barre d'adresse se replie, l'écran grandit. Calé sur la hauteur d'écran
    // maximale (lvh, sinon vh qui la donne aussi sur téléphone), le bas du hero reste au bas de l'écran :
    // plus de bande pâle sous la carte. (Une valeur non reconnue par le navigateur est simplement ignorée.)
    if (mode === "M") {
      hero.style.top = "calc(100vh - " + HH + "px)";
      hero.style.top = "calc(100lvh - " + HH + "px)";
    }
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
  // ——— Carte du haut : tout le Maroc vu du ciel, qui s'allume ———
  // Le pays entier, de Tanger à Dakhla, en perspective, dans deux canvas superposés :
  // - le fond (la mer, les pays voisins, le Maroc en relief, la grille de « l'infrastructure digitale »,
  //   les autoroutes) : dessiné une fois, il ne change pas tant que la caméra est immobile ;
  // - au-dessus, ce qui vit : des centaines de points lumineux (chacun une entreprise que ses clients
  //   trouvent en ligne), les arcs du studio d'El Jadida vers tout le pays, les noms des villes et la
  //   recherche en direct (toutes les 3,6 s, une vraie recherche fait s'allumer une entreprise et sa fiche).
  // À l'arrivée, la caméra se pose sur le pays et les lumières s'allument depuis El Jadida.
  // Sur ordinateur, la caméra tourne doucement au défilement puis monte dans les nuages ; sur téléphone,
  // elle reste immobile : rien à redessiner pendant qu'on fait défiler, le défilement reste fluide.
  var MAP = (function () {
    var cv = $("mcv"),
      cv0 = $("mcv0"),
      wrap = $("mwrap"),
      ctx = cv && cv.getContext("2d"),
      cx0 = cv0 && cv0.getContext("2d"),
      geoEl = $("mgeo");
    var none = { step: function () {}, layout: function () {} };
    if (!ctx || !cx0 || !geoEl) return none;
    var G = JSON.parse(geoEl.textContent),
      mq = $("mq"),
      mqt = mq.querySelector("span"),
      mcard = $("mcard"),
      RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function xy(e) {
      var p = e.getAttribute("data-xy").split(",");
      return [+p[0], +p[1]];
    }
    // les noms : les grandes villes d'abord (ce sont elles qui gardent leur nom quand la place manque),
    // les mers et l'Europe à la fin
    var LAB = [].map
      .call(document.querySelectorAll("#mdata i"), function (e) {
        var p = xy(e);
        return { x: p[0], y: p[1], r: +e.getAttribute("data-r"), t: e.textContent };
      })
      .sort(function (a, b) {
        return b.r - a.r;
      });
    // le nom d'El Jadida est porté par l'étiquette du studio (« Digilago · El Jadida »)
    var hq = G.hq,
      HQL = "";
    LAB.forEach(function (l) {
      if (Math.abs(l.x - hq[0]) < 0.2 && Math.abs(l.y - hq[1]) < 0.2) {
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
    // À l'arrivée, elles s'allument depuis El Jadida, comme une onde qui gagne tout le pays.
    var seed = 11;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    var LT = [];
    G.c.forEach(function (c) {
      var s = 0.8 + Math.sqrt(c[2]) * 0.62;
      for (var i = 0; i < c[2]; i++) {
        var a = rnd() * 6.2832,
          d = Math.sqrt(-2 * Math.log(rnd() + 1e-6)) * s * 0.6,
          x = c[0] + Math.cos(a) * d,
          y = c[1] + Math.sin(a) * d;
        LT.push({
          x: x,
          y: y,
          ph: rnd() * 6.2832,
          sp: 0.5 + rnd() * 1.5,
          g: rnd() < 0.18,
          on: 0.45 + Math.sqrt((x - hq[0]) * (x - hq[0]) + (y - hq[1]) * (y - hq[1])) / 290,
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
      S0 = null,
      S1 = null,
      KR = 1,
      TOPC = 0,
      PILL = null,
      camKey = "",
      lastStatic = 0,
      REF = null,
      A0 = null,
      t0 = -1,
      skip = false,
      ready = false;
    var cam = { tx: 0, ty: 0, R: 1, c: 1, s: 0, cp: 1, sp: 0, rc: 0, h: 0, hy: 0, ox: 0 };
    var P = { x: 0, y: 0, z: 0, k: 0 };
    // la carte attend les polices (les noms des villes en dépendent) : au plus 0,9 s
    function go() {
      ready = true;
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go);
      setTimeout(go, 900);
    } else go();
    // La caméra regarde un point du sol (tx, ty) sous l'angle th, à la distance R, tournée de ps
    // (0 : face au nord) ; ce point est dessiné en (W/2 + ox, hy).
    function setCam(v) {
      cam.tx = v.tx;
      cam.ty = v.ty;
      cam.R = v.R;
      cam.c = Math.cos(v.th);
      cam.s = Math.sin(v.th);
      cam.cp = Math.cos(v.ps);
      cam.sp = Math.sin(v.ps);
      cam.rc = v.R * cam.c;
      cam.h = v.R * cam.s;
      cam.hy = v.hy;
      cam.ox = v.ox;
    }
    function proj(x, y, alt) {
      var dx = x - cam.tx,
        dy = y - cam.ty,
        D = cam.rc + dx * cam.sp - dy * cam.cp,
        Hh = cam.h - (alt || 0),
        zc = D * cam.c + Hh * cam.s;
      P.z = zc;
      if (zc < 1) return false;
      P.k = F / zc;
      P.x = W / 2 + cam.ox + (dx * cam.cp + dy * cam.sp) * P.k;
      P.y = cam.hy + (Hh * cam.c - D * cam.s) * P.k;
      return true;
    }
    // le lointain (l'Europe, le large) s'efface dans la brume ; tout le Maroc reste net
    function fog(z) {
      return Math.max(0, Math.min(1, (cam.R * 2.3 - z) / (cam.R * 0.8)));
    }
    function path(c, pts, alt) {
      var ok = 0;
      for (var i = 0; i < pts.length; i += 2) {
        if (!proj(pts[i], pts[i + 1], alt)) continue;
        if (ok++) c.lineTo(P.x, P.y);
        else c.moveTo(P.x, P.y);
      }
      return ok;
    }
    // Cadre la caméra v pour que tout le pays tienne dans la zone b = [x0, y0, x1, y1] du canvas.
    function fit(v, b) {
      var o = G.o,
        lo = 40,
        hi = 9000,
        bb;
      v.hy = v.ox = 0;
      function box(R) {
        v.R = R;
        setCam(v);
        var x0 = 1e9,
          x1 = -1e9,
          y0 = 1e9,
          y1 = -1e9;
        for (var i = 0; i < o.length; i += 2) {
          if (!proj(o[i], o[i + 1])) return null;
          if (P.x < x0) x0 = P.x;
          if (P.x > x1) x1 = P.x;
          if (P.y < y0) y0 = P.y;
          if (P.y > y1) y1 = P.y;
        }
        return [x0, y0, x1, y1];
      }
      for (var n = 0; n < 24; n++) {
        var m = (lo + hi) / 2;
        bb = box(m);
        if (!bb || bb[2] - bb[0] > b[2] - b[0] || bb[3] - bb[1] > b[3] - b[1]) lo = m;
        else hi = m;
      }
      bb = box(hi);
      v.ox = (b[0] + b[2] - bb[0] - bb[2]) / 2;
      v.hy = (b[1] + b[3] - bb[1] - bb[3]) / 2;
      return v;
    }
    function mix(a, b, e) {
      return {
        tx: a.tx + (b.tx - a.tx) * e,
        ty: a.ty + (b.ty - a.ty) * e,
        R: a.R * Math.pow(b.R / a.R, e),
        th: a.th + (b.th - a.th) * e,
        ps: a.ps + (b.ps - a.ps) * e,
        hy: a.hy + (b.hy - a.hy) * e,
        ox: a.ox + (b.ox - a.ox) * e,
      };
    }
    function layout(w, h, m) {
      MOB = m;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = w;
      H = h;
      cv.width = cv0.width = Math.round(w * DPR);
      cv.height = cv0.height = Math.round(h * DPR);
      F = (m ? 1.3 : 0.95) * w;
      // les parties du canvas visibles au chargement (b0-b1), puis une fois le hero posé (c0-c1) ;
      // en haut, la place de la légende « En direct »
      var b0 = Math.max(h * 0.1, -ST),
        b1 = Math.min(h, VH - ST),
        c0 = Math.max(h * 0.1, HH - VH - ST),
        c1 = Math.min(h, HH - ST);
      TOPC = (m ? 72 : 44) * u;
      if (m) {
        // téléphone : le pays debout, de Tanger (en haut) à Dakhla (en bas)
        S0 = S1 = fit({ tx: 300, ty: 320, th: 0.98, ps: 0.12 }, [14, Math.max(b0, TOPC), w - 14, c1 - 16 * u]);
      } else {
        // ordinateur : le pays en travers de l'écran, tout entier visible dès l'arrivée ;
        // au défilement, la caméra s'approche et tourne doucement
        var y0 = Math.max(b0, TOPC);
        S0 = fit({ tx: 300, ty: 320, th: 0.8, ps: -0.56 }, [w * 0.05, y0, w * 0.95, Math.max(b1 - 22 * u, y0 + 300 * u)]);
        S1 = fit({ tx: 300, ty: 310, th: 0.72, ps: -0.34 }, [w * 0.04, Math.max(c0, TOPC), w * 0.96, c1 - 28 * u]);
      }
      KR = F / S0.R;
      // ordinateur : la caméra est dans le dessin lui-même, le bloc de la carte reste à plat
      if (!m && wrap) wrap.style.transform = wrap.style.opacity = wrap.style.transformOrigin = "";
      // téléphone : la caméra tourne autour du studio d'El Jadida
      if (m && wrap) {
        setCam(S0);
        if (proj(hq[0], hq[1])) wrap.style.transformOrigin = P.x.toFixed(1) + "px " + P.y.toFixed(1) + "px";
      }
      // la légende « En direct » posée sur le haut de la carte : aucun nom ne passe dessous
      var ml = $("mlive");
      PILL = null;
      if (ml) {
        var r1 = ml.getBoundingClientRect(),
          r2 = cv.getBoundingClientRect();
        PILL = [r1.left - r2.left - 6, r1.top - r2.top - 6, r1.right - r2.left + 6, r1.bottom - r2.top + 4];
      }
      camKey = "";
      REF = A0 = null;
      LBL = {};
      HQS = null;
    }
    // Les noms de lieux : dessinés une fois (texte et halo blanc) dans une petite image, puis réutilisés.
    var LBL = {};
    function label(l, s) {
      var k = l.t + "|" + l.r + "|" + s,
        im = LBL[k];
      if (im) return im;
      var big = l.r === 3,
        sea = l.r === 0,
        fs =
          (sea
            ? MOB ? 11.5 : 14.5
            : big
              ? MOB ? 12.5 : 16.5
              : l.r === 2
                ? MOB ? 10 : 11.5
                : MOB ? 9 : 10.5) * s,
        font =
          sea || big
            ? "italic 500 " + fs + "px 'Playfair Display', Georgia, serif"
            : "600 " + fs + "px 'Instrument Sans', system-ui, sans-serif";
      im = document.createElement("canvas");
      var x = im.getContext("2d");
      x.font = font;
      var w = Math.ceil(x.measureText(l.t).width) + 12,
        h = Math.ceil(fs * 1.5) + 8;
      im.width = Math.ceil(w * DPR);
      im.height = Math.ceil(h * DPR);
      x = im.getContext("2d");
      x.scale(DPR, DPR);
      x.font = font;
      x.textAlign = "center";
      x.textBaseline = "middle";
      if (sea) x.fillStyle = "rgba(255,255,255,.74)";
      else {
        x.lineWidth = big ? 4 : 3.4;
        x.lineJoin = "round";
        x.strokeStyle = "rgba(255,255,255,.92)";
        x.strokeText(l.t, w / 2, h / 2);
        x.fillStyle = big ? "#17366F" : "rgba(52,84,140,.95)";
      }
      x.fillText(l.t, w / 2, h / 2);
      im.cw = w;
      im.ch = h;
      // le nom se place juste sous le point de la ville (la mer : centrée)
      im.dy = sea ? -h / 2 : 3 * s - 3;
      return (LBL[k] = im);
    }
    // l'étiquette du studio : « Digilago · El Jadida »
    var HQS = null;
    function hqSprite() {
      if (HQS) return HQS;
      var t = "Digilago" + (HQL ? " · " + HQL : ""),
        fs = MOB ? 10.5 : 11.5,
        font = "600 " + fs + "px 'Instrument Sans', system-ui, sans-serif",
        c = document.createElement("canvas"),
        x = c.getContext("2d");
      x.font = font;
      var w = Math.ceil(x.measureText(t).width) + 20,
        h = Math.round(fs * 1.9);
      c.width = Math.ceil(w * DPR);
      c.height = Math.ceil(h * DPR);
      x = c.getContext("2d");
      x.scale(DPR, DPR);
      x.fillStyle = "#0B1B3A";
      x.beginPath();
      if (x.roundRect) x.roundRect(0, 0, w, h, h / 2);
      else x.rect(0, 0, w, h);
      x.fill();
      x.font = font;
      x.fillStyle = "#fff";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(t, w / 2, h / 2 + 0.5);
      c.cw = w;
      c.ch = h;
      return (HQS = c);
    }
    // une police arrivée après coup : on refait les étiquettes avec la bonne
    if (document.fonts && document.fonts.addEventListener)
      document.fonts.addEventListener("loadingdone", function () {
        LBL = {};
        HQS = null;
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
      // les pays voisins : en retrait
      c.beginPath();
      G.a.forEach(function (pts) {
        if (path(c, pts) > 2) c.closePath();
      });
      c.fillStyle = "rgba(235,243,255,.4)";
      c.fill();
      // le Maroc, posé comme une plaque : une tranche bleue sous le pays, puis le pays
      var th = cam.R * 0.012;
      c.beginPath();
      path(c, G.o, -th);
      c.closePath();
      c.save();
      c.shadowColor = "rgba(6,28,84,.4)";
      c.shadowBlur = MOB ? 16 : 26;
      c.shadowOffsetY = MOB ? 6 : 12;
      c.fillStyle = "rgba(118,160,232,.95)";
      c.fill();
      c.restore();
      c.beginPath();
      path(c, G.o);
      c.closePath();
      var lg = c.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, "rgba(228,238,253,.9)");
      lg.addColorStop(0.5, "rgba(240,246,255,.98)");
      lg.addColorStop(1, "#F8FBFF");
      c.fillStyle = lg;
      c.fill();
      c.save();
      c.clip();
      // une lumière douce sur le nord du pays, là où vivent la plupart des entreprises
      if (proj(372, 128)) {
        var sr = Math.max(W, H) * (MOB ? 0.62 : 0.42),
          sg = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, sr);
        sg.addColorStop(0, "rgba(255,255,255,.75)");
        sg.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = sg;
        c.fillRect(P.x - sr, P.y - sr, sr * 2, sr * 2);
      }
      // la grille de l'infrastructure digitale, plus marquée tous les 50 (100 sur téléphone)
      var GS = MOB ? 20 : 10,
        gx,
        gy;
      c.lineWidth = 1;
      for (var pass = 0; pass < 2; pass++) {
        c.beginPath();
        for (gx = 20; gx <= 580; gx += GS)
          if (!(gx % 50) === !!pass) path(c, [gx, 10, gx, 630]);
        for (gy = 10; gy <= 630; gy += GS)
          if (!(gy % 50) === !!pass) path(c, [10, gy, 590, gy]);
        c.strokeStyle = pass ? "rgba(31,87,199,.13)" : "rgba(31,87,199,.055)";
        c.stroke();
      }
      // le relief (Rif, Moyen et Haut Atlas, Anti-Atlas) : des ombres douces ; puis le halo bleu des villes
      function glow(x, y, rad, col) {
        if (!proj(x, y)) return;
        var rr = rad * P.k,
          rg = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, rr);
        rg.addColorStop(0, col);
        rg.addColorStop(1, "rgba(64,105,180,0)");
        c.fillStyle = rg;
        c.save();
        c.translate(P.x, P.y);
        c.scale(1, cam.s * 0.9 + 0.1);
        c.translate(-P.x, -P.y);
        c.fillRect(P.x - rr, P.y - rr, rr * 2, rr * 2);
        c.restore();
      }
      [[445, 58, 34, 1], [432, 138, 30, 0.9], [330, 228, 60, 1.1], [395, 190, 36, 0.8], [300, 268, 44, 0.7]].forEach(
        function (m) {
          glow(m[0], m[1], m[2], "rgba(64,105,180," + 0.15 * m[3] + ")");
        },
      );
      G.c.forEach(function (ci) {
        if (ci[2] >= (MOB ? 9 : 6))
          glow(ci[0], ci[1], 2.6 + Math.sqrt(ci[2]) * 0.85, "rgba(47,132,236,.3)");
      });
      c.restore();
      // la côte et la frontière : un trait fin, avec un liseré clair côté mer
      c.beginPath();
      path(c, G.o);
      c.closePath();
      c.lineJoin = "round";
      c.lineWidth = 2.4;
      c.strokeStyle = "rgba(255,255,255,.75)";
      c.stroke();
      c.lineWidth = 0.9;
      c.strokeStyle = "rgba(31,87,199,.4)";
      c.stroke();
      // les autoroutes
      c.lineCap = "round";
      c.beginPath();
      G.r.forEach(function (pts) {
        path(c, pts);
      });
      c.lineWidth = MOB ? 2.2 : 3;
      c.strokeStyle = "rgba(255,255,255,.75)";
      c.stroke();
      c.lineWidth = MOB ? 0.9 : 1.2;
      c.strokeStyle = "rgba(31,87,199,.34)";
      c.stroke();
      // les villes : un point net
      c.beginPath();
      G.c.forEach(function (ci) {
        if (!proj(ci[0], ci[1])) return;
        var r =
          (ci[2] > 25 ? 2.6 : ci[2] > 8 ? 2 : 1.4) *
          Math.min(1.3, Math.max(0.75, P.k / KR)) *
          (MOB ? 0.9 : 1);
        c.moveTo(P.x + r, P.y);
        c.arc(P.x, P.y, r, 0, 6.2832);
      });
      c.fillStyle = "rgba(31,87,199,.92)";
      c.fill();
      c.lineWidth = 1.1;
      c.strokeStyle = "rgba(255,255,255,.95)";
      c.stroke();
    }
    // deux repères au sol, pour suivre la caméra entre deux dessins du fond
    function refAt() {
      if (!REF || !proj(REF[0], REF[1])) return null;
      var ax = P.x,
        ay = P.y;
      if (!proj(REF[2], REF[3])) return null;
      return [ax, ay, P.x, P.y];
    }
    // Recherches en direct
    var evI = -1,
      evT = -1e9,
      ev = null,
      EVD = 3600,
      cardW = 0;
    function pick(now, y0, y1) {
      for (var n = 0; n < EV.length; n++) {
        var e = EV[(evI + 1 + n) % EV.length];
        if (!proj(e.x, e.y)) continue;
        var room = (MOB ? 140 : 156) * u,
          dn = P.y < y0 + room;
        if (P.x > W * 0.14 && P.x < W * 0.86 && (dn ? P.y < y1 - room - 20 * u && P.y > y0 + 20 * u : P.y < y1 - 24 * u)) {
          evI = EV.indexOf(e);
          ev = e;
          mq.classList.toggle("dn", dn);
          mcard.classList.toggle("dn", dn);
          evT = now;
          mcard.innerHTML = e.el.innerHTML;
          mcard.classList.toggle("mcl", e.el.hasAttribute("data-cl"));
          cardW = 0;
          mqt.textContent = RM ? e.q : "";
          return;
        }
      }
      // aucune place pour l'instant (la carte est encore peu visible) : on réessaie bientôt
      ev = null;
      evT = now - EVD + 600;
    }
    var PL = [];
    function step(now, sy, PAN2, DAWN2) {
      if (!S0 || !ready) return;
      if (t0 < 0) {
        t0 = now;
        // téléphone : la carte se pose en douceur (voir mobCam : la carte graphique s'en charge)
      }
      // la bande du canvas réellement visible (le hero remonte, puis reste en place)
      var top = ST + Math.max(VH - HH, -sy),
        b0 = Math.max(H * 0.1, -top),
        b1 = Math.min(H, VH - top),
        ti = RM ? 99 : (now - t0) / 1000,
        t = now / 1000,
        v = S0;
      if (!MOB && !RM) {
        v = mix(S0, S1, PAN2 * PAN2 * (3 - 2 * PAN2));
        // l'arrivée : la caméra descend en tournant et se pose sur le pays
        if (ti < 3.2) {
          var q = Math.pow(1 - ti / 3.2, 3);
          v.R *= 1 + 0.65 * q;
          v.th += 0.5 * q;
          v.ps += 0.6 * q;
        }
        // à la fin du hero, la caméra monte dans les nuages
        if (DAWN2 > 0) {
          v.R *= 1 + DAWN2 * 0.9;
          v.th += DAWN2 * 0.35;
        }
      }
      setCam(v);
      var key = MOB
        ? "m"
        : [v.tx, v.ty, v.R, v.th, v.ps, v.hy, v.ox]
            .map(function (n) {
              return n.toFixed(2);
            })
            .join();
      // Le fond est redessiné quand la caméra bouge (ordinateur seulement), au plus toutes les 50 ms :
      // entre deux, l'image du fond suit la caméra par une simple transformation CSS (sans redessiner).
      var moving = key !== camKey;
      if (moving) {
        if (!camKey || now - lastStatic > 50) {
          camKey = key;
          lastStatic = now;
          drawStatic(cx0);
          REF = [cam.tx, cam.ty, cam.tx + 80 * cam.cp, cam.ty + 80 * cam.sp];
          A0 = refAt();
          S(cv0, "transform", "none");
        } else if (A0) {
          var A1 = refAt();
          if (A1) {
            var vx0 = A0[2] - A0[0],
              vy0 = A0[3] - A0[1],
              vx1 = A1[2] - A1[0],
              vy1 = A1[3] - A1[1],
              l0 = vx0 * vx0 + vy0 * vy0 || 1,
              ca = (vx0 * vx1 + vy0 * vy1) / l0,
              sa = (vx0 * vy1 - vy0 * vx1) / l0;
            S(
              cv0,
              "transform",
              "matrix(" +
                [ca, sa, -sa, ca, A1[0] - (ca * A0[0] - sa * A0[1]), A1[1] - (sa * A0[0] + ca * A0[1])]
                  .map(function (n) {
                    return n.toFixed(4);
                  })
                  .join() +
                ")",
            );
          }
        }
      }
      if (MOB) mobCam(ti, PAN2, DAWN2);
      // sur téléphone, une fois la carte allumée : 30 images par seconde suffisent pour les lumières
      if (MOB && !moving && ti > 2.6) {
        skip = !skip;
        if (skip) return;
      }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var i, l, a, r, ig;
      // les entreprises : des points qui scintillent doucement (et s'allument d'un éclat à l'arrivée)
      for (i = 0; i < LT.length; i++) {
        l = LT[i];
        ig = ti - l.on;
        if (ig <= 0 || !proj(l.x, l.y)) continue;
        if (P.x < -10 || P.x > W + 10 || P.y < b0 - 10 || P.y > b1 + 10) continue;
        a = fog(P.z);
        if (a <= 0.03) continue;
        a *= RM ? 0.85 : 0.55 + 0.45 * Math.sin(t * l.sp + l.ph);
        r = Math.max(MOB ? 3.3 : 3.4, Math.min(12, P.k * (MOB ? 4 : 2.8)));
        if (ig < 0.6) {
          var f = ig / 0.6;
          a = Math.min(1, f * 4) * (a + (1 - a) * (1 - f));
          r *= 1 + (1 - f) * 1.8;
        }
        ctx.globalAlpha = a;
        ctx.drawImage(l.g ? SPG : SPB, P.x - r, P.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      // la lumière circule sur les autoroutes
      if (!RM && ti > 1.6)
        G.r.forEach(function (pts, k) {
          var n = pts.length / 2 - 1;
          for (var j = 0; j < 2; j++) {
            var f2 = ((t * 0.045 + k * 0.37 + j * 0.5) % 1) * n,
              q2 = Math.floor(f2) * 2,
              w = f2 % 1;
            if (!proj(pts[q2] + (pts[q2 + 2] - pts[q2]) * w, pts[q2 + 1] + (pts[q2 + 3] - pts[q2 + 1]) * w)) continue;
            if (P.y < b0 || P.y > b1) continue;
            r = Math.max(2.6, Math.min(8, P.k * 2.2));
            ctx.globalAlpha = fog(P.z) * Math.min(1, ti - 1.6);
            ctx.drawImage(SPB, P.x - r, P.y - r, r * 2, r * 2);
          }
        });
      ctx.globalAlpha = 1;
      // le studio, à El Jadida : des arcs vers tout le Maroc (tracés un à un à l'arrivée)
      G.arcs.forEach(function (d, k) {
        var dx = d[0] - hq[0],
          dy = d[1] - hq[1],
          hgt = Math.sqrt(dx * dx + dy * dy) * 0.22,
          dr = RM ? 1 : Math.min(1, Math.max(0, (ti - 0.7 - k * 0.11) / 0.9));
        if (dr <= 0) return;
        dr = 1 - Math.pow(1 - dr, 3);
        ctx.beginPath();
        var on = 0,
          ns = Math.max(2, Math.ceil(24 * dr));
        for (var s = 0; s <= ns; s++) {
          var u2 = (s / ns) * dr;
          if (!proj(hq[0] + dx * u2, hq[1] + dy * u2, Math.sin(Math.PI * u2) * hgt)) continue;
          if (on++) ctx.lineTo(P.x, P.y);
          else ctx.moveTo(P.x, P.y);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(31,87,199,.24)";
        ctx.stroke();
        if (dr < 1) {
          if (on) ctx.drawImage(SPG, P.x - 5, P.y - 5, 10, 10);
          return;
        }
        var prog = RM ? 1 : ((t * 0.32 + k * 0.29) % 1.6) / 1.2;
        if (prog > 0 && prog < 1) {
          if (proj(hq[0] + dx * prog, hq[1] + dy * prog, Math.sin(Math.PI * prog) * hgt)) {
            r = Math.max(3, Math.min(7, P.k * 2));
            ctx.globalAlpha = Math.sin(Math.PI * prog) * fog(P.z);
            ctx.drawImage(SPG, P.x - r, P.y - r, r * 2, r * 2);
            ctx.globalAlpha = 1;
          }
        }
      });
      // l'étiquette du studio, puis les noms de lieux (sans se chevaucher : les grandes villes d'abord)
      PL.length = 0;
      if (PILL) PL.push(PILL);
      var hx = -1e4,
        hy2 = 0,
        img = hqSprite(),
        bx = 0,
        by = 0;
      if (proj(hq[0], hq[1])) {
        hx = P.x;
        hy2 = P.y;
        bx = hx - img.cw - 11;
        by = hy2 - img.ch / 2;
        if (bx < 8) bx = hx + 11; // pas la place à gauche : l'étiquette passe à droite
        PL.push([bx - 2, by - 2, bx + img.cw + 2, by + img.ch + 2]);
      }
      var la = RM ? 1 : Math.min(1, Math.max(0, (ti - 1.1) / 0.8));
      if (la > 0)
        for (i = 0; i < LAB.length; i++) {
          l = LAB[i];
          // les petites villes : seulement quand la caméra s'approche (et jamais sur téléphone)
          if (l.hq || (l.r === 1 && MOB) || !proj(l.x, l.y)) continue;
          if (l.r === 1 && P.k < KR * 1.25) continue;
          var sc = Math.round(Math.min(1.25, Math.max(0.85, P.k / KR)) * 20) / 20,
            im = label(l, sc),
            pos = l.r ? 4 : 1,
            ok = false,
            x,
            y;
          // sous le point, sinon au-dessus, à droite, à gauche : la première place libre
          for (var c4 = 0; c4 < pos && !ok; c4++) {
            x = c4 < 2 ? P.x - im.cw / 2 : c4 === 2 ? P.x - 2 : P.x - im.cw + 2;
            y = c4 === 0 ? P.y + im.dy : c4 === 1 ? P.y - im.ch - im.dy : P.y - im.ch / 2;
            if (x < -40 || x + im.cw > W + 40 || y < b0 - 10 || y + im.ch > b1 + 10) continue;
            var x1 = x + 3,
              y1 = y + 3,
              x2 = x + im.cw - 3,
              y2 = y + im.ch - 3,
              hit = false;
            for (var j = 0; j < PL.length && !hit; j++)
              hit = x1 < PL[j][2] && x2 > PL[j][0] && y1 < PL[j][3] && y2 > PL[j][1];
            if (hit) continue;
            PL.push([x1, y1, x2, y2]);
            ok = true;
          }
          if (!ok) continue;
          ctx.globalAlpha = fog(P.z) * la;
          ctx.drawImage(im, x, y, im.cw, im.ch);
        }
      ctx.globalAlpha = 1;
      if (hx > -1e4) {
        var ha = RM ? 1 : Math.min(1, ti / 0.6);
        for (var rr = 0; rr < 2; rr++) {
          var ph = RM ? 0.4 : (t * 0.6 + rr * 0.5) % 1;
          ctx.beginPath();
          ctx.arc(hx, hy2, (5 + ph * 24) * (MOB ? 0.85 : 1), 0, 6.2832);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(31,87,199," + 0.5 * (1 - ph) * ha + ")";
          ctx.stroke();
        }
        ctx.globalAlpha = ha;
        ctx.beginPath();
        ctx.arc(hx, hy2, MOB ? 4.2 : 5, 0, 6.2832);
        ctx.fillStyle = "#1F57C7";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.drawImage(img, bx, by, img.cw, img.ch);
        ctx.globalAlpha = 1;
      }
      // une recherche, puis l'entreprise trouvée s'allume avec sa fiche ;
      // dès que la caméra monte dans les nuages, la recherche et la fiche s'effacent
      if (DAWN2 > 0.03) ev = null;
      else if (ti > 2.9 && now - evT > EVD) pick(now, Math.max(b0, TOPC), b1);
      var e = ev,
        el = now - evT;
      if (e && proj(e.x, e.y)) {
        var px = P.x,
          py = P.y;
        if (el > 900) {
          var rp = Math.min(1, (el - 900) / 900);
          for (var k2 = 0; k2 < 2; k2++) {
            var q3 = Math.min(1, rp * 1.4 - k2 * 0.3);
            if (q3 <= 0) continue;
            ctx.beginPath();
            ctx.arc(px, py, 4 + q3 * 24, 0, 6.2832);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(242,178,51," + (1 - q3) * 0.9 + ")";
            ctx.stroke();
          }
          ctx.drawImage(SPG, px - 10, py - 10, 20, 20);
          // le rayon doré monte vers la fiche (ou descend, quand la fiche est sous le point)
          var bd = mcard.classList.contains("dn") ? 1 : -1,
            bl = (MOB ? 36 : 42) * u,
            bm = ctx.createLinearGradient(0, py + bl * bd, 0, py);
          bm.addColorStop(0, "rgba(255,211,106,0)");
          bm.addColorStop(1, "rgba(255,211,106,.85)");
          ctx.fillStyle = bm;
          ctx.fillRect(px - 1.5, bd > 0 ? py : py - bl, 3, bl);
        }
        if (!RM) {
          var nq = Math.max(0, Math.min(e.q.length, Math.round((el - 150) / 38)));
          if (mqt.textContent.length !== nq) mqt.textContent = e.q.slice(0, nq);
        }
        // la largeur de la fiche est lue une fois par recherche (pas à chaque image)
        if (!cardW) cardW = mcard.offsetWidth || 0;
        var fx = Math.max(12 - (px - cardW / 2), Math.min(0, W - 12 - (px + cardW / 2)));
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
    // Téléphone : la même chorégraphie que sur ordinateur, mais sans rien redessiner.
    // Le pays (fond, lumières, fiche) est incliné, tourné et rapproché d'un seul bloc par une transformation 3D,
    // que la carte graphique applique à chaque image (aucun calcul de la page, défilement fluide) :
    // - à l'arrivée, la carte se pose en se redressant ;
    // - pendant que le hero reste en place, la caméra survole le pays et s'approche d'El Jadida ;
    // - à la fin du hero, elle s'élève et la carte s'éloigne sous les nuages.
    function mobCam(ti, pan, dawn) {
      if (!wrap) return;
      if (RM) {
        S(wrap, "transform", "none");
        S(wrap, "opacity", "1");
        return;
      }
      var a = Math.min(1, ti / 2.4),
        ea = 1 - Math.pow(1 - a, 3),
        e = pan * pan * (3 - 2 * pan),
        d = dawn * dawn * (3 - 2 * dawn),
        rx = 24 * (1 - ea) + 14 * e + 14 * d,
        rz = -1.6 * e + 1.5 * d,
        sc = (1 + 0.08 * (1 - ea)) * (1 + 0.13 * e) * (1 - 0.2 * d),
        ty = (0.05 * (1 - ea) - 0.025 * e) * H;
      S(
        wrap,
        "transform",
        "perspective(" + Math.round(H * 1.9) + "px) translate3d(0," + ty.toFixed(1) + "px,0) rotateX(" +
          rx.toFixed(2) + "deg) rotateZ(" + rz.toFixed(2) + "deg) scale(" + sc.toFixed(4) + ")",
      );
      S(wrap, "opacity", Math.min(1, ti / 0.8).toFixed(3));
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
    story.style.height = Math.round(H * (1 + NS * 0.6)) + "px";
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
    nightRun(ST2[i]);
  }
  // « Il travaille pendant que vous dormez » : la nuit passe sur le téléphone, au rythme de la liste
  // (mêmes délais que ses lignes). L'horloge avance, chaque notification arrive à son heure, le jour change
  // à minuit, puis le jour se lève avec le résumé de la nuit.
  var NIGHT = [["19:00", 0], ["23:14", 550], ["01:52", 1100], ["06:30", 1650], ["08:00", 2400]],
    nightT = [];
  function nightRun(sl) {
    var ph = sl && sl.querySelector(".rphone.night");
    if (!ph) return;
    var clk = ph.querySelector(".lk-t"),
      ns = ph.querySelectorAll(".lkn");
    nightT.forEach(clearTimeout);
    nightT = [];
    ph.classList.remove("sunrise", "d1on");
    ns.forEach(function (n) {
      n.classList.remove("in");
    });
    NIGHT.forEach(function (s, k) {
      nightT.push(
        setTimeout(
          function () {
            clk.textContent = s[0];
            clk.classList.remove("tick");
            void clk.offsetWidth;
            clk.classList.add("tick");
            if (k >= 2) ph.classList.add("d1on"); // après minuit : samedi
            if (k >= 1 && ns[k - 1]) ns[k - 1].classList.add("in");
            if (k === NIGHT.length - 1) ph.classList.add("sunrise");
          },
          RM ? 0 : s[1],
        ),
      );
    });
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
    el.style.transformOrigin = RTL ? "100% 50%" : "0 50%";
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
    mtGap = 0,
    mtC0 = 0,
    mtDir = 1;
  function mtLayout(H) {
    if (!MC.length) return;
    mtCW = MC[0].offsetWidth;
    mtGap =
      parseFloat(
        getComputedStyle(mtTrack).columnGap || getComputedStyle(mtTrack).gap,
      ) || 0;
    // où se trouve la première carte sans déplacement, et dans quel sens la file avance
    // (vers la droite en français et en anglais, vers la gauche en arabe)
    mtTrack.style.transform = "none";
    if (mtTrack._s) mtTrack._s.transform = "none";
    var r0 = MC[0].getBoundingClientRect(),
      r1 = (MC[1] || MC[0]).getBoundingClientRect();
    // centres (et non bords) : la petite mise à l'échelle des cartes ne les déplace pas
    mtC0 = (r0.left + r0.right) / 2;
    mtDir = r1.left < r0.left ? -1 : 1;
    mtSec.style.height =
      Math.round(H + (MC.length - 1) * (mtCW + mtGap) * 0.55) + "px";
  }
  // Photos des métiers : les cartes hors du cadre ne se chargeraient qu'au dernier moment (vides pendant
  // le défilement) ; elles sont toutes demandées dès que la section approche.
  if ("IntersectionObserver" in window && mtSec) {
    var mtIO = new IntersectionObserver(
      function (es) {
        if (!es[0].isIntersecting) return;
        mtIO.disconnect();
        mtSec.querySelectorAll(".sp-img img").forEach(function (im) {
          im.loading = "eager";
        });
      },
      { rootMargin: "150% 0px" },
    );
    mtIO.observe(mtSec);
  }
  var mtFill = $("mtFill");
  if (mtFill) mtFill.style.transformOrigin = RTL ? "100% 50%" : "0 50%";
  function sxStep(sy) {
    if (!MC.length) return;
    var B = POS.mt,
      top = B.top - sy;
    if (top + B.h < 0 || top > VH) return;
    var p = clamp01(-top / Math.max(1, B.h - VH)),
      W = CW;
    var step = mtCW + mtGap,
      x = W / 2 - mtC0 - mtDir * p * (MC.length - 1) * step;
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
    // durées de défilement raccourcies : les animations se jouent plus vite, le visiteur avance
    mani.style.height = 1.7 * H + "px";
    maniStage.style.height = H + "px";
    // chaque carte se pose sous l'onglet de la précédente : les titres des cartes réduites restent lisibles
    var top0 = (M ? 70 : 104) * u,
      step = (M ? 46 : 58) * u,
      last = top0 + (cards.length - 1) * step;
    cardH = M ? Math.min(H - last - 24 * u, 760 * u) : Math.min(H - last - 24 * u, 640 * u);
    cards.forEach(function (c, i) {
      c.style.top = top0 + i * step + "px";
      c.style.height = M ? "auto" : cardH + "px";
      c.style.minHeight = M ? cardH * 0.9 + "px" : "";
    });
    (function () {
      var g = document.getElementById("giant");
      if (!g) return;
      var W = document.documentElement.clientWidth,
        pad = W < 760 ? 14 : Math.min(96, W * 0.066);
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
    // Onglet de chaque carte (numéro et titre, repris de la carte : déjà traduit) : quand la carte suivante
    // la recouvre, il reste visible au-dessus. Les trois titres se lisent ensemble.
    cardTabs = Array.prototype.map.call(cards, function (c) {
      var t = document.createElement("div"),
        n = c.querySelector(".sc-n"),
        h = c.querySelector("h3");
      t.className = "sc-tab";
      t.setAttribute("aria-hidden", "true");
      t.innerHTML =
        "<span>" + (n ? n.textContent.split("/")[0].trim() : "") + "</span><b>" + (h ? h.textContent : "") + "</b>";
      c.insertBefore(t, c.firstChild);
      c.classList.add("has-tab");
      return t;
    }),
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
      var sl = Math.abs(gdT.scrollLeft),
        i = Math.round(sl / gdStep());
      gdD.forEach(function (d, k) {
        d.classList.toggle("on", k === i);
      });
      $("gdPrev").disabled = sl < 8;
      $("gdNext").disabled =
        sl > gdT.scrollWidth - gdT.clientWidth - 8;
    };
    $("gdPrev").addEventListener("click", function () {
      gdT.scrollBy({ left: (RTL ? 1 : -1) * gdStep(), behavior: "smooth" });
    });
    $("gdNext").addEventListener("click", function () {
      gdT.scrollBy({ left: (RTL ? -1 : 1) * gdStep(), behavior: "smooth" });
    });
    gdD.forEach(function (d, k) {
      d.addEventListener("click", function () {
        gdT.scrollTo({ left: (RTL ? -1 : 1) * k * gdStep(), behavior: "smooth" });
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
  // Préparé à l'approche de la section (et non au chargement) : les copies qui font tourner les
  // rangées en boucle téléchargeraient aussitôt leurs longues captures, même hors de l'écran.
  LATE.push(function () {
    var cats = document.querySelectorAll(".scat");
    if (!cats.length) return;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            io.unobserve(e.target);
            scRow(e.target);
          });
        },
        { rootMargin: "1400px 0px" },
      );
      cats.forEach(function (cat) {
        io.observe(cat);
      });
    } else cats.forEach(scRow);
  });
  function scRow(cat) {
    {
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
    }
  }
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
