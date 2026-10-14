// Lumo showcase: command search/filter, click-to-copy, scroll reveal. No dependencies, no tracking.
(function () {
function T(s, v) { var o = s; try { var el = document.getElementById("lumo-t"), d = el && JSON.parse(el.textContent); if (d && Object.prototype.hasOwnProperty.call(d, s)) o = d[s]; } catch (e) {} return v == null ? o : String(o).split("{n}").join(v); }  /* page language (#lumo-t) */
  const toast = document.getElementById("toast");
  let timer;
  function notify(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  // command search + filter (index page only)
  const search = document.getElementById("cmd-search");
  if (search) {
    const chips = Array.from(document.querySelectorAll(".chip"));
    const groups = Array.from(document.querySelectorAll(".cmd-group"));
    const empty = document.getElementById("cmd-empty");
    let filter = "all";
    // the search also matches the category name (e.g. "music", "coins", "setup")
    groups.forEach((g) => {
      const h = g.querySelector("h2");
      const cat = h ? h.textContent.replace(/\d+\s*$/, "").trim().toLowerCase() : "";
      g.querySelectorAll(".cmd").forEach((c) => { c.dataset.search = (c.dataset.search || "") + " " + cat + " " + (g.dataset.group || ""); });
    });
    const count = document.getElementById("cmd-count");
    const apply = () => {
      const q = (search.value || "").trim().toLowerCase().replace(/\s+/g, " ");
      let shown = 0;
      groups.forEach((g) => {
        const inCat = filter === "all" || g.dataset.group === filter;
        let visible = 0;
        g.querySelectorAll(".cmd").forEach((c) => {
          const ok = inCat && (!q || c.dataset.search.includes(q));
          c.hidden = !ok;
          if (ok) visible++;
        });
        g.hidden = visible === 0;
        shown += visible;
      });
      empty.hidden = shown !== 0;
      if (count) count.textContent = (q || filter !== "all") ? T(shown === 1 ? "{n} match" : "{n} matches", shown) : "";
    };
    search.addEventListener("keydown", (e) => { if (e.key === "Escape") { search.value = ""; apply(); } });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== search && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); search.focus(); }
    });
    search.addEventListener("input", apply);
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        filter = chip.dataset.filter;
        apply();
      })
    );
  }

  // a small Copy button on every command card, with an inline "Copied" confirmation
  const copyText = (text) => navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text) : Promise.reject();
  document.querySelectorAll(".cmd header").forEach((head) => {
    const name = head.querySelector(".cmd-name");
    if (!name || !name.dataset.copy) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "cmd-copy"; b.textContent = T("Copy");
    b.setAttribute("aria-label", T("Copy {n}", name.dataset.copy));
    let t;
    b.addEventListener("click", () => {
      const done = (ok) => {
        b.textContent = ok ? T("Copied \u2713") : name.dataset.copy; b.classList.toggle("ok", ok);
        clearTimeout(t); t = setTimeout(() => { b.textContent = T("Copy"); b.classList.remove("ok"); }, 1600);
      };
      copyText(name.dataset.copy).then(() => done(true), () => done(false));
    });
    const badges = head.querySelector(".badges");
    head.insertBefore(b, badges ? badges.nextSibling : null);
  });

  document.querySelectorAll(".cmd-name").forEach((btn) =>
    btn.addEventListener("click", () => {
      const text = btn.dataset.copy;
      if (!text) { notify(T("Right-click a message → Apps → {n}", btn.textContent)); return; }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => notify(T("Copied {n}", text)), () => notify(text));
      } else {
        notify(text);
      }
    })
  );

  // scroll reveal (elements are visible by default: they are only hidden once this script adds .rv-on, so no-JS visitors and crawlers see everything)
  const items = Array.from(document.querySelectorAll(".reveal"));
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window) || reduce) {
    items.forEach((el) => el.classList.add("in"));
  } else {
    // slight stagger for cards that sit side by side in a grid (unless the page already set data-d)
    items.forEach((el) => {
      if (el.hasAttribute("data-d") || !el.parentElement) return;
      const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal"));
      if (sibs.length > 1) el.style.transitionDelay = (Math.min(sibs.indexOf(el), 5) * 70) + "ms";
    });
    document.documentElement.classList.add("rv-on");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  }

  // living mascot on the home hero: blinks now and then, waves on hover/tap, and leans a little toward the cursor.
  // Eyelids are two small shapes laid over the art; their spots come from each holiday variant, so hats stay put.
  (function () {
    const EYES = { // [x, y, w, h] of each eye, in px of the 512px art
      plain: [[214, 247, 33, 44], [319, 251, 33, 44]],
      halloween: [[221, 292, 27, 35], [307, 295, 27, 35]],
      thanksgiving: [[217, 266, 31, 40], [314, 269, 31, 40]],
      christmas: [[220, 283, 28, 37], [309, 287, 28, 37]],
    };
    const motion = !reduce;
    const fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const rigs = [];
    document.querySelectorAll(".hero-bot img, .hero-bot-m img").forEach((img) => {
      const rig = document.createElement("span");
      rig.className = "bot-rig";
      img.parentNode.insertBefore(rig, img);
      rig.appendChild(img);
      const lids = [document.createElement("span"), document.createElement("span")];
      lids.forEach((l) => { l.className = "bot-lid"; l.setAttribute("aria-hidden", "true"); rig.appendChild(l); });
      const place = () => {
        const m = (img.getAttribute("src") || "").match(/\/(halloween|thanksgiving|christmas)\//);
        (EYES[m ? m[1] : "plain"]).forEach(([x, y, w, h], i) => {
          const s = lids[i].style;
          s.left = ((x - w / 2 - 4) / 5.12) + "%"; s.top = ((y - h / 2 - 4) / 5.12) + "%";
          s.width = ((w + 8) / 5.12) + "%"; s.height = ((h + 8) / 5.12) + "%";
        });
      };
      place();
      new MutationObserver(place).observe(img, { attributes: true, attributeFilter: ["src"] });
      if (motion) {
        const wave = () => { rig.classList.remove("wave"); void rig.offsetWidth; rig.classList.add("wave"); };
        rig.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") wave(); });
        rig.addEventListener("click", wave);
        rig.addEventListener("animationend", (e) => { if (e.animationName === "bot-wave") rig.classList.remove("wave"); });
      }
      rigs.push(rig);
    });
    if (!rigs.length || !motion) return;
    const blink = () => {
      if (document.hidden) return;
      rigs.forEach((r) => { r.classList.remove("blink"); void r.offsetWidth; r.classList.add("blink"); });
      if (Math.random() < 0.2) setTimeout(() => rigs.forEach((r) => { r.classList.remove("blink"); void r.offsetWidth; r.classList.add("blink"); }), 260);
    };
    let bt;
    const loop = () => { bt = setTimeout(() => { blink(); loop(); }, 2600 + Math.random() * 3800); };
    loop();
    document.addEventListener("visibilitychange", () => { clearTimeout(bt); if (!document.hidden) loop(); });
    if (fine) {
      let raf = 0, mx = 0, my = 0;
      window.addEventListener("pointermove", (e) => {
        mx = e.clientX; my = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          rigs.forEach((r) => {
            const b = r.getBoundingClientRect();
            if (!b.width) return;
            const dx = Math.max(-1, Math.min(1, (mx - (b.left + b.width / 2)) / 600));
            const dy = Math.max(-1, Math.min(1, (my - (b.top + b.height / 2)) / 600));
            r.style.transform = `translate(${(dx * 5).toFixed(1)}px, ${(dy * 3).toFixed(1)}px) rotate(${(dx * 3).toFixed(2)}deg)`;
          });
        });
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => rigs.forEach((r) => { r.style.transform = ""; }));
    }
  })();

  // home page demo chat: plays a short scene on a loop. Every message is in the HTML (crawlers and no-JS visitors see the
  // whole chat); the script only hides and reveals them. Pauses off-screen and in hidden tabs; reduced motion keeps the static chat.
  (function () {
    const box = document.getElementById("demo-chat");
    if (!box || reduce || !("IntersectionObserver" in window)) return;
    const steps = Array.from(box.querySelectorAll(".demo-step"));
    const typing = box.querySelector(".demo-typing");
    // [step index or "typing", wait in ms before the next beat]
    const SCRIPT = [[0, 1400], ["typing", 1500], [1, 2600], [2, 3200], [3, 3600], ["reset", 700]];
    let i = 0, timer = 0, visible = false, playing = false;
    const show = (el) => { el.classList.add("on"); };
    const reset = () => { steps.forEach((s) => s.classList.remove("on")); typing.classList.remove("on"); box.classList.remove("demo-fade"); };
    box.classList.add("demo-on");
    steps.forEach(show);  // until it first scrolls into view, the whole chat shows as a still frame (never an empty box)
    let started = false;
    const beat = () => {
      timer = 0;
      if (!visible || document.hidden) { playing = false; return; }
      const [what, wait] = SCRIPT[i];
      if (what === "typing") typing.classList.add("on");
      else if (what === "reset") box.classList.add("demo-fade");
      else { typing.classList.remove("on"); show(steps[what]); }
      i = (i + 1) % SCRIPT.length;
      if (i === 0) timer = setTimeout(() => { reset(); beat(); }, wait);
      else timer = setTimeout(beat, wait);
    };
    const resume = () => {
      if (playing || !visible || document.hidden) return;
      playing = true;
      if (!started) { started = true; timer = setTimeout(() => { box.classList.add("demo-fade"); timer = setTimeout(() => { reset(); beat(); }, 600); }, 2200); }
      else timer = setTimeout(beat, 500);
    };
    const pause = () => { clearTimeout(timer); timer = 0; playing = false; };
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? resume() : pause(); }, { threshold: 0.25 }).observe(box);
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));
  })();

  // close the mobile menu after picking a link or pressing Escape
  const menu = document.querySelector(".nav-menu");
  if (menu) {
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) menu.removeAttribute("open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") menu.removeAttribute("open"); });
  }

  // open the FAQ entry that the URL hash points to
  function openHash() {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (el && el.tagName === "DETAILS") el.open = true;
  }
  openHash();
  window.addEventListener("hashchange", openHash);
  // theme: Dark (default) / Light / Auto. Saved only in this browser (localStorage). The head script applies it before first paint.
  (function () {
    const root = document.documentElement;
    const KEY = "aeth-theme";
    const ORDER = ["dark", "light", "auto"];  // valid choices
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const read = () => { let v = "dark"; try { v = localStorage.getItem(KEY) || v; } catch (e) {} return ORDER.includes(v) ? v : "dark"; };
    const apply = (pref) => {
      const eff = pref === "auto" ? (mq && mq.matches ? "light" : "dark") : pref;
      root.setAttribute("data-theme-pref", pref);
      root.setAttribute("data-theme", eff);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", eff === "light" ? "#f5f7fb" : "#0b0d14");
      document.querySelectorAll("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeSet === pref)));
      const names = { dark: T("Dark"), light: T("Light"), auto: T("Auto") };
      document.querySelectorAll("[data-theme-menu]").forEach((b) => { b.setAttribute("aria-label", T("Appearance: {n}. Theme and seasonal options", names[pref])); b.title = T("Appearance: {n}", names[pref]); });
    };
    const save = (pref) => { try { localStorage.setItem(KEY, pref); } catch (e) {} apply(pref); };
    // the top-bar button opens a small menu: Appearance (Dark / Light / Auto) and Seasonal (lumo-holiday.js handles those buttons)
    const pop = (open, focusBtn) => {
      document.querySelectorAll("[data-theme-menu]").forEach((b) => {
        const m = document.getElementById(b.getAttribute("aria-controls"));
        if (!m) return;
        m.hidden = !open;
        b.setAttribute("aria-expanded", String(open));
        if (!open && focusBtn) b.focus();
      });
    };
    document.addEventListener("click", (e) => {
      const set = e.target.closest("[data-theme-set]");
      if (set) { save(set.dataset.themeSet); return; }
      const btn = e.target.closest("[data-theme-menu]");
      if (btn) { pop(btn.getAttribute("aria-expanded") !== "true"); return; }
      if (!e.target.closest(".theme-menu")) pop(false);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.querySelector('[data-theme-menu][aria-expanded="true"]')) pop(false, true); });
    if (mq) { const f = () => { if (read() === "auto") apply("auto"); }; mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f); }
    window.addEventListener("storage", (e) => { if (e.key === KEY) apply(read()); });
    apply(read());
  })();
})();
