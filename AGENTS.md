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

`build` is deliberately absent from pre-push: CI runs it authoritatively, and
building inside a git worktree corrupts the shared `.nx` cache. The hook also
hands over to the worktree's own copy of itself before running, because agent
worktrees inherit an absolute `core.hooksPath` pointing at the main clone — the
loop executor runs in worktrees here, so that is the normal case, not an edge
one.

To skip them for a genuine emergency: `git commit --no-verify`. Say so in the PR
if you do; a silent skip and an absent gate look identical afterwards.

## Attaching screenshots to a PR

Visual evidence belongs on the PR when a change is visual — a redesigned panel,
a new state, a layout fix. It does **not** belong in the repository: binaries,
especially multi-MB GIFs, bloat git history permanently and cannot be removed
from it later.

1. Capture to a path **outside** the repo, then copy it into the session's own
   scratchpad directory. `file_upload` reads only paths the session owns, so a
   bare `/tmp/…` path is rejected.
2. Shrink first: `sips -Z 1100 -s format jpeg -s formatOptions 55 <file>` takes a
   full-page PNG well under GitHub's limit with no meaningful loss of legibility.
3. Upload **into the authenticated page's own file input**, which is what mints
   the `user-attachments` URL. GitHub's comment box hides a real
   `<input type="file" multiple>` inside its `<file-attachment>` element —
   `#fc-new_comment_field` for the bottom compose box, `#fc-issue-<id>-body` for
   an in-place edit. Find the input, then upload; several files in one call mint
   all the URLs at once.
4. Poll the textarea until the markup lands — the upload is asynchronous and the
   value arrives as `<img … src="https://github.com/user-attachments/assets/…">`.
5. To place it anywhere other than the box you uploaded into, take that URL and
   `gh api --method PATCH repos/<owner>/<repo>/issues/comments/<id> -F body=@<file>`.
   Then clear the compose box, or the upload posts as a stray comment.
6. Verify it renders: reload and check `naturalWidth > 0` on the image.

Do not try to upload from outside the browser. `/upload/policies/assets` needs a
web-session CSRF token, GitHub's CSP blocks cross-origin fetches from local
servers, and no documented API mints `user-attachments` URLs. Two routes that
look adjacent and are not worth it: a synthetic ⌘V paste depends on synthetic
input reaching the page, which is not dependable across browser reconnects; and
base64-ing the image through the model to build a `File` in-page costs roughly
70KB of tokens per screenshot for no gain.

> This repository is **public**, so `![alt](raw.githubusercontent.com/…)` embeds
> do render here — unlike a private repo, where `camo` cannot authenticate and
> they 404. That is a reason to be deliberate about what a screenshot shows, not
> a reason to commit one: the history cost is the same either way.
