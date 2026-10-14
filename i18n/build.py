"""Build the Español, Português (Brasil) and 日本語 pages from the English ones.

    python3 i18n/build.py          # rewrite /es/, /pt-br/, /ja/ and the language bits of the English pages
    python3 i18n/build.py --check  # fail if anything would change, or a translation is missing

The English pages at the root are the source. Each text run is looked up by its English in i18n/<code>.json
(see htmltr.py: <1>…</1> and <1/> stand for the page's own markup, {1} for its numbers); a run with no entry stays
English. privacy.html and terms.html stay English and say so. Safe to run again: everything it adds to an English
page sits between <!--i18n--> markers and is replaced, never stacked.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import htmltr  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://lumobot.org/"
LANGS = {"en": ("", "English", "EN"), "es": ("es/", "Español", "ES"), "pt-BR": ("pt-br/", "Português (Brasil)", "PT"),
         "ja": ("ja/", "日本語", "日本")}
PAGES = ["index.html", "features.html", "commands.html", "getting-started.html", "starkeepers.html", "faq.html", "premium.html",
         "dashboard.html", "status.html", "changelog.html", "404.html"]
ENGLISH_ONLY = ["privacy.html", "terms.html"]
ONLY_EN_NOTE = ("This page is only in English.", "Esta página solo está en inglés.", "Esta página só está em inglês.",
                "このページは英語のみです。")
CHANGELOG_NOTE = "The entries below are in English."
GLOBE = ('<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" '
         'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" '
         'cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>')
BLOCK = re.compile(r"\s*<!--i18n-->.*?<!--/i18n-->|<!--i18n-([a-z]+)-->.*?<!--/i18n-\1-->", re.S)


def sha(path: Path, n: int = 10) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:n]


def table(code: str) -> dict:
    d = json.loads((ROOT / "i18n" / f"{code}.json").read_text("utf-8"))
    d.pop("_about", None)
    return d


def url_of(code: str, page: str) -> str:
    base = SITE + LANGS[code][0]
    return base if page == "index.html" else base + page


def href_of(code: str, page: str) -> str:
    return "/" + LANGS[code][0] + ("" if page == "index.html" else page)


def bust(page: str) -> str:
    """Point the shared scripts at their current version, so an edit to one reaches every page."""
    for rel in ["script.js", "styles.css", "assets/lumo-holiday.js", "assets/lumo-music.js", "assets/lumo-status.js",
                "assets/lumo-stats.js"]:
        page = re.sub(r'((?:href|src)="/?' + re.escape(rel) + r')\?v=[0-9a-f]+"', lambda m: f'{m.group(1)}?v={sha(ROOT / rel)}"', page)
    return page


def head_block(code: str, page: str, tr: dict) -> str:
    out = ["<!--i18n-->"]
    if page in PAGES and page != "404.html":
        for c in LANGS:
            out.append(f'<link rel="alternate" hreflang="{c}" href="{url_of(c, page)}">')
        out.append(f'<link rel="alternate" hreflang="x-default" href="{url_of("en", page)}">')
    out.append(f'<link rel="stylesheet" href="/assets/lumo-lang.css?v={sha(ROOT / "assets/lumo-lang.css")}">')
    homes = {c: "/" + v[0] for c, v in LANGS.items()}
    has = "true" if page in PAGES else "false"
    rel = "" if page == "index.html" else page
    out.append("<script>(function(){var D=" + json.dumps(homes) + ',cur="' + code + '",has=' + has + ',rel="' + rel
               + '",p=null;try{p=localStorage.getItem("lumo-lang")}catch(e){}if(!p){if(cur!=="en")return;'
               'var n=navigator.languages||[navigator.language||""];for(var i=0;i<n.length;i++){var c=String(n[i]).toLowerCase();'
               'var m=c.indexOf("pt")===0?"pt-BR":c.indexOf("es")===0?"es":c.indexOf("ja")===0?"ja":c.indexOf("en")===0?"en":null;'
               'if(m){p=m;break}}if(!p||p==="en")return}if(p===cur||!D[p]||!has)return;'
               'location.replace(D[p]+rel+location.search+location.hash)})()</script>')
    if code != "en":
        js = {k[3:]: v for k, v in tr.items() if k.startswith("js:")}
        out.append('<script type="application/json" id="lumo-t">' + json.dumps(js, ensure_ascii=False).replace("</", "<\\/") + "</script>")
    out.append(f'<script src="/assets/lumo-lang.js?v={sha(ROOT / "assets/lumo-lang.js")}" defer></script>')
    out.append("<!--/i18n-->")
    return "\n  ".join(out)


def switcher(code: str, page: str, tr: dict) -> str:
    label = tr.get("Language", "Language")
    items = []
    for c, (_, native, _) in LANGS.items():
        target = page if page in PAGES else "index.html"
        cur = ' aria-current="true"' if c == code else ""
        items.append(f'<a href="{href_of(c, target)}" hreflang="{c}" lang="{c}" data-lang="{c}"{cur}>'
                     f'<span translate="no">{native}</span>{"<span class=lang-ck aria-hidden=true>✓</span>" if c == code else ""}</a>')
    return (f'<!--i18n-sw--><details class="lang-pop"><summary aria-label="{html.escape(label)}: {LANGS[code][1]}" '
            f'title="{html.escape(label)}">{GLOBE}<span class="lang-code" translate="no">{LANGS[code][2]}</span></summary>'
            f'<div class="lang-menu"><span class="lang-h">{html.escape(label)}</span>{"".join(items)}</div></details><!--/i18n-sw-->')


def add_bits(page_html: str, code: str, page: str, tr: dict) -> str:
    page_html = BLOCK.sub("", page_html)
    page_html = page_html.replace("</head>", "  " + head_block(code, page, tr) + "\n</head>", 1)
    page_html = page_html.replace('<div class="theme-pop">', switcher(code, page, tr) + '<div class="theme-pop">', 1)
    return page_html


SKIP = re.compile(r"^(?:[a-z]+:|//|/|#|\?)", re.I)


def rewrite_urls(page_html: str) -> str:
    def fix(u: str) -> str:
        if not u or SKIP.match(u):
            return u
        path = re.split(r"[?#]", u, 1)[0]
        return u if path in PAGES else "../" + u

    def attr(m):
        name, val = m.group(1), m.group(2)
        if name == "srcset":
            val = ", ".join(" ".join([fix(p.strip().split(" ")[0])] + p.strip().split(" ")[1:]) for p in val.split(","))
        else:
            val = fix(val)
        return f'{name}="{val}"'

    return re.sub(r'\b(href|src|srcset|poster)="([^"]*)"', attr, page_html)


def localize_shots(page_html: str, code: str) -> str:
    """Guide screenshots live in assets/guide/<lang>/; use this language's picture when there is one."""
    d = code.lower()

    def swap(m):
        alt = ROOT / "assets" / "guide" / d / m.group(1)
        return f"assets/guide/{d}/{m.group(1)}" if alt.exists() else m.group(0)
    return re.sub(r"assets/guide/en/([\w.-]+)", swap, page_html)


def build_lang(code: str, page: str, en_html: str) -> str:
    tr = table(code)
    src = BLOCK.sub("", en_html)
    if page == "changelog.html":
        src = src.replace('<p class="lead">Highlights of what changed, newest first.</p>',
                          '<p class="lead">Highlights of what changed, newest first.</p>\n'
                          f'      <p class="lang-note">{CHANGELOG_NOTE}</p>', 1)
    src = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', "", src, flags=re.S)  # English-only structured data
    out = htmltr.translate(src, tr.get, lang=code)
    out = localize_shots(out, code)
    out = out.replace(f'"{url_of("en", page)}"', f'"{url_of(code, page)}"')  # canonical, og:url
    out = rewrite_urls(out)
    return add_bits(out, code, page, tr)


def english_only_note(page_html: str) -> str:
    page_html = re.sub(r"<!--i18n-note-->.*?<!--/i18n-note-->", "", page_html, flags=re.S)
    note = "".join(f'<span lang="{c}">{t}</span>' for c, t in zip(LANGS, ONLY_EN_NOTE))
    return page_html.replace('<div class="legal-wrap">',
                             f'<div class="legal-wrap"><!--i18n-note--><p class="lang-note lang-only-en">{note}</p><!--/i18n-note-->', 1)


def outputs() -> dict[Path, str]:
    files: dict[Path, str] = {}
    en = {"Language": "Language"}
    for page in PAGES:
        src = bust((ROOT / page).read_text("utf-8"))
        files[ROOT / page] = add_bits(src, "en", page, en)
        for code in LANGS:
            if code != "en":
                files[ROOT / LANGS[code][0] / page] = build_lang(code, page, src)
    for page in ENGLISH_ONLY:
        src = bust((ROOT / page).read_text("utf-8"))
        files[ROOT / page] = english_only_note(add_bits(src, "en", page, en))
    sm = (ROOT / "sitemap.xml").read_text("utf-8")
    sm = BLOCK.sub("", sm)
    extra = ["<!--i18n-->"]
    for code in LANGS:
        if code == "en":
            continue
        for page in PAGES:
            if page != "404.html":
                extra.append(f"  <url><loc>{url_of(code, page)}</loc><priority>0.7</priority></url>")
    extra.append("<!--/i18n-->")
    files[ROOT / "sitemap.xml"] = sm.replace("</urlset>", "\n".join(extra) + "\n</urlset>", 1)
    return files


def missing_report() -> dict[str, list[str]]:
    keys = []
    for page in PAGES:
        for k in htmltr.collect(BLOCK.sub("", (ROOT / page).read_text("utf-8"))):
            if k not in keys:
                keys.append(k)
    return {c: [k for k in keys if k not in table(c)] for c in LANGS if c != "en"}


def main() -> int:
    check = "--check" in sys.argv
    changed = []
    for path, text in outputs().items():
        old = path.read_text("utf-8") if path.exists() else None
        if old != text:
            changed.append(path.relative_to(ROOT))
            if not check:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, "utf-8")
    for c, miss in missing_report().items():
        print(f"{c}: {len(miss)} text runs stay English")
    if changed:
        print(("would change: " if check else "wrote: ") + ", ".join(map(str, changed)))
    return 1 if (check and changed) else 0


if __name__ == "__main__":
    sys.exit(main())
