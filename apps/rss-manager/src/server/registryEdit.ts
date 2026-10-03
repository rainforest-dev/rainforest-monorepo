import {
  accessSync,
  chmodSync,
  constants,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type { Rejection, Source, Topic } from '@/lib';
import {
  canActivate,
  canActivateTopic,
  canDeclineTopic,
  canRetire,
} from '@/lib/desk';

import { parseSources, parseTopics } from './registry.js';

export const SOURCE_ACTIONS = ['activate', 'retire'] as const;
export const TOPIC_ACTIONS = ['activate', 'decline'] as const;

export type SourceAction = (typeof SOURCE_ACTIONS)[number];
export type TopicAction = (typeof TOPIC_ACTIONS)[number];

export type EditResult =
  | { ok: true; text: string; applied: string[] }
  | { ok: false; rejected: Rejection[] };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function entryPattern(name: string): RegExp {
  return new RegExp(`^- \\[[ x]\\] \\*\\*${escapeRegex(name)}\\*\\*`);
}

function setCheckbox(line: string, checked: boolean): string {
  return line.replace(/^- \[[ x]\]/, checked ? '- [x]' : '- [ ]');
}

function spliceEntry(lines: string[], name: string): string[] {
  const idx = lines.findIndex((l) => entryPattern(name).test(l));
  if (idx === -1) throw new Error(`Entry not found: ${name}`);

  const removed = [lines[idx]];
  let j = idx + 1;
  while (j < lines.length && lines[j] !== '' && /^\s/.test(lines[j])) {
    removed.push(lines[j]);
    j++;
  }
  lines.splice(idx, removed.length);
  if (lines[idx]?.trim() === '') lines.splice(idx, 1);

  return removed;
}

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
  while (insertIdx > sectionIdx + 1 && lines[insertIdx - 1].trim() === '')
    insertIdx--;

  lines.splice(insertIdx, 0, '', ...entry);
}

function moveEntry(
  lines: string[],
  name: string,
  section: string,
  checked: boolean,
  createSection: boolean,
): void {
  const entry = spliceEntry(lines, name);
  entry[0] = setCheckbox(entry[0], checked);

  if (createSection && !lines.some((l) => l === `## ${section}`))
    lines.push('', `## ${section}`, '', ...entry);
  else insertAtSectionEnd(lines, section, entry);
}

function sectionAt(lines: string[], idx: number): string {
  for (let i = idx; i >= 0; i--)
    if (lines[i].startsWith('## ')) return lines[i].slice(3).trim();
  return '';
}

export function applySourceAction(
  text: string,
  name: string,
  action: SourceAction,
): string {
  const lines = text.split('\n');

  if (action === 'retire') moveEntry(lines, name, 'Retired', false, true);
  else {
    const idx = lines.findIndex((l) => entryPattern(name).test(l));
    if (idx === -1) throw new Error(`Entry not found: ${name}`);
    if (sectionAt(lines, idx) === 'Active Sources')
      lines[idx] = setCheckbox(lines[idx], true);
    else moveEntry(lines, name, 'Active Sources', true, false);
  }

  return lines.join('\n');
}

export function applyTopicAction(
  text: string,
  name: string,
  action: TopicAction,
): string {
  const lines = text.split('\n');

  if (action === 'activate') moveEntry(lines, name, 'Active', true, false);
  else moveEntry(lines, name, 'Declined', false, true);

  return lines.join('\n');
}

function editBatch<T extends { name: string }>(
  text: string,
  names: string[],
  parse: (text: string) => T[],
  rejection: (item: T) => string | undefined,
  apply: (text: string, name: string) => string,
): EditResult {
  const unique = [...new Set(names)];
  const firstByName = new Map<string, T>();
  for (const item of parse(text))
    if (!firstByName.has(item.name)) firstByName.set(item.name, item);

  const rejected = unique.flatMap((name): Rejection[] => {
    const item = firstByName.get(name);
    const reason = item ? rejection(item) : 'not in the registry';
    return reason ? [{ name, reason }] : [];
  });
  if (rejected.length) return { ok: false, rejected };

  return { ok: true, applied: unique, text: unique.reduce(apply, text) };
}

function sourceRejection(
  source: Source,
  action: SourceAction,
): string | undefined {
  if (action === 'activate')
    return canActivate(source)
      ? undefined
      : `cannot activate a source that is ${source.status}`;
  if (canRetire(source)) return undefined;
  return source.status === 'retired'
    ? 'already retired'
    : 'has a delivery gap; re-subscribe instead of retiring';
}

function topicRejection(topic: Topic, action: TopicAction): string | undefined {
  const allowed =
    action === 'activate' ? canActivateTopic(topic) : canDeclineTopic(topic);
  return allowed
    ? undefined
    : `cannot ${action} a topic that is ${topic.status}`;
}

export function editSources(
  text: string,
  names: string[],
  action: SourceAction,
): EditResult {
  return editBatch(
    text,
    names,
    parseSources,
    (source) => sourceRejection(source, action),
    (current, name) => applySourceAction(current, name, action),
  );
}

export function editTopics(
  text: string,
  names: string[],
  action: TopicAction,
): EditResult {
  return editBatch(
    text,
    names,
    parseTopics,
    (topic) => topicRejection(topic, action),
    (current, name) => applyTopicAction(current, name, action),
  );
}

export function writeFileAtomic(path: string, text: string): void {
  const mode = statSync(path).mode & 0o7777;
  // rename() replaces the file whatever its own mode, so a read-only file must be refused here.
  accessSync(path, constants.W_OK);

  const temp = join(dirname(path), `.${basename(path)}.tmp`);
  try {
    writeFileSync(temp, text, { encoding: 'utf-8', mode });
    chmodSync(temp, mode);
    renameSync(temp, path);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
}

export function editRegistryFile(
  path: string,
  edit: (text: string) => EditResult,
): EditResult {
  const result = edit(readFileSync(path, 'utf-8'));
  if (result.ok) writeFileAtomic(path, result.text);
  return result;
}
