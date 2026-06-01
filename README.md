# LogBrew Documentation

Source for the public LogBrew documentation site.

LogBrew is agent-first observability for developers. The docs explain how to
send first-party telemetry, then read logs, traces, issues, actions, and
releases through the native `logbrew` CLI and API.

## Sitemap

| Section | What it covers |
| --- | --- |
| Start | Product overview and first working CLI flow. |
| Concepts | Telemetry streams, releases, projects, environments, and the mobile companion app. |
| Guides | CLI usage, SDK ingestion, and issue triage workflows. |
| Reference | Command grammar, telemetry API shape, and data storage behavior. |

## Working on the docs

The docs use [Mintlify](https://mintlify.com). Authoring is MDX plus
`docs.json` navigation.

```bash
npm i -g mint
mint dev
mint validate
mint broken-links
mint a11y
mint score
```

Run validation before publishing any docs change. Use the preview site to check
the first-run path, mobile readability, cards, code examples, and navigation.

## House style

- Write for developers and AI coding agents.
- Use popular terms: logs, traces, issues, actions, releases, environments.
- Keep pages short, task-oriented, and copy-paste friendly.
- Prefer `Steps`, `CardGroup`, `CodeGroup`, callouts, and tables when they make
  scanning easier.
- Internal links are root-relative without `.mdx`.
- Sentence case for headings.
- ASCII only. Do not use em dashes.
- Do not document removed provider-sync flows or private implementation plans.

## Layout

```text
introduction.mdx
quickstart.mdx
concepts/     Telemetry, releases, projects, mobile app
guides/       CLI, SDK ingestion, issue workflow
reference/    CLI, telemetry API, data storage
docs.json     Mintlify site config and navigation
```

## Related

- [logbrew.co](https://logbrew.co)
- [LogBrewCo](https://github.com/LogBrewCo)

## License

MIT for the documentation source. See [LICENSE](LICENSE). The LogBrew product
and brand are not covered.
