import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  isWritable,
  parseSources,
  parseTopics,
  siteUrlFromFeed,
} from './registry.js';

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
    expect(active[0].siteUrl).toBe('https://astro.build');
    expect(active[0].category).toBe('Frontend & Web');
  });

  it('marks proposed sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const proposed = sources.filter((s) => s.status === 'proposed');
    expect(proposed).toHaveLength(2);
    expect(proposed[0].name).toBe("TkDodo's Blog");
    expect(proposed[0].url).toBe('https://tkdodo.eu/blog/rss.xml');
    expect(proposed[1].url).toBe('https://github.blog/feed/');
  });

  it('marks no-rss sources correctly', () => {
    const sources = parseSources(SOURCES_FIXTURE);
    const noRss = sources.filter((s) => s.status === 'no-rss');
    expect(noRss).toHaveLength(1);
  });

  it('keeps a `website:` entry as its own site', () => {
    const noRss = parseSources(SOURCES_FIXTURE).find(
      (s) => s.status === 'no-rss',
    );
    expect(noRss?.siteUrl).toBe('https://claude.ai/changelog');
  });

  it('points a feed URL at the site it belongs to', () => {
    const bySite = Object.fromEntries(
      parseSources(SOURCES_FIXTURE).map((s) => [s.name, s.siteUrl]),
    );
    expect(bySite['CSS-Tricks']).toBe('https://css-tricks.com');
    expect(bySite['The Verge']).toBe('https://www.theverge.com');
    expect(bySite["TkDodo's Blog"]).toBe('https://tkdodo.eu/blog');
  });
});

describe('siteUrlFromFeed', () => {
  it.each([
    ['https://astro.build/rss.xml', 'https://astro.build'],
    ['https://css-tricks.com/feed/', 'https://css-tricks.com'],
    ['https://www.theverge.com/rss/index.xml', 'https://www.theverge.com'],
    ['https://tkdodo.eu/blog/rss.xml', 'https://tkdodo.eu/blog'],
    ['https://www.reddit.com/r/rust/.rss', 'https://www.reddit.com/r/rust'],
    ['https://medium.com/feed/@someone', 'https://medium.com/@someone'],
    [
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC123',
      'https://www.youtube.com',
    ],
  ])('%s → %s', (feed, site) => {
    expect(siteUrlFromFeed(feed)).toBe(site);
  });

  it('returns anything unparseable unchanged', () => {
    expect(siteUrlFromFeed('')).toBe('');
    expect(siteUrlFromFeed('not-a-url')).toBe('not-a-url');
  });
});

describe('stale flags', () => {
  const FIXTURE = `# R

## Active Sources

### Web

- [x] **web.dev** #domain/frontend <!-- stale: delivery-gap | live feed active May 2026, Readwise not delivering since 2026-02-17 -->
  https://web.dev/feed.xml

- [x] **Readwise Docs** #domain/ai <!-- stale: feed-dead | feed URL returns 404 as of 2026-06-28 -->
  https://docs.readwise.io/rss.xml

- [x] **Legacy Flag** #domain/ai <!-- stale: last seen 2025-08-19; likely a Readwise subscription gap -->
  https://example.com/rss.xml

- [x] **Healthy** #domain/ai
  https://example.org/rss.xml
`;

  function byName(name: string) {
    const found = parseSources(FIXTURE).find((s) => s.name === name);
    if (!found) throw new Error(`fixture has no source named "${name}"`);
    return found;
  }

  it('parses a typed delivery-gap flag', () => {
    expect(byName('web.dev').stale).toEqual({
      type: 'delivery-gap',
      note: 'live feed active May 2026, Readwise not delivering since 2026-02-17',
    });
  });

  it('parses a typed feed-dead flag', () => {
    expect(byName('Readwise Docs').stale?.type).toBe('feed-dead');
  });

  it('keeps an untyped legacy flag working as unspecified', () => {
    const stale = byName('Legacy Flag').stale;
    expect(stale?.type).toBe('unspecified');
    expect(stale?.note).toContain('last seen 2025-08-19');
  });

  it('leaves a healthy source unflagged', () => {
    expect(byName('Healthy').stale).toBeUndefined();
  });

  it('leaves no comment marker behind on unterminated input', () => {
    const src = parseSources(
      '## Active Sources\n\n- [x] **X** #domain/ai <!-- stale: low-value | see <!-- nested -->\n  https://e.com/f\n',
    )[0];
    expect(src.tags).toEqual(['domain/ai']);
  });

  it('does not read a # inside a stale note as a tag', () => {
    const src = parseSources(
      '## Active Sources\n\n- [x] **X** #domain/ai <!-- stale: low-value | see #frontend channel -->\n  https://e.com/f\n',
    )[0];
    expect(src.tags).toEqual(['domain/ai']);
  });
});

describe('isWritable', () => {
  const originalVaultPath = process.env.VAULT_PATH;

  afterEach(() => {
    process.env.VAULT_PATH = originalVaultPath;
  });

  it('is true for a registry file that exists and can be written', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rss-manager-'));
    writeFileSync(join(dir, 'RSS-Source-Registry.md'), '# R\n', 'utf-8');
    process.env.VAULT_PATH = dir;
    expect(isWritable('RSS-Source-Registry.md')).toBe(true);
  });

  it('is false when the file is not there at all', () => {
    process.env.VAULT_PATH = mkdtempSync(join(tmpdir(), 'rss-manager-'));
    expect(isWritable('RSS-Source-Registry.md')).toBe(false);
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
    expect(active[0].description).toBe(
      'Agents, LLMs, MCP ecosystem, Claude Code',
    );
  });

  it('parses proposed topics correctly', () => {
    const topics = parseTopics(TOPICS_FIXTURE);
    const proposed = topics.filter((t) => t.status === 'proposed');
    expect(proposed).toHaveLength(1);
    expect(proposed[0].name).toBe('Home automation');
  });
});
