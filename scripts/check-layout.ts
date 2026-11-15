// Opens every page in the docs navigation, in every locale, at phone, tablet, and desktop widths,
// and fails when a page scrolls sideways, a control is too small to hit, or an Arabic page does not
// mirror its English page.
//
//   bun install && bunx playwright install chromium
//   bun scripts/check-layout.ts [--base URL] [--locales en,ar] [--pages guides/] [--json FILE]
//
// --base defaults to the live site. Use http://localhost:3000 for `mint dev`.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";

const WIDTHS = [320, 390, 768, 1440];
const TARGET = 44; // px. The theme's --lb-target. A smaller control needs this much room around it.
const RTL_LOCALES = new Set(["ar"]);
const CONCURRENCY = 4;

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = (arg("base") ?? "https://docs.logbrew.co").replace(/\/$/, "");
const onlyLocales = arg("locales")?.split(",");
const pageFilter = arg("pages");

type Nav = string | Nav[] | { [key: string]: Nav };
const pagesOf = (node: Nav): string[] =>
  typeof node === "string"
    ? [node]
    : Array.isArray(node)
      ? node.flatMap(pagesOf)
      : ["tabs", "anchors", "dropdowns", "groups", "pages"].flatMap((key) => (key in node ? pagesOf(node[key]) : []));

const docs = JSON.parse(readFileSync(new URL("../docs.json", import.meta.url), "utf8"));
const jobs = (docs.navigation.languages as { language: string }[])
  .filter(({ language }) => !onlyLocales || onlyLocales.includes(language))
  .flatMap((locale) => pagesOf(locale as Nav).map((page) => ({ locale: locale.language, page })))
  .filter(({ page }) => !pageFilter || page.includes(pageFilter));

type Finding = { page: string; width: number; kind: "sideways scroll" | "small target" | "not mirrored" | "not loaded"; detail: string };

// Runs in the page. Returns one line per problem at the current viewport width.
const inspect = ({ target, rtl }: { target: number; rtl: boolean }) => {
  const problems: { kind: string; detail: string }[] = [];
  const width = innerWidth;
  const name = (el: Element) => {
    const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${label}"`;
  };
  const shown = (el: Element) => {
    const box = el.getBoundingClientRect();
    return (
      box.width > 0 &&
      box.height > 0 &&
      el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
      !el.closest("[aria-hidden=true], [inert], .sr-only") &&
      box.right > 0 &&
      box.left < width
    );
  };

  const extra = document.documentElement.scrollWidth - width;
  if (extra > 0) {
    const scrolls = (el: Element | null): boolean =>
      !!el && el !== document.body && (/(auto|scroll|hidden|clip)/.test(getComputedStyle(el).overflowX) || scrolls(el.parentElement));
    const wide = [...document.body.querySelectorAll("*")].filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && (box.right > width + 1 || box.left < -1) && !scrolls(el.parentElement);
    });
    const outermost = wide.filter((el) => !wide.includes(el.parentElement as Element)).slice(0, 3);
    problems.push({ kind: "sideways scroll", detail: `${extra}px by ${outermost.map(name).join(", ")}` });
  }

  const CONTROL =
    "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=radio], [role=switch], [role=checkbox], [role=menuitem], [tabindex]:not([tabindex='-1'])";
  const inSentence = (el: Element) =>
    getComputedStyle(el).display === "inline" &&
    [...(el.parentElement?.childNodes ?? [])].some((node) => node !== el && node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  const controls = [...document.querySelectorAll(CONTROL)].filter(
    (el) => shown(el) && !el.parentElement?.closest(CONTROL) && !inSentence(el),
  );
  const boxes = controls.map((el) => el.getBoundingClientRect());
  const small = (box: DOMRect) => box.width < target - 0.5 || box.height < target - 0.5;
  // WCAG 2.2 2.5.8 spacing test, with the theme's 44 px in place of 24 px: a circle of that size on
  // the center of a small control must touch no other control and no other small control's circle.
  const circleHitsBox = (box: DOMRect, x: number, y: number) => {
    const dx = Math.max(box.left - x, 0, x - box.right);
    const dy = Math.max(box.top - y, 0, y - box.bottom);
    return Math.hypot(dx, dy) < target / 2 - 0.5;
  };
  boxes.forEach((box, i) => {
    if (!small(box)) return;
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const crowded = boxes.findIndex((other, j) => {
      if (i === j) return false;
      if (circleHitsBox(other, x, y)) return true;
      return small(other) && Math.hypot(other.left + other.width / 2 - x, other.top + other.height / 2 - y) < target - 0.5;
    });
    if (crowded >= 0) {
      problems.push({ kind: "small target", detail: `${Math.round(box.width)}x${Math.round(box.height)} ${name(controls[i])} near ${name(controls[crowded])}` });
    }
  });

  if (rtl) {
    if (getComputedStyle(document.body).direction !== "rtl") problems.push({ kind: "not mirrored", detail: "text direction is ltr" });
    // A logo keeps its own form: the mug stays on the left of the name.
    const mark = [...document.querySelectorAll('a[href="https://logbrew.co"] img')].find(shown);
    const logo = mark?.parentElement?.getBoundingClientRect();
    const markBox = mark?.getBoundingClientRect();
    if (logo && markBox && markBox.left + markBox.width / 2 > logo.left + logo.width / 2)
      problems.push({ kind: "not mirrored", detail: "logo mug is on the right of the name" });
  }
  return problems;
};

// Runs in the page. The left and right edge of each part of the page frame that has a box.
const LANDMARKS = {
  logo: 'a[href="https://logbrew.co"]:has(img)',
  search: "#search-bar-entry, #search-bar-entry-mobile",
  menu: "#search-bar-entry-mobile + button",
  tabs: ".nav-tabs",
  "theme switch": '[data-switch="pill"]',
  "language menu": "#localization-select-trigger",
  sidebar: "#sidebar",
  outline: "#table-of-contents",
  "copy page menu": "#page-context-menu",
  "heading link": "#content-area .anchor-link",
  "previous or next page link": "#pagination a[href]",
};
const edges = (landmarks: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(landmarks).flatMap(([part, selector]) => {
      const box = [...document.querySelectorAll(selector)]
        .map((el) => el.getBoundingClientRect())
        .find((b) => b.width > 0 && b.height > 0 && b.right > 0 && b.left < innerWidth);
      return box ? [[part, [box.left, box.right]]] : [];
    }),
  ) as Record<string, [number, number]>;

// An Arabic page mirrors its English page: a part that starts at the left edge in English starts
// at the right edge in Arabic. Text lengths differ, so either the start or the end edge must match.
const unmirrored = (english: Record<string, [number, number]>, arabic: Record<string, [number, number]>, width: number) =>
  Object.entries(english).flatMap(([part, [left, right]]) => {
    const mirrored = arabic[part];
    if (!mirrored) return [];
    const ok = Math.abs(mirrored[1] - (width - left)) <= 4 || Math.abs(mirrored[0] - (width - right)) <= 4;
    return ok ? [] : [`${part} at ${Math.round(mirrored[0])} to ${Math.round(mirrored[1])}px, ${Math.round(left)} to ${Math.round(right)}px in English`];
  });

const settle = async (page: Page, width: number) => {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.waitForTimeout(150);
};

const open = async (page: Page, path: string) => {
  await page.setViewportSize({ width: WIDTHS[0], height: 900 });
  await page.goto(`${base}/${path}`, { waitUntil: "load" });
  await page.waitForSelector("#content-area");
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
};

const check = async (page: Page, { locale, page: path }: (typeof jobs)[number]): Promise<Finding[]> => {
  const rtl = RTL_LOCALES.has(locale);
  const english: Record<number, Record<string, [number, number]>> = {};
  if (rtl) {
    await open(page, path.slice(locale.length + 1));
    for (const width of WIDTHS) {
      await settle(page, width);
      english[width] = await page.evaluate(edges, LANDMARKS);
    }
  }
  await open(page, path);
  const findings: Finding[] = [];
  for (const width of WIDTHS) {
    await settle(page, width);
    const problems = await page.evaluate(inspect, { target: TARGET, rtl });
    if (rtl) {
      const parts = unmirrored(english[width], await page.evaluate(edges, LANDMARKS), width);
      problems.push(...parts.map((detail) => ({ kind: "not mirrored", detail })));
    }
    findings.push(...problems.map((p) => ({ page: path, width, kind: p.kind as Finding["kind"], detail: p.detail })));
  }
  return findings;
};

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const queue = [...jobs];
const findings: Finding[] = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    const page = await browser.newPage();
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        findings.push(...(await check(page, job)));
      } catch (error) {
        findings.push({ page: job.page, width: 0, kind: "not loaded", detail: `could not check: ${(error as Error).message.split("\n")[0]}` });
      }
    }
    await page.close();
  }),
);
await browser.close();

const json = arg("json");
if (json) writeFileSync(json, JSON.stringify(findings, null, 2));
const byKind = Object.groupBy(findings, (f) => f.kind);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n${kind}: ${list?.length}`);
  const lines = Object.groupBy(list ?? [], (f) => `${f.width}px ${f.detail}`);
  for (const [line, same] of Object.entries(lines).sort(([, a], [, b]) => (b?.length ?? 0) - (a?.length ?? 0)))
    console.log(`  ${same?.length} pages  ${line}${same?.length === 1 ? `  (${same[0].page})` : ""}`);
}
console.log(`\nChecked ${jobs.length} pages at ${WIDTHS.join(", ")} px: ${findings.length} problems.`);
process.exit(findings.length ? 1 : 0);
