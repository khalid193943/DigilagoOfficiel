(function () {
  var $ = function (id) {
      return document.getElementById(id);
    },
    root = document.documentElement;
  var RMZ =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var U = 1,
    VH = window.innerHeight;
  function lay() {
    var W = root.clientWidth,
      H = window.innerHeight,
      M = W < 760 || W / H < 0.78,
      u = M ? W / 390 : Math.min(W / 1440, Math.max(H, 760) / 900);
    U = u;
    VH = H;
    root.dataset.mode = M ? "M" : "D";
    root.style.setProperty("--u", u + "px");
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
  lay();
  window.addEventListener("resize", lay);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lay);
  $("fnav").classList.add("on");
  // La barre du haut se range quand on descend et revient dès qu'on remonte.
  (function () {
    var nav = $("fnav"),
      last = window.scrollY,
      acc = 0,
      tick = false;
    window.addEventListener(
      "scroll",
      function () {
        if (tick) return;
        tick = true;
        requestAnimationFrame(function () {
          tick = false;
          var y = window.scrollY,
            d = y - last;
          last = y;
          acc = d > 0 === acc > 0 ? acc + d : d;
          var sh = $("sheet");
          if (acc > 40 && y > 140 && !(sh && sh.classList.contains("open"))) nav.classList.add("away");
          else if (acc < -24 || y < 140) nav.classList.remove("away");
        });
      },
      { passive: true },
    );
  })();
  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".fnav .fl a").forEach(function (a) {
    if (a.getAttribute("href") === here) a.classList.add("cur-p");
  });
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
      { threshold: 0.15 },
    );
    document.querySelectorAll(".rv, .ai").forEach(function (el) {
      io.observe(el);
    });
    var fo = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) $("foot").classList.add("open");
        });
      },
      { threshold: 0.3 },
    );
    fo.observe($("foot"));
  } else {
    document.querySelectorAll(".rv").forEach(function (el) {
      el.classList.add("in");
    });
  }
  var fine = window.matchMedia && matchMedia("(pointer:fine)").matches,
    cur = $("cur"),
    cx = -100,
    cy = -100,
    tx = -100,
    ty = -100;
  if (fine && cur) {
    // Le curseur ne s'anime que lorsque la souris bouge, puis s'arrête.
    var curRaf = 0;
    function loop() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cur.style.transform =
        "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      curRaf =
        Math.abs(tx - cx) + Math.abs(ty - cy) > 0.3
          ? requestAnimationFrame(loop)
          : 0;
    }
    window.addEventListener(
      "pointermove",
      function (e) {
        tx = e.clientX;
        ty = e.clientY;
        cur.classList.add("on");
        var t =
          e.target.closest &&
          e.target.closest("a, button, select, input, textarea, summary");
        cur.classList.toggle("big", !!t);
        if (!curRaf) curRaf = requestAnimationFrame(loop);
      },
      { passive: true },
    );
    document
      .querySelectorAll(".cta, .cband a, .foot .wa")
      .forEach(function (el) {
        el.style.transition = "transform .45s cubic-bezier(.16,1,.3,1)";
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.transform =
            "translate(" +
            (e.clientX - r.left - r.width / 2) * 0.2 +
            "px," +
            (e.clientY - r.top - r.height / 2) * 0.3 +
            "px)";
        });
        el.addEventListener("pointerleave", function () {
          el.style.transform = "";
        });
      });
  } else if (cur) cur.remove();
  var prog = document.createElement("div");
  prog.className = "prog";
  document.body.appendChild(prog);
  document.querySelectorAll(".rv").forEach(function (el) {
    var sib = Array.prototype.filter.call(
      el.parentElement.children,
      function (c) {
        return c.classList.contains("rv");
      },
    );
    el.style.setProperty("--i", Math.max(0, sib.indexOf(el)));
  });
  if ("IntersectionObserver" in window) {
    var mo = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) {
            en.target._mask.classList.add("in");
            mo.unobserve(en.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll(".mask").forEach(function (el) {
      var p = el.parentElement;
      p._mask = el;
      mo.observe(p);
    });
    var co = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          co.unobserve(en.target);
          var el = en.target,
            txt = el.textContent,
            m = txt.match(/^(\d+)(.*)$/);
          if (!m) return;
          var to = +m[1],
            rest = m[2],
            t0 = performance.now();
          (function tick(now) {
            var k = Math.min(1, (now - t0) / 1400),
              e = 1 - Math.pow(1 - k, 3);
            el.textContent = Math.round(to * e) + rest;
            if (k < 1) requestAnimationFrame(tick);
          })(t0);
        });
      },
      { threshold: 0.6 },
    );
    document.querySelectorAll(".stats b").forEach(function (el) {
      co.observe(el);
    });
  }
  var wr = document.querySelectorAll(".wreveal");
  wr.forEach(function (p) {
    p.innerHTML = p.textContent
      .split(/(\s+)/)
      .map(function (w) {
        return /\s+/.test(w) ? w : '<span class="wd">' + w + "</span>";
      })
      .join("");
  });
  if (fine)
    document
      .querySelectorAll(".lab, .chan a, .sv, .pc, .eng > div, .obj > div")
      .forEach(function (el) {
        el.classList.add("tilt");
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect(),
            x = (e.clientX - r.left) / r.width - 0.5,
            y = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform =
            "perspective(900px) rotateY(" +
            x * 7 +
            "deg) rotateX(" +
            -y * 7 +
            "deg) translateY(-4px)";
        });
        el.addEventListener("pointerleave", function () {
          el.style.transform = "";
        });
      });
  var hero = document.querySelector(".phero"),
    hin = document.querySelectorAll(
      ".phero .hin, .phero .hcta, .phero .anchors, .phero .stats",
    ),
    rows = document.querySelectorAll(".sband .row"),
    bigs = document.querySelectorAll(".pil-big"),
    cb = document.querySelectorAll(".cband"),
    st4 = document.querySelector(".st4");
  // Un seul passage par image : on mesure tout d'abord, puis on écrit.
  // Aucune lecture après écriture, donc aucun recalcul de mise en page forcé.
  var rowW = [],
    wrW = Array.prototype.map.call(wr, function (p) {
      return p.querySelectorAll(".wd");
    }),
    DCL = document.querySelectorAll("#dayclouds .cl"),
    docH = 0;
  function measureStatic() {
    docH = root.scrollHeight;
    rowW = Array.prototype.map.call(rows, function (r) {
      return r.scrollWidth;
    });
  }
  function scene() {
    var sy = window.scrollY,
      H = VH,
      doc = docH - H;
    // lectures
    var rr = Array.prototype.map.call(rows, function (r) {
        return r.getBoundingClientRect();
      }),
      br = Array.prototype.map.call(bigs, function (b) {
        return b.parentElement.getBoundingClientRect().top;
      }),
      cr = Array.prototype.map.call(cb, function (c) {
        return c.getBoundingClientRect().top;
      }),
      r4 = st4 ? st4.getBoundingClientRect().top : 0,
      wrr = Array.prototype.map.call(wr, function (p) {
        return p.getBoundingClientRect();
      }),
      hh = hero ? hero.offsetHeight : 0;
    // écritures
    prog.style.transform = "scaleX(" + (doc > 0 ? Math.min(1, sy / doc) : 0) + ")";
    if (hero && sy < hh * 1.2) {
      var p = Math.min(1, sy / hh);
      hero.style.setProperty("--py", (sy * 0.35).toFixed(1) + "px");
      hin.forEach(function (el, i) {
        el.style.transform =
          "translate3d(0," + (-sy * (0.12 + i * 0.05)).toFixed(1) + "px,0)";
        el.style.opacity = Math.max(0, 1 - p * (1.3 + i * 0.2)).toFixed(3);
      });
    }
    rows.forEach(function (r, i) {
      var b = rr[i];
      if (b.bottom < -200 || b.top > H + 200) return;
      var d = +r.dataset.d,
        off = (b.top - H) * 0.6 * d;
      r.style.transform =
        "translate3d(" +
        (d < 0 ? off : -rowW[i] / 3 + off).toFixed(1) +
        "px,0,0)";
    });
    bigs.forEach(function (b, i) {
      b.style.transform =
        "translate3d(0," + ((br[i] - H * 0.3) * -0.25).toFixed(1) + "px,0)";
    });
    cb.forEach(function (c, i) {
      var k = Math.max(0, Math.min(1, (H - cr[i]) / (H * 0.7)));
      c.style.transform = "scale(" + (0.86 + 0.14 * k).toFixed(4) + ")";
      c.style.borderRadius = ((54 - 30 * k) * U).toFixed(1) + "px";
    });
    if (st4)
      st4.style.setProperty(
        "--sx",
        Math.max(0, Math.min(1, (H * 0.85 - r4) / (H * 0.5))).toFixed(3),
      );
    wr.forEach(function (p, j) {
      var r = wrr[j];
      if (r.bottom < -H || r.top > H * 2) return;
      var k = Math.max(
          0,
          Math.min(1, (H * 0.85 - r.top) / (r.height + H * 0.35)),
        ),
        ws = wrW[j],
        n = Math.floor(k * ws.length * 1.05);
      ws.forEach(function (w, i) {
        w.classList.toggle("on", i < n);
      });
    });
    // Nuages du fond : propriété « translate » (composée sur la carte graphique,
    // sans décaler la mise en page, contrairement à « top »).
    var span = H * 1.9;
    DCL.forEach(function (c) {
      var y =
        ((((+c.dataset.y * H - sy * +c.dataset.f) % span) + span) % span) -
        H * 0.45;
      c.style.translate = "0 " + y.toFixed(1) + "px";
    });
  }
  var ticking = false;
  function req() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        scene();
      });
    }
  }
  window.addEventListener("scroll", req, { passive: true });
  window.addEventListener("resize", function () {
    measureStatic();
    req();
  });
  measureStatic();
  scene();
  if ("ResizeObserver" in window)
    new ResizeObserver(function () {
      measureStatic();
      req();
    }).observe(document.body);
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
  document.querySelectorAll(".blk.dk").forEach(function (el) {
    addPollen(el, 24);
  });
  var hang = document.getElementById("hang");
  if (hang) {
    var hcols = hang.querySelectorAll(".hcol");
    if ("IntersectionObserver" in window) {
      var ho = new IntersectionObserver(
        function (es) {
          es.forEach(function (en) {
            if (en.isIntersecting) {
              hang.classList.add("in");
              ho.disconnect();
            }
          });
        },
        { threshold: 0.15 },
      );
      ho.observe(hang);
    } else hang.classList.add("in");
    // Flottement : ne tourne que lorsque le bloc est à l'écran.
    var hVis = false,
      hRaf = 0;
    function float(now) {
      var r = hang.getBoundingClientRect(),
        H = VH,
        t = now / 1000;
      hcols.forEach(function (c, i) {
        var y =
          +c.dataset.y * U +
          Math.sin(t * 0.9 + i * 1.3) * 7 * U +
          (r.top - H * 0.3) * -+c.dataset.k;
        c.style.transform = "translate3d(0," + y.toFixed(1) + "px,0)";
      });
      hRaf = hVis && !RMZ ? requestAnimationFrame(float) : 0;
    }
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (es) {
        hVis = es[0].isIntersecting;
        if (hVis && !hRaf) hRaf = requestAnimationFrame(float);
      }).observe(hang);
    else requestAnimationFrame(float);
    if (fine)
      hang.querySelectorAll(".ht:not(.ghost)").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var b = el.getBoundingClientRect(),
            x = (e.clientX - b.left) / b.width - 0.5,
            y = (e.clientY - b.top) / b.height - 0.5;
          el.style.transform =
            "perspective(700px) rotateY(" +
            x * 18 +
            "deg) rotateX(" +
            -y * 18 +
            "deg) scale(1.08)";
        });
        el.addEventListener("pointerleave", function () {
          el.style.transform = "";
        });
      });
  }
  var wz = document.getElementById("wz");
  if (wz)
    (function () {
      var card = $("wzCard"),
        steps = card.querySelectorAll(".wz-step"),
        dots = document.querySelectorAll(".rt-dot"),
        cur = 0,
        N = steps.length;
      var st = {
        needs: [],
        name: "",
        met: "",
        city: "El Jadida",
        when: "",
        has: "",
        first: "",
        tel: "",
        mail: "",
        pref: "WhatsApp",
      };
      var ref =
        "DG-" +
        new Date().getFullYear() +
        "-" +
        Math.random().toString(36).slice(2, 6).toUpperCase();
      function preview() {}
      function pop() {}
      function go(i, back) {
        if (i < 0 || i >= N) return;
        steps[cur].classList.remove("on", "back");
        cur = i;
        steps[cur].classList.toggle("back", !!back);
        steps[cur].classList.add("on");
        $("wzBack").disabled = cur === 0;
        $("wzCount").textContent = cur + 1 + " / " + N;
        $("wzErr").textContent = "";
        var nx = $("wzNext");
        nx.classList.toggle("launch", cur === N - 1);
        nx.firstChild.textContent =
          cur === N - 1 ? "Lancer mon projet " : "Continuer";
        dots.forEach(function (d, k) {
          d.classList.toggle("done", k < cur);
          d.classList.toggle("on", k === cur);
        });
        $("rtFill").style.width = (cur / (N - 1)) * 100 + "%";
        $("rtPlane").style.left = (cur / (N - 1)) * 100 + "%";
        if (cur === N - 1) recap();
        var t = steps[cur].querySelector("input");
        if (t && window.matchMedia("(pointer:fine)").matches)
          setTimeout(function () {
            t.focus({ preventScroll: true });
          }, 350);
        var r = card.getBoundingClientRect();
        if (r.top < 60)
          window.scrollTo({
            top: window.scrollY + r.top - 110,
            behavior: "smooth",
          });
      }
      function err(m) {
        $("wzErr").textContent = m;
        card.classList.remove("shake");
        void card.offsetWidth;
        card.classList.add("shake");
      }
      function valid() {
        if (cur === 0 && !st.needs.length) {
          err(
            "Choisissez au moins une option, même « Je ne sais pas encore ».",
          );
          return false;
        }
        if (cur === 1 && !st.name.trim()) {
          err("Le nom de votre entreprise, s’il vous plaît.");
          $("wName").focus();
          return false;
        }
        if (cur === 3 && st.tel.replace(/\D/g, "").length < 8) {
          err("Un numéro de téléphone ou WhatsApp pour vous répondre.");
          $("wTel").focus();
          return false;
        }
        return true;
      }
      function recap() {
        var rows = [
          ["Besoin", st.needs.join(", ") || "—", 0],
          ["Entreprise", (st.name || "—") + (st.met ? ", " + st.met : ""), 1],
          ["Ville", st.city || "—", 1],
          ["Délai", st.when || "À définir", 2],
          ["Site existant", st.has || "À préciser", 2],
          ["Contact", (st.first ? st.first + ", " : "") + (st.tel || "—"), 3],
          ["Préférence", st.pref, 3],
        ];
        $("recap").innerHTML = rows
          .map(function (r) {
            return (
              '<div data-go="' + r[2] + '"><dt>' + r[0] + "</dt><dd></dd></div>"
            );
          })
          .join("");
        $("recap")
          .querySelectorAll("dd")
          .forEach(function (dd, k) {
            dd.textContent = rows[k][1];
          });
        $("recap")
          .querySelectorAll("div")
          .forEach(function (dv) {
            dv.addEventListener("click", function () {
              go(+dv.dataset.go, true);
            });
          });
      }
      function dgLead(o) {
        try {
          var api = (
            document.documentElement.getAttribute("data-api") || ""
          ).replace(/\/$/, "");
          if (!api) return;
          fetch(api + "/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(o),
            keepalive: true,
          }).catch(function () {});
        } catch (e) {}
      }
      function launch() {
        var L = [
          "Bonjour Digilago, je démarre un projet.",
          "",
          "Référence : " + ref,
          "Besoin : " + st.needs.join(", "),
          "Entreprise : " + st.name + (st.met ? " (" + st.met + ")" : ""),
          "Ville : " + (st.city || "El Jadida"),
          "Délai : " + (st.when || "À définir"),
          "Site existant : " + (st.has || "À préciser"),
          "",
          "Contact : " +
            (st.first ? st.first + ", " : "") +
            st.tel +
            (st.mail ? ", " + st.mail : ""),
          "Préférence : " + st.pref,
        ];
        var url =
          "https://wa.me/212649953813?text=" + encodeURIComponent(L.join("\n"));
        dgLead({
          name: st.first || st.name,
          company: st.name,
          phone: st.tel,
          email: st.mail,
          need: st.needs.join(", ") + (st.met ? " (" + st.met + ")" : ""),
          message: L.join("\n"),
          source: "Démarrer un projet " + ref,
        });
        $("wzWa").href = url;
        window.open(url, "_blank", "noopener");
        card.classList.add("sent");
        $("wzRef").textContent = "Référence " + ref;
        dots.forEach(function (d) {
          d.classList.add("done");
          d.classList.remove("on");
        });
        $("rtFill").style.width = "100%";
        $("rtPlane").style.left = "100%";
        $("rtPlane").style.transform = "translateY(-26px) rotate(-18deg)";
      }
      $("wzNext").addEventListener("click", function () {
        if (!valid()) return;
        if (cur === N - 1) launch();
        else go(cur + 1);
      });
      $("wzBack").addEventListener("click", function () {
        go(cur - 1, true);
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.target.tagName === "INPUT") {
          e.preventDefault();
          $("wzNext").click();
        }
      });
      document.querySelectorAll("#tNeeds .wtile").forEach(function (b) {
        b.addEventListener("click", function () {
          var on = b.getAttribute("aria-pressed") !== "true";
          b.setAttribute("aria-pressed", on);
          var v = b.dataset.need;
          st.needs = st.needs.filter(function (x) {
            return x !== v;
          });
          if (on) st.needs.push(v);
          preview();
          pop();
        });
      });
      function single(sel, key, attr, cb) {
        document.querySelectorAll(sel).forEach(function (b) {
          b.addEventListener("click", function () {
            document.querySelectorAll(sel).forEach(function (x) {
              x.setAttribute("aria-pressed", x === b ? "true" : "false");
              x.classList.toggle("on", x === b);
            });
            st[key] = b.dataset[attr] || b.textContent;
            if (cb) cb(b);
            preview();
            pop();
          });
        });
      }
      single("#tMet .wchip", "met", "met");
      single("#tWhen .wtile", "when", "when");
      single("#tHas .wchip", "has", "has");
      single("#tPref .wchip", "pref", "pref");
      [
        ["wName", "name"],
        ["wCity", "city"],
        ["wFirst", "first"],
        ["wTel", "tel"],
        ["wMail", "mail"],
      ].forEach(function (p) {
        $(p[0]).addEventListener("input", function () {
          st[p[1]] = this.value;
          preview();
        });
      });
      var pn = new URLSearchParams(location.search).get("nom");
      if (pn) {
        st.name = pn;
        var wn = document.getElementById("wName");
        if (wn) wn.value = pn;
      }
      var pm = new URLSearchParams(location.search).get("metier");
      if (pm) {
        st.met = pm;
        if (!st.needs.length) {
          st.needs.push("Site web");
          var sw = document.querySelector('#tNeeds [data-need="Site web"]');
          if (sw) sw.setAttribute("aria-pressed", "true");
        }
      }
      preview();
      go(0);
    })();
  (function () {
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
  })();
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
    var dataEl = document.getElementById("xpData");
    if (!dataEl) return;
    var D = JSON.parse(dataEl.textContent),
      cur = { s: null, m: null },
      win = document.querySelector(".st-win");
    var SECS = document.querySelectorAll(".st-sec"),
      q = document.getElementById("xpQ"),
      res = document.getElementById("xpRes");
    var norm = function (t) {
      return t
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    };
    var ALL = [];
    D.s.forEach(function (s) {
      s.m.forEach(function (m) {
        ALL.push({ s: s, m: m, k: norm(m.n + " " + s.n) });
      });
    });
    D.s.forEach(function (s) {
      (s.a || []).forEach(function (n) {
        ALL.push({
          s: s,
          m: { n: n, u: "", x: 0, g: "e", also: 1 },
          k: norm(n + " " + s.n),
        });
      });
    });
    win.addEventListener("click", function () {
      win.classList.toggle("on");
    });
    function fit(img, box, speed) {
      if (!img || !box) return;
      var go = function () {
        var dy = Math.max(
          0,
          img.getBoundingClientRect().height - box.clientHeight,
        );
        img.style.setProperty("--dy", dy + "px");
        img.style.setProperty(
          "--t",
          Math.max(6, Math.min(26, dy / (speed || 190))) + "s",
        );
      };
      if (img.complete && img.naturalHeight) go();
      else img.addEventListener("load", go, { once: true });
    }
    function current() {
      var ex = document.querySelector(".xp-ex.on");
      if (!ex) return "";
      var i = ex.querySelector("img"),
        v = ex.querySelector("video");
      return i ? i.getAttribute("src") : v ? v.getAttribute("poster") : "";
    }
    function devices() {
      var src = current();
      document.querySelectorAll(".dvc-img").forEach(function (d) {
        if (d.getAttribute("src") !== src) {
          d.onload = function () {
            fit(d, d.parentNode, 300);
          };
          d.src = src;
        }
      });
    }
    function showEx(s, m) {
      document.querySelectorAll(".xp-ex").forEach(function (ex) {
        var on = ex.dataset.e === m.e;
        ex.classList.toggle("on", on);
        var v = ex.querySelector("video");
        if (v) {
          if (on) {
            v.muted = true;
            v.play().catch(function () {});
          } else v.pause();
        }
        if (on) {
          win.classList.remove("on");
          fit(ex.querySelector("img"), ex.querySelector(".xp-vw"));
        }
      });
      document.getElementById("xpUrl").textContent = m.u + ".ma";
      document.getElementById("xpMN").textContent = m.n;
      document.getElementById("xpSN").textContent =
        s.n + (m.g === "p" ? ", indépendant" : "");
      var tag = document.getElementById("xpTag");
      tag.textContent =
        m.x === 1
          ? "Idée de site pour ce métier"
          : m.x === 2
            ? "Idée de site pour ce secteur"
            : "Idée de style, prototype du métier bientôt";
      tag.classList.toggle("style", !m.x);
      document.getElementById("xpGo").href =
        "demarrer.html?metier=" + encodeURIComponent(m.n);
      document.getElementById("xpWa").href =
        "https://wa.me/212649953813?text=" +
        encodeURIComponent(
          "Bonjour Digilago, je voudrais un site pour mon activité : " +
            m.n +
            ".",
        );
      devices();
      if (typeof brand === "function") brand();
    }
    var row = document.getElementById("stRow"),
      rowFor = "";
    function open(k) {
      SECS.forEach(function (sec) {
        var on = sec.dataset.s === k;
        sec.classList.toggle("open", on);
        sec
          .querySelector(".st-h")
          .setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    function fillRow(s) {
      if (rowFor === s.k) return;
      rowFor = s.k;
      row.innerHTML = s.m
        .map(function (m, i) {
          return (
            '<button type="button" class="st-ty' +
            (m.x ? " ok" : "") +
            '" role="option" data-u="' +
            m.u +
            '" style="animation-delay:' +
            i * 45 +
            'ms"><span class="st-tyi">' +
            (m.i || "") +
            "</span><b>" +
            m.n +
            "</b><small>" +
            (m.x === 1
              ? "Idée de site"
              : m.x === 2
                ? "Idée du secteur"
                : "Idée de style") +
            "</small></button>"
          );
        })
        .join("");
      row.scrollLeft = 0;
      row.querySelectorAll(".st-ty").forEach(function (b) {
        b.addEventListener("click", function () {
          pick(s.k, b.dataset.u, false);
        });
      });
      document.getElementById("stAl").innerHTML = s.al || "";
    }
    function pick(k, u, scroll) {
      var s =
        D.s.filter(function (x) {
          return x.k === k;
        })[0] || D.s[0];
      var m =
        s.m.filter(function (x) {
          return x.u === u;
        })[0] || s.m[0];
      cur.s = s;
      cur.m = m;
      open(s.k);
      fillRow(s);
      row.querySelectorAll(".st-ty").forEach(function (b) {
        var on = b.dataset.u === m.u;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
        if (on)
          row.scrollTo({
            left: Math.max(
              0,
              b.offsetLeft - row.clientWidth / 2 + b.offsetWidth / 2,
            ),
            behavior: "smooth",
          });
      });
      showEx(s, m);
      if (history.replaceState)
        history.replaceState(null, "", "#" + s.k + "/" + m.u);
      if (scroll) {
        var app = document.querySelector(".st-app");
        window.scrollTo({
          top: app.getBoundingClientRect().top + window.scrollY - 90,
          behavior: "smooth",
        });
      }
    }
    SECS.forEach(function (sec) {
      sec.querySelector(".st-h").addEventListener("click", function () {
        pick(
          sec.dataset.s,
          null,
          document.documentElement.dataset.mode === "M",
        );
      });
    });
    var BR = { n: "", c: "#1F57C7" };
    try {
      var saved = JSON.parse(localStorage.getItem("dg-brand") || "{}");
      if (saved.c) BR = saved;
    } catch (e) {}
    var bIn = document.getElementById("stbIn"),
      bEl = document.getElementById("stBrand");
    function initials(t) {
      var w = t.trim().split(/\s+/).filter(Boolean);
      return w.length
        ? (w[0][0] + (w[1] ? w[1][0] : w[0][1] || "")).toUpperCase()
        : "VE";
    }
    function slugify(t) {
      return (
        norm(t)
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "votre-entreprise"
      );
    }
    function brand() {
      var name = BR.n.trim() || "Votre entreprise";
      bEl.style.setProperty("--bc", BR.c);
      document.getElementById("stYours").style.setProperty("--bc", BR.c);
      document.getElementById("stbName").textContent = name;
      document.getElementById("stbLogo").textContent = initials(BR.n);
      document.getElementById("xpUrl").textContent = BR.n.trim()
        ? slugify(BR.n) + ".ma"
        : cur.m
          ? cur.m.u + ".ma"
          : "votre-entreprise.ma";
      document.querySelectorAll(".stb-sw button").forEach(function (b) {
        b.setAttribute("aria-pressed", b.dataset.c === BR.c ? "true" : "false");
      });
      if (cur.m)
        document.getElementById("xpGo").href =
          "demarrer.html?metier=" +
          encodeURIComponent(cur.m.n) +
          (BR.n.trim() ? "&nom=" + encodeURIComponent(BR.n.trim()) : "");
      try {
        localStorage.setItem("dg-brand", JSON.stringify(BR));
      } catch (e) {}
    }
    bIn.value = BR.n;
    bIn.addEventListener("input", function () {
      BR.n = bIn.value;
      brand();
    });
    document.querySelectorAll(".stb-sw button").forEach(function (b) {
      b.addEventListener("click", function () {
        BR.c = b.dataset.c;
        brand();
      });
    });
    var modal = document.getElementById("stModal");
    document.getElementById("stFull").addEventListener("click", function () {
      var src = current();
      if (!src) return;
      document.getElementById("stMImg").src = src;
      document.getElementById("stMT").textContent = cur.m.n;
      modal.hidden = false;
      document.documentElement.style.overflow = "hidden";
    });
    function closeM() {
      modal.hidden = true;
      document.documentElement.style.overflow = "";
    }
    document.getElementById("stClose").addEventListener("click", closeM);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeM();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeM();
      if (e.key === "/" && document.activeElement !== q) {
        e.preventDefault();
        q.focus();
      }
    });
    var sq = document.getElementById("sq"),
      ICONS = {};
    try {
      ICONS = JSON.parse(document.getElementById("sqIcons").textContent);
    } catch (e) {}
    var SYN = {
      "entreprise-et-pme":
        "entreprise entreprises societe company business pme startup corporate sarl sa groupe holding شركة مقاولة",
      "medecin-generaliste":
        "medecin docteur doctor generaliste gp famille طبيب",
      dentiste: "dentist dental dents طبيب اسنان",
      "clinique-dentaire": "dental clinic dentaire implant",
      pediatre: "enfant bebe pediatrician kids اطفال",
      pharmacie: "pharmacy parapharmacie صيدلية",
      psychologue: "psy therapist therapie coach mental",
      veterinaire: "vet animaux chien chat pets بيطري",
      kinesitherapeute: "kine physio physiotherapy reeducation",
      cardiologue: "coeur heart cardio",
      gynecologue: "femme gyneco grossesse",
      "clinique-et-centre-medical":
        "hopital hospital clinic polyclinique مصحة مستشفى",
      "laboratoire-danalyses": "labo lab analyses sang مختبر",
      "centre-de-radiologie": "radio scanner irm imagerie",
      "clinique-esthetique": "esthetique botox laser",
      "clinique-ophtalmologique": "yeux eye vision",
      ophtalmologue: "yeux eye vision ophtalmo",
      riad: "maison hote guesthouse marrakech رياض",
      hotel: "hotel فندق resort",
      "restaurant-marocain": "restaurant food cuisine مطعم",
      cafe: "coffee coffeeshop مقهى",
      patisserie: "gateaux cake حلويات",
      "cabinet-davocats": "avocat lawyer law محامي",
      notaire: "notary موثق",
      "expert-comptable": "comptable accountant comptabilite",
      "salle-de-sport": "gym fitness musculation crossfit",
      "salon-de-coiffure": "coiffeur coiffeuse hair",
      barbier: "barber coiffeur homme",
      "agence-immobiliere": "real estate immobilier appartement عقار",
      "garage-automobile": "mecanicien mechanic voiture auto",
      "ecole-privee": "ecole school primaire college مدرسة",
      creche: "nursery bebe حضانة",
      maternelle: "kindergarten prescolaire",
      "auto-ecole": "permis driving school",
      "centre-de-langues": "anglais english langue cours",
      "boutique-de-vetements": "mode fashion vetements",
      "entreprise-btp": "construction chantier batiment",
      "agence-de-voyages": "voyage travel tourisme",
    };
    var IDX = ALL.map(function (h) {
      return {
        h: h,
        n: norm(h.m.n),
        w: norm(h.m.n).split(/[^a-z0-9]+/),
        s: norm(h.s.n),
        y: norm(SYN[h.m.u] || ""),
      };
    });
    var act = -1,
      hits = [];
    function lev1(a, b) {
      if (Math.abs(a.length - b.length) > 1) return false;
      var i = 0,
        j = 0,
        d = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
          i++;
          j++;
          continue;
        }
        if (++d > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else {
          i++;
          j++;
        }
      }
      return d + (a.length - i) + (b.length - j) <= 1;
    }
    function score(x, t) {
      var s = 0;
      if (x.n.indexOf(t) === 0) s = 100;
      else if (
        x.w.some(function (w) {
          return w.indexOf(t) === 0;
        })
      )
        s = 85;
      else if (x.n.indexOf(t) !== -1) s = 65;
      else if (
        x.y.split(" ").some(function (w) {
          return w.indexOf(t) === 0;
        })
      )
        s = 55;
      else if (x.y.indexOf(t) !== -1) s = 45;
      else if (x.s.indexOf(t) !== -1) s = 30;
      else if (
        t.length >= 4 &&
        x.w.concat(x.y.split(" ")).some(function (w) {
          return w.length >= 4 && lev1(w.slice(0, Math.max(t.length, 4)), t);
        })
      )
        s = 22;
      return s ? s + (x.h.m.x ? 6 : 0) + (x.h.m.g === "e" ? 2 : 0) : 0;
    }
    function mark(name, t) {
      var n = norm(name),
        i = n.indexOf(t);
      if (!t || i < 0) return name;
      return (
        name.slice(0, i) +
        "<mark>" +
        name.slice(i, i + t.length) +
        "</mark>" +
        name.slice(i + t.length)
      );
    }
    var ARR =
      '<svg class="smq-ar" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    function item(h, i, t) {
      return (
        '<li class="smq-it' +
        (i === act ? " act" : "") +
        '" role="option" data-i="' +
        i +
        '"><span class="smq-si">' +
        (ICONS[h.s.k] || "") +
        '</span><span class="smq-tx"><b>' +
        mark(h.m.n, t) +
        "</b><small>" +
        h.s.n +
        (h.m.g === "p" ? ", indépendant" : "") +
        '</small></span><span class="smq-bd' +
        (h.m.x ? "" : h.m.also ? " al" : " st") +
        '">' +
        (h.m.x
          ? "Idée de site"
          : h.m.also
            ? "Aussi pour ce secteur"
            : "Idée de style") +
        "</span>" +
        ARR +
        "</li>"
      );
    }
    function foot(n) {
      return (
        '<div class="smq-foot"><span><kbd>↑</kbd><kbd>↓</kbd>naviguer</span><span><kbd>Entrée</kbd>ouvrir</span><span><kbd>Échap</kbd>fermer</span><span>' +
        n +
        "</span></div>"
      );
    }
    var ans = document.getElementById("ans"),
      pops = document.getElementById("sqPops"),
      ansT = 0,
      lastKey = "";
    var GEN = {
      boulangerie: "commerce",
      boulanger: "commerce",
      pain: "commerce",
      savon: "industrie",
      cosmetique: "beaute",
      association: "services",
      ong: "services",
      cooperative: "industrie",
      agriculture: "industrie",
      ferme: "industrie",
      traiteur: "restauration",
      mariage: "tourisme",
      evenement: "tourisme",
      decoration: "commerce",
      mode: "commerce",
      informatique: "services",
      agence: "services",
      marketing: "services",
      ecole: "education",
      formation: "education",
      clinique: "sante",
      medecin: "sante",
      hotel: "hotellerie",
      voyage: "tourisme",
      voiture: "services",
      immobilier: "immobilier",
      sport: "sport",
      beaute: "beaute",
      avocat: "juridique",
      usine: "industrie",
    };
    function exSrc(e) {
      var f = document.querySelector('.xp-ex[data-e="' + e + '"]');
      if (!f) return "";
      var i = f.querySelector("img"),
        v = f.querySelector("video");
      return i ? i.getAttribute("src") : v ? v.getAttribute("poster") : "";
    }
    function esc(t) {
      return String(t).replace(/[<>&"]/g, function (c) {
        return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
      });
    }
    function answer(raw) {
      var t = norm(raw.trim());
      if (t.length < 2) {
        ans.classList.remove("show");
        pops.classList.remove("hide");
        setTimeout(function () {
          if (!ans.classList.contains("show")) ans.hidden = true;
        }, 450);
        return;
      }
      var best = IDX.map(function (x) {
        return { x: x, s: score(x, t) };
      })
        .filter(function (o) {
          return o.s;
        })
        .sort(function (a, b) {
          return b.s - a.s;
        })[0];
      var s,
        m,
        known = !!best,
        words = t.split(/\s+/);
      if (best) {
        s = best.x.h.s;
        m = best.x.h.m.also ? s.m[0] : best.x.h.m;
      } else {
        var k = null;
        Object.keys(GEN).some(function (g) {
          if (
            words.some(function (w) {
              return w.indexOf(g) === 0 || (g.indexOf(w) === 0 && w.length > 3);
            })
          ) {
            k = GEN[g];
            return true;
          }
          return false;
        });
        s = D.s.filter(function (x) {
          return x.k === (k || "services");
        })[0];
        m = s.m[0];
      }
      var key = s.k + "/" + m.u + "/" + (known ? 1 : 0) + "/" + t;
      if (key === lastKey) return;
      lastKey = key;
      var label = known && !best.x.h.m.also ? m.n : raw.trim();
      var others = s.m
        .filter(function (x) {
          return x.u !== m.u;
        })
        .slice(0, 6);
      var src = exSrc(m.e),
        href = "demarrer.html?metier=" + encodeURIComponent(label);
      ans.innerHTML =
        '<div class="ans-l"><span class="ans-k"><i></i>' +
        (known ? "Bonne nouvelle" : "Oui, c’est possible") +
        "</span>" +
        "<h3>Oui, nous créons des sites pour <em>" +
        esc(label.charAt(0).toLowerCase() + label.slice(1)) +
        "</em>.</h3>" +
        "<p>" +
        (known
          ? "Votre activité fait partie du secteur <b>" +
            s.n +
            "</b>. Voici une idée de site que nous adapterons à votre logo, vos couleurs et vos textes."
          : "Ce n’est pas encore dans nos exemples, et c’est très bien : nous étudions votre activité et nous construisons un site sur mesure. Voici une idée proche, dans le secteur <b>" +
            s.n +
            "</b>.") +
        "</p>" +
        '<div class="ans-f"><span>Ce que votre site peut contenir</span><ul>' +
        s.f
          .map(function (f) {
            return "<li>" + f + "</li>";
          })
          .join("") +
        "</ul></div>" +
        (others.length
          ? '<div class="ans-s"><span>Nous le faisons aussi pour</span><div>' +
            others
              .map(function (o) {
                return (
                  '<button type="button" data-u="' +
                  o.u +
                  '" data-n="' +
                  esc(o.n) +
                  '">' +
                  o.n +
                  "</button>"
                );
              })
              .join("") +
            "</div></div>"
          : "") +
        '<div class="ans-c"><a class="ans-go" href="' +
        href +
        '">Démarrer mon projet ' +
        ARR +
        '</a><a class="ans-ct" href="contact.html">Nous contacter</a></div></div>' +
        '<div class="ans-r"><button type="button" class="ans-pv" aria-label="Voir cette idée en grand"><span class="ans-bar"><i></i><i></i><i></i><em>' +
        m.u +
        '.ma</em></span><span class="ans-img">' +
        (src ? '<img src="' + src + '" alt="">' : "") +
        '</span><span class="ans-tag">Idée de site : ' +
        esc(m.n) +
        "</span></button><small>Survolez pour parcourir, cliquez pour l’ouvrir en grand</small></div>";
      ans.hidden = false;
      pops.classList.add("hide");
      requestAnimationFrame(function () {
        ans.classList.remove("show");
        void ans.offsetWidth;
        ans.classList.add("show");
      });
      var im = ans.querySelector(".ans-img img"),
        box = ans.querySelector(".ans-img");
      if (im) {
        var fitA = function () {
          var dy = Math.max(
            0,
            im.getBoundingClientRect().height - box.clientHeight,
          );
          im.style.setProperty("--dy", dy + "px");
          im.style.setProperty(
            "--t",
            Math.max(6, Math.min(22, dy / 200)) + "s",
          );
        };
        if (im.complete) fitA();
        else im.addEventListener("load", fitA, { once: true });
      }
      ans.querySelector(".ans-pv").addEventListener("click", function () {
        pick(s.k, m.u, true);
      });
      ans.querySelectorAll(".ans-s button").forEach(function (b) {
        b.addEventListener("click", function () {
          q.value = b.dataset.n;
          answer(b.dataset.n);
        });
      });
    }
    q.addEventListener("input", function () {
      clearTimeout(ansT);
      ansT = setTimeout(function () {
        answer(q.value);
      }, 160);
    });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var b = ans.querySelector(".ans-pv");
        if (b) b.click();
      } else if (e.key === "Escape") {
        q.value = "";
        answer("");
      }
    });
    document.getElementById("sqGo").addEventListener("click", function () {
      if (q.value.trim()) {
        answer(q.value);
        var b = ans.querySelector(".ans-pv");
        if (b) b.click();
      } else q.focus();
    });
    document.querySelectorAll(".smq-pop").forEach(function (b) {
      b.addEventListener("click", function () {
        q.value = b.dataset.q;
        answer(b.dataset.q);
      });
    });
    q.addEventListener("focus", function () {
      sq.classList.add("focus");
    });
    q.addEventListener("blur", function () {
      sq.classList.remove("focus");
    });
    var L3 = {
      fr: {
        k: "Français",
        t: "Bienvenue chez vous.",
        d: "ltr",
        l: ["Accueil", "Services", "À propos", "Contact"],
        c: "Prendre rendez-vous",
        b: "Votre marque",
      },
      en: {
        k: "English",
        t: "Welcome home.",
        d: "ltr",
        l: ["Home", "Services", "About", "Contact"],
        c: "Book now",
        b: "Your brand",
      },
      ar: {
        k: "العربية",
        t: "مرحبًا بكم.",
        d: "rtl",
        l: ["الرئيسية", "خدماتنا", "من نحن", "اتصل بنا"],
        c: "احجز موعدًا",
        b: "علامتك",
      },
    };
    document.querySelectorAll(".l3-sw button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".l3-sw button").forEach(function (x) {
          x.setAttribute("aria-selected", x === b ? "true" : "false");
        });
        var L = L3[b.dataset.l],
          nav = document.getElementById("l3Nav"),
          hi = document.getElementById("l3Hi");
        nav.classList.add("sw");
        hi.classList.add("sw");
        setTimeout(function () {
          nav.dir = L.d;
          hi.dir = L.d;
          nav.querySelector(".l3-logo").textContent = L.b;
          nav.querySelectorAll(".l3-links i").forEach(function (i, k) {
            i.textContent = L.l[k];
          });
          nav.querySelector(".l3-cta").textContent = L.c;
          document.getElementById("l3HiK").textContent = L.k;
          document.getElementById("l3HiT").textContent = L.t;
          nav.classList.remove("sw");
          hi.classList.remove("sw");
        }, 200);
      });
    });
    window.addEventListener("resize", function () {
      var ex = document.querySelector(".xp-ex.on");
      if (ex) fit(ex.querySelector("img"), ex.querySelector(".xp-vw"));
    });
    var h = decodeURIComponent((location.hash || "").slice(1)).split("/");
    pick(
      h[0],
      h[1],
      !!h[0] &&
        D.s.some(function (s) {
          return s.k === h[0];
        }),
    );
  })();
  (function () {
    var els = document.querySelectorAll(".tech2 .term, .tech2 .dials");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) {
        e.classList.add("run");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("run");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.35 },
    );
    els.forEach(function (e) {
      io.observe(e);
    });
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
  (function () {
    var d = document.getElementById("dock");
    if (!d) return;
    var here = location.pathname.split("/").pop() || "index.html";
    d.querySelectorAll("a[data-p]").forEach(function (a) {
      if (a.dataset.p === here) a.classList.add("cur");
    });
    var home = !!document.getElementById("hero");
    function tick() {
      var y = window.scrollY,
        lim = home ? window.innerHeight * 0.9 : 160;
      d.classList.toggle("on", y > lim);
    }
    window.addEventListener(
      "scroll",
      function () {
        requestAnimationFrame(tick);
      },
      { passive: true },
    );
    tick();
  })();
  var sheet = $("sheet"),
    mb = $("mb");
  function setMenu(on) {
    sheet.classList.toggle("open", on);
    if (mb) mb.setAttribute("aria-expanded", on ? "true" : "false");
    root.style.overflow = on ? "hidden" : "";
  }
  if (mb)
    mb.addEventListener("click", function () {
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
    if (e.key === "Escape") setMenu(false);
  });
  var tl = $("tl");
  if (tl) {
    var items = tl.querySelectorAll(":scope > div"),
      tlFill = $("tlFill"),
      tlT = false;
    tlFill.style.transformOrigin = "top";
    function tlStep() {
      tlT = false;
      var r = tl.getBoundingClientRect(),
        tops = Array.prototype.map.call(items, function (it) {
          return it.getBoundingClientRect().top;
        }),
        lim = VH * 0.6,
        p = Math.max(0, Math.min(1, (lim - r.top) / r.height));
      tlFill.style.height = r.height - 12 + "px";
      tlFill.style.transform = "scaleY(" + p.toFixed(4) + ")";
      items.forEach(function (it, i) {
        it.classList.toggle("on", tops[i] < lim);
      });
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!tlT) {
          tlT = true;
          requestAnimationFrame(tlStep);
        }
      },
      { passive: true },
    );
    tlStep();
  }
  document.querySelectorAll(".flt button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".flt button").forEach(function (x) {
        x.classList.toggle("on", x === b);
      });
      var f = b.dataset.f;
      document.querySelectorAll("#pgrid .pc").forEach(function (p) {
        p.classList.toggle("hide", f !== "all" && p.dataset.cat !== f);
      });
    });
  });
  var form = $("cform");
  if (form) {
    form.querySelectorAll(".svs button").forEach(function (b) {
      b.addEventListener("click", function () {
        b.setAttribute(
          "aria-pressed",
          b.getAttribute("aria-pressed") === "true" ? "false" : "true",
        );
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements,
        nom = f.nom.value.trim();
      if (!nom) {
        f.nom.focus();
        f.nom.style.boxShadow = "inset 0 0 0 2px #E23B2E";
        return;
      }
      var svs = Array.prototype.filter
        .call(form.querySelectorAll(".svs button"), function (b) {
          return b.getAttribute("aria-pressed") === "true";
        })
        .map(function (b) {
          return b.textContent;
        });
      var lines = ["Bonjour Digilago,", "", "Nom : " + nom];
      if (f.ent.value.trim()) lines.push("Entreprise : " + f.ent.value.trim());
      lines.push("Métier : " + f.met.value);
      if (f.ville.value.trim()) lines.push("Ville : " + f.ville.value.trim());
      if (f.tel.value.trim()) lines.push("Téléphone : " + f.tel.value.trim());
      if (svs.length) lines.push("Intéressé par : " + svs.join(", "));
      if (f.msg.value.trim()) lines.push("", f.msg.value.trim());
      try {
        var api = (
          document.documentElement.getAttribute("data-api") || ""
        ).replace(/\/$/, "");
        if (api)
          fetch(api + "/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: nom,
              company: f.ent.value.trim(),
              phone: f.tel.value.trim(),
              need: f.met.value + (svs.length ? " : " + svs.join(", ") : ""),
              message: f.msg.value.trim(),
              source: "Formulaire de contact",
            }),
            keepalive: true,
          }).catch(function () {});
      } catch (e) {}
      window.open(
        "https://wa.me/212649953813?text=" +
          encodeURIComponent(lines.join("\n")),
        "_blank",
        "noopener",
      );
      $("ok2").classList.add("on");
    });
  }
})();
