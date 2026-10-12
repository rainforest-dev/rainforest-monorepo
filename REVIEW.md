# Review guide

Pull requests here are reviewed by the subagents in `.claude/agents/review-*.md`.
The `Claude Review` workflow runs the ones the changed paths call for, checks their
findings and posts them as inline comments plus one summary. The loop runs the same
subagents before it opens a PR.

| Reviewer              | Runs when the PR changes                                                                                                 | Asks                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `review-correctness`  | anything                                                                                                                 | Does the change do what it says without breaking what it touches?            |
| `review-privacy`      | anything                                                                                                                 | Does private data, a secret or a home-network detail reach this public repo? |
| `review-architecture` | `apps/*/src/**`, `libs/**`, `apps/*/astro.config.*`, `apps/*/next.config.*`, `package.json` files, `pnpm-workspace.yaml` | Does it keep the import, barrel, bundle and theme rules in CLAUDE.md?        |
| `review-tests`        | source under `apps/**` or `libs/**` (not docs, not config only)                                                          | Would a test fail if this behaviour broke tomorrow?                          |
| `review-spec`         | a head branch starting with `loop/`                                                                                      | Does it meet the task's acceptance criteria, and are its claims backed?      |

Skip every reviewer except `review-privacy` when the PR changes only Markdown
under `docs/` or a README.

## Rules reviewers cite

- CLAUDE.md "Imports", "Module Boundaries", "Shared Theme", "pnpm Catalogs",
  "A green `astro build` says nothing about `astro dev`"
- AGENTS.md "Commit and push gates", "Attaching screenshots to a PR"
- `apps/personal-memories/README.md` "Data directory": private data stays outside
  the repository

## Severity

`🔴 blocking`: merging breaks behaviour, leaks private data, or breaks a rule above.
`🟡 optional`: everything else. An optional finding never holds a merge.

## Not worth a comment

Formatting, import order and `../` imports (prettier and lint fail on those), naming
taste, and anything in code the PR did not change.
