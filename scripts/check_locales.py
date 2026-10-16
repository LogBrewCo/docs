#!/usr/bin/env python3
"""Check that every translated page keeps the contract of its English page.

A translated page lives at <locale>/<page>.mdx and translates <page>.mdx.
The check fails when a locale misses or adds a page, or when a page changes
code blocks, inline code, links, anchors, components, frontmatter keys, or
navigation. Run it with no arguments for every locale, or name locales.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

LOCALES = ["tr", "de", "es", "ja", "fr", "pt-BR", "it", "nl", "vi",
           "zh-Hans", "ko", "id", "pl", "ar"]
ROOT = Path(__file__).resolve().parent.parent
FENCE = re.compile(r"^( *)(`{3,}|~{3,}).*?^\1\2[ \t]*$", re.M | re.S)
INLINE = re.compile(r"`[^`\n]+`")
LINK = re.compile(r"\]\(([^)\s]+)\)|href=\"([^\"]+)\"")
COMPONENT = re.compile(r"<([A-Z][A-Za-z]*)[\s>/]")
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)


def pages(nav):
    """Flatten tabs, groups, and pages into a list of (kind, value) items."""
    out = []
    for item in nav if isinstance(nav, list) else [nav]:
        if isinstance(item, str):
            out.append(("page", item))
            continue
        if "href" in item:
            out.append(("href", item["href"]))
        for key in ("tabs", "groups", "pages"):
            if key in item:
                out.append((key, len(item[key])))
                out += pages(item[key])
    return out


def parse(path):
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER.match(text)
    meta = {}
    if match:
        for line in match.group(1).splitlines():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip().strip('"')
    body = text[match.end():] if match else text
    fences = [m.group(0) for m in FENCE.finditer(body)]
    prose = FENCE.sub("", body)
    links = [a or b for a, b in LINK.findall(prose)]
    return {
        "meta": meta,
        "fences": fences,
        "inline": set(INLINE.findall(prose)),
        "links": links,
        "components": Counter(COMPONENT.findall(INLINE.sub("", prose))),
        "text": text,
    }


def localize(link, locale):
    if link.startswith("/") and not re.search(r"\.\w+(#|$)", link):
        return f"/{locale}{link}"
    return link


def check_page(page, locale, errors):
    source, target = ROOT / f"{page}.mdx", ROOT / locale / f"{page}.mdx"
    en, tr = parse(source), parse(target)
    where = f"{locale}/{page}.mdx"
    if set(en["meta"]) != set(tr["meta"]):
        errors.append(f"{where}: frontmatter keys differ from English")
    if any(not value for value in tr["meta"].values()):
        errors.append(f"{where}: empty frontmatter value")
    if en["fences"] != tr["fences"]:
        errors.append(f"{where}: code blocks differ from English")
    for code in sorted(en["inline"] ^ tr["inline"]):
        errors.append(f"{where}: inline code differs from English: {code}")
    want = Counter(localize(link, locale) for link in en["links"])
    for link, count in (want - Counter(tr["links"])).items():
        errors.append(f"{where}: missing link {link} (x{count})")
    for link, count in (Counter(tr["links"]) - want).items():
        errors.append(f"{where}: unexpected link {link} (x{count})")
    if en["components"] != tr["components"]:
        errors.append(f"{where}: components differ from English")
    for link in set(tr["links"]):
        path, _, anchor = link.partition("#")
        if not anchor or not (path == "" or path.startswith(f"/{locale}/")):
            continue
        file = target if path == "" else ROOT / f"{path.lstrip('/')}.mdx"
        if file.exists() and f'id="{anchor}"' not in file.read_text("utf-8"):
            errors.append(f"{where}: no id=\"{anchor}\" in {file.relative_to(ROOT)}")


def main(selected):
    errors = []
    nav = json.loads((ROOT / "docs.json").read_text("utf-8"))["navigation"]
    languages = {item["language"]: item for item in nav.get("languages", [])}
    english = pages(languages.get("en", nav))
    english_pages = [value for kind, value in english if kind == "page"]
    for locale in selected or LOCALES:
        folder = ROOT / locale
        if not folder.is_dir() and locale not in languages:
            continue
        found = {str(p.relative_to(folder))[:-4] for p in folder.rglob("*.mdx")}
        for page in sorted(set(english_pages) - found):
            errors.append(f"{locale}: missing page {page}")
        for page in sorted(found - set(english_pages)):
            errors.append(f"{locale}: page {page} has no English source")
        for page in sorted(found & set(english_pages)):
            check_page(page, locale, errors)
        if locale in languages:
            expected = [(kind, f"{locale}/{value}" if kind == "page" else value)
                        for kind, value in english]
            if pages(languages[locale]) != expected:
                errors.append(f"{locale}: navigation differs from English")
    for error in errors:
        print(error)
    print(f"check_locales: {len(errors)} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
