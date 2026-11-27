import { expect, test } from "bun:test";
import { hitsInNavigation, hitsInPage, hitsInText, patternTables } from "./check-copy-slop";

// One sentence per English pattern name, each a phrase the slop rules quote.
const sloppy: Readonly<Record<string, string>> = {
  "AI vocabulary": "Unlock the power of seamless collaboration on your journey.",
  "plain word": "Leverage the CLI to read issues.",
  "promotional language": "An industry-leading dashboard with world-class search.",
  "significance inflation": "LogBrew is the future of error tracking.",
  "not just X but Y": "It is not only a dashboard but a command center.",
  signposting: "Logs need structure. Here is the setup.",
  "chatbot phrase": "I hope this helps! Let me know if you have questions.",
  "temporal runway opener": "In today's fast-paced world, teams ship daily.",
  "weasel attribution": "Experts say this approach improves uptime.",
  "fancy is": "The CLI serves as the entry point.",
  "filler phrase": "In order to send logs, add a key.",
  "authority trope": "At its core, the SDK is a queue.",
  "fake-candid opener": "Is it fast? Honestly? It depends.",
  "theatrical takeaway": "Rollbacks cut downtime. Let that sink in.",
  "generic conclusion": "The future looks bright for our customers.",
  "stacked hedge": "This could potentially be the cause.",
  "cutoff disclaimer": "While specific details are limited, the queue grew.",
  "superficial -ing clause": "The SDK groups errors, ensuring a calm inbox.",
};

test("catches every English pattern the table names", () => {
  expect(new Set(Object.keys(sloppy))).toEqual(new Set((patternTables["en"] ?? []).map(({ name }) => name)));
  for (const [name, sentence] of Object.entries(sloppy)) {
    expect(hitsInText(sentence, "en").map((hit) => hit.name)).toContain(name);
  }
});

test("passes plain sentences and the literal uses of a flagged word", () => {
  for (const sentence of [
    "Check the full event, not only its title.",
    "The delete button unlocks after the confirmation text matches.",
    "Rotate the phone to landscape mode.",
  ]) {
    expect(hitsInText(sentence, "en")).toEqual([]);
  }
});

test("runs a translation's own slop words only on that locale", () => {
  expect(hitsInText("Jornadas da sessão.", "pt-BR")).toHaveLength(1);
  expect(hitsInText("Jornadas da sessão.", "es")).toHaveLength(0);
  expect(hitsInText("oturum yolculukları", "tr")).toHaveLength(1);
  expect(hitsInText("Le SDK utilise la clé.", "fr")).toHaveLength(0);
});

test("reads titles and prose and skips code, links, and attributes", () => {
  const page = [
    "---",
    'title: "Leverage the CLI"',
    "icon: seamless",
    "---",
    "",
    "Run `logbrew --robust` or open [the guide](https://example.com/seamless).",
    '<Card title="A robust card" href="/seamless">',
    "```bash",
    "echo seamless",
    "```",
    "This sentence is not only long",
    "but also wrapped.",
    "",
    "- In order to",
    "- send logs, add a key.",
  ].join("\n");
  expect(hitsInPage("page.mdx", page, "en").map(({ line, text }) => [line, text])).toEqual([
    [2, "Leverage"],
    [7, "robust"],
    [11, "not only long but"],
    [14, "In order to"],
  ]);
});

test("checks each navigation language with its own table", () => {
  const raw = JSON.stringify(
    {
      description: "A seamless start.",
      navigation: {
        languages: [
          { language: "en", tabs: [{ tab: "Guides", groups: [{ group: "Your journey", pages: ["seamless"] }] }] },
          { language: "pt-BR", tabs: [{ tab: "Jornada", groups: [{ group: "Seamless", pages: [] }] }] },
        ],
      },
    },
    null,
    2,
  );
  expect(hitsInNavigation(raw).map(({ line, locale, text }) => [line, locale, text])).toEqual([
    [2, "en", "seamless"],
    [12, "en", "journey"],
    [25, "pt-BR", "Jornada"],
  ]);
});
