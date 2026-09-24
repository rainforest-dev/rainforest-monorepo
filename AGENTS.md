<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

<!-- Everything below is hand-maintained. `nx configure-ai-agents` rewrites only
     the block above, between its own start/end markers. -->

## Commit and push gates

`.husky/pre-commit` runs `lint-staged`, which formats staged files with prettier.
`.husky/pre-push` runs `pnpm format:check` and then
`nx affected -t lint typecheck test` against the push range.

Both mirror CI rather than adding rules of their own, and both exist because of
PR #342 — the first PR this repo's loop opened unattended, which failed CI on
`Check formatting` while `pnpm prettier --write` sat documented in CLAUDE.md,
unrun. Formatting on the way in means that failure cannot be authored.

`build` is deliberately absent from the pre-push targets, because building
inside a git worktree corrupts the shared `.nx` cache. `personal-website`'s
`test` and `typecheck` depend on `^build`, so a push that affects it still
builds its libraries. CI has no build step either; builds run in the Vercel
previews and the release workflows. The hook also
hands over to the worktree's own copy of itself before running, because agent
worktrees inherit an absolute `core.hooksPath` pointing at the main clone — the
loop executor runs in worktrees here, so that is the normal case, not an edge
one.

In a genuine emergency, `git push --no-verify` skips the pre-push checks, which
are the heavy gate; `git commit --no-verify` only skips the pre-commit
formatter. Say so in the PR if you use either; a silent skip and an absent gate
look identical afterwards.

## Attaching screenshots to a PR

Visual evidence belongs on the PR when a change is visual — a redesigned panel,
a new state, a layout fix. It does **not** belong in the repository: binaries,
especially multi-MB GIFs, bloat git history permanently and cannot be removed
from it later.

`gh` 2.101 and later uploads attachments itself, so this is one command:

```bash
gh pr comment <number> --body "What the screenshots show, and that they come from fixture data." \
  --attach './index.jpg#Week index with two fixture weeks' \
  --attach './week.jpg#Week page with photos inline'
```

The text after `#` is the alt text. Up to 50 files per command; a body that already
references `![alt](./index.jpg)` gets that reference rewritten to the uploaded asset.

Capture to a path **outside** the repo. Shrink first when the image is large:
`sips -Z 1100` caps the longest side (so crop a tall full-page capture with
`sips -c <h> <w>` before resizing, or the width collapses). Never put real
personal data in a screenshot that goes on a public PR; use fixture data.

The browser-upload procedure this section used to describe predates `--attach`
and is no longer needed.
