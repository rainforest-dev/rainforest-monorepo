import { describe, expect,it } from 'vitest';

import { parseSources, parseTopics } from './registry.js';

const SOURCES_FIXTURE = `---
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

## Needs Verification

- [ ] **TkDodo's Blog** #tech/tanstack #tech/react
  https://tkdodo.eu/blog/rss.xml · for topic: TanStack ecosystem
  **What**: Deep dives into React patterns.

## Proposed Sources

- [ ] **The GitHub Blog** #devops #domain/frontend
  https://github.blog/feed/ · for topic: Build tooling · _2026-06-17_ · proposed by rss-discover
  Evidence: Low-frequency.

## No RSS Found

- [ ] **Claude Code Changelog** #tech/claude-code #domain/ai
  website: https://claude.ai/changelog · _2026-06-17_

## Retired
`;

const TOPICS_FIXTURE = `---
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

describe('parseSources', () => {
  it('returns all sources', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    expect(sources).toHaveLength(6);
  });

  it('marks active sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const active = sources.filter((s) => s.status === 'active');
    expect(active).toHaveLength(3);
    expect(active[0].name).toBe('Astro');
    expect(active[0].tags).toContain('domain/frontend');
    expect(active[0].tags).toContain('tech/astro');
    expect(active[0].url).toBe('https://astro.build/rss.xml');
    expect(active[0].category).toBe('Frontend & Web');
  });

  it('marks pending sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const pending = sources.filter((s) => s.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe("TkDodo's Blog");
    expect(pending[0].url).toBe('https://tkdodo.eu/blog/rss.xml');
  });

  it('marks proposed sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const proposed = sources.filter((s) => s.status === 'proposed');
    expect(proposed).toHaveLength(1);
    expect(proposed[0].url).toBe('https://github.blog/feed/');
  });

  it('marks no-rss sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const noRss = sources.filter((s) => s.status === 'no-rss');
    expect(noRss).toHaveLength(1);
  });
});

describe('parseTopics', () => {
  it('returns all topics', () => {
    const topics = parseTopics(TOPICS_FIXTURE);
    expect(topics).toHaveLength(3);
  });

  it('parses active topics correctly', () => {
    const topics = parseTopics(TOPICS_FIXTURE);
    const active = topics.filter((t) => t.status === 'active');
    expect(active).toHaveLength(2);
    expect(active[0].name).toBe('AI agents & tools');
    expect(active[0].tags).toContain('domain/ai');
    expect(active[0].description).toBe('Agents, LLMs, MCP ecosystem, Claude Code');
  });

  it('parses proposed topics correctly', () => {
    const topics = parseTopics(TOPICS_FIXTURE);
    const proposed = topics.filter((t) => t.status === 'proposed');
    expect(proposed).toHaveLength(1);
    expect(proposed[0].name).toBe('Home automation');
  });
});
