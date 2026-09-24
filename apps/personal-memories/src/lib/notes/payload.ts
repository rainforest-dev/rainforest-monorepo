import type { TimelineEvent } from '../timeline.ts';
import { resolveAnnotations, type ResolvedAnnotation } from './attach.ts';
import { emptyNote } from './format.ts';
import type { NotesStore, ReadResult } from './store.ts';

export type NotePayload = {
  date: string;
  body: string;
  annotations: ResolvedAnnotation[];
  cover?: string;
  version: string;
  writable: boolean;
  parseError?: true;
};

export function toPayload(
  { note, version, parseError }: ReadResult,
  writable: boolean,
  dayEvents: readonly TimelineEvent[],
): NotePayload {
  const payload: NotePayload = {
    date: note.date,
    body: note.body,
    annotations: resolveAnnotations(note.annotations, dayEvents),
    version,
    writable: writable && !parseError,
  };
  if (note.cover) payload.cover = note.cover;
  if (parseError) payload.parseError = true;
  return payload;
}

export function notePayload(
  store: NotesStore | undefined,
  date: string,
  dayEvents: readonly TimelineEvent[],
): NotePayload {
  const result = store
    ? store.read(date)
    : { note: emptyNote(date), version: '' };
  return toPayload(result, store?.writable ?? false, dayEvents);
}
