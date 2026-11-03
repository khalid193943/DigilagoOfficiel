/* Commun à toutes les pages (injecté avant le script de la page). */
(function () {
  var root = document.documentElement;
  root.classList.add("js");

  // 1) Animations en boucle : en pause dès qu'une section sort de l'écran.
  //    Le navigateur ne calcule plus que ce que l'on voit.
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          en.target.classList.toggle("is-off", !en.isIntersecting);
        });
      },
      { rootMargin: "25% 0px" },
    );
    document
      .querySelectorAll("body > section, main > section, section.sec, section.blk, .foot, .sky, #dayclouds")
      .forEach(function (el) {
        io.observe(el);
      });
  }

  // 2) Menus des langues (barre du haut de l'accueil, barre de toutes les pages) : au toucher, ils
  //    s'ouvrent et se ferment ; un toucher ailleurs les referme.
  document.querySelectorAll(".lsw").forEach(function (lsw) {
    var lb = lsw.querySelector("#lang, .lsw-b");
    if (!lb) return;
    lb.addEventListener("click", function (e) {
      e.preventDefault();
      lb.setAttribute("aria-expanded", lsw.classList.toggle("open") ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!lsw.contains(e.target)) {
        lsw.classList.remove("open");
        lb.setAttribute("aria-expanded", "false");
      }
    });
  });

  // 3) Carte du monde : chargée seulement quand on s'en approche.
  var wd = document.getElementById("worldDefs");
  if (wd && wd.dataset.src) {
    var load = function () {
      if (wd.dataset.loaded) return;
      wd.dataset.loaded = "1";
      fetch(wd.dataset.src)
        .then(function (r) {
          return r.text();
        })
        .then(function (t) {
          var i = t.indexOf("<defs>"),
            j = t.lastIndexOf("</defs>");
          if (i < 0 || j < 0) return;
          wd.innerHTML = t.slice(i, j + 7);
          // Safari : on redonne les références pour forcer le redessin.
          document.querySelectorAll("#vmap use").forEach(function (u) {
            var h = u.getAttribute("href");
            u.setAttribute("href", h);
          });
          document.getElementById("vmap").classList.add("ready");
        })
        .catch(function () {
          wd.dataset.loaded = "";
          document.getElementById("vmap").classList.add("ready");
        });
    };
    var vis = document.getElementById("vis") || document.getElementById("vmap");
    if ("IntersectionObserver" in window && vis) {
      var mo = new IntersectionObserver(
        function (es) {
          if (es[0].isIntersecting) {
            mo.disconnect();
            load();
          }
        },
        { rootMargin: "1600px 0px" },
      );
      mo.observe(vis);
    } else load();
    // Et dans tous les cas, une fois la page au repos.
    setTimeout(function () {
      (window.requestIdleCallback || setTimeout)(load);
    }, 4000);
  }
})();
// « On vous rappelle » : prénom + téléphone, envoyés à l'espace de gestion comme les autres demandes.
(function () {
  document.querySelectorAll(".cb-form").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = f.elements.n.value.trim(),
        p = f.elements.p.value.trim();
      if (p.replace(/\D/g, "").length < 8) {
        f.classList.add("err");
        f.elements.p.focus();
        return;
      }
      f.classList.remove("err");
      var api = (
        document.documentElement.getAttribute("data-api") || ""
      ).replace(/\/$/, "");
      if (api)
        try {
          fetch(api + "/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              (window.dgLeadExtra || Object)({
                name: n,
                phone: p,
                need: "Être rappelé",
                message: "Demande de rappel depuis " + location.pathname,
                source: "Rappel, " + document.title.split(" | ")[0] + (window.dgSrc ? window.dgSrc() : ""),
              }),
            ),
            keepalive: true,
          }).catch(function () {});
        } catch (x) {}
      f.classList.add("sent");
      setTimeout(function () {
        location.assign("merci.html?f=rappel" + (n ? "&n=" + encodeURIComponent(n.slice(0, 40)) : ""));
      }, 900);
    });
  });
})();

// Pages suivantes chargées d'avance : au survol d'un lien (ordinateur), à l'approche du doigt (téléphone).
// Le clic ouvre alors la page presque instantanément (les pages sont d'un seul fichier : tout est déjà là).
(function () {
  // l'accueil est seulement téléchargé d'avance (son animation d'arrivée doit se jouer sous les yeux du
  // visiteur) ; les autres pages sont entièrement préparées : le clic les affiche aussitôt
  var HOME = [{ href_matches: "/" }, { href_matches: "/index.html" }, { href_matches: "/:lang(en|ar)/" },
    { href_matches: "/:lang(en|ar)/index.html" }];
  var OUT = { selector_matches: "[target=_blank],[download],.lsw a" };
  var rules = {
    prerender: [
      { source: "document", where: { and: [{ href_matches: "/*" }, { not: OUT }, { not: { or: HOME } }] }, eagerness: "moderate" },
    ],
    // toujours en plus : le téléchargement d'avance (si la préparation complète n'est pas possible, il reste)
    prefetch: [{ source: "document", where: { and: [{ href_matches: "/*" }, { not: OUT }] }, eagerness: "moderate" }],
  };
  if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules")) {
    var s = document.createElement("script");
    s.type = "speculationrules";
    s.textContent = JSON.stringify(rules);
    document.head.appendChild(s);
    return;
  }
  // autres navigateurs : un préchargement simple, une seule fois par page
  var done = {};
  function warm(e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin || a.pathname === location.pathname) return;
    var u = a.href.split("#")[0];
    if (done[u]) return;
    done[u] = 1;
    var l = document.createElement("link");
    l.rel = "prefetch";
    l.href = u;
    document.head.appendChild(l);
  }
  document.addEventListener("pointerover", warm, { passive: true });
  document.addEventListener("touchstart", warm, { passive: true });
})();

// Mesure d'audience et publicité : RIEN n'est chargé avant l'accord du visiteur (loi 09-08, CNDP). Deux choix séparés :
// la mesure d'audience (GA4, Tag Manager, Clarity) et la publicité (pixel Meta, Google Ads). Sans identifiant dans
// src/analytics.json, le bandeau reste caché et aucun outil n'est chargé. Le choix est gardé 12 mois.
(function () {
  var box = null,
    ID = { gtm: /^GTM-[A-Z0-9]{4,12}$/, ga4: /^G-[A-Z0-9]{4,14}$/, clarity: /^[a-z0-9]{6,16}$/, meta: /^\d{10,20}$/, aw: /^AW-\d{6,14}$/,
      aw_lead: /^[\w-]{6,40}$/, aw_wa: /^[\w-]{6,40}$/, aw_tel: /^[\w-]{6,40}$/ },
    cfg = {},
    tools = false,
    ads = false,
    booted = false,
    queue = [],
    loaded = false,
    adsLoaded = false,
    gt = false,
    KEY = "dg_consent",
    SRC = "dg_src",
    ATT = "dg_att",
    EID = "dg_eid";

  // D'où vient la visite ? (utm_source ou site d'origine) : gardé le temps de la visite, sans cookie,
  // et joint à la demande pour savoir ce qui a amené le client (Instagram, Google, ChatGPT…).
  // Pour les publicités, le détail (campagne, annonce, identifiants de clic Google et Meta) est gardé de la même façon
  // et envoyé avec la demande : la gestion sait quelle campagne a amené chaque client.
  try {
    var q = new URLSearchParams(location.search),
      ref = "";
    try {
      ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
    } catch (e) {}
    if (ref === location.hostname.replace(/^www\./, "")) ref = "";
    if (!sessionStorage.getItem(SRC)) {
      var u = q.get("utm_source"),
        s = u ? "utm:" + u + (q.get("utm_medium") ? "/" + q.get("utm_medium") : "") : ref ? "via " + ref : "";
      s = s.replace(/[^\w:\/. -]/g, "").slice(0, 40);
      if (s) sessionStorage.setItem(SRC, s);
    }
    if (!sessionStorage.getItem(ATT)) {
      var at = {},
        any = false;
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid", "fbclid"].forEach(function (k) {
        var v = q.get(k);
        if (v) {
          at[k] = v.replace(/[\u0000-\u001f<>]/g, "").slice(0, 200);
          any = true;
        }
      });
      if (ref) {
        at.referrer = ref.slice(0, 80);
        any = true;
      }
      if (any) {
        at.landing = location.pathname.slice(0, 160);
        at.at = new Date().toISOString();
        sessionStorage.setItem(ATT, JSON.stringify(at));
      }
    }
  } catch (e) {}
  window.dgSrc = function () {
    try {
      var s = sessionStorage.getItem(SRC);
      return s ? " · " + s : "";
    } catch (e) {
      return "";
    }
  };
  function att() {
    try {
      return JSON.parse(sessionStorage.getItem(ATT) || "null") || {};
    } catch (e) {
      return {};
    }
  }
  function cookie(n) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  function uid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }
  // Joint à chaque demande envoyée à la gestion : provenance, identifiant de l'événement (la même demande vue par le
  // navigateur et par le serveur n'est comptée qu'une fois chez Meta et Google), et le choix publicité du visiteur.
  window.dgLeadExtra = function (o) {
    o = o || {};
    var c = get() || {},
      eid = uid();
    try {
      sessionStorage.setItem(EID, eid);
    } catch (e) {}
    o.att = att();
    o.event_id = eid;
    o.consent_ads = !!(ads && c.m);
    if (o.consent_ads) {
      var fbp = cookie("_fbp"),
        fbc = cookie("_fbc");
      if (fbp) o.fbp = fbp;
      if (fbc) o.fbc = fbc;
    }
    o.page = (location.origin + location.pathname).slice(0, 300);
    return o;
  };

  function get() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && v.t && Date.now() - v.t < 365 * 864e5) return v;
    } catch (e) {}
    return null;
  }
  function put(a, m) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ a: a ? 1 : 0, m: m ? 1 : 0, t: Date.now() }));
    } catch (e) {}
  }
  function script(src) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }
  // Google (Analytics et Ads) : une seule bibliothèque, tout refusé par défaut (Consent Mode), puis ouvert selon le choix
  function gtagBase() {
    if (gt) return;
    gt = true;
    var dl = (window.dataLayer = window.dataLayer || []);
    window.gtag = function () {
      dl.push(arguments);
    };
    window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
  }
  function load() {
    if (loaded || !tools) return;
    loaded = true;
    var dl;
    // Consent Mode : la mesure d'audience seulement (la publicité a son propre choix)
    if (cfg.ga4 || cfg.gtm) {
      gtagBase();
      window.gtag("consent", "update", { analytics_storage: "granted" });
    }
    // Google Analytics 4 est envoyé directement ; Tag Manager, s'il est configuré, se charge en plus (pour les balises
    // à venir). Ne pas y ajouter la balise GA4 : les visites seraient comptées deux fois.
    if (cfg.ga4) {
      window.gtag("config", cfg.ga4);
      script("https://www.googletagmanager.com/gtag/js?id=" + cfg.ga4);
    }
    if (cfg.gtm) {
      dl = window.dataLayer;
      dl.push({ "gtm.start": Date.now(), event: "gtm.js" });
      script("https://www.googletagmanager.com/gtm.js?id=" + cfg.gtm);
    }
    if (cfg.clarity) {
      window.clarity =
        window.clarity ||
        function () {
          (window.clarity.q = window.clarity.q || []).push(arguments);
        };
      script("https://www.clarity.ms/tag/" + cfg.clarity);
    }
  }
  // Publicité : pixel Meta et Google Ads, seulement avec l'accord « Publicité »
  function loadAds() {
    if (adsLoaded || !ads) return;
    adsLoaded = true;
    if (cfg.aw) {
      var had = gt && !!cfg.ga4 && loaded;
      gtagBase();
      window.gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
      window.gtag("config", cfg.aw);
      if (!had) script("https://www.googletagmanager.com/gtag/js?id=" + cfg.aw);
    }
    if (cfg.meta) {
      /* code officiel du pixel Meta (fbevents.js), chargé ici seulement */
      if (!window.fbq) {
        var n = (window.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        });
        if (!window._fbq) window._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        script("https://connect.facebook.net/en_US/fbevents.js");
      }
      window.fbq("init", cfg.meta);
      window.fbq("track", "PageView");
    }
  }
  // Événement (demande envoyée, clic WhatsApp, clic téléphone) : mesure d'audience si acceptée, publicité si acceptée
  window.dgTrack = function (name, p) {
    if (!booted) return void queue.push([name, p]);
    p = p || {};
    if (loaded)
      try {
        if (cfg.ga4) window.gtag("event", name, p);
        if (cfg.gtm) {
          var o = { event: name };
          for (var k in p) o[k] = p[k];
          window.dataLayer.push(o);
        }
        if (cfg.clarity && window.clarity) window.clarity("event", name);
      } catch (e) {}
    if (adsLoaded)
      try {
        var eid = p.event_id || "";
        if (cfg.meta && window.fbq) {
          if (name === "generate_lead") window.fbq("track", "Lead", { content_name: p.form || "" }, eid ? { eventID: eid } : undefined);
          else if (name === "click_whatsapp") window.fbq("track", "Contact", { method: "whatsapp" });
          else if (name === "click_tel") window.fbq("track", "Contact", { method: "telephone" });
        }
        var lab = name === "generate_lead" ? cfg.aw_lead : name === "click_whatsapp" ? cfg.aw_wa : name === "click_tel" ? cfg.aw_tel : "";
        if (cfg.aw && lab) window.gtag("event", "conversion", eid ? { send_to: cfg.aw + "/" + lab, transaction_id: eid } : { send_to: cfg.aw + "/" + lab });
      } catch (e) {}
  };
  window.dgEventId = function () {
    try {
      return sessionStorage.getItem(EID) || "";
    } catch (e) {
      return "";
    }
  };
  document.addEventListener(
    "click",
    function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var h = a.getAttribute("href") || "";
      if (/^https:\/\/wa\.me\//.test(h)) window.dgTrack("click_whatsapp", { page: location.pathname });
      else if (/^tel:/.test(h)) window.dgTrack("click_tel", { page: location.pathname });
      else if (/^mailto:/.test(h)) window.dgTrack("click_email", { page: location.pathname });
    },
    true,
  );

  function boot0() {
    box = document.getElementById("dgc");
    if (!box) return;
    for (var k in ID) {
      var v = box.getAttribute("data-" + k) || "";
      if (ID[k].test(v)) cfg[k] = v;
    }
    tools = !!(cfg.gtm || cfg.ga4 || cfg.clarity);
    ads = !!(cfg.meta || cfg.aw);
    if (!tools && !ads) return;
    var c = get();
    if (c && c.a) load();
    if (c && c.m) loadAds();
    // jamais demandé, ou publicité ajoutée depuis le dernier choix : on redemande
    if (!c || (ads && c.m === undefined)) setTimeout(show, 1200);
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-c]");
      if (!b) return;
      var w = b.getAttribute("data-c"),
        ch = box.querySelector(".dgc-ch");
      if (w === "pick" && ch && ch.hidden) {
        ch.hidden = false;
        b.textContent = b.getAttribute("data-save") || b.textContent;
        var cur = get() || {};
        box.querySelectorAll("[data-k]").forEach(function (i) {
          i.checked = i.getAttribute("data-k") === "a" ? cur.a !== 0 : !!cur.m;
        });
        return;
      }
      var a = w === "yes",
        m = ads && w === "yes";
      if (w === "pick")
        box.querySelectorAll("[data-k]").forEach(function (i) {
          if (i.getAttribute("data-k") === "a") a = i.checked;
          else m = ads && i.checked;
        });
      var before = get() || {};
      put(a, m);
      hide();
      if (a) load();
      if (m) loadAds();
      // les outils déjà chargés ne se déchargent pas : on repart de zéro
      if ((loaded && !a) || (adsLoaded && !m) || (before.a && !a) || (before.m && !m)) location.reload();
    });
  }
  // la page « Merci » signale la demande avant la fin du chargement : les événements attendent l'accord lu
  function boot() {
    try {
      boot0();
    } finally {
      booted = true;
      queue.splice(0).forEach(function (a) {
        window.dgTrack(a[0], a[1]);
      });
    }
  }
  function show() {
    box.hidden = false;
    requestAnimationFrame(function () {
      box.classList.add("on");
    });
  }
  function hide() {
    box.classList.remove("on");
    setTimeout(function () {
      box.hidden = true;
    }, 450);
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-cookies]")) {
      e.preventDefault();
      show();
    }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
