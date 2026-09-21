import { accessSync, constants, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Source, Stale, StaleType, Topic } from './registry.types.js';

export type { Source, Stale, StaleType, Topic } from './registry.types.js';

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

const STALE_TYPES: StaleType[] = ['feed-dead', 'delivery-gap', 'low-value'];

/**
 * Tags are whatever precedes a trailing comment. Truncating at the first `<!--`
 * rather than stripping comment pairs avoids leaving a bare `<!--` behind on
 * nested or unterminated input, and matches the registry format, where the
 * stale comment is always last on the line.
 */
function beforeComment(text: string): string {
  const start = text.indexOf('<!--');
  return start === -1 ? text : text.slice(0, start);
}

function extractTags(text: string): string[] {
  return [...beforeComment(text).matchAll(/#([\w/.-]+)/g)].map((m) => m[1]);
}

/**
 * Parses `<!-- stale: <type> | <note> -->`. An untyped legacy comment keeps
 * working and reports `unspecified`, so rss-discover output written before the
 * type existed still renders.
 */
function extractStale(text: string): Stale | undefined {
  const match = text.match(/<!--\s*stale:\s*([\s\S]*?)-->/);
  if (!match) return undefined;

  const body = match[1].trim();
  const divider = body.indexOf('|');
  if (divider !== -1) {
    const candidate = body.slice(0, divider).trim();
    if ((STALE_TYPES as string[]).includes(candidate))
      return {
        type: candidate as StaleType,
        note: body.slice(divider + 1).trim(),
      };
  }
  return { type: 'unspecified', note: body };
}

function extractUrl(line: string): string {
  const match = line.trim().match(/^(https?:\/\/[^\s·]+)/);
  return match ? match[1] : '';
}

/** Path segments that exist only to serve the feed file. */
const FEED_SEGMENT = /^(feeds?|rss|atom)$|\.(xml|rss|atom|json)$/i;

/**
 * The site behind a feed URL, or `''` when the URL does not say.
 *
 * Only trailing segments are plumbing: `/blog/rss.xml` is the blog serving a
 * feed, while `/atom/everything/` and `/feeds/posts/default` are routes that
 * merely contain the word, so stripping those would invent a dead link. When
 * nothing trailing matches, the feed path is indistinguishable from a page
 * path — `medium.com/feed/@someone`, `hnrss.org/frontpage` — and a guess would
 * land the reader on XML, which is what this whole thing is meant to avoid.
 */
export function siteUrlFromFeed(feedUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(feedUrl);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';

  const segments = parsed.pathname.split('/').filter(Boolean);
  const depth = segments.length;
  while (segments.length && FEED_SEGMENT.test(segments[segments.length - 1]))
    segments.pop();

  if (segments.length === depth) return '';
  if (segments.length) return `${parsed.origin}/${segments.join('/')}`;

  // The path was plumbing all the way down, so the origin is the site — unless
  // a query names which feed it is (`?channel_id=…`), where every such feed on
  // the host would otherwise collapse onto one homepage.
  return parsed.search ? '' : parsed.origin;
}

export function parseSources(content: string): Source[] {
  const body = stripFrontmatter(content);
  const sources: Source[] = [];

  let section = '';
  let category = '';
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      category = '';
      continue;
    }

    if (line.startsWith('### ')) {
      category = line.slice(4).trim();
      continue;
    }

    if (line.trim().startsWith('<!--')) continue;

    const itemMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\*(.*)/);
    if (!itemMatch) continue;

    const checked = itemMatch[1] === 'x';
    const name = itemMatch[2];
    const tagsText = itemMatch[3];
    const tags = extractTags(tagsText);

    let url = '';
    let proposedDate: string | undefined;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine.startsWith('http') || nextLine.startsWith('website:')) {
        if (nextLine.startsWith('http')) url = extractUrl(nextLine);
        else {
          const urlMatch = nextLine.match(/https?:\/\/[^\s·]+/);
          url = urlMatch ? urlMatch[0] : '';
        }
        const dateMatch = nextLine.match(/_(\d{4}-\d{2}-\d{2})_/);
        if (dateMatch) proposedDate = dateMatch[1];
        i = j;
      }
    }

    let status: Source['status'] = 'proposed';
    if (section === 'Active Sources') status = checked ? 'active' : 'proposed';
    else if (section === 'Needs Verification') status = 'proposed';
    else if (section === 'Proposed Sources') status = 'proposed';
    else if (section === 'No RSS Found') status = 'no-rss';
    else if (section === 'Retired') status = 'retired';

    sources.push({
      name,
      url,
      // A no-RSS entry has no feed: its URL is already the site.
      siteUrl: status === 'no-rss' ? url : siteUrlFromFeed(url),
      tags,
      status,
      category,
      proposedDate,
      stale: extractStale(tagsText),
    });
  }

  return sources;
}

export function parseTopics(content: string): Topic[] {
  const body = stripFrontmatter(content);
  const topics: Topic[] = [];

  let section = '';
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      continue;
    }

    if (line.trim().startsWith('<!--')) continue;

    const itemMatch = line.match(/^- \[([ x])\] \*\*(.+?)\*\*(.*)/);
    if (!itemMatch) continue;

    const name = itemMatch[2];
    const tagsText = itemMatch[3];
    const tags = extractTags(tagsText);

    let description = '';
    let proposedDate: string | undefined;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('-') && !nextLine.startsWith('#')) {
        description = nextLine;
        const dateMatch = nextLine.match(/_(\d{4}-\d{2}-\d{2})_/);
        if (dateMatch) proposedDate = dateMatch[1];
        i = j;
      }
    }

    let status: Topic['status'] = 'proposed';
    if (section === 'Active') status = 'active';
    else if (section === 'Proposed') status = 'proposed';
    else if (section === 'Declined') status = 'declined';

    topics.push({
      name,
      tags,
      description,
      status,
      proposedDate,
      stale: extractStale(tagsText),
    });
  }

  return topics;
}

export const SOURCES_FILE = 'RSS-Source-Registry.md';
export const TOPICS_FILE = 'RSS-Topic-Registry.md';

export function registryFilePath(filename: string): string {
  const base = process.env.VAULT_PATH ?? '/vault';
  return join(base, filename);
}

/**
 * Whether a registry file can be written, for the flag a list response carries
 * so the UI can disable edits that could only fail. It is asked right after the
 * file has been read, so a false here means the mount is read-only rather than
 * the file being absent; a write that fails anyway is classified from its own
 * errno (see `registryApi.ts`), which no probe can race.
 */
export function isWritable(filename: string): boolean {
  try {
    accessSync(registryFilePath(filename), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function readSources(): Source[] {
  const path = registryFilePath(SOURCES_FILE);
  return parseSources(readFileSync(path, 'utf-8'));
}

export function readTopics(): Topic[] {
  const path = registryFilePath(TOPICS_FILE);
  return parseTopics(readFileSync(path, 'utf-8'));
}

// ── Write helpers ──────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove an entry (checkbox line + all indented continuation lines) from lines in-place. */
function spliceEntry(lines: string[], name: string): string[] {
  const re = new RegExp(`^- \\[[ x]\\] \\*\\*${escapeRegex(name)}\\*\\*`);
  const idx = lines.findIndex((l) => re.test(l));
  if (idx === -1) throw new Error(`Entry not found: ${name}`);

  const removed = [lines[idx]];
  let j = idx + 1;
  // Grab all indented continuation lines (URL, description, What/Why/Recent…)
  while (j < lines.length && lines[j] !== '' && /^\s/.test(lines[j])) {
    removed.push(lines[j]);
    j++;
  }
  lines.splice(idx, removed.length);
  // Clean up blank line left behind
  if (lines[idx]?.trim() === '') lines.splice(idx, 1);

  return removed;
}

/** Insert entry lines before the next ## section (end of target section). */
function insertAtSectionEnd(
  lines: string[],
  section: string,
  entry: string[],
): void {
  const sectionIdx = lines.findIndex((l) => l === `## ${section}`);
  if (sectionIdx === -1) throw new Error(`Section not found: ## ${section}`);

  let insertIdx = lines.length;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      insertIdx = i;
      break;
    }
  }
  // Back over trailing blank lines so we don't double-space
  while (insertIdx > sectionIdx + 1 && lines[insertIdx - 1].trim() === '')
    insertIdx--;

  lines.splice(insertIdx, 0, '', ...entry);
}

/** Promote a proposed source to active: checks [x] and moves to Active Sources. */
export function activateSource(name: string): void {
  const filePath = registryFilePath(SOURCES_FILE);
  const lines = readFileSync(filePath, 'utf-8').split('\n');

  const re = new RegExp(`^- \\[[ x]\\] \\*\\*${escapeRegex(name)}\\*\\*`);
  const idx = lines.findIndex((l) => re.test(l));
  if (idx === -1) throw new Error(`Source not found: ${name}`);

  // Determine current section
  let currentSection = '';
  for (let i = idx; i >= 0; i--) {
    if (lines[i].startsWith('## ')) {
      currentSection = lines[i].slice(3).trim();
      break;
    }
  }

  if (currentSection === 'Active Sources') {
    // Already in right section — just check the box
    lines[idx] = lines[idx].replace(/^- \[ \]/, '- [x]');
  } else {
    // Move to Active Sources with checked box
    const entry = spliceEntry(lines, name);
    entry[0] = entry[0].replace(/^- \[[ x]\]/, '- [x]');
    insertAtSectionEnd(lines, 'Active Sources', entry);
  }

  writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/** Move a proposed topic to Active, checking its box. */
export function activateTopic(name: string): void {
  const filePath = registryFilePath(TOPICS_FILE);
  const lines = readFileSync(filePath, 'utf-8').split('\n');

  const entry = spliceEntry(lines, name);
  entry[0] = entry[0].replace(/^- \[[ x]\]/, '- [x]');
  insertAtSectionEnd(lines, 'Active', entry);

  writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/** Move a proposed topic to Declined, unchecking its box. */
export function declineTopic(name: string): void {
  const filePath = registryFilePath(TOPICS_FILE);
  const lines = readFileSync(filePath, 'utf-8').split('\n');

  const entry = spliceEntry(lines, name);
  entry[0] = entry[0].replace(/^- \[[ x]\]/, '- [ ]');

  if (!lines.some((l) => l === '## Declined')) {
    lines.push('', '## Declined', '', ...entry);
  } else {
    insertAtSectionEnd(lines, 'Declined', entry);
  }

  writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/** Move an active source to Retired, unchecking its box. */
export function retireSource(name: string): void {
  const filePath = registryFilePath(SOURCES_FILE);
  const lines = readFileSync(filePath, 'utf-8').split('\n');

  const entry = spliceEntry(lines, name);
  entry[0] = entry[0].replace(/^- \[[ x]\]/, '- [ ]');

  if (!lines.some((l) => l === '## Retired')) {
    lines.push('', '## Retired', '', ...entry);
  } else {
    insertAtSectionEnd(lines, 'Retired', entry);
  }

  writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
