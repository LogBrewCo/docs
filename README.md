# LogBrew Documentation

> Source for **[furkanerday.mintlify.app](https://furkanerday.mintlify.app)** — the user-facing docs for LogBrew. (Custom domain coming later.)

LogBrew is a mobile-first iOS app for indie developers. It pulls together errors from Sentry, deployments from Vercel and Railway, exception logs from PostHog, SLA breaches from Linear, and payment failures from Stripe, and surfaces every one of them as a real-time push notification on your iPhone.

This repo holds the public docs that explain how LogBrew works, how to connect each service, and how the product behaves once events start flowing. The app itself is closed source — only the documentation lives here.

## Sitemap

| Section | What it covers |
| --- | --- |
| **Get Started** | Install LogBrew, sign in with GitHub / GitLab / Bitbucket, connect your first service. |
| **Core Concepts** | Feed, Logs, Projects, Notifications. The mental model behind the app. |
| **Integrations** | OAuth setup, severity mapping, and resolve-sync behavior for the six supported providers. New ones land via the Request page. |
| **Features** | Live feed reconnection, two-way resolve sync, shareable links, saved filters. |
| **Account & Settings** | Sign-in providers, language, push notifications, account deletion and recovery. |

## Working on the docs

The docs use [Mintlify](https://mintlify.com), so authoring is plain MDX with a small set of built-in components (`<Card>`, `<Steps>`, `<Tabs>`, etc.).

```bash
npm i -g mint
mint dev           # localhost:3000, live reload on every save
mint validate      # build check, run before pushing
mint broken-links  # internal link sanity
```

Every push to `main` redeploys [furkanerday.mintlify.app](https://furkanerday.mintlify.app) automatically through the Mintlify GitHub App. Open a PR and each commit gets a unique preview URL posted by the bot.

## House style

The docs are read by people who haven't opened the app yet. Keep the prose direct and concrete.

- Active voice, second person.
- Sentence flow over jargon. Cut filler ("in order to", "obviously", "simply").
- ASCII only. No em-dashes — use commas, periods, or colons.
- Internal links are root-relative without the extension: `/integrations/sentry`.
- One idea per paragraph. One concept per heading. Sentence case for headings.

## Layout

```
introduction.mdx
quickstart.mdx
concepts/      Feed, Logs, Projects, Notifications
integrations/  Sentry, Vercel, Railway, PostHog, Linear, Stripe, Request
features/      Live Feed, Resolve Sync, Sharing, Saved Filters
settings/      Account, Notifications
docs.json      Site config (navigation tree, theme, colors)
custom.css     Light/dark icon swap for Vercel and Railway
```

## What's not here

- The LogBrew iOS app source — closed.
- The LogBrew backend (Rust, Postgres, APNs) — closed.
- Marketing pages, pricing, blog posts — those live on [logbrew.co](https://logbrew.co).

## Related

- **[logbrew.co](https://logbrew.co)** — main product site.
- **[LogBrewCo](https://github.com/LogBrewCo)** — GitHub organization.
- **App Store** — search **LogBrew** on iOS.

## License

MIT for the documentation source. See [LICENSE](LICENSE). The LogBrew product, brand, and app are not covered.
