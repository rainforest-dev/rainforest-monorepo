import { parse, stringify } from 'yaml';

import type { TimelineSource } from '../timeline.ts';
import { taipeiTime } from '../weeks.ts';
import {
  type Annotation,
  ANNOTATIONS_HEADING,
  type DayNote,
  SOURCE_LABELS,
} from './types.ts';

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;
const ANCHOR = /^%% ev:(\S+) at:(\S+) src:(line|slack|photo) %%$/;

export function emptyNote(date: string): DayNote {
  return { date, frontmatter: {}, body: '', annotations: [] };
}

export function isEmptyNote(
  note: Pick<DayNote, 'body' | 'annotations' | 'cover'>,
): boolean {
  return !note.body.trim() && note.annotations.length === 0 && !note.cover;
}

const OWN_KEYS = new Set(['date', 'daily', 'tags', 'cover']);

const tagsOf = (tags: unknown): unknown[] =>
  Array.isArray(tags) ? tags : typeof tags === 'string' ? [tags] : [];

export function hasUserFrontmatter(
  frontmatter: Record<string, unknown>,
): boolean {
  return (
    Object.keys(frontmatter).some((key) => !OWN_KEYS.has(key)) ||
    tagsOf(frontmatter['tags']).some((t) => t !== 'memories')
  );
}

const trimBlankLines = (text: string) =>
  text
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '')
    .trimEnd();

function parseAnnotation(block: string): Annotation {
  const lines = block.split('\n');
  const heading = lines[0].replace(/^### /, '');
  const quote: string[] = [];
  let anchor: RegExpExecArray | null = null;
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('> ')) {
      quote.push(line.slice(2));
      continue;
    }
    anchor = ANCHOR.exec(line);
    if (anchor) {
      i++;
      break;
    }
    if (line.trim()) break;
  }
  const author = anchor ? heading.split(' · ').slice(2).join(' · ') : heading;
  return {
    eventId: anchor?.[1] ?? '',
    at: anchor?.[2] ?? '',
    source: (anchor?.[3] as TimelineSource | undefined) ?? 'line',
    author,
    excerpt: quote.join(' '),
    body: trimBlankLines(lines.slice(i).join('\n')),
  };
}

export function parseNote(text: string, date: string): DayNote {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = FRONTMATTER.exec(normalized);
  const data: unknown = match
    ? (parse(match[1], { schema: 'core' }) ?? {})
    : {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('frontmatter is not a mapping');
  }
  const rest = match ? normalized.slice(match[0].length) : normalized;

  const lines = rest.split('\n');
  const split = lines.indexOf(ANNOTATIONS_HEADING);
  const bodyLines = split === -1 ? lines : lines.slice(0, split);
  const section = split === -1 ? '' : lines.slice(split + 1).join('\n');

  const annotations = section
    .split(/^(?=### )/m)
    .filter((block) => block.startsWith('### '))
    .map(parseAnnotation);

  const { cover, ...frontmatter } = data as Record<string, unknown>;
  const note: DayNote = {
    date,
    frontmatter,
    body: trimBlankLines(bodyLines.join('\n')),
    annotations,
  };
  if (typeof cover === 'string' && cover) note.cover = cover;
  return note;
}

function serializeAnnotation(a: Annotation): string {
  const heading = a.eventId
    ? [taipeiTime(a.at), SOURCE_LABELS[a.source], a.author].join(' · ')
    : a.author;
  const parts = [`### ${heading}`];
  if (a.excerpt) parts.push(`> ${a.excerpt}`);
  if (a.eventId) parts.push(`%% ev:${a.eventId} at:${a.at} src:${a.source} %%`);
  if (a.body.trim()) parts.push(a.body.trim());
  return parts.join('\n\n');
}

export function serializeNote(note: DayNote): string {
  const { tags, ...rest } = note.frontmatter;
  const extra = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key !== 'date' && key !== 'daily'),
  );
  const otherTags = tagsOf(tags).filter((t) => t !== 'memories');
  const data: Record<string, unknown> = {
    date: note.date,
    daily: `[[daily-notes/${note.date}]]`,
    tags: ['memories', ...otherTags],
    ...extra,
  };
  if (note.cover) data['cover'] = note.cover;

  const frontmatterYaml = stringify(data, {
    defaultStringType: 'PLAIN',
    singleQuote: true,
  }).trimEnd();
  const sections = [`---\n${frontmatterYaml}\n---`];
  if (note.body.trim()) sections.push(note.body.trim());
  if (note.annotations.length) {
    sections.push(ANNOTATIONS_HEADING);
    sections.push(...note.annotations.map(serializeAnnotation));
  }
  return `${sections.join('\n\n')}\n`;
}
