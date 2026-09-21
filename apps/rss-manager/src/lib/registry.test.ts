import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
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

  it('treats a no-rss entry as its own site however the line is written', () => {
    const bare = parseSources(
      '## No RSS Found\n\n- [ ] **Changelog** #tech/claude-code\n  https://claude.ai/changelog · _2026-06-17_\n',
    )[0];
    expect(bare.status).toBe('no-rss');
    expect(bare.siteUrl).toBe('https://claude.ai/changelog');
  });
});

describe('siteUrlFromFeed', () => {
  it.each([
    ['https://astro.build/rss.xml', 'https://astro.build'],
    ['https://css-tricks.com/feed/', 'https://css-tricks.com'],
    ['https://www.theverge.com/rss/index.xml', 'https://www.theverge.com'],
    ['https://tkdodo.eu/blog/rss.xml', 'https://tkdodo.eu/blog'],
    ['https://www.reddit.com/r/rust/.rss', 'https://www.reddit.com/r/rust'],
    ['https://example.com/blog/atom.xml', 'https://example.com/blog'],
  ])('%s → %s', (feed, site) => {
    expect(siteUrlFromFeed(feed)).toBe(site);
  });

  it('leaves a route that merely contains the word alone', () => {
    // Stripping these mid-path would invent a 404.
    expect(siteUrlFromFeed('https://simonwillison.net/atom/everything/')).toBe(
      '',
    );
    expect(
      siteUrlFromFeed('https://blog.example.com/feeds/posts/default'),
    ).toBe('');
    expect(siteUrlFromFeed('https://medium.com/feed/@someone')).toBe('');
  });

  it('gives up when a query is what names the feed', () => {
    // Every channel would otherwise collapse onto the same homepage.
    expect(
      siteUrlFromFeed(
        'https://www.youtube.com/feeds/videos.xml?channel_id=UC123',
      ),
    ).toBe('');
  });

  it('gives up on anything that is not an http(s) URL', () => {
    expect(siteUrlFromFeed('')).toBe('');
    expect(siteUrlFromFeed('not-a-url')).toBe('');
    expect(siteUrlFromFeed('javascript:alert(1)')).toBe('');
  });
});

describe('isWritable', () => {
  const originalVaultPath = process.env.VAULT_PATH;

  afterEach(() => {
    // Assigning undefined would store the string 'undefined' and send every
    // later lookup to a relative path.
    if (originalVaultPath === undefined) delete process.env.VAULT_PATH;
    else process.env.VAULT_PATH = originalVaultPath;
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

  // root bypasses the permission bits, so this can only run unprivileged.
  it.skipIf(process.getuid?.() === 0)(
    'is false for a file that exists but cannot be written',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'rss-manager-'));
      const file = join(dir, 'RSS-Source-Registry.md');
      writeFileSync(file, '# R\n', 'utf-8');
      chmodSync(file, 0o444);
      process.env.VAULT_PATH = dir;
      expect(isWritable('RSS-Source-Registry.md')).toBe(false);
    },
  );
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
