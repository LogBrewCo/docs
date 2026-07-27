# LogBrew Docs Agent Guide

## Scope

This guide applies to the entire repository. The repository is public and
indexed, so keep every change suitable for permanent public history.

Start with `git status`, preserve unrelated work, and keep each change focused
on one user journey or contract surface.

## Public truth and ownership

- Document behavior only when a deployed public contract, released public
  package, or verified public product surface supports it.
- Do not present planned or ambiguous behavior as available. Ask for
  authoritative public evidence instead of guessing.
- Use exact public commands, package names, endpoint paths, fields, and values.
  Examples must use obvious placeholders and synthetic data.
- `docs.json` owns information architecture, navigation, redirects, shared
  metadata, and global links. Reference pages own reusable public contracts;
  task pages should link to them rather than duplicate long catalogs.
- `README.md` and executable checks own repository inventory and commands.
  Keep volatile lists out of this guide.

## User-journey quality

- Optimize for the shortest honest path to first value, with ordered steps,
  observable checkpoints, safe recovery, and a clear next action.
- Prefer scannable task pages, copy-paste examples, and structured JSON that
  both people and agents can interpret without guessing.
- Every page needs useful title and description metadata. Use sentence case,
  ASCII by default, and root-relative internal links without `.mdx`.
- Keep terminology, routes, branding, and component patterns consistent with
  the LogBrew website and public agent-readable surfaces. Shared changes must
  remain compatible with localized website experiences.
- Avoid parallel pages that compete for the same canonical intent. Preserve
  redirects when replacing a public route.

## Privacy and public history

Never add secrets, credentials, authorization values, customer data, private
hosts or URLs, local absolute paths, private repository context, internal
architecture or operations material, or non-public plans.

Use fake identifiers and redacted examples. If a private signal appears, stop
and report it; deleting the current line is not enough when it may already
exist in Git history. Do not add alternate agent prompts, implementation plans,
receipts, or private planning artifacts. Keep commit messages generic,
product-focused, and free of agent attribution.

## Risk-based validation

Run the smallest set of repository checks that proves the changed behavior:

- Always review the focused diff and check formatting and public-data safety.
- Validate documentation structure after content or configuration changes.
- Check links and redirects after route, navigation, or cross-link changes.
- Check accessibility and use a local browser preview for visual, component,
  search, navigation, or responsive changes. Pure copy edits do not require a
  browser.
- Execute changed install, CLI, SDK, or API examples only when safe, using a
  clean temporary environment and a released public surface.
- Verify deployed SEO or agent-readable behavior only against the relevant
  public target.

Do not weaken a check to make a failure disappear. Explain environment-only
failures, keep evidence proportional to risk, and review branch history before
committing public documentation.
