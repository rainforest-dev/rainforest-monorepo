import type { TimelineSource } from '@/lib/server';

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
