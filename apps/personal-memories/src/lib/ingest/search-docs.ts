// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import { nameOf, type Person, personOf } from '../people.ts';
import type { SearchDoc } from '../search/docs.ts';
import { clipSnippet, contentHash } from '../search/text.ts';
import type { TimelineEvent } from '../server/timeline.ts';
import { taipeiDate, taipeiTime } from '../weeks.ts';

export const CHUNK_GAP_MS = 10 * 60 * 1000;
export const CHUNK_MAX_MESSAGES = 40;
export const CHUNK_MAX_CHARS = 1500;
type Chunk = {
  events: TimelineEvent[];
  lines: { line: string; text: string }[];
  chars: number;
  last: number;
};

function chunkDoc(chunk: Chunk, people: readonly Person[]): SearchDoc {
  const [first] = chunk.events as [TimelineEvent, ...TimelineEvent[]];
  const text = chunk.lines.map((l) => l.line).join('\n');
  const longest = chunk.lines.reduce((a, b) =>
    Array.from(b.text).length > Array.from(a.text).length ? b : a,
  );
  const ids = new Set<string>();
  for (const e of chunk.events) {
    const person = personOf(people, e.source, e.author);
    if (person) ids.add(person.id);
  }
  return {
    id: `chat:${first.id}`,
    day: taipeiDate(first.at),
    kind: 'chat',
    source: first.source,
    text,
    snippet: clipSnippet(longest.text),
    people: [...ids],
    places: [],
    eventIds: chunk.events.map((e) => e.id),
    contentHash: contentHash(text),
  };
}

export function chatDocs(
  events: readonly TimelineEvent[],
  people: readonly Person[],
): SearchDoc[] {
  const open = new Map<string, Chunk>();
  const closed: Chunk[] = [];
  for (const event of events) {
    if (event.source === 'photo' || !event.text?.trim()) continue;
    const key = `${event.source}\u0000${event.chat ?? ''}`;
    const time = Date.parse(event.at);
    const line = `${taipeiTime(event.at)} ${nameOf(people, event.source, event.author)}：${event.text}`;
    const size = Array.from(line).length;
    const current = open.get(key);
    const fits =
      current &&
      taipeiDate(current.events[0]?.at ?? event.at) === taipeiDate(event.at) &&
      time - current.last <= CHUNK_GAP_MS &&
      current.events.length < CHUNK_MAX_MESSAGES &&
      current.chars + size <= CHUNK_MAX_CHARS;
    if (current && fits) {
      current.events.push(event);
      current.lines.push({ line, text: event.text });
      current.chars += size;
      current.last = time;
      continue;
    }
    if (current) closed.push(current);
    open.set(key, {
      events: [event],
      lines: [{ line, text: event.text }],
      chars: size,
      last: time,
    });
  }
  closed.push(...open.values());
  const order = new Map(events.map((e, i) => [e.id, i]));
  return closed
    .sort(
      (a, b) =>
        (order.get(a.events[0]?.id ?? '') ?? 0) -
        (order.get(b.events[0]?.id ?? '') ?? 0),
    )
    .map((chunk) => chunkDoc(chunk, people));
}

export function photoDocs(
  events: readonly TimelineEvent[],
  people: readonly Person[],
): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const event of events) {
    if (event.source !== 'photo') continue;
    const meta = event.photo?.meta ?? {};
    const parts: string[] = [];
    if (meta.labels?.length) parts.push(`labels: ${meta.labels.join(', ')}`);
    if (meta.text?.length) parts.push(`文字: ${meta.text.join(' ')}`);
    if (meta.venues?.length) parts.push(`場所: ${meta.venues.join(', ')}`);
    if (meta.place) parts.push(`地點: ${meta.place}`);
    if (meta.persons?.length) parts.push(`人物: ${meta.persons.join(', ')}`);
    if (event.text) parts.push(`相簿: ${event.text}`);
    if (parts.length === 0) continue;
    const text = parts.join('｜');
    const ids = new Set<string>();
    for (const name of meta.persons ?? []) {
      const person = personOf(people, 'photo', name);
      if (person) ids.add(person.id);
    }
    docs.push({
      id: `photo:${event.id}`,
      day: taipeiDate(event.at),
      kind: 'photo',
      source: 'photo',
      text,
      snippet: clipSnippet(text),
      people: [...ids],
      places: [...(meta.place ? [meta.place] : []), ...(meta.venues ?? [])],
      eventIds: [event.id],
      contentHash: contentHash(text),
    });
  }
  return docs;
}

export const buildSearchDocs = (
  events: readonly TimelineEvent[],
  people: readonly Person[],
): SearchDoc[] => [...chatDocs(events, people), ...photoDocs(events, people)];
