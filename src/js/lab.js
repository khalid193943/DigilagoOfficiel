/* Digilago Lab et page « Collaborer » : formulaires de demande et assistant du Lab.
   Les demandes partent dans la Gestion (« Demandes »), comme celles des autres formulaires du site : même adresse
   (l'attribut data-api de <html>), même provenance de visite et même mesure (« generate_lead »).
   Aucun texte affiché n'est écrit ici : tout vient de la page, déjà traduite en anglais et en arabe.
   Seuls les libellés envoyés à la Gestion (attributs data-fr) restent en français.
   Inséré par tools/lab.py (pages du Lab) et tools/collab.py (page Collaborer). */
(function () {
  "use strict";
  var WA = "https://wa.me/212649953813",
    root = document.documentElement,
    api = (root.getAttribute("data-api") || "").replace(/\/$/, ""),
    lang = (root.lang || "fr").slice(0, 2),
    sep = lang === "fr" ? " : " : ": ",
    calm = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
    each = function (list, fn) {
      Array.prototype.forEach.call(list, fn);
    };

  // LAB-03 : chaque « Jouer » compte (mesure d'audience et publicité, seulement si le visiteur les a acceptées)
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-play]");
    if (a && window.dgTrack) window.dgTrack("jeu_lago_jouer", { position: a.getAttribute("data-play"), page: location.pathname });
  });

  function digits(s) {
    return String(s || "").replace(/\D/g, "");
  }
  function isMail(s) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(s || "").trim());
  }
  function src(s) {
    return (s + (window.dgSrc ? window.dgSrc() : "")).slice(0, 80);
  }
  // Envoi à la Gestion : vrai si la demande est bien arrivée (12 s au plus).
  function send(o, form) {
    if (!api || !window.fetch) return Promise.resolve(false);
    var p = window.dgLeadExtra ? window.dgLeadExtra(o) : o,
      ctl = window.AbortController ? new AbortController() : null,
      to = setTimeout(function () {
        if (ctl) ctl.abort();
      }, 12000);
    p.lang = lang;
    return fetch(api + "/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
      signal: ctl ? ctl.signal : undefined,
    })
      .then(function (r) {
        clearTimeout(to);
        if (r.ok && window.dgTrack)
          window.dgTrack("generate_lead", { form: form, event_id: window.dgEventId ? window.dgEventId() : "" });
        return r.ok;
      })
      .catch(function () {
        clearTimeout(to);
        return false;
      });
  }

  // ─── formulaires : « Profiter d'un projet » (Lab), « Proposer une collaboration » ───
  each(document.querySelectorAll("form.ask"), function (f) {
    var err = f.querySelector(".ask-err"),
      ok = f.nextElementSibling && f.nextElementSibling.classList.contains("ask-ok") ? f.nextElementSibling : null,
      btn = f.querySelector("[type=submit]"),
      proj = f.getAttribute("data-project") || "",
      busy = false;
    function v(n) {
      var e = f.elements[n];
      return e && e.value ? String(e.value).trim() : "";
    }
    // un ou plusieurs groupes de choix (Recrutement : ce que vous cherchez, puis votre métier)
    function choices() {
      return Array.prototype.slice.call(f.querySelectorAll("input[type=radio]:checked"));
    }
    // le message WhatsApp tout prêt, dans la langue de la page
    function waHref() {
      var hello = f.querySelector("[data-t=hello]"),
        picked = choices()
          .map(function (c) {
            return (c.parentNode.querySelector("b") || c.parentNode).textContent.trim();
          })
          .join(" · "),
        out = [hello ? hello.textContent : ""],
        who = [v("name"), v("company")].filter(Boolean).join(", "),
        how = [v("phone"), v("email"), v("city")].filter(Boolean).join(" · ");
      if (picked) out.push("» " + picked + (proj ? " (" + proj + ")" : ""));
      if (who || how) out.push("", who, how);
      if (v("link")) out.push(v("link"));
      if (v("message")) out.push("", v("message"));
      return WA + "?text=" + encodeURIComponent(out.join("\n").replace(/\n{3,}/g, "\n\n").trim());
    }
    function refresh() {
      var h = waHref();
      each(f.querySelectorAll('a[href^="https://wa.me/"]'), function (a) {
        a.href = h;
      });
      if (ok)
        each(ok.querySelectorAll('a[href^="https://wa.me/"]'), function (a) {
          a.href = h;
        });
    }
    function fail(key, field) {
      err.hidden = false;
      each(err.querySelectorAll("[data-e]"), function (s) {
        s.hidden = s.getAttribute("data-e") !== key;
      });
      each(f.querySelectorAll("[aria-invalid]"), function (e) {
        e.removeAttribute("aria-invalid");
      });
      var el = field && f.elements[field];
      if (el) {
        el.setAttribute("aria-invalid", "true");
        el.focus();
      }
    }
    function done() {
      if (!ok) return;
      f.hidden = true;
      ok.hidden = false;
      ok.focus();
    }
    f.addEventListener("input", refresh);
    f.addEventListener("change", refresh);
    refresh();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      if (v("website")) return done(); // champ piège rempli : un robot, on ne transmet rien
      var phone = v("phone"),
        mail = v("email"),
        need = choices()
          .map(function (c) {
            return c.getAttribute("data-fr");
          })
          .filter(Boolean)
          .join(" · ");
      if (!v("name")) return fail("name", "name");
      if (digits(phone).length < 8 && !isMail(mail)) return fail("contact", !phone && mail ? "email" : "phone");
      if (f.hasAttribute("data-need-msg") && !v("message")) return fail("message", "message");
      err.hidden = true;
      busy = true;
      f.classList.add("busy");
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      send(
        {
          name: v("name"),
          company: v("company"),
          phone: phone,
          email: mail,
          city: v("city"),
          need: (need || f.getAttribute("data-fr") || "") + (proj ? " (" + proj + ")" : ""),
          message: [v("message"), v("link") ? "Lien : " + v("link") : ""].filter(Boolean).join("\n\n"),
          source: src(f.getAttribute("data-src") || "Site"),
        },
        f.getAttribute("data-form") || "lab",
      ).then(function (sent) {
        busy = false;
        f.classList.remove("busy");
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        if (!sent) return fail("send");
        done();
      });
    });
  });
  // « Proposer » sur une carte : la bonne case est cochée dans le formulaire
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-pick]");
    if (!a) return;
    var r = document.querySelector('input[type=radio][value="' + a.getAttribute("data-pick") + '"]');
    if (r) {
      r.checked = true;
      r.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  // ─── l'assistant du Lab ───
  var bot = document.getElementById("labBot");
  if (!bot) return;
  var panel = bot.querySelector(".bot-panel"),
    log = bot.querySelector(".bot-log"),
    act = bot.querySelector(".bot-act"),
    launcher = bot.querySelector(".bot-btn"),
    tpl = bot.querySelector("template").content,
    page = bot.getAttribute("data-page"),
    PROJ = { radar: "Radar", gestion: "Gestion" }[page] || "",
    MAIN = ["demo", "same", "collab", "q", "human"],
    KEY = "dgLabBot",
    chain = Promise.resolve(),
    drawn = false,
    st = {};
  try {
    st = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {};
  } catch (e) {}
  if (!st.log) st.log = [];
  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
  }
  function q(sel) {
    return tpl.querySelector(sel);
  }
  function t(k) {
    var e = q('[data-t="' + k + '"]');
    return e ? e.textContent : "";
  }

  // heures d'ouverture : du lundi au samedi, de 9 h à 19 h, heure du Maroc
  function clock() {
    try {
      var o = {};
      new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" })
        .formatToParts(new Date())
        .forEach(function (x) {
          o[x.type] = x.value;
        });
      return { d: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday), h: (+o.hour % 24) + +o.minute / 60 };
    } catch (e) {
      var n = new Date();
      return { d: n.getDay(), h: n.getHours() + n.getMinutes() / 60 };
    }
  }
  function when() {
    var c = clock(),
      work = c.d >= 1 && c.d <= 6;
    if (work && c.h >= 9 && c.h < 19) return "when_today";
    if (work && c.h < 9) return "when_9";
    return c.d === 6 ? "when_monday" : "when_tomorrow";
  }
  var live = when() === "when_today";
  bot.classList.toggle("off", !live);
  bot.querySelector("[data-on]").hidden = !live;
  bot.querySelector("[data-off]").hidden = live;

  // ─── la conversation ───
  function bubble(who, node) {
    var d = document.createElement("div");
    d.className = "bot-msg " + who;
    d.appendChild(node);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function draw(e) {
    if (e.u !== undefined) {
      var s = document.createElement("span");
      s.dir = "auto"; // un numéro ou un texte latin reste dans le bon ordre sur la page arabe
      s.textContent = e.u;
      return bubble("me", s);
    }
    var m = q('[data-m="' + e.b + '"]');
    if (!m) return;
    m = m.cloneNode(true);
    var w = m.querySelector("[data-when]"),
      wt = w && q('[data-w="' + ((e.v && e.v.when) || "when_today") + '"]');
    if (w) w.textContent = wt ? wt.textContent : "";
    var f = document.createDocumentFragment();
    while (m.firstChild) f.appendChild(m.firstChild);
    bubble("it", f);
  }
  function typing(on) {
    var d = log.querySelector(".typing");
    if (on && !d) {
      d = document.createElement("div");
      d.className = "bot-msg it typing";
      d.setAttribute("aria-hidden", "true");
      d.innerHTML = "<i></i><i></i><i></i>";
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    } else if (!on && d) d.remove();
  }
  function later(fn, ms) {
    chain = chain.then(function () {
      return new Promise(function (res) {
        setTimeout(
          function () {
            fn();
            res();
          },
          calm ? 0 : ms,
        );
      });
    });
  }
  function say(k, v) {
    var e = { b: k, v: v };
    st.log.push(e);
    save();
    later(function () {
      typing(true);
    }, 150);
    later(function () {
      typing(false);
      draw(e);
    }, 550);
  }
  function me(text) {
    var e = { u: text };
    st.log.push(e);
    save();
    draw(e);
  }
  function clear() {
    act.textContent = "";
  }
  function focusAct(force) {
    if (!bot.classList.contains("on")) return;
    var a = document.activeElement;
    if (!force && a && a !== document.body && !bot.contains(a)) return;
    var el = act.querySelector("input,textarea,button,a");
    if (el)
      try {
        el.focus({ preventScroll: true });
      } catch (e) {
        el.focus();
      }
  }
  function waHref() {
    var out = [t("hello"), t("wa_page") + sep + document.title.split(" | ")[0]];
    if (st.needLabel) out.push(t("wa_need") + sep + st.needLabel);
    if (st.name) out.push(t("wa_who") + sep + st.name);
    if (st.phone) out.push(t("wa_tel") + sep + st.phone);
    if (st.msg) out.push("", st.msg);
    return WA + "?text=" + encodeURIComponent(out.join("\n"));
  }
  function menu(keys) {
    clear();
    var box = document.createElement("div");
    box.className = "bot-cs";
    keys.forEach(function (k) {
      var c = q('[data-c="' + k + '"]');
      if (!c) return;
      c = c.cloneNode(true);
      if (c.tagName === "A" && /^https:\/\/wa\.me\//.test(c.getAttribute("href"))) c.href = waHref();
      box.appendChild(c);
    });
    act.appendChild(box);
    log.scrollTop = log.scrollHeight;
    focusAct(false);
  }
  function offer(keys) {
    st.menu = keys;
    st.ask = null;
    save();
    later(function () {
      menu(keys);
    }, 60);
  }
  function input(kind) {
    clear();
    var f = document.createElement("form"),
      i = q('[data-i="' + kind + '"]').cloneNode(true),
      go = q('[data-b="send"]').cloneNode(true);
    f.className = "bot-in";
    f.noValidate = true;
    f.appendChild(i);
    f.appendChild(go);
    if (kind === "more") f.appendChild(q('[data-c="skip"]').cloneNode(true));
    act.appendChild(f);
    log.scrollTop = log.scrollHeight;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      answer(kind, i.value.trim());
    });
    if (i.tagName === "TEXTAREA")
      i.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          answer(kind, i.value.trim());
        }
      });
    focusAct(true);
  }
  function ask(kind) {
    st.ask = kind;
    st.menu = null;
    save();
    later(function () {
      input(kind);
    }, 60);
  }
  // prénom, puis numéro, puis un mot (facultatif), puis l'envoi ; ce qui est déjà connu n'est pas redemandé
  function step(s) {
    if (s === "name" && !st.name) {
      say("ask_name");
      return ask("name");
    }
    if (s !== "more" && !st.phone) {
      say("ask_phone");
      return ask("phone");
    }
    say("ask_more");
    ask("more");
  }
  function answer(kind, val) {
    if (kind === "name") {
      if (!val) return;
      clear();
      me(val);
      st.name = val.slice(0, 40);
      return step("phone");
    }
    if (kind === "phone") {
      if (!val) return;
      clear();
      me(val);
      if (digits(val).length < 8) {
        say("bad_phone");
        return ask("phone");
      }
      st.phone = val.slice(0, 24);
      return step("more");
    }
    clear();
    if (val) me(val);
    finish(val);
  }
  function finish(msg) {
    st.msg = msg || "";
    st.ask = st.menu = null;
    save();
    chain = chain
      .then(function () {
        typing(true);
        return send(
          {
            name: st.name,
            phone: st.phone,
            need: (st.need || "Question") + (PROJ ? " (" + PROJ + ")" : ""),
            message: st.msg,
            source: src("Lab, assistant" + (PROJ ? ", " + PROJ : "")),
          },
          "assistant",
        );
      })
      .then(function (sent) {
        typing(false);
        var e = sent ? { b: "done", v: { when: when() } } : { b: "fail" };
        st.log.push(e);
        save();
        draw(e);
        offer(sent ? ["wa_now", "again"] : ["wa", "again"]);
      });
  }
  function pick(k, label, fr) {
    clear();
    if (k !== "skip") me(label);
    if (k === "demo" || k === "same" || k === "call" || k === "leave") {
      st.need = fr;
      st.needLabel = label;
      return step("name");
    }
    if (k === "skip") return finish("");
    if (k === "collab") {
      say("m_collab");
      return offer(["collab_page", "leave", "again"]);
    }
    if (k === "q" || k === "q_more") {
      say("q_intro");
      return offer(["q_sale", "q_price", "q_time", "q_data", "q_real", "human"]);
    }
    if (k.indexOf("q_") === 0) {
      say("a_" + k.slice(2));
      return offer(k === "q_sale" || k === "q_price" ? ["same", "q_more", "human"] : ["q_more", "human", "again"]);
    }
    if (k === "human") {
      say(live ? "m_human_on" : "m_human_off");
      return offer(["wa", "call"]);
    }
    say("again");
    offer(MAIN);
  }
  act.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest(".bot-c");
    if (!c) return;
    if (c.tagName === "A") return; // WhatsApp ou page « Collaborer » : le lien s'ouvre normalement
    pick(c.getAttribute("data-c"), c.textContent.trim(), c.getAttribute("data-fr"));
  });

  // ─── ouvrir, fermer ───
  function open() {
    if (!drawn) {
      drawn = true;
      st.log.forEach(draw);
      if (!st.log.length) {
        say("hello_" + page);
        offer(MAIN);
      } else if (st.ask) input(st.ask);
      else menu(st.menu || MAIN);
    }
    panel.hidden = false;
    bot.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
    requestAnimationFrame(function () {
      bot.classList.add("on");
      log.scrollTop = log.scrollHeight;
      focusAct(true);
    });
  }
  function close(back) {
    bot.classList.remove("on");
    launcher.setAttribute("aria-expanded", "false");
    setTimeout(
      function () {
        if (bot.classList.contains("on")) return;
        panel.hidden = true;
        bot.classList.remove("open");
      },
      calm ? 0 : 220,
    );
    if (back) launcher.focus();
  }
  launcher.addEventListener("click", function () {
    if (bot.classList.contains("on")) close(false);
    else open();
  });
  bot.querySelector(".bot-x").addEventListener("click", function () {
    close(true);
  });
  // téléphone : un toucher sur le voile autour de la fenêtre la referme
  bot.addEventListener("click", function (e) {
    if (e.target === bot && bot.classList.contains("on")) close(true);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && bot.classList.contains("on")) close(true);
  });

  // au-dessus du bandeau des cookies quand il est ouvert et qu'il passe dessous
  function lift() {
    var c = document.getElementById("dgc"),
      y = 0;
    if (c && c.classList.contains("on")) {
      var r = c.getBoundingClientRect(),
        b = launcher.getBoundingClientRect(),
        cur = parseFloat(bot.style.getPropertyValue("--lift")) || 0;
      if (r.height > 0 && r.top < innerHeight && r.left < b.right && r.right > b.left) y = Math.max(0, b.bottom + cur - r.top + 10);
    }
    bot.style.setProperty("--lift", Math.round(y) + "px");
  }
  addEventListener("resize", lift);
  addEventListener("load", lift);
  document.addEventListener("click", function () {
    setTimeout(lift, 500);
  });
  if (window.MutationObserver)
    new MutationObserver(function () {
      lift();
    }).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
  setTimeout(lift, 1200);
})();

// ─── La nuit du Lab : un ciel de points, et la marque de la page dessinée en points ───
// Pages du Lab seulement. Accueil du Lab : le soleil se lève sur l'horizon. Radar : l'écran balaie, les entreprises
// s'allument. Gestion : les lignes du registre s'écrivent. Mouvement réduit : une image fixe. Onglet caché : en pause.
(function () {
  "use strict";
  var body = document.body,
    main = document.querySelector("main[data-lab]");
  if (!main || !body.classList.contains("labpg")) return;
  var cv = document.createElement("canvas"),
    ctx = cv.getContext && cv.getContext("2d");
  if (!ctx) return;
  cv.className = "lab-dots";
  cv.setAttribute("aria-hidden", "true");
  body.insertBefore(cv, body.firstChild);
  body.classList.add("lab-dots-on");
  var kind = main.getAttribute("data-lab"),
    calm = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    W = 0,
    H = 0,
    stars = [],
    logo = [],
    geo = null,
    start = performance.now(),
    last = 0,
    raf = 0;
  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }
  function ease(x) {
    x = Math.max(0, Math.min(1, x));
    return 1 - Math.pow(1 - x, 3);
  }
  // la marque en points, posée dans l'en-tête de la page (coordonnées de la page)
  function shape() {
    var hero = document.querySelector(".lab-hero"),
      out = [];
    if (!hero) return out;
    var r = hero.getBoundingClientRect(),
      top = r.top + scrollY,
      mob = W < 760,
      g;
    if (kind === "index") {
      // ordinateur : à droite du titre, à la place des captures (elles sont juste en dessous, dans le catalogue)
      var R = mob ? W * 0.2 : Math.min(300, W * 0.21),
        cx = mob ? W * 0.8 : r.left + r.width * 0.74,
        y0 = top + (mob ? 150 : r.height * 0.74);
      g = R / 13;
      geo = { cx: cx, y0: y0, R: R };
      for (var y = y0 - R; y <= y0 + R * 0.55; y += g)
        for (var x = cx - R; x <= cx + R; x += g) {
          var dx = x - cx,
            dy = y - y0;
          if (dy <= 0 && dx * dx + dy * dy <= R * R)
            out.push({ x: x, y: y, k: "sun", h: -dy / R, q: Math.sqrt(dx * dx + dy * dy) / R, p: rnd(0, 6.28) });
          else if (dy >= (R * 4) / 22 && dy <= (R * 12) / 22) out.push({ x: x, y: y, k: "bar", p: rnd(0, 6.28) });
        }
      return out;
    }
    // un peu plus grand et plus dense qu'avant : la forme du D (barre + demi-disque) se lit tout de suite
    var R2 = mob ? W * 0.2 : Math.min(200, W * 0.14),
      cx2 = mob ? W - R2 * 1.15 : r.right - R2 * 1.12,
      cy = top + (mob ? 150 : 270);
    g = R2 / (mob ? 9 : 11);
    geo = { cx: cx2, cy: cy, R: R2 };
    for (var yy = cy - R2; yy <= cy + R2; yy += g)
      for (var xx = cx2 - (R2 * 12) / 22; xx <= cx2 + R2; xx += g) {
        var ex = xx - cx2,
          ey = yy - cy;
        if (ex >= (-R2 * 12) / 22 && ex <= (-R2 * 4) / 22) out.push({ x: xx, y: yy, k: "bar", p: rnd(0, 6.28) });
        else if (ex >= 0 && ex * ex + ey * ey <= R2 * R2)
          out.push({ x: xx, y: yy, k: "disc", a: (Math.atan2(ey, ex) * 180) / Math.PI, q: Math.sqrt(ex * ex + ey * ey) / R2, row: Math.floor(((ey + R2) / (2 * R2)) * 5), p: rnd(0, 6.28), hit: Math.random() < 0.07 });
      }
    return out;
  }
  function build() {
    W = innerWidth;
    H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var gap = W < 760 ? 26 : 22;
    stars = [];
    for (var y = 0; y < H * 1.5; y += gap)
      for (var x = gap / 2; x < W; x += gap)
        if (Math.random() < 0.5)
          stars.push({ x: x + rnd(-7, 7), y: y + rnd(-7, 7), r: rnd(0.45, 1.1), a: rnd(0.07, 0.38), s: rnd(0.3, 1.2), p: rnd(0, 6.28), b: Math.random() < 0.2 });
    logo = shape();
  }
  function draw(now) {
    var t = calm ? 99999 : now - start,
      sy = scrollY,
      span = H * 1.5,
      i,
      d;
    ctx.clearRect(0, 0, W, H);
    // le ciel : de tout petits points qui scintillent, avec un léger décalage au défilement
    for (i = 0; i < stars.length; i++) {
      d = stars[i];
      var y = (((d.y - sy * 0.06) % span) + span) % span - H * 0.25;
      if (y < -2 || y > H + 2) continue;
      var a = calm ? d.a : d.a * (0.55 + 0.45 * Math.sin(t * 0.001 * d.s + d.p));
      ctx.fillStyle = d.b ? "rgba(159,200,255," + a + ")" : "rgba(255,255,255," + a + ")";
      ctx.fillRect(d.x, y, d.r * 2, d.r * 2);
    }
    if (!geo) return;
    // la lueur du soleil (accueil du Lab), sous les points
    if (kind === "index") {
      var gy = geo.y0 - sy,
        lum = ease((t - 200) / 2200);
      if (gy > -geo.R * 1.4 && gy < H + geo.R) {
        var gr = ctx.createRadialGradient(geo.cx, gy, 0, geo.cx, gy, geo.R * 1.35);
        gr.addColorStop(0, "rgba(245,184,61," + (0.26 * lum).toFixed(3) + ")");
        gr.addColorStop(0.55, "rgba(245,184,61," + (0.08 * lum).toFixed(3) + ")");
        gr.addColorStop(1, "rgba(245,184,61,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(geo.cx - geo.R * 1.4, gy - geo.R * 1.4, geo.R * 2.8, geo.R * 2.8);
      }
    }
    // la marque
    var mob2 = W < 760,
      sweep = -90 + 180 * (0.5 - 0.5 * Math.cos(t * 0.0012)),
      cycle = (t % 5200) / 5200;
    for (i = 0; i < logo.length; i++) {
      d = logo[i];
      var x = d.x,
        yy = d.y - sy,
        al,
        col,
        rad = W < 760 ? 1.3 : 1.9;
      if (kind === "index") {
        if (d.k === "sun") {
          // trame : de gros points près de l'horizon, de plus en plus fins vers le bord du soleil
          var rise = ease((t - 250 - d.h * 900) / 1500);
          yy = geo.y0 - sy + (d.y - geo.y0) * rise;
          al = rise * (0.62 + 0.3 * Math.sin(t * 0.0016 + d.p));
          col = d.q < 0.55 ? "255,214,128" : "245,184,61";
          rad = (mob2 ? 0.7 : 1) * (0.9 + 2.4 * (1 - d.q));
        } else {
          al = ease(t / 900) * (0.7 + 0.2 * Math.sin(t * 0.0012 + d.p));
          col = "235,243,255";
          rad = mob2 ? 1.2 : 1.8;
        }
      } else if (d.k === "bar") {
        al = 0.75;
        col = "95,159,249";
      } else if (kind === "radar") {
        var lag = sweep - d.a;
        if (lag < 0) lag += 360;
        var trail = lag < 60 ? 1 - lag / 60 : 0;
        al = 0.2 + 0.78 * trail;
        rad = (W < 760 ? 1.3 : 1.9) * (1 + 0.5 * trail);
        col = d.hit && trail > 0.05 ? "61,220,151" : "159,200,255";
        if (d.hit) al = Math.max(al, 0.35 + 0.25 * Math.sin(t * 0.003 + d.p));
        // le bord de l'écran et un anneau intérieur restent allumés : la forme du D se lit même hors du faisceau
        if (d.q > 0.84) al = Math.max(al, 0.6);
        else if (Math.abs(d.q - 0.52) < 0.07) al = Math.max(al, 0.36);
      } else {
        var on = ease((cycle * 6 - d.row) * 1.4) * (cycle > 0.86 ? 1 - (cycle - 0.86) / 0.14 : 1);
        al = 0.2 + 0.75 * on;
        if (d.q > 0.84) al = Math.max(al, 0.55); // le contour du D
        col = d.row === 4 && on > 0.5 ? "61,220,151" : "221,235,255";
      }
      if (yy < -4 || yy > H + 4 || al <= 0.01) continue;
      ctx.fillStyle = "rgba(" + col + "," + al.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(x, yy, rad, 0, 6.2832);
      ctx.fill();
    }
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; // environ 30 images par seconde, cela suffit
    last = now;
    draw(now);
  }
  function go() {
    cancelAnimationFrame(raf);
    if (calm) draw(performance.now());
    else if (!document.hidden) raf = requestAnimationFrame(loop);
  }
  var rt = 0;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      build();
      go();
    }, 150);
  });
  addEventListener("load", function () {
    logo = shape();
    go();
  });
  if (calm)
    addEventListener("scroll", function () {
      draw(performance.now());
    }, { passive: true });
  document.addEventListener("visibilitychange", go);
  build();
  go();
})();
