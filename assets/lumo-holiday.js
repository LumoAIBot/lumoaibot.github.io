/* Lumo seasonal themes (site + dashboard). Shared file: keep the copies in the site and the bot repo identical.
   Picks a holiday from the visitor's own date, or the one chosen in the menu (saved in this browser only, key "lumo-holiday"):
     Halloween     Oct 1 - Oct 31
     Thanksgiving  Nov 1 - the Sunday after US Thanksgiving (4th Thursday of November)
     Christmas     the Monday after that - Dec 31
   It sets <html data-holiday="...">, swaps the robot pictures for the dressed-up ones, and draws a few slow, detailed particles
   (sprites drawn once, faded behind text and cards) on a canvas behind the page (pointer-events: none; paused when the tab is hidden). Runs again after an in-page navigation. */
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
  // Each look is drawn once into a small offscreen sprite (gradients, faces, veins), then stamped every frame, so it stays light.
  // Flyers pass BEHIND the page: over text, buttons and cards they fade to a faint ghost and come back in the open.
  var fx = { el: null, ctx: null, parts: [], w: 0, h: 0, dpr: 1, raf: 0, last: 0, kind: "", rects: [], rectsAt: 0 };
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var LEAF = "M0 9L-.6 4C-4 6-7.5 5.2-9 2.6C-7 1.6-6.4 0-7-2.2C-4.8-1.6-3.6-2.4-3.6-4.6C-2.2-3.4-.8-4.2 0-8C.8-4.2 2.2-3.4 3.6-4.6C3.6-2.4 4.8-1.6 7-2.2C6.4 0 7 1.6 9 2.6C7.5 5.2 4 6 .6 4Z";
  var OAK = "M0 9L0 5C-2 6-4 5-3.6 3C-5.6 3.4-6.4 1.6-5 .4C-6.6-.4-6.2-2.4-4.4-2.4C-5.2-4.2-3.8-5.4-2.4-4.6C-2.4-6.6-1-7.6 0-8.6C1-7.6 2.4-6.6 2.4-4.6C3.8-5.4 5.2-4.2 4.4-2.4C6.2-2.4 6.6-.4 5 .4C6.4 1.6 5.6 3.4 3.6 3C4 5 2 6 0 5Z";
  var COVER = "p,li,h1,h2,h3,h4,dt,dd,label,summary,figcaption,blockquote,pre,table,img,svg,input,select,textarea,button,.btn,.card,.tile,.cmd,.faq,.bento-tile,.guide-shot,.stage,.chat,.discord,[class*='card'],[class*='panel'],[class*='chip'],[class*='badge']";
  var sprites = {};
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick1(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sprite(key, half, draw) {                       // half = half-size in CSS px; drawn at 3x for sharp edges on any screen
    if (sprites[key]) { return sprites[key]; }
    var k = 3, cv = document.createElement("canvas"); cv.width = cv.height = Math.ceil(half * 2 * k);
    var c = cv.getContext("2d"); if (!c) { return null; }
    c.scale(k, k); c.translate(half, half); draw(c);
    sprites[key] = { cv: cv, half: half }; return sprites[key];
  }
  function grad(c, x0, y0, r0, x1, y1, r1, stops) { var g = c.createRadialGradient(x0, y0, r0, x1, y1, r1); for (var i = 0; i < stops.length; i += 2) { g.addColorStop(stops[i], stops[i + 1]); } return g; }

  function drawBat(c, wing, light) {                       // wing: -1 up, 0 level, 1 down (three flap frames)
    var body = light ? ["#4c2a78", "#1e1033"] : ["#7d5bc4", "#2a1748"], mem = light ? "rgba(76,42,120,.82)" : "rgba(150,118,225,.78)";
    var tip = wing * 6, mid = wing * 3;
    c.fillStyle = mem; c.strokeStyle = light ? "rgba(30,16,51,.55)" : "rgba(40,22,72,.6)"; c.lineWidth = 0.45;
    for (var s = -1; s <= 1; s += 2) {                     // two wings: arm bone, three fingers, scalloped trailing edge
      c.beginPath(); c.moveTo(1.2 * s, -1);
      c.quadraticCurveTo(5 * s, -4 + mid, 9 * s, -3.4 + tip);
      c.quadraticCurveTo(12.5 * s, -2.6 + tip, 14.5 * s, -1.2 + tip);
      c.quadraticCurveTo(12.4 * s, 0 + tip * 0.6, 11.6 * s, 2.2 + tip * 0.5);
      c.quadraticCurveTo(10 * s, 1.2 + mid * 0.6, 8.4 * s, 2.8 + mid * 0.5);
      c.quadraticCurveTo(6.6 * s, 1.6 + mid * 0.5, 5 * s, 3.2 + mid * 0.3);
      c.quadraticCurveTo(3.4 * s, 2.2, 1.4 * s, 2.6);
      c.closePath(); c.fill();
      c.beginPath(); c.moveTo(1.6 * s, -.6); c.lineTo(9 * s, -3.2 + tip);
      c.moveTo(9 * s, -3.2 + tip); c.lineTo(11.6 * s, 2 + tip * 0.5);
      c.moveTo(9 * s, -3.2 + tip); c.lineTo(8.4 * s, 2.6 + mid * 0.5);
      c.moveTo(9 * s, -3.2 + tip); c.lineTo(5 * s, 3 + mid * 0.3); c.stroke();
    }
    c.fillStyle = grad(c, -0.8, -1.6, 0.3, 0, 0, 4, [0, body[0], 1, body[1]]);
    c.beginPath(); c.ellipse(0, 0.6, 2.1, 3.1, 0, 0, 6.29); c.fill();       // body
    c.beginPath(); c.arc(0, -2.6, 1.9, 0, 6.29); c.fill();                   // head
    c.beginPath(); c.moveTo(-1.6, -3.4); c.lineTo(-1.3, -5.6); c.lineTo(-0.4, -3.9); c.moveTo(1.6, -3.4); c.lineTo(1.3, -5.6); c.lineTo(0.4, -3.9); c.fill();  // ears
    c.fillStyle = light ? "#f59e0b" : "#ffd166";                             // little glowing eyes
    c.beginPath(); c.arc(-0.7, -2.7, 0.42, 0, 6.29); c.arc(0.7, -2.7, 0.42, 0, 6.29); c.fill();
  }
  function drawPumpkin(c, face, light) {
    var lobes = [[-4.4, 3.4], [4.4, 3.4], [-2.2, 3.8], [2.2, 3.8], [0, 3.6]];
    for (var i = 0; i < lobes.length; i++) {               // five ribs, each with its own soft highlight
      var x = lobes[i][0], rx = lobes[i][1];
      c.fillStyle = grad(c, x - rx * 0.35, -2.4, 0.4, x, 0.4, rx * 1.6, [0, "#ffb15c", 0.55, "#f07a12", 1, "#b04a06"]);
      c.beginPath(); c.ellipse(x, 0.4, rx, 5.4, 0, 0, 6.29); c.fill();
    }
    c.strokeStyle = "rgba(120,45,4,.45)"; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(-2.6, -4.4); c.quadraticCurveTo(-3.4, 0.4, -2.6, 5.2); c.moveTo(2.6, -4.4); c.quadraticCurveTo(3.4, 0.4, 2.6, 5.2); c.stroke();
    c.fillStyle = light ? "#4d6b1f" : "#6f9a3a";           // stem and a curly vine
    c.beginPath(); c.moveTo(-0.9, -4.6); c.quadraticCurveTo(-0.6, -7, 0.8, -8.2); c.lineTo(1.6, -7.4); c.quadraticCurveTo(0.6, -6.4, 0.9, -4.6); c.fill();
    c.strokeStyle = c.fillStyle; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0.6, -5.6); c.bezierCurveTo(3, -7.6, 4.4, -5, 3, -4.6); c.stroke();
    if (face) {                                            // a jack-o'-lantern with a warm candle glow inside
      c.fillStyle = grad(c, 0, 1, 0.2, 0, 1, 5, [0, "#fff3b0", 0.5, "#ffc93c", 1, "#e8700c"]);
      c.beginPath(); c.moveTo(-3.2, -1.2); c.lineTo(-1.4, -1.6); c.lineTo(-2.1, 0.2); c.closePath();
      c.moveTo(3.2, -1.2); c.lineTo(1.4, -1.6); c.lineTo(2.1, 0.2); c.closePath();
      c.moveTo(-3.6, 1.6); c.lineTo(-2.4, 2.2); c.lineTo(-1.6, 1.6); c.lineTo(-0.6, 2.4); c.lineTo(0.6, 1.6); c.lineTo(1.6, 2.4); c.lineTo(2.4, 1.6); c.lineTo(3.6, 1.6);
      c.quadraticCurveTo(0, 5.6, -3.6, 1.6); c.fill();
    }
  }
  function drawLeaf(c, d, base, light) {
    var p = new Path2D(d);
    c.fillStyle = grad(c, -2, -3, 0.5, 0, 0, 10, [0, "#ffd27a", 0.35, base, 1, light ? "#7a2e0e" : "#8a3412"]);
    c.fill(p); c.strokeStyle = "rgba(90,30,6,.35)"; c.lineWidth = 0.35; c.stroke(p);
    c.strokeStyle = "rgba(255,230,180,.55)"; c.lineWidth = 0.45;                       // midrib and veins
    c.beginPath(); c.moveTo(0, 8.6); c.lineTo(0, -6.6); c.moveTo(0, 2); c.lineTo(-5.6, -0.6); c.moveTo(0, 2); c.lineTo(5.6, -0.6);
    c.moveTo(0, -1.4); c.lineTo(-3, -3.8); c.moveTo(0, -1.4); c.lineTo(3, -3.8); c.stroke();
  }
  function drawAcorn(c) {
    c.fillStyle = grad(c, -1.4, 0, 0.3, 0, 1.6, 4.6, [0, "#e9b56b", 0.6, "#b7772e", 1, "#7a4a16"]);
    c.beginPath(); c.ellipse(0, 1.6, 3, 3.9, 0, 0, 6.29); c.fill();
    c.fillStyle = grad(c, -1, -2.6, 0.2, 0, -1.6, 4, [0, "#9a6a3a", 1, "#5b3a1a"]);
    c.beginPath(); c.ellipse(0, -1.4, 3.7, 2.1, 0, 3.14, 6.29); c.lineTo(3.7, -1.1); c.quadraticCurveTo(0, 0.2, -3.7, -1.1); c.fill();
    c.strokeStyle = "rgba(40,22,8,.45)"; c.lineWidth = 0.35;
    c.beginPath(); for (var i = -3; i <= 3; i += 1.5) { c.moveTo(i - 0.6, -3); c.lineTo(i + 0.6, -0.8); } c.stroke();
    c.strokeStyle = "#5b3a1a"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(0, -3.4); c.quadraticCurveTo(0.6, -4.8, 1.6, -5); c.stroke();
  }
  function drawFlake(c, light, kind) {
    var col = light ? "rgba(70,120,190,.9)" : "rgba(240,248,255,.95)";
    c.shadowColor = light ? "rgba(70,120,190,.4)" : "rgba(190,225,255,.9)"; c.shadowBlur = 2.2;
    c.strokeStyle = col; c.lineCap = "round"; c.lineWidth = 0.8; c.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
      c.moveTo(0, 0); c.lineTo(ca * 6.4, sa * 6.4);
      var bs = kind ? [2.4, 4.4] : [3.6];                  // two flake shapes: fern-like and simple
      for (var j = 0; j < bs.length; j++) {
        var bx = ca * bs[j], by = sa * bs[j], ln = kind ? 2.4 - j * 0.7 : 2.2;
        c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + 0.8) * ln, by + Math.sin(a + 0.8) * ln);
        c.moveTo(bx, by); c.lineTo(bx + Math.cos(a - 0.8) * ln, by + Math.sin(a - 0.8) * ln);
      }
    }
    c.stroke(); c.shadowBlur = 0;
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 0.9, 0, 6.29); c.fill();
  }
  function drawDot(c, light) {
    c.fillStyle = grad(c, 0, 0, 0, 0, 0, 3, light ? [0, "rgba(110,150,210,.9)", 0.5, "rgba(110,150,210,.45)", 1, "rgba(110,150,210,0)"]
                                              : [0, "rgba(255,255,255,1)", 0.45, "rgba(225,238,255,.55)", 1, "rgba(225,238,255,0)"]);
    c.beginPath(); c.arc(0, 0, 3, 0, 6.29); c.fill();
  }
  function drawStar(c, light) {                            // a few warm twinkles among the snow
    c.fillStyle = grad(c, 0, 0, 0, 0, 0, 5, light ? [0, "rgba(202,138,4,.95)", 1, "rgba(202,138,4,0)"] : [0, "rgba(255,236,170,1)", 1, "rgba(255,214,102,0)"]);
    c.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 1.2 : 5, a = i * Math.PI / 4 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
  }
  function look(p, light) {
    var L = light ? "L" : "D";
    switch (p.type) {
      case "bat": return sprite("bat" + p.f + L, 16, function (c) { drawBat(c, p.f - 1, light); });
      case "pumpkin": return sprite("pk" + p.v + L, 10, function (c) { drawPumpkin(c, p.v, light); });
      case "leaf": return sprite("lf" + p.v + p.c + L, 10, function (c) { drawLeaf(c, p.v ? OAK : LEAF, p.c, light); });
      case "acorn": return sprite("ac", 7, drawAcorn);
      case "flake": return sprite("fl" + p.v + L, 8, function (c) { drawFlake(c, light, p.v); });
      case "star": return sprite("st" + L, 6, function (c) { drawStar(c, light); });
      default: return sprite("dt" + L, 4, function (c) { drawDot(c, light); });
    }
  }
  function spawn(kind, initial) {
    var w = fx.w, h = fx.h, p = { x: rnd(0, w), y: initial ? rnd(0, h) : -24, t: rnd(0, 6.28), r: rnd(0, 6.28), a: 1, v: 0, f: 1 };
    if (kind === "halloween") {
      if (Math.random() < 0.6) {
        p.type = "bat"; p.s = rnd(1.35, 2.0); p.vx = rnd(10, 22) * (Math.random() < 0.5 ? -1 : 1); p.vy = rnd(-3, 3);
        p.y = initial ? rnd(0, h * 0.85) : rnd(0, h * 0.7); if (!initial) { p.x = p.vx > 0 ? -30 : w + 30; }
      } else {
        p.type = "pumpkin"; p.v = Math.random() < 0.45 ? 1 : 0; p.s = rnd(1.25, 1.75); p.vx = rnd(-4, 4); p.vy = rnd(8, 14); p.vr = rnd(-0.3, 0.3);
      }
    } else if (kind === "thanksgiving") {
      if (Math.random() < 0.12) { p.type = "acorn"; p.s = rnd(0.9, 1.2); p.vx = rnd(-3, 3); p.vy = rnd(20, 30); p.vr = rnd(-1.2, 1.2); }
      else {
        p.type = "leaf"; p.v = Math.random() < 0.35 ? 1 : 0; p.s = rnd(0.9, 1.5); p.vx = rnd(-6, 6); p.vy = rnd(14, 26); p.vr = rnd(-0.9, 0.9);
        p.c = pick1(["#e8591a", "#d9381e", "#f2a03d", "#c0561c", "#c9a227"]);
      }
    } else {
      var q = Math.random();
      p.type = q < 0.3 ? "flake" : q < 0.36 ? "star" : "dot"; p.v = Math.random() < 0.5 ? 1 : 0;
      p.s = p.type === "flake" ? rnd(0.8, 1.35) : p.type === "star" ? rnd(0.7, 1) : rnd(0.5, 1); p.vx = rnd(-5, 5); p.vy = p.type === "star" ? rnd(8, 14) : rnd(14, 30); p.vr = rnd(-0.4, 0.4);
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
    fx.rectsAt = 0;
  }
  function cover(ts) {                                     // what's on screen that flyers should pass behind (re-measured a few times a second)
    if (ts - fx.rectsAt < 350) { return; }
    fx.rectsAt = ts; fx.rects = [];
    var list = document.querySelectorAll(COVER);
    for (var i = 0; i < list.length && fx.rects.length < 260; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.width && r.height && r.bottom > 0 && r.top < fx.h && r.right > 0 && r.left < fx.w && r.width * r.height < fx.w * fx.h * 0.6) { fx.rects.push([r.left - 4, r.top - 4, r.right + 4, r.bottom + 4]); }
    }
  }
  function hidden(x, y, m) {                               // m: the flyer's own reach, so a wing tip never sits on a word
    for (var i = 0; i < fx.rects.length; i++) { var r = fx.rects[i]; if (x > r[0] - m && x < r[2] + m && y > r[1] - m && y < r[3] + m) { return true; } }
    return false;
  }
  function frame(ts) {
    fx.raf = 0;
    if (!fx.el || !fx.kind) { return; }
    var still = !!(reduce && reduce.matches);
    var dt = fx.last ? Math.min((ts - fx.last) / 1000, 0.1) : 0;
    if (!still && fx.last && ts - fx.last < 30) { fx.raf = requestAnimationFrame(frame); return; }  // ~30 fps is plenty
    fx.last = ts;
    cover(ts || 1);
    var c = fx.ctx, light = root.getAttribute("data-theme") === "light", base = fx.kind === "christmas" ? (light ? 0.8 : 0.75) : (light ? 0.78 : 0.7);
    c.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
    c.clearRect(0, 0, fx.w, fx.h);
    for (var i = 0; i < fx.parts.length; i++) {
      var p = fx.parts[i];
      if (!still) {
        p.t += dt; p.x += (p.vx + Math.sin(p.t * 1.3) * (p.type === "bat" ? 6 : 10)) * dt; p.y += (p.vy + (p.type === "bat" ? Math.sin(p.t * 2.1) * 8 : 0)) * dt;
        if (p.vr) { p.r += p.vr * dt; }
        if (p.y > fx.h + 30 || p.x < -60 || p.x > fx.w + 60 || p.y < -60) { fx.parts[i] = spawn(fx.kind, false); continue; }
      }
      var goal = hidden(p.x, p.y, (p.type === "bat" ? 11 : 6) * p.s) ? 0.08 : 1;
      p.a = still || !dt ? goal : p.a + (goal - p.a) * Math.min(1, dt * 5);
      if (p.a < 0.02) { continue; }
      if (p.type === "bat") { var ph = Math.sin(p.t * 9); p.f = ph > 0.35 ? 0 : ph < -0.35 ? 2 : 1; }
      var sp = look(p, light); if (!sp) { continue; }
      c.save(); c.translate(p.x, p.y); c.globalAlpha = base * p.a;
      if (p.type === "bat") { c.scale(p.s * (p.vx < 0 ? -1 : 1), p.s); }
      else if (p.type === "pumpkin" || p.type === "acorn") { c.rotate(Math.sin(p.r) * 0.5); c.scale(p.s, p.s); }
      else if (p.type === "leaf") { c.rotate(p.r + Math.sin(p.t * 1.7) * 0.6); c.scale(p.s, p.s * (0.75 + 0.25 * Math.cos(p.t * 2))); }
      else if (p.type === "star") { c.globalAlpha *= 0.55 + 0.45 * Math.abs(Math.sin(p.t * 2.4)); c.scale(p.s, p.s); }
      else { c.rotate(p.r); c.scale(p.s, p.s); }
      c.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
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
