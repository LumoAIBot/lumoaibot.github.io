/* Lumo live numbers: "in N servers with M members" on the home page.
   Reads https://dashboard.lumobot.org/api/public/stats (two totals, cached 5 minutes on the bot).
   Shows the last numbers it saw straight away, refreshes every 5 minutes while the tab is visible,
   and stays hidden if it has never had an answer. No cookies; the last numbers live in localStorage. */
(function () {
  "use strict";
function T(s, v) { var o = s; try { var el = document.getElementById("lumo-t"), d = el && JSON.parse(el.textContent); if (d && Object.prototype.hasOwnProperty.call(d, s)) o = d[s]; } catch (e) {} return v == null ? o : String(o).split("{n}").join(v); }  /* page language (#lumo-t) */
  var box = document.querySelector("[data-live-stats]");
  if (!box) return;
  var URL_ = box.getAttribute("data-src") || "https://dashboard.lumobot.org/api/public/stats";
  var KEY = "lumo-live-stats", EVERY = 5 * 60 * 1000, timer = 0, last = 0;

  function short(n) {
    n = Math.max(0, Math.floor(+n || 0));
    if (n < 1000) return String(n);
    var units = [[1e9, "B"], [1e6, "M"], [1e3, "k"]];
    for (var i = 0; i < units.length; i++) {
      var u = units[i][0];
      if (n >= u) {
        var v = n / u, d = v < 10 ? 1 : 0, p = Math.pow(10, d);
        var s = (Math.floor(v * p) / p).toFixed(d).replace(/\.0$/, "");
        return s + units[i][1];
      }
    }
    return String(n);
  }

  function show(d) {
    if (!d || typeof d.servers !== "number" || typeof d.members !== "number" || d.servers < 1) return false;
    var s = box.querySelector('[data-stat="servers"]'), m = box.querySelector('[data-stat="members"]');
    if (s) { s.textContent = short(d.servers); s.title = T("{n} servers", d.servers.toLocaleString((document.documentElement.lang || []))); }
    if (m) { m.textContent = short(d.members); m.title = T("{n} members", d.members.toLocaleString((document.documentElement.lang || []))); }
    var sl = box.querySelector('[data-unit="servers"]');
    if (sl) sl.textContent = d.servers === 1 ? T("server") : T("servers");
    box.hidden = false;
    return true;
  }

  try { show(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) {}

  function load() {
    if (document.hidden || !window.fetch) return;
    last = Date.now();
    fetch(URL_, { mode: "cors", credentials: "omit", cache: "default" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (show(d)) { try { localStorage.setItem(KEY, JSON.stringify({ servers: d.servers, members: d.members })); } catch (e) {} }
      })
      .catch(function () {});
  }

  function schedule() { clearInterval(window.__lumoStatsT); timer = window.__lumoStatsT = setInterval(load, EVERY); }
  /* preview: page swaps drop page listeners, so this is re-added when the home page script runs again */
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && Date.now() - last >= EVERY) load();
  });
  load();
  schedule();
})();
