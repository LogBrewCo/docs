# Agent Instructions

This is the public LogBrew documentation repo. Keep instructions concise,
operational, and safe for a public repository.

## Product Direction

- LogBrew is agent-first observability for developers.
- Document first-party logs, traces, issues, actions, releases, projects,
  environments, CLI, SDK ingestion, mobile companion workflows, and telemetry
  data.
- Do not reintroduce removed provider-sync docs for Sentry, PostHog, Vercel,
  Railway, Linear, or Stripe.
- Do not mention private implementation plans, private repo paths, cleanup
  context, or launch-state caveats.
- Do not publish infrastructure details: databases, backend framework choices,
  hosting providers, backup providers, internal hostnames, operator commands,
  storage paths, credentials, or private runbooks.
- Public docs explain the product, marketing story, usage, and AI-agent best
  practices. Keep implementation details in private repos.
- Use popular terms that humans and AI coding agents understand.

## Mintlify UX

- `docs.json` owns information architecture. Use one clear root navigation
  pattern with groups unless the site genuinely needs tabs or anchors.
- Add `redirects` when moving or deleting published pages.
- Every page needs frontmatter `title` and `description`.
- Prefer short task-oriented pages with scannable headings, cards, steps,
  code examples, tables, and callouts.
- Keep the first-run path obvious: what LogBrew is, how to log in, how to send
  telemetry, and how to read it with `--json`.
- Test docs like a real user on desktop and mobile when possible.

## Style

- ASCII only. Do not use em dashes.
- Sentence case for headings.
- Use root-relative internal links without `.mdx`.
- Keep examples copy-paste friendly.
- Do not invent package names, install commands, URLs, or product behavior.

## Verification

```bash
mint validate
mint broken-links --check-redirects
mint a11y
mint score
```

If the Mintlify CLI is unavailable, run structural checks manually:

```bash
rg -n "Sentry|PostHog|Vercel|Railway|Linear|Stripe|Postgres|Timescale|SQLx|S3|s3" \
  . --glob "*.mdx" --glob "README.md" --glob "docs.json"
rg -n "\x{2014}|\x{2013}|\x{2018}|\x{2019}|\x{201C}|\x{201D}" \
  . --glob "*.mdx" --glob "README.md" --glob "docs.json"
```

Before final response, inspect `git diff` and report what checks were run.
