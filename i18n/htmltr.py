"""Translate rendered HTML by its English text (the dashboard, and the website's per-language pages).

Pages are written in English. ``translate(html, table)`` finds each run of text (with its inline markup) inside a
block, turns it into a key and swaps in the translation:

* inline tags become numbered placeholders, ``<a href="/x">Levels</a> page`` -> ``<1>Levels</1> page``; the real tags
  (attributes included) go back in from the original, so a translation can move them but never change a link;
* numbers and ``#channel`` / ``@role`` names in the text become ``{1}``, ``{2}`` ... in order, so ``3 members`` and
  ``12 members`` share one key;
* anything inside ``<code>`` or an element with ``translate="no"`` (command names, server names, people's names)
  becomes one opaque placeholder ``<N/>`` and is never translated;
* a few attributes (title, aria-label, placeholder, alt, some meta content) are looked up the same way.

Missing keys keep the English text; ``collect`` lists the keys a page needs (used by tests and the site build).
"""
from __future__ import annotations

import html as _html
import re
from typing import Callable, Optional

TOKEN = re.compile(r"<!--.*?-->|<![^>]*>|<[^>]+>|[^<]+", re.S)
TAG = re.compile(r"<\s*(/)?\s*([a-zA-Z0-9-]+)([^>]*?)(/)?\s*>", re.S)
INLINE = {"a", "b", "strong", "em", "i", "span", "small", "kbd", "br", "abbr", "mark", "sup", "sub", "u", "s", "time", "img", "wbr", "bdi", "q", "cite"}
VOID = {"br", "img", "wbr", "input", "meta", "link", "hr", "source"}
SKIP = {"script", "style", "svg", "textarea", "pre", "template", "noscript", "math"}
OPAQUE = {"code"}
ATTRS = ("title", "aria-label", "placeholder", "alt", "data-tip", "aria-description")
META_NAMES = {"description", "og:title", "og:description", "twitter:title", "twitter:description", "og:image:alt", "twitter:image:alt", "apple-mobile-web-app-title", "application-name"}
# numbers, and #channel / @role / @member names (kept exactly as written)
NUM = re.compile(r"(?<![\w{])\d+(?:[.,:]\d+)*(?![\w}])|(?<![\w&])[#@][^\W\d_][\w-]*|(?<![\w&])[#@]\d+(?![\w-])")
LETTERS = re.compile(r"[A-Za-z]{2}")
WS = re.compile(r"\s+")
ATTR_RE = re.compile(r'([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|\'([^\']*)\')')


def _tag(tok: str):
    m = TAG.match(tok)
    if not m:
        return None, None, False
    name = m.group(2).lower()
    return name, bool(m.group(1)), bool(m.group(4)) or name in VOID


def _attr(tok: str, name: str) -> Optional[str]:
    for m in ATTR_RE.finditer(tok):
        if m.group(1).lower() == name:
            return _html.unescape(m.group(3) if m.group(3) is not None else m.group(4))
    return None


class _Run:
    """Tokens of one text run, and its key."""

    def __init__(self, toks: list[str]):
        self.toks = toks

    def build(self):
        tags: list[str] = []  # placeholder index -> original tag (or opaque html)
        nums: list[str] = []
        out: list[str] = []
        stack: list[tuple[str, int]] = []
        i, n = 0, len(self.toks)
        while i < n:
            t = self.toks[i]
            if t.startswith("<"):
                name, close, void = _tag(t)
                if name is None:
                    out.append(t)
                elif not close and (name in OPAQUE or _attr(t, "translate") == "no") and not void:
                    depth, j = 1, i + 1
                    while j < n and depth:
                        nm, cl, vd = _tag(self.toks[j]) if self.toks[j].startswith("<") else (None, None, True)
                        if nm == name and not vd:
                            depth += -1 if cl else 1
                        j += 1
                    tags.append("".join(self.toks[i:j]))
                    out.append(f"<{len(tags)}/>")
                    i = j
                    continue
                elif close:
                    k = next((idx for idx in range(len(stack) - 1, -1, -1) if stack[idx][0] == name), None)
                    if k is None:
                        tags.append(t); out.append(f"<{len(tags)}/>")
                    else:
                        _, num = stack.pop(k)
                        tags.append(t); out.append(f"</{num}>")
                        # remember the closing tag under the same number: stored as tags[num-1] + "\x00" + close
                        tags[num - 1] = tags[num - 1] + "\x00" + t
                        tags.pop()
                elif void:
                    tags.append(t); out.append(f"<{len(tags)}/>")
                else:
                    tags.append(t); stack.append((name, len(tags))); out.append(f"<{len(tags)}>")
            else:
                text = WS.sub(" ", _html.unescape(t))

                def num(m):
                    nums.append(m.group(0))
                    return "{%d}" % len(nums)

                out.append(NUM.sub(num, text))
            i += 1
        for name, num in stack:  # never closed inside the run: a plain placeholder
            out = [o if o != f"<{num}>" else f"<{num}/>" for o in out]
        return "".join(out), tags, nums


def _restore(text: str, tags: list[str], nums: list[str]) -> Optional[str]:
    def tg(m):
        close, idx, selfc = m.group(1), int(m.group(2)) - 1, m.group(3)
        if idx >= len(tags):
            raise KeyError
        parts = tags[idx].split("\x00")
        if selfc:
            return parts[0] if len(parts) == 1 else None
        return parts[1] if close else parts[0]

    def nm(m):
        return nums[int(m.group(1)) - 1]

    out = []
    try:
        for m in re.finditer(r"<(/)?(\d+)(/)?>|\{(\d+)\}|[^<{]+|[<{]", text):
            if m.group(2):
                r = tg(m)
                out.append(r if r is not None else "")
            elif m.group(4):
                out.append(nums[int(m.group(4)) - 1])
            else:
                out.append(_html.escape(m.group(0), quote=False))
    except (KeyError, IndexError):
        return None
    return "".join(out)


def _runs(page: str):
    """Yield (start_token, end_token, tokens) for each translatable run, plus the token list."""
    toks = TOKEN.findall(page)
    runs, cur, skip = [], [], 0

    def flush(end):
        if cur:
            runs.append((end - len(cur), end))
        cur.clear()

    for idx, t in enumerate(toks):
        if t.startswith("<!--") or t.startswith("<!"):
            flush(idx); continue
        if t.startswith("<"):
            name, close, void = _tag(t)
            if name in SKIP and not void:
                flush(idx)
                skip += -1 if close else 1
                skip = max(skip, 0)
                continue
            if skip:
                continue
            if name in INLINE or name in OPAQUE:
                cur.append(idx); continue
            flush(idx)
        else:
            if skip:
                continue
            cur.append(idx)
    flush(len(toks))
    return toks, [(toks, a, b) for a, b in runs]


def _trim(toks, a, b):
    """Drop leading/trailing whitespace and markup that is not part of the sentence."""
    while a < b and (not toks[a].strip() or (toks[a].startswith("<") and _edge(toks, a, b, True))):
        a += 1
    while b > a and (not toks[b - 1].strip() or (toks[b - 1].startswith("<") and _edge(toks, b - 1, b, False))):
        b -= 1
    return a, b


def _edge(toks, i, b, leading):
    name, close, void = _tag(toks[i])
    if name is None or name in OPAQUE or (not close and not void and _attr(toks[i], "translate") == "no"):
        return False
    if void:
        return name != "img"
    if leading and close:
        return True
    if not leading and not close:
        return True
    if leading:  # an opening tag at the start whose close is beyond the run
        depth = 0
        for j in range(i, b):
            nm, cl, vd = _tag(toks[j]) if toks[j].startswith("<") else (None, None, True)
            if nm == name and not vd:
                depth += -1 if cl else 1
                if depth == 0:
                    return False
        return True
    return False


def _children(toks, a, b):
    """Split a run whose own text has no words into its top-level elements (inner ranges)."""
    parts, depth, start, name0 = [], 0, None, None
    for j in range(a, b):
        t = toks[j]
        if not t.startswith("<"):
            if depth == 0 and LETTERS.search(t):
                return None
            continue
        name, close, void = _tag(t)
        if name is None:
            continue
        if depth == 0:
            if close:
                return None
            if void:
                continue
            if name in OPAQUE or _attr(t, "translate") == "no":
                # skip the whole opaque element
                start, name0 = ("skip", name)
            else:
                start, name0 = j, name
            depth = 1
            continue
        if name == name0 and not void:
            depth += -1 if close else 1
            if depth == 0:
                if start != "skip":
                    parts.append((start + 1, j))
                start = None
    if depth:
        return None
    return parts


def _keyed(page: str):
    toks, runs = _runs(page)
    out = []
    todo = [(a, b) for _, a, b in runs]
    while todo:
        a, b = todo.pop(0)
        a2, b2 = _trim(toks, a, b)
        if a2 >= b2:
            continue
        seg = toks[a2:b2]
        if not any(not s.startswith("<") and LETTERS.search(s) for s in seg):
            continue
        kids = _children(toks, a2, b2)
        if kids is not None and (len(kids) > 1 or (kids and kids[0] != (a2 + 1, b2 - 1))):
            todo[0:0] = kids
            continue
        if kids and kids[0] == (a2 + 1, b2 - 1):
            todo.insert(0, kids[0])
            continue
        key, tags, nums = _Run(seg).build()
        key = key.strip()
        if not LETTERS.search(re.sub(r"<[^>]*>", "", key)):
            continue
        out.append((a2, b2, key, tags, nums))
    out.sort(key=lambda r: r[0])
    return toks, out


def _attr_jobs(tok: str):
    name, close, void = _tag(tok)
    if name is None or close or _attr(tok, "translate") == "no":
        return []
    jobs = []
    for m in ATTR_RE.finditer(tok):
        an = m.group(1).lower()
        val = _html.unescape(m.group(3) if m.group(3) is not None else m.group(4))
        if an in ATTRS or (an == "content" and name == "meta" and (_attr(tok, "name") or _attr(tok, "property") or "") in META_NAMES) \
                or (an == "value" and name == "input" and (_attr(tok, "type") or "") in ("submit", "button")):
            if LETTERS.search(val):
                jobs.append((m.span(2), val))
    return jobs


def _num_key(val: str):
    nums: list[str] = []

    def num(m):
        nums.append(m.group(0))
        return "{%d}" % len(nums)

    return NUM.sub(num, WS.sub(" ", val).strip()), nums


def collect(page: str) -> list[str]:
    """Every key ``page`` would look up, in order (text runs, then attributes)."""
    toks, runs = _keyed(page)
    keys = [k for _, _, k, _, _ in runs]
    skip = 0
    for t in toks:
        if t.startswith("<") and not t.startswith("<!"):
            name, close, void = _tag(t)
            if name in SKIP and not void:
                skip = max(0, skip + (-1 if close else 1))
                if name != "svg":
                    continue
            if skip and name != "svg":
                continue
            for _, val in _attr_jobs(t):
                keys.append(_num_key(val)[0])
    return keys


def translate(page: str, lookup: Callable[[str], Optional[str]], lang: Optional[str] = None,
              missing: Optional[set] = None) -> str:
    """``page`` with every known run and attribute replaced (``lookup(key)`` returns the translation or None)."""
    toks, runs = _keyed(page)
    repl: dict[int, tuple[int, str]] = {}
    for a, b, key, tags, nums in runs:
        tr = lookup(key)
        if tr is None:
            if missing is not None:
                missing.add(key)
            continue
        new = _restore(tr, tags, nums)
        if new is None:
            if missing is not None:
                missing.add(key)
            continue
        repl[a] = (b, new)
    out, i, skip = [], 0, 0
    while i < len(toks):
        if i in repl:
            b, new = repl[i]
            out.append(new)
            i = b
            continue
        t = toks[i]
        if t.startswith("<") and not t.startswith("<!"):
            name, close, void = _tag(t)
            if name in SKIP and not void:
                skip = max(0, skip + (-1 if close else 1))
            if name == "html" and not close and lang:
                t = re.sub(r'\blang="[^"]*"', f'lang="{lang}"', t) if "lang=" in t else t.replace("<html", f'<html lang="{lang}"', 1)
            if not skip or name == "svg":
                jobs = _attr_jobs(t)
                for (s, e), val in reversed(jobs):
                    key, nums = _num_key(val)
                    tr = lookup(key)
                    if tr is None:
                        if missing is not None:
                            missing.add(key)
                        continue
                    try:
                        tr = re.sub(r"\{(\d+)\}", lambda m: nums[int(m.group(1)) - 1], tr)
                    except IndexError:
                        continue
                    t = t[:s] + '"' + _html.escape(tr, quote=True) + '"' + t[e:]
        out.append(t)
        i += 1
    return "".join(out)


def placeholders(text: str) -> list[str]:
    """The markup and number placeholders in a key or translation (they must match)."""
    return sorted(re.findall(r"</?\d+/?>|\{\d+\}", text))
