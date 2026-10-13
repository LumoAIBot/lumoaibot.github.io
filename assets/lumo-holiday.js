/* Lumo seasonal themes (site + dashboard). Shared file: keep the copies in the site and the bot repo identical.
   Picks a holiday from the visitor's own date, or the one chosen in the menu (saved in this browser only, key "lumo-holiday"):
     Halloween     Oct 1 - Oct 31
     Thanksgiving  Nov 1 - the Sunday after US Thanksgiving (4th Thursday of November)
     Christmas     the Monday after that - Dec 31
   It sets <html data-holiday="...">, swaps the robot pictures for the dressed-up ones, and draws a few slow particles on a
   canvas behind the page (pointer-events: none; paused when the tab is hidden). Runs again after an in-page navigation. */
(function () {
  "use strict";
  var KEY = "lumo-holiday";
  function T(s) { try { var el = document.getElementById("lumo-t"), d = el && JSON.parse(el.textContent); return d && Object.prototype.hasOwnProperty.call(d, s) ? d[s] : s; } catch (e) { return s; } }  /* page language (#lumo-t) */
  var PREFS = ["auto", "off", "halloween", "thanksgiving", "christmas"];
  var NAMES = { halloween: "Halloween", thanksgiving: "Thanksgiving", christmas: "Christmas" };
  var root = document.documentElement;

  if (window.LumoHoliday) { window.LumoHoliday.init(); return; }

  function season(now) {
    var y = now.getFullYear(), m = now.getMonth();
    if (m === 9) { return "halloween"; }
    if (m !== 10 && m !== 11) { return ""; }
    var first = new Date(y, 10, 1).getDay();
    var thanks = 1 + (4 - first + 7) % 7 + 21;            // 4th Thursday of November
    var today = new Date(y, m, now.getDate());
    return today <= new Date(y, 10, thanks + 3) ? "thanksgiving" : "christmas";  // the Sunday after can be Dec 1
  }
  var mem = null;  // used when storage is blocked (private mode), so a choice still applies on this page
  function pref() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) { v = null; }
    return PREFS.indexOf(v) >= 0 ? v : (mem || "auto");
  }
  function pick(p) { return p === "auto" ? season(new Date()) : (p === "off" ? "" : p); }

  // ------------------------------------------------------------------ robot pictures
  var HS = "(?:halloween|thanksgiving|christmas)";
  var RES = [
    [new RegExp("^(.*?\\bassets/robot/)(?:" + HS + "/)?([a-z]+-\\d+\\.webp)(\\?.*)?$"), function (m, h) { return m[1] + (h ? h + "/" : "") + m[2] + (m[3] || ""); }],
    [new RegExp("^(.*?\\bassets/logo)(?:-" + HS + ")?(\\.webp)(\\?.*)?$"), function (m, h) { return m[1] + (h ? "-" + h : "") + m[2] + (m[3] || ""); }],
    [new RegExp("^(.*?/static/m/)(?:" + HS + "-)?([a-z]+\\.webp)(\\?.*)?$"), function (m, h) { return m[1] + (h ? h + "-" : "") + m[2] + (m[3] || ""); }]
  ];
  var current = null;
  function dress(img) {
    var src = img.getAttribute("src");
    if (!src || img.hasAttribute("data-no-holiday")) { return; }
    for (var i = 0; i < RES.length; i++) {
      var m = src.match(RES[i][0]);
      if (!m) { continue; }
      var next = RES[i][1](m, current);
      if (next !== src) {
        if (current) {
          var plain = RES[i][1](m, "");
          img.addEventListener("error", function onErr() { img.removeEventListener("error", onErr); img.setAttribute("src", plain); });
        }
        img.setAttribute("src", next);
      }
      return;
    }
  }
  function dressAll(node) {
    if (!node || node.nodeType !== 1) { return; }
    if (node.tagName === "IMG") { dress(node); return; }
    var list = node.getElementsByTagName("img");
    for (var i = 0; i < list.length; i++) { dress(list[i]); }
  }
  if (window.MutationObserver) {
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        for (var j = 0; j < recs[i].addedNodes.length; j++) { dressAll(recs[i].addedNodes[j]); }
      }
    }).observe(root, { childList: true, subtree: true });
  }

  // ------------------------------------------------------------------ particles
  var fx = { el: null, ctx: null, parts: [], w: 0, h: 0, dpr: 1, raf: 0, last: 0, kind: "" };
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var BAT = "M0-2C-3-6-7-7-12-5C-10-3-10-1-11 1C-8 0-6 1-5 3C-4 1-2 1 0 2C2 1 4 1 5 3C6 1 8 0 11 1C10-1 10-3 12-5C7-7 3-6 0-2Z";
  var LEAF = "M0 9L-.6 4C-4 6-7.5 5.2-9 2.6C-7 1.6-6.4 0-7-2.2C-4.8-1.6-3.6-2.4-3.6-4.6C-2.2-3.4-.8-4.2 0-8C.8-4.2 2.2-3.4 3.6-4.6C3.6-2.4 4.8-1.6 7-2.2C6.4 0 7 1.6 9 2.6C7.5 5.2 4 6 .6 4Z";
  var paths = {};
  function path(d) { if (!paths[d] && window.Path2D) { paths[d] = new Path2D(d); } return paths[d]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function spawn(kind, initial) {
    var w = fx.w, h = fx.h, p = { x: rnd(0, w), y: initial ? rnd(0, h) : -24, t: rnd(0, 6.28), r: rnd(0, 6.28) };
    if (kind === "halloween") {
      if (Math.random() < 0.6) {
        p.type = "bat"; p.s = rnd(1.4, 2.3); p.vx = rnd(10, 22) * (Math.random() < 0.5 ? -1 : 1); p.vy = rnd(-3, 3);
        p.y = initial ? rnd(0, h * 0.85) : rnd(0, h * 0.7); if (!initial) { p.x = p.vx > 0 ? -30 : w + 30; }
      } else {
        p.type = "pumpkin"; p.s = rnd(1.1, 1.6); p.vx = rnd(-4, 4); p.vy = rnd(8, 14); p.vr = rnd(-0.3, 0.3);
      }
    } else if (kind === "thanksgiving") {
      p.type = "leaf"; p.s = rnd(0.9, 1.6); p.vx = rnd(-6, 6); p.vy = rnd(14, 26); p.vr = rnd(-0.9, 0.9);
      p.c = ["#e8591a", "#d9381e", "#f2a03d", "#b5541c", "#c9a227"][Math.floor(Math.random() * 5)];
    } else {
      p.type = Math.random() < 0.35 ? "flake" : "dot"; p.s = p.type === "flake" ? rnd(0.8, 1.4) : rnd(1.2, 2.6); p.vx = rnd(-5, 5); p.vy = rnd(14, 30); p.vr = rnd(-0.4, 0.4);
    }
    return p;
  }
  function count(kind) {
    var area = Math.max(0.45, Math.min(1.25, (fx.w * fx.h) / (1280 * 800)));
    return Math.round((kind === "christmas" ? 30 : kind === "thanksgiving" ? 14 : 11) * area);
  }
  function size() {
    if (!fx.el) { return; }
    fx.dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.w = window.innerWidth; fx.h = window.innerHeight;
    fx.el.width = Math.round(fx.w * fx.dpr); fx.el.height = Math.round(fx.h * fx.dpr);
  }
  function drawPumpkin(c, light) {
    c.fillStyle = "#f07a12";
    c.beginPath(); c.ellipse(-3.2, 0, 4.2, 5, 0, 0, 6.29); c.ellipse(3.2, 0, 4.2, 5, 0, 0, 6.29); c.fill();
    c.fillStyle = "#ff9a3c"; c.beginPath(); c.ellipse(0, 0, 3.6, 5.3, 0, 0, 6.29); c.fill();
    c.fillStyle = light ? "#3f6212" : "#6aa84f"; c.fillRect(-0.8, -7.6, 1.6, 3);
  }
  function drawFlake(c) {
    c.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
      c.moveTo(0, 0); c.lineTo(ca * 6, sa * 6);
      var bx = ca * 3.6, by = sa * 3.6, b1 = a + 0.75, b2 = a - 0.75;           // little side branches
      c.moveTo(bx, by); c.lineTo(bx + Math.cos(b1) * 2.2, by + Math.sin(b1) * 2.2);
      c.moveTo(bx, by); c.lineTo(bx + Math.cos(b2) * 2.2, by + Math.sin(b2) * 2.2);
    }
    c.stroke();
  }
  function frame(ts) {
    fx.raf = 0;
    if (!fx.el || !fx.kind) { return; }
    var still = !!(reduce && reduce.matches);
    var dt = fx.last ? Math.min((ts - fx.last) / 1000, 0.1) : 0;
    if (!still && fx.last && ts - fx.last < 30) { fx.raf = requestAnimationFrame(frame); return; }  // ~30 fps is plenty
    fx.last = ts;
    var c = fx.ctx, light = root.getAttribute("data-theme") === "light";
    c.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
    c.clearRect(0, 0, fx.w, fx.h);
    for (var i = 0; i < fx.parts.length; i++) {
      var p = fx.parts[i];
      if (!still) {
        p.t += dt; p.x += (p.vx + Math.sin(p.t * 1.3) * (p.type === "bat" ? 6 : 10)) * dt; p.y += (p.vy + (p.type === "bat" ? Math.sin(p.t * 2.1) * 8 : 0)) * dt;
        if (p.vr) { p.r += p.vr * dt; }
        if (p.y > fx.h + 30 || p.x < -60 || p.x > fx.w + 60 || p.y < -60) { fx.parts[i] = spawn(fx.kind, false); continue; }
      }
      c.save(); c.translate(p.x, p.y);
      if (p.type === "bat") {
        c.scale(p.s * (p.vx < 0 ? -1 : 1), p.s * (0.65 + 0.35 * Math.abs(Math.sin(p.t * 9))));
        c.fillStyle = light ? "rgba(59,29,92,.55)" : "rgba(167,139,250,.5)"; c.fill(path(BAT));
      } else if (p.type === "pumpkin") {
        c.rotate(Math.sin(p.r) * 0.5); c.scale(p.s, p.s); c.globalAlpha = light ? 0.7 : 0.6; drawPumpkin(c, light);
      } else if (p.type === "leaf") {
        c.rotate(p.r + Math.sin(p.t * 1.7) * 0.6); c.scale(p.s, p.s * (0.75 + 0.25 * Math.cos(p.t * 2))); c.globalAlpha = light ? 0.75 : 0.6;
        c.fillStyle = p.c; c.fill(path(LEAF));
      } else if (p.type === "flake") {
        c.rotate(p.r); c.scale(p.s, p.s); c.lineWidth = 1.3; c.lineCap = "round";
        c.strokeStyle = light ? "rgba(96,140,200,.8)" : "rgba(235,245,255,.75)"; drawFlake(c);
      } else {
        c.fillStyle = light ? "rgba(120,160,215,.7)" : "rgba(255,255,255,.7)";
        c.beginPath(); c.arc(0, 0, p.s, 0, 6.29); c.fill();
      }
      c.restore();
    }
    if (!still && !document.hidden) { fx.raf = requestAnimationFrame(frame); }
  }
  function kick() {
    if (fx.el && fx.kind && !fx.raf && !document.hidden) { fx.last = 0; fx.raf = requestAnimationFrame(frame); }
  }
  function startFx(kind) {
    if (fx.kind === kind && fx.el) { kick(); return; }
    fx.kind = kind;
    if (fx.raf) { cancelAnimationFrame(fx.raf); fx.raf = 0; }
    if (!kind) { if (fx.el) { fx.el.remove(); fx.el = null; } return; }
    if (!fx.el) {
      fx.el = document.createElement("canvas");
      fx.el.className = "lumo-fx";
      fx.el.setAttribute("aria-hidden", "true");
      fx.ctx = fx.el.getContext("2d");
      if (!fx.ctx) { fx.el = null; return; }
      root.appendChild(fx.el);
      size();
    }
    fx.parts = [];
    for (var n = count(kind), i = 0; i < n; i++) { fx.parts.push(spawn(kind, true)); }
    kick();
  }

  // ------------------------------------------------------------------ apply + menu
  function sync() {
    var p = pref();
    var on = document.querySelectorAll("[data-holiday-set]");
    for (var i = 0; i < on.length; i++) { on[i].setAttribute("aria-pressed", on[i].getAttribute("data-holiday-set") === p ? "true" : "false"); }
    var auto = season(new Date());
    var hint = document.querySelectorAll("[data-holiday-now]");
    for (var j = 0; j < hint.length; j++) { hint[j].textContent = auto ? T("\u00b7 now: {name}").replace("{name}", T(NAMES[auto])) : T("\u00b7 none right now"); }
  }
  function apply() {
    var p = pref(), h = pick(p);
    root.setAttribute("data-holiday-pref", p);
    if (h) { root.setAttribute("data-holiday", h); } else { root.removeAttribute("data-holiday"); }
    if (h !== current) { current = h; dressAll(root); }
    startFx(h);
    sync();
  }
  function set(p) {
    if (PREFS.indexOf(p) < 0) { return; }
    mem = p;
    try { localStorage.setItem(KEY, p); } catch (e) { /* private mode: still applies on this page */ }
    apply();
  }
  function init() {
    document.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest("[data-holiday-set]");
      if (b) { set(b.getAttribute("data-holiday-set")); }
    });
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("resize", function () { size(); kick(); });
    window.addEventListener("storage", function (ev) { if (ev.key === KEY) { apply(); } });
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", sync); }
    apply();
  }
  if (reduce && reduce.addEventListener) { reduce.addEventListener("change", function () { kick(); }); }  // once (not a page listener)
  window.LumoHoliday = { init: init, set: set, pref: pref, active: function () { return current || ""; }, season: season };
  init();
})();
