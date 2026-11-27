// Finds the copy slop a machine can judge without false alarms in the docs pages and the
// navigation labels in docs.json. copy-slop-patterns.json holds one table per locale: "en" for
// the English pages and, for a translation, only the slop words that locale's pages used. English
// phrases never run on a translation, because "utilise" is plain French.
//
//   bun scripts/check-copy-slop.ts
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import tables from "./copy-slop-patterns.json" with { type: "json" };

export type Pattern = { readonly name: string; readonly phrases: readonly string[] };
export const patternTables: Readonly<Record<string, readonly Pattern[]>> = tables;

type Rule = { readonly name: string; readonly pattern: RegExp };
const rules = new Map(
  Object.entries(patternTables).map(([locale, patterns]) => [
    locale,
    patterns.flatMap(({ name, phrases }): Rule[] =>
      phrases.map((phrase) => ({
        name,
        pattern: new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${phrase})(?![\p{L}\p{N}])`, "giu"),
      })),
    ),
  ]),
);

export type Hit = { readonly file: string; readonly line: number; readonly locale: string; readonly text: string; readonly name: string };
type TextHit = Pick<Hit, "locale" | "text" | "name"> & { readonly index: number };

export function hitsInText(text: string, locale: string): TextHit[] {
  return (rules.get(locale) ?? []).flatMap(({ name, pattern }) =>
    [...text.matchAll(pattern)].map((match) => ({ locale, text: match[0], name, index: match.index })),
  );
}

// Code, links, JSX expressions, and attributes that hold no reader text. Each span turns into
// spaces of the same length, so an index in the prose is the same index in the page.
const notProse = new RegExp(
  [
    String.raw`^( *)(\x60{3,}|~{3,})[^]*?^\1\2[ \t]*$`,
    String.raw`\x60[^\x60]*\x60`,
    String.raw`https?:\/\/[^\s)"'>]+|mailto:[^\s)"'>]+`,
    String.raw`\]\([^)]*\)`,
    String.raw`\{[^{}]*\}`,
    String.raw`<!--[^]*?-->`,
    String.raw`\b(?:href|src|icon|img|id|className|style|lang|color|cols|width|height|language)=(?:"[^"]*"|'[^']*')`,
    String.raw`^(?:import|export) .*$`,
    String.raw`<\/?[A-Za-z][\w.]*|\/?>`,
  ].join("|"),
  "gmu",
);
const frontmatter = /^---\n([^]*?)\n---\n/u;
const copyKeys = new Set(["title", "sidebarTitle", "description"]);
const blockStart = /^\s*(?:[-*+] |\d+\. |#{1,6} |> |\||<)/u;

const blank = (span: string): string => span.replaceAll(/[^\n]/gu, " ");

export function prose(page: string): string {
  const head = frontmatter.exec(page);
  const meta = head
    ? head[0]
        .replaceAll(/^([\w:-]+):( ?)(.*)$/gmu, (line, key: string, space: string, value: string) =>
          copyKeys.has(key) ? blank(`${key}:${space}`) + value.replaceAll('"', " ") : blank(line),
        )
        .replaceAll(/^---$/gmu, "   ")
    : "";
  return meta + page.slice(meta.length).replaceAll(notProse, blank);
}

// A block is a paragraph, list item, heading, table row, or component line. Hits run per block,
// so a phrase may wrap across lines but never across blocks.
export function hitsInPage(file: string, page: string, locale: string): Hit[] {
  const text = prose(page);
  const lines = page.split("\n");
  const hits: Hit[] = [];
  let start = 0;
  let block = "";
  let first = 0;
  const flush = (): void => {
    const lead = block.length - block.trimStart().length;
    for (const hit of hitsInText(block.trim(), locale)) {
      const at = first + lead + hit.index;
      hits.push({ file, line: page.slice(0, at).split("\n").length, locale, text: hit.text, name: hit.name });
    }
    block = "";
  };
  lines.forEach((line, index) => {
    const chunk = text.slice(start, start + line.length);
    if (chunk.trim() === "" || blockStart.test(lines[index] ?? "")) flush();
    if (block === "") first = start;
    block += block === "" ? chunk : ` ${chunk}`;
    start += line.length + 1;
  });
  flush();
  return hits;
}

const navigationKeys = new Set(["tab", "group", "anchor", "label", "description", "og:description"]);

export function hitsInNavigation(raw: string): Hit[] {
  const visit = (value: unknown, key: string, locale: string): Hit[] => {
    if (typeof value === "string") {
      if (!navigationKeys.has(key)) return [];
      const line = raw.slice(0, raw.indexOf(JSON.stringify(value))).split("\n").length;
      return hitsInText(value, locale).map(({ text, name }) => ({ file: "docs.json", line, locale, text, name }));
    }
    if (Array.isArray(value)) return value.flatMap((item) => visit(item, key, locale));
    if (value === null || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    const own = typeof record["language"] === "string" ? record["language"] : locale;
    return Object.entries(record).flatMap(([child, item]) => visit(item, child, own));
  };
  return visit(JSON.parse(raw), "", "en");
}

function mdxFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
    const path = join(folder, entry.name);
    return entry.isDirectory() ? mdxFiles(path) : entry.name.endsWith(".mdx") ? [path] : [];
  });
}

export function hitsInRepository(root: string): { pages: number; hits: Hit[] } {
  const raw = readFileSync(join(root, "docs.json"), "utf8");
  const locales = new Set(
    (JSON.parse(raw) as { navigation: { languages: { language: string }[] } }).navigation.languages.map(
      ({ language }) => language,
    ),
  );
  const files = mdxFiles(root);
  const hits = files.flatMap((path) => {
    const file = relative(root, path);
    const top = file.split("/")[0] ?? "";
    return hitsInPage(file, readFileSync(path, "utf8"), locales.has(top) ? top : "en");
  });
  return { pages: files.length, hits: [...hitsInNavigation(raw), ...hits] };
}

function tally(hits: readonly Hit[], key: (hit: Hit) => string): string {
  const counts = new Map<string, number>();
  for (const hit of hits) counts.set(key(hit), (counts.get(key(hit)) ?? 0) + 1);
  return [...counts]
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
}

if (import.meta.main) {
  const { pages, hits } = hitsInRepository(join(import.meta.dir, ".."));
  if (hits.length > 0) {
    console.error(
      [
        `Copy has ${hits.length} slop hits. Use the plain word, state the fact the page already has, or cut it.`,
        ...hits.map(({ file, line, text, name }) => `${file}:${line} "${text}" is ${name}`),
        `By pattern: ${tally(hits, (hit) => hit.name)}`,
        `By locale: ${tally(hits, (hit) => hit.locale)}`,
      ].join("\n"),
    );
    process.exit(1);
  }
  console.log(`copy slop ok (${pages} pages and docs.json)`);
}
