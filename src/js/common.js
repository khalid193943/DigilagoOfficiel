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

  // 2) Carte du monde : chargée seulement quand on s'en approche.
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
