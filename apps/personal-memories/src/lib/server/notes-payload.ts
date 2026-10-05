import { resolveAnnotations, type ResolvedAnnotation } from '@/lib/notes';
import type { Person } from '@/lib/people';

import { emptyNote } from './notes-format.ts';
import type { NotesStore, ReadResult } from './notes-store.ts';
import type { TimelineEvent } from './timeline.ts';

export type NotePayload = {
  date: string;
  body: string;
  annotations: ResolvedAnnotation[];
  cover?: string;
  version: string;
  writable: boolean;
  parseError?: true;
  viewer?: string;
  people: Person[];
};

export function toPayload(
  { note, version, parseError }: ReadResult,
  writable: boolean,
  dayEvents: readonly TimelineEvent[],
  people: Person[] = [],
): NotePayload {
  const payload: NotePayload = {
    date: note.date,
    body: note.body,
    annotations: resolveAnnotations(note.annotations, dayEvents),
    version,
    writable: writable && !parseError,
    people,
  };
  if (note.cover) payload.cover = note.cover;
  if (parseError) payload.parseError = true;
  return payload;
}

export function notePayload(
  store: NotesStore | undefined,
  date: string,
  dayEvents: readonly TimelineEvent[],
  viewer?: string,
  people: Person[] = [],
): NotePayload {
  const result = store
    ? store.read(date)
    : { note: emptyNote(date), version: '' };
  const payload = toPayload(
    result,
    store?.writable ?? false,
    dayEvents,
    people,
  );
  if (viewer) payload.viewer = viewer;
  return payload;
}
