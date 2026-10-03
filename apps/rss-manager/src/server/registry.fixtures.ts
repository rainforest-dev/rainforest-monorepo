export const SOURCES_FIXTURE = `---
type: source-registry
updated: 2026-06-17
---

# RSS Source Registry

## Active Sources

### Frontend & Web

- [x] **Astro** #domain/frontend #tech/astro
  https://astro.build/rss.xml

- [x] **CSS-Tricks** #domain/frontend #tech/css
  https://css-tricks.com/feed/

### Tech News & Industry

- [x] **The Verge** #domain/frontend #domain/ai
  https://www.theverge.com/rss/index.xml

## Proposed Sources

- [ ] **TkDodo's Blog** #tech/tanstack #tech/react
  https://tkdodo.eu/blog/rss.xml · for topic: TanStack ecosystem · _2026-06-17_ · proposed by rss-discover
  **What**: Deep dives into React patterns.

- [ ] **The GitHub Blog** #devops #domain/frontend
  https://github.blog/feed/ · for topic: Build tooling · _2026-06-17_ · proposed by rss-discover
  Evidence: Low-frequency.

## No RSS Found

- [ ] **Claude Code Changelog** #tech/claude-code #domain/ai
  website: https://claude.ai/changelog · _2026-06-17_

## Retired
`;

export const TOPICS_FIXTURE = `---
type: topic-registry
updated: 2026-06-17
---

# RSS Topic Registry

## Active

- [x] **AI agents & tools** #domain/ai #tech/claude-code
  Agents, LLMs, MCP ecosystem, Claude Code

- [x] **Frontend / React ecosystem** #domain/frontend #tech/react
  React, hooks, patterns — primary stack

## Proposed

- [ ] **Home automation** #devops
  HA and smart home tools

## Declined
`;
