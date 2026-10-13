/* Lumo background music + in-page navigation, so the music keeps playing between pages.
   Music: "Outer Space Loop" by wipics (CC0), https://opengameart.org/content/outer-space-loop
   - Browsers block sound until a tap or key press, so it starts on the first interaction (unless
     the visitor turned it off before: localStorage "lumo-music" = "off").
   - Gapless loop through the Web Audio API; soft volume with a slow fade-in.
   - Same-origin links (and, on the dashboard, form posts) load with fetch and swap <body>, so the
     page never unloads. Anything else (external links, login/logout, downloads, modifier clicks)
     navigates normally. Config: data-slot / data-slot-in / data-slot-mq (top-bar spot on small screens), data-src, data-exclude (path regex), data-forms="1", data-volume, data-fade on the script tag. */
(function () {
  "use strict";
  function T(s) { try { var el = document.getElementById("lumo-t"), d = el && JSON.parse(el.textContent); return d && Object.prototype.hasOwnProperty.call(d, s) ? d[s] : s; } catch (e) { return s; } }  /* page language (#lumo-t) */
  if (window.LumoMusic) { return; }
  var tag = document.currentScript, ds = (tag && tag.dataset) || {};
  var cfg = window.LUMO_MUSIC || {
    src: ds.src, exclude: ds.exclude, forms: ds.forms === "1",
    volume: ds.volume ? parseFloat(ds.volume) : undefined, fade: ds.fade ? parseFloat(ds.fade) : undefined
  };
  var SRC = cfg.src || "/assets/audio/outer-space-loop.mp3";
  var VOL = typeof cfg.volume === "number" ? cfg.volume : 0.16;
  var FADE = typeof cfg.fade === "number" ? cfg.fade : 2.5;
  var EXCLUDE = cfg.exclude ? new RegExp(cfg.exclude) : null;
  var KEY = "lumo-music";
  var pref = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var setPref = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } };

  var ctx = null, gain = null, el = null, started = false, playing = false, btn = null;
  var AC = window.AudioContext || window.webkitAudioContext;

  function fadeTo(v, secs) {
    if (gain && ctx) {
      var t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(v, t + secs);
    } else if (el) {
      var from = el.volume, steps = Math.max(1, Math.round(secs * 20)), i = 0;
      clearInterval(el._fade);
      el._fade = setInterval(function () { i++; el.volume = from + (v - from) * (i / steps); if (i >= steps) { clearInterval(el._fade); } }, 50);
    }
  }
  var seam = null;
  // First and last non-silent sample (the track itself has no silence: it has a crossfade baked in).
  function edges(buf) {
    var th = 1e-4, n = buf.length, first = n, last = 0, c, d, i;
    for (c = 0; c < buf.numberOfChannels; c++) {
      d = buf.getChannelData(c);
      for (i = 0; i < first && i < n; i++) { if (d[i] > th || d[i] < -th) { first = i; break; } }
      for (i = n - 1; i > last; i--) { if (d[i] > th || d[i] < -th) { last = i; break; } }
    }
    if (first >= last) { return [0, buf.duration]; }
    return [first / buf.sampleRate, (last + 1) / buf.sampleRate];
  }
  // Fallback without Web Audio: two <audio> elements that crossfade near the end, so there is no gap.
  var pair = [], cur = 0, level = 0, xfTimer = null, XF = 1.2;
  function elVolume() { return Math.max(0, Math.min(1, level)); }
  function useElement() {
    if (el) { return; }
    for (var k = 0; k < 2; k++) { var a = new Audio(SRC); a.preload = "auto"; a.volume = 0; pair.push(a); }
    el = { play: function () { var p = pair[cur].play(); watch(); return p; },
           pause: function () { pair.forEach(function (a) { a.pause(); }); clearInterval(xfTimer); },
           get currentTime() { return pair[cur].currentTime; },
           get volume() { return level; },
           set volume(v) { level = v; var a = pair[cur], b = pair[1 - cur]; if (!a._xf) { a.volume = elVolume(); } if (!b._xf && b.paused) { b.volume = 0; } } };
    el.play().then(function () { fadeTo(VOL, FADE); }).catch(function () { playing = false; paint(); });
  }
  function watch() {
    clearInterval(xfTimer);
    xfTimer = setInterval(function () {
      var a = pair[cur], b = pair[1 - cur];
      if (!a.duration || a._xf || a.currentTime < a.duration - XF) { return; }
      a._xf = true; b.currentTime = 0; b.volume = 0; b.play();
      var t0 = Date.now();
      var step = setInterval(function () {
        var k = Math.min(1, (Date.now() - t0) / (XF * 1000));
        b.volume = elVolume() * Math.sin(k * Math.PI / 2); a.volume = elVolume() * Math.cos(k * Math.PI / 2);
        if (k >= 1) { clearInterval(step); a.pause(); a._xf = false; cur = 1 - cur; }
      }, 40);
    }, 100);
  }
  function start() {  // call from inside a tap/key handler (iOS needs that)
    playing = true; paint();
    if (!AC) { useElement(); if (el) { el.play(); fadeTo(VOL, FADE); } return; }
    if (!ctx) {
      ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination);
      var unlock = ctx.createBufferSource(); unlock.buffer = ctx.createBuffer(1, 1, 22050); unlock.connect(ctx.destination); unlock.start(0);
    }
    if (ctx.resume) { ctx.resume(); }
    if (!started) {
      started = true;
      fetch(SRC).then(function (r) { if (!r.ok) { throw new Error("audio " + r.status); } return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (ok, bad) { ctx.decodeAudioData(b, ok, bad); }); })
        .then(function (buf) {
          var edge = edges(buf);
          var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
          s.loopStart = edge[0]; s.loopEnd = edge[1];  // skip any decoder/encoder padding, so the loop has no gap
          s.connect(gain); s.start(0, edge[0]);
          seam = { start: edge[0], end: edge[1], duration: buf.duration };
          if (playing) { fadeTo(VOL, FADE); }
        })
        .catch(function () { ctx = null; gain = null; useElement(); });
    } else {
      fadeTo(VOL, FADE);
    }
    if (el) { el.play(); fadeTo(VOL, FADE); }
  }
  function stop() {
    playing = false; paint();
    fadeTo(0, 0.4);
    setTimeout(function () { if (playing) { return; } if (ctx && ctx.suspend) { ctx.suspend(); } if (el) { el.pause(); } }, 450);
  }
  // Leaving (tab hidden, app backgrounded, phone locked, page closing, an off-site link): pause without
  // changing the saved choice; coming back resumes only if it was playing and is not turned off.
  var away = false;
  function leave() {
    if (!playing) { return; }
    away = true; playing = false; paint();
    if (gain && ctx) { fadeTo(0, 0.15); setTimeout(function () { if (!playing && ctx && ctx.suspend) { ctx.suspend(); } }, 160); }
    if (el) { el.pause(); }
  }
  function back() {
    if (!away || document.visibilityState === "hidden") { return; }
    away = false;
    if (pref() !== "off") { start(); }
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { leave(); } else { back(); } });
  window.addEventListener("pagehide", leave);
  window.addEventListener("pageshow", function (e) { if (e.persisted) { back(); } });
  window.addEventListener("focus", back);

  function toggle() {
    away = false;
    if (playing) { stop(); setPref("off"); } else { setPref("on"); start(); }
  }
  function paint() {
    if (!btn) { return; }
    btn.setAttribute("aria-pressed", playing ? "true" : "false");
    btn.classList.toggle("is-on", playing);
    btn.title = playing ? "Music on (tap to turn off)" : "Music off (tap to turn on)";
  }
  function mountButton() {
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button"; btn.className = "lumo-music"; btn.setAttribute("aria-label", T("Toggle music"));
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M9 17.5a2.5 2.5 0 1 1-2-2.45V5.6l10-2.1v11.4a2.5 2.5 0 1 1-2-2.45V7.1l-6 1.26v9.14z"/>' +
        '<path class="lm-x" d="M4 4l16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      btn.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); toggle(); });
      paint();
    }
    // On small screens it sits in the top bar (next to the menu button) so it never covers the page.
    var slot = null, box = null;
    if (SLOT_MQ && SLOT_MQ.matches) {
      slot = ds.slot ? document.querySelector(ds.slot) : null;
      box = !slot && ds.slotIn ? document.querySelector(ds.slotIn) : null;
    }
    btn.classList.toggle("in-bar", !!(slot || box));
    if (slot) { if (btn.nextSibling !== slot) { slot.parentNode.insertBefore(btn, slot); } }
    else if (box) { if (btn.parentNode !== box) { box.appendChild(btn); } }
    else if (btn.parentNode !== document.body) { document.body.appendChild(btn); }
  }
  var SLOT_MQ = (ds.slot || ds.slotIn) && window.matchMedia ? window.matchMedia(ds.slotMq || "all") : null;
  if (SLOT_MQ) { var onMq = function () { if (btn) { mountButton(); } }; if (SLOT_MQ.addEventListener) { SLOT_MQ.addEventListener("change", onMq); } else { SLOT_MQ.addListener(onMq); } }

  // first tap / key anywhere starts the music (not on the toggle itself: its click decides)
  var firstDone = false;
  function first(ev) {
    if (firstDone) { return; }
    if (btn && ev.target && btn.contains(ev.target)) { return; }
    firstDone = true;
    ["pointerdown", "touchstart", "keydown"].forEach(function (t) { document.removeEventListener(t, first, true); });
    if (pref() !== "off" && !playing) { start(); }
  }
  ["pointerdown", "touchstart", "keydown"].forEach(function (t) { document.addEventListener(t, first, true); });

  // ---------------------------------------------------------------- in-page navigation
  // Page scripts add listeners to document/window. Remember them so a page swap can drop the old
  // page's listeners before its script runs again for the new page.
  var pageListeners = [];
  var origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if ((this === document || this === window) && fn !== first) { pageListeners.push([this, type, fn, opts]); }
    return origAdd.call(this, type, fn, opts);
  };
  function dropPageListeners() {
    pageListeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    pageListeners = [];
  }
  function internal(url) {
    if (url.origin !== location.origin) { return false; }
    if (EXCLUDE && EXCLUDE.test(url.pathname)) { return false; }
    return !/\.(png|jpe?g|gif|webp|svg|ico|mp3|ogg|zip|xml|txt|json|pdf)$/i.test(url.pathname);
  }
  function runScripts(root) {
    Array.prototype.forEach.call(root.querySelectorAll("script"), function (old) {
      if (old.type && !/javascript|module/.test(old.type)) { return; }
      if (old.src && /lumo-music|\/static\/music\.js/.test(old.src)) { return; }
      var s = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (a) { s.setAttribute(a.name, a.value); });
      if (old.src) { s.async = false; } else { s.textContent = old.textContent; }
      old.parentNode.replaceChild(s, old);
    });
  }
  var busy = 0;
  function swap(html, url, push, hash) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc.body) { location.href = url; return; }
    dropPageListeners();
    document.title = doc.title;
    if (doc.documentElement.lang) { document.documentElement.lang = doc.documentElement.lang; }  // a language switch swaps in place too
    Array.prototype.forEach.call(document.body.attributes, function (a) { if (!doc.body.hasAttribute(a.name)) { document.body.removeAttribute(a.name); } });
    Array.prototype.forEach.call(doc.body.attributes, function (a) { document.body.setAttribute(a.name, a.value); });
    // scripts in <head> that the next page has and this one doesn't (rare) are added too
    var have = {};
    Array.prototype.forEach.call(document.head.querySelectorAll("script[src]"), function (s) { have[s.getAttribute("src")] = 1; });
    var headScripts = Array.prototype.filter.call(doc.head.querySelectorAll("script[src]"), function (s) { return !/lumo-music|\/static\/music\.js/.test(s.src); });
    document.body.replaceChildren.apply(document.body, Array.prototype.map.call(doc.body.childNodes, function (n) { return document.importNode(n, true); }));
    if (push) { history.pushState({ lumo: 1 }, "", url); }
    headScripts.forEach(function (s) {  // re-run the page script(s) for the new content
      var n = document.createElement("script");
      n.src = s.getAttribute("src"); n.async = false;
      var oldTag = document.head.querySelector('script[src="' + s.getAttribute("src") + '"]');
      if (oldTag && have[s.getAttribute("src")]) { oldTag.remove(); }
      document.head.appendChild(n);
    });
    runScripts(document.body);
    mountButton();
    var target = hash && document.getElementById(hash.slice(1));
    if (target) { target.scrollIntoView(); } else { window.scrollTo(0, 0); }
    var main = document.getElementById("main") || document.querySelector("main");
    if (main) { if (!main.hasAttribute("tabindex")) { main.setAttribute("tabindex", "-1"); } main.focus({ preventScroll: true }); }
    window.dispatchEvent(new CustomEvent("lumo:navigated", { detail: { url: url } }));
  }
  function go(url, push, init) {
    var my = ++busy;
    var dest = new URL(url, location.href);
    document.documentElement.classList.add("lumo-loading");
    return fetch(dest.href, Object.assign({ credentials: "same-origin", headers: { "X-Lumo-Nav": "1" } }, init || {}))
      .then(function (r) {
        var ct = r.headers.get("content-type") || "";
        var final = new URL(r.url || dest.href);
        if (final.origin !== location.origin || ct.indexOf("text/html") < 0 || (EXCLUDE && EXCLUDE.test(final.pathname))) { throw new Error("full"); }
        return r.text().then(function (t) {
          if (my !== busy) { return; }
          var push2 = push || (init && r.redirected && final.href !== location.href);  // a POST answered in place keeps the address
          swap(t, init && !r.redirected ? location.href : final.href + (init ? "" : dest.hash), push2, init ? "" : dest.hash);
        });
      })
      .catch(function () { if (init) { throw new Error("full"); } location.href = dest.href; })
      .finally(function () { document.documentElement.classList.remove("lumo-loading"); });
  }
  origAdd.call(document, "click", function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) { return; }
    var a = ev.target.closest && ev.target.closest("a[href]");
    if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self") || a.hasAttribute("data-no-swap")) { return; }
    var url = new URL(a.href, location.href);
    if (!internal(url)) { if (/^https?:$/.test(url.protocol)) { leave(); } return; }  // leaving the site in this tab
    if (url.pathname === location.pathname && url.search === location.search && url.hash) { return; }  // same-page anchor
    ev.preventDefault();
    go(url.href, true);
  });
  if (cfg.forms) {
    origAdd.call(document, "submit", function (ev) {
      if (ev.defaultPrevented) { return; }
      var f = ev.target;
      if (!f || f.tagName !== "FORM" || f.hasAttribute("data-no-swap") || (f.target && f.target !== "_self")) { return; }
      var url = new URL(f.getAttribute("action") || location.href, location.href);
      if (!internal(url)) { return; }
      var method = (f.getAttribute("method") || "get").toLowerCase();
      var data;
      try { data = new FormData(f, ev.submitter || undefined); } catch (e) { data = new FormData(f); if (ev.submitter && ev.submitter.name) { data.append(ev.submitter.name, ev.submitter.value); } }
      ev.preventDefault();
      if (method === "get") {
        url.search = new URLSearchParams(data).toString();
        go(url.href, true);
        return;
      }
      if (f._lumoSending) { return; }
      f._lumoSending = true;
      var multipart = (f.getAttribute("enctype") || "").toLowerCase() === "multipart/form-data";
      go(url.href, false, { method: "POST", body: multipart ? data : new URLSearchParams(data) }).catch(function () {
        f._lumoSending = false;
        HTMLFormElement.prototype.submit.call(f);  // the server answered with a redirect off-site: let the browser follow it
      });
    });
  }
  origAdd.call(window, "popstate", function () { go(location.href, false); });
  if (history.scrollRestoration) { history.scrollRestoration = "manual"; }

  if (document.body) { mountButton(); } else { origAdd.call(document, "DOMContentLoaded", mountButton); }
  window.LumoMusic = {
    start: start, stop: stop, toggle: toggle,
    get playing() { return playing; },
    get paused() { return !playing; },
    get currentTime() { return ctx ? ctx.currentTime : (el ? el.currentTime : 0); },
    navigate: function (u) { return go(u, true); },
    get seam() { return seam; }
  };
})();
