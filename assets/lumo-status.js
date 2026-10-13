/* Lumo status page (status.html): asks the bot how it is doing, every time the page opens and on Refresh.
   GET https://dashboard.lumobot.org/api/public/status (only answers lumobot.org; the bot keeps the answer ~15 s).
     red     the request fails, takes longer than 5 s, or Lumo is not connected to Discord (also while it is starting)
     yellow  connected, but AI chat or music is having trouble
     green   everything works
   The last good answer is kept in this browser (key "lumo-status-last") so a red page can say when Lumo was last seen. */
(function () {
  "use strict";
function T(s, v) { var o = s; try { var el = document.getElementById("lumo-t"), d = el && JSON.parse(el.textContent); if (d && Object.prototype.hasOwnProperty.call(d, s)) o = d[s]; } catch (e) {} return v == null ? o : String(o).split("{n}").join(v); }  /* page language (#lumo-t) */
  var URL = "https://dashboard.lumobot.org/api/public/status";
  var KEY = "lumo-status-last";
  var TIMEOUT = 5000;
  var hero = document.querySelector(".st-hero");
  if (!hero) { return; }
  var $ = function (s) { return document.querySelector(s); };
  var btn = $(".st-refresh"), when = $(".st-checked b");
  var checkedAt = 0, busy = false;

  function fmtTime(sec) {
    var d = new Date(sec * 1000), now = new Date();
    var t = d.toLocaleTimeString((document.documentElement.lang || []), { hour: "numeric", minute: "2-digit" });
    var day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var that = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (that === day) { return "Today, " + t; }
    if (day - that === 864e5) { return "Yesterday, " + t; }
    var opts = { month: "short", day: "numeric" };
    if (d.getFullYear() !== now.getFullYear()) { opts.year = "numeric"; }
    return d.toLocaleDateString((document.documentElement.lang || []), opts) + ", " + t;
  }
  function ago() {
    if (busy) { return; }
    var s = Math.round((Date.now() - checkedAt) / 1000);
    when.textContent = s < 45 ? T("just now") : s < 3600 ? T("{n} min ago", Math.round(s / 60)) : fmtTime(checkedAt / 1000);
  }
  function saved() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v.seen === "number" ? v : null; } catch (e) { return null; }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify({ seen: d.checked_at || Math.floor(Date.now() / 1000), started_at: d.started_at })); } catch (e) { /* private mode */ }
  }
  function pills(parts) {
    document.querySelectorAll(".st-pill").forEach(function (p) {
      p.className = "st-pill is-" + (parts[p.getAttribute("data-part")] || "checking");
    });
  }
  function show(d) {
    var st, sub, parts;
    var up = d && d.gateway_connected === true;
    if (!d) {
      st = "offline"; sub = "down";
      parts = { discord: "offline", ai: "offline", music: "offline", dashboard: "offline" };
    } else if (!up) {
      st = "offline"; sub = d.ready ? "down" : "starting";
      parts = { discord: "offline", ai: "offline", music: "offline", dashboard: "online" };
    } else {
      var ai = d.ai === "degraded", mu = d.music === "degraded";
      st = ai || mu ? "partial" : "online";
      sub = ai && mu ? "both" : ai ? "ai" : mu ? "music" : "ok";
      parts = { discord: "online", ai: ai ? "partial" : "online", music: mu ? "partial" : "online", dashboard: "online" };
    }
    hero.setAttribute("data-st", st);
    hero.setAttribute("data-view", sub === "starting" ? "starting" : st);
    hero.setAttribute("data-sub", sub);
    pills(parts);
    var ping = $(".st-ping"), lab = $(".st-since-l"), since = $(".st-since");
    if (up) {
      ping.textContent = typeof d.latency_ms === "number" ? d.latency_ms + " ms" : "—";
      lab.textContent = T("Online since");
      since.textContent = d.started_at ? fmtTime(d.started_at) : "—";
      save(d);
    } else {
      ping.textContent = "—";
      var last = saved();
      lab.textContent = T("Last seen");
      since.textContent = last ? fmtTime(last.seen) : "—";
    }
  }
  function check() {
    if (busy) { return; }
    busy = true;
    btn.setAttribute("aria-busy", "true"); btn.disabled = true;
    when.textContent = T("checking…");
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, TIMEOUT);
    var started = Date.now();
    fetch(URL, { cache: "no-store", credentials: "omit", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) { throw new Error("HTTP " + r.status); } return r.json(); })
      .then(function (d) { if (!d || typeof d.gateway_connected !== "boolean") { throw new Error("bad answer"); } return d; })
      .catch(function () { return null; })
      .then(function (d) {
        clearTimeout(timer);
        if (!ctrl && Date.now() - started > TIMEOUT) { d = null; }
        busy = false;
        btn.removeAttribute("aria-busy"); btn.disabled = false;
        checkedAt = Date.now();
        show(d);
        ago();
      });
  }
  btn.addEventListener("click", check);
  setInterval(ago, 30000);
  document.addEventListener("visibilitychange", function () {  // back on the tab after a while: look again
    if (!document.hidden && checkedAt && Date.now() - checkedAt > 60000) { check(); }
  });
  check();
})();
