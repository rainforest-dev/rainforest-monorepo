import type { TimelineSource } from '@/lib/server';

import { clipSnippet, contentHash } from './text.ts';

export type SearchDocKind = 'chat' | 'photo' | 'note';

export type SearchDoc = {
  id: string;
  day: string;
  kind: SearchDocKind;
  source: TimelineSource | 'note';
  text: string;
  snippet: string;
  people: string[];
  places: string[];
  eventIds: string[];
  contentHash: string;
};

export function noteDoc(
  date: string,
  body: string,
  annotations: readonly { body: string }[],
): SearchDoc | undefined {
  const text = [body, ...annotations.map((a) => a.body)]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
  if (!text) return undefined;
  return {
    id: `note:${date}`,
    day: date,
    kind: 'note',
    source: 'note',
    text,
    snippet: clipSnippet(text),
    people: [],
    places: [],
    eventIds: [],
    contentHash: contentHash(text),
  };
}
