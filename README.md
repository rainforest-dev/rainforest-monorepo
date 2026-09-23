# Rainforest's monorepo

Everything behind [rainforest.tools](https://rainforest.tools) lives here: the site itself, a few
small services that share its design system, and the libraries underneath them. Nx manages the
project graph, pnpm manages the workspace.

[![Website](https://img.shields.io/badge/website-rainforest.tools-blue)](https://rainforest.tools)
[![Built with Nx](https://img.shields.io/badge/built%20with-Nx-143055.svg?logo=nx)](https://nx.dev)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)

## What is in here

| App                                              | What it does                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [`personal-website`](./apps/personal-website/)   | The Astro site: resume, blog, case studies, and an MCP server at `/mcp` that serves the same profile data to agents |
| [`personal-liff`](./apps/personal-liff/)         | A LINE mini-app, built on Next.js and the LIFF SDK                                                                  |
| [`personal-calibre`](./apps/personal-calibre/)   | Ebook library service, with its own MCP endpoint                                                                    |
| [`personal-memories`](./apps/personal-memories/) | Photo album, deployed to the homelab as a container image                                                           |
| [`rss-manager`](./apps/rss-manager/)             | Feed collection and triage                                                                                          |

Each app has a sibling `*-e2e` project running Playwright against it.

| Library                                                            | What it holds                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [`@rainforest-dev/personal-data`](./libs/personal-data/)           | Profile, work history and project data, typed once and read by both the site and the MCP tools |
| [`@rainforest-dev/personal-portfolio`](./libs/personal-portfolio/) | Case study content and the MCP registrations that expose it                                    |
| [`@rainforest-dev/rainforest-ui`](./libs/rainforest-ui/)           | Shared components, built with Lit and Tailwind, documented in Storybook                        |

```mermaid
graph LR
  subgraph Apps
    W[personal-website]
    L[personal-liff]
    C[personal-calibre]
    M[personal-memories]
    R[rss-manager]
  end
  subgraph Libraries
    PD[personal-data]
    PP[personal-portfolio]
    UI[rainforest-ui]
  end
  W --> PD
  W --> PP
  W --> UI
  PP --> PD
  L --> UI
  M --> UI
  C --> UI
  W -. serves .-> MCP([MCP at rainforest.tools/mcp])
  C -. serves .-> MCP2([MCP endpoint])
```

## How changes get in

Most commits here are written by an agent. In the ninety days to 2026-09-22 that was 240 commits
on `main`, 203 of them conventional, arriving through 18 pull requests. Volume like that is only
reviewable if the gates are identical on every path in, so the hooks mirror CI rather than
inventing rules of their own.

```mermaid
flowchart TD
  A[commit] --> B[pre-commit: lint-staged runs prettier on staged files]
  B --> C[push]
  C --> D[pre-push: pnpm format:check]
  D --> E[pre-push: nx affected lint + typecheck + test across the push range]
  E --> F[pull request]
  F --> G[CI: format:check, then nx affected on Nx Cloud]
  F --> H[CodeQL and GitGuardian]
  F --> I[Vercel preview]
  F --> J[Claude Code Review]
  G --> K[merge to main]
  H --> K
  I --> K
  J --> K
  K --> L[per-app release workflow]
```

Two decisions in there are deliberate and easy to undo by accident.

`build` is not in the pre-push hook. CI runs it authoritatively, and building inside a git
worktree corrupts the shared `.nx` cache. Lint, typecheck and test catch nearly everything before
a push spends a runner.

`pnpm format:check` is a CI step of its own, separate from `nx affected`, because prettier covers
files that no Nx project owns. It is also the step that failed on PR #342, the first pull request
this repo's loop opened unattended: the formatter documented in `CLAUDE.md` had simply never been
run. Formatting on the way in means that failure cannot be authored again.

The pre-push hook hands over to the worktree's own copy of itself before running. Agent worktrees
inherit an absolute `core.hooksPath` pointing at the main clone, so without the handover git would
check this worktree's files using whatever branch that other checkout happens to have. Worktrees
are the normal case here, not an edge one.

To skip the hooks in a genuine emergency, use `git commit --no-verify`, and say so in the pull
request. A silent skip and an absent gate look the same afterwards.

## Running it locally

Node 22 and pnpm 11 are what the workspace expects. `engines` and `packageManager` in
`package.json` are the source of truth if this drifts.

```bash
pnpm install

pnpm nx dev personal-website          # or personal-liff, personal-calibre, ...
pnpm nx run-many -t lint typecheck test --projects=personal-website
pnpm nx affected -t lint typecheck test
```

`pnpm nx graph` draws the real dependency graph, which will be more current than the diagram
above.

## Agent instructions

`AGENTS.md` and `CLAUDE.md` carry the contract for agents working in this repo: the commit and
push gates, how to attach visual evidence to a pull request, and the comment allow-list that keeps
rationale in pull request descriptions instead of in the source.
