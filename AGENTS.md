# Agent Instructions

Public LogBrew docs are hostile-by-default: assume every word is indexed,
quoted, and permanent. Keep instructions concise, operational, and safe.

## Confidentiality gate

- Stop and fix any private signal before other work.
- Never reveal or imply infrastructure, databases, backend frameworks, hosting,
  backups, DNS, ops, hostnames, paths, credentials, tokens, secrets, customer
  data, strategy, roadmap, private repo paths, runbooks, launch state, or
  cleanup context.
- Public docs cover product behavior, marketing story, workflows, CLI, API,
  SDK ingestion, mobile companion workflows, telemetry data, and AI-agent best
  practices.

Run this leak scan every time:

```bash
rg -n -i "clickhouse|postgres|sqlx|timescale|sentry|posthog|terraform|dns|hetzner|storage box|storagebox|backup|restore|ssh|hostname|hostnames|/opt/|tailscale|100\.|api\.logbrew\.co|secret|token|key|credential|password|customer|roadmap|strategy|private repo|runbook|launch state|cleanup" \
  . --glob "*.mdx" --glob "README.md" --glob "docs.json"
```

Safe bearer-token examples may remain only when they use placeholders.

## Product direction

- LogBrew is agent-first observability for developers.
- Agent-friendly docs are the primary standard: CLI-first, JSON-first,
  copy-paste friendly, and clear enough for coding agents to use without
  guessing.
- Document first-party logs, traces, issues, actions, releases, projects,
  environments, CLI, SDK ingestion, mobile companion workflows, and telemetry
  data.
- Do not reintroduce removed provider-sync docs for Sentry, PostHog, Vercel,
  Railway, Linear, or Stripe.
- Use popular terms that humans and AI coding agents understand.
- Check competitor docs for user-friendly patterns and missing workflow ideas,
  but only publish LogBrew behavior that is already true and safe to say.

## Mintlify UX

- `docs.json` owns information architecture. Use one root navigation pattern
  with groups unless tabs or anchors are clearly needed.
- Add `redirects` when moving or deleting published pages.
- Every page needs frontmatter `title` and `description`.
- Keep the first-run path obvious: what LogBrew is, how to log in, how to send
  telemetry, and how to read it with `--json`.
- Prefer short task pages with scannable headings, cards, steps, code examples,
  tables, and callouts.
- Test docs like a real user on desktop and mobile when possible.

## Style

- ASCII only. Do not use em dashes.
- Sentence case for headings.
- Use root-relative internal links without `.mdx`.
- Keep examples copy-paste friendly.
- Do not invent package names, install commands, URLs, or product behavior.

## Verification

Run:

```bash
git status --short
mint validate
mint broken-links --check-redirects
mint a11y
mint score
```

Commit and push only when the strict confidentiality scan is clean and checks
pass, or when any remaining check failure is clearly a local-environment issue
that has been documented.

If Mintlify checks are unavailable or fail for local-environment reasons, run:

```bash
rg -n "Sentry|PostHog|Vercel|Railway|Linear|Stripe|Postgres|Timescale|SQLx|S3|s3" \
  . --glob "*.mdx" --glob "README.md" --glob "docs.json"
rg -n "\x{2014}|\x{2013}|\x{2018}|\x{2019}|\x{201C}|\x{201D}" \
  . --glob "*.mdx" --glob "README.md" --glob "docs.json"
```

Before final response, inspect `git diff` and report what checks were run.
