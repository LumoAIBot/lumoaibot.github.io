/* Language switcher: remember the pick (the redirect in each page's head reads it) and close the menu on an outside click or Esc. */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".lang-menu a[data-lang]");
    if (a) { try { localStorage.setItem("lumo-lang", a.getAttribute("data-lang")); } catch (err) {} return; }
    document.querySelectorAll("details.lang-pop[open]").forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute("open"); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll("details.lang-pop[open]").forEach(function (d) { d.removeAttribute("open"); var s = d.querySelector("summary"); if (s) s.focus(); });
  });
})();
