import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Source = {
  name: string;
  url: string;
  tags: string[];
  status: 'active' | 'pending' | 'proposed' | 'no-rss' | 'retired';
  category: string;
};

export type Topic = {
  name: string;
  tags: string[];
  description: string;
  status: 'active' | 'proposed' | 'declined';
};

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

function extractTags(text: string): string[] {
  return [...text.matchAll(/#([\w/.-]+)/g)].map((m) => m[1]);
}

function extractUrl(line: string): string {
  const match = line.trim().match(/^(https?:\/\/[^\s·]+)/);
  return match ? match[1] : '';
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
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine.startsWith('http')) {
        url = extractUrl(nextLine);
        i = j;
      } else if (nextLine.startsWith('website:')) {
        const urlMatch = nextLine.match(/https?:\/\/[^\s·]+/);
        url = urlMatch ? urlMatch[0] : '';
        i = j;
      }
    }

    let status: Source['status'] = 'pending';
    if (section === 'Active Sources') status = checked ? 'active' : 'pending';
    else if (section === 'Needs Verification') status = 'pending';
    else if (section === 'Proposed Sources') status = 'proposed';
    else if (section === 'No RSS Found') status = 'no-rss';
    else if (section === 'Retired') status = 'retired';

    sources.push({ name, url, tags, status, category });
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
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('-') && !nextLine.startsWith('#')) {
        description = nextLine;
        i = j;
      }
    }

    let status: Topic['status'] = 'proposed';
    if (section === 'Active') status = 'active';
    else if (section === 'Proposed') status = 'proposed';
    else if (section === 'Declined') status = 'declined';

    topics.push({ name, tags, description, status });
  }

  return topics;
}

export function registryFilePath(filename: string): string {
  const base = process.env.VAULT_PATH ?? '/vault';
  return join(base, filename);
}

export function readSources(): Source[] {
  const path = registryFilePath('RSS-Source-Registry.md');
  return parseSources(readFileSync(path, 'utf-8'));
}

export function readTopics(): Topic[] {
  const path = registryFilePath('RSS-Topic-Registry.md');
  return parseTopics(readFileSync(path, 'utf-8'));
}

// ── Write helpers ──────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove a source entry (checkbox line + optional URL line) from lines in-place. */
function spliceEntry(lines: string[], name: string): string[] {
  const re = new RegExp(`^- \\[[ x]\\] \\*\\*${escapeRegex(name)}\\*\\*`);
  const idx = lines.findIndex((l) => re.test(l));
  if (idx === -1) throw new Error(`Source not found: ${name}`);

  const removed = [lines[idx]];
  const next = lines[idx + 1]?.trim();
  if (next?.startsWith('http') || next?.startsWith('website:')) {
    removed.push(lines[idx + 1]);
  }
  lines.splice(idx, removed.length);
  // Clean up blank line left behind
  if (lines[idx]?.trim() === '') lines.splice(idx, 1);

  return removed;
}

/** Insert entry lines before the next ## section (end of target section). */
function insertAtSectionEnd(lines: string[], section: string, entry: string[]): void {
  const sectionIdx = lines.findIndex((l) => l === `## ${section}`);
  if (sectionIdx === -1) throw new Error(`Section not found: ## ${section}`);

  let insertIdx = lines.length;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { insertIdx = i; break; }
  }
  // Back over trailing blank lines so we don't double-space
  while (insertIdx > sectionIdx + 1 && lines[insertIdx - 1].trim() === '') insertIdx--;

  lines.splice(insertIdx, 0, '', ...entry);
}

/** Promote a proposed/pending source to active: checks [x] and moves to Active Sources. */
export function activateSource(name: string): void {
  const filePath = registryFilePath('RSS-Source-Registry.md');
  const lines = readFileSync(filePath, 'utf-8').split('\n');

  const re = new RegExp(`^- \\[[ x]\\] \\*\\*${escapeRegex(name)}\\*\\*`);
  const idx = lines.findIndex((l) => re.test(l));
  if (idx === -1) throw new Error(`Source not found: ${name}`);

  // Determine current section
  let currentSection = '';
  for (let i = idx; i >= 0; i--) {
    if (lines[i].startsWith('## ')) { currentSection = lines[i].slice(3).trim(); break; }
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

/** Move an active source to Retired, unchecking its box. */
export function retireSource(name: string): void {
  const filePath = registryFilePath('RSS-Source-Registry.md');
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
