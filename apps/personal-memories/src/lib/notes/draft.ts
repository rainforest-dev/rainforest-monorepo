import type { ResolvedAnnotation } from './attach.ts';
import type { NotePayload } from './payload.ts';
import type { Annotation } from './types.ts';

export type Draft = {
  body: string;
  annotations: ResolvedAnnotation[];
  cover?: string | undefined;
};

export const toDraft = (p: NotePayload): Draft => ({
  body: p.body,
  annotations: p.annotations,
  cover: p.cover,
});

export type SaveAnnotation = Annotation & { origin?: string };

export const toAnnotation = (a: ResolvedAnnotation): SaveAnnotation => ({
  eventId: a.eventId,
  at: a.at,
  source: a.source,
  author: a.author,
  excerpt: a.excerpt,
  body: a.body,
  ...(a.by ? { by: a.by } : {}),
  ...(a.origin ? { origin: a.origin } : {}),
});

export const saveInput = (
  p: Pick<NotePayload, 'date' | 'version'>,
  d: Draft,
) => ({
  date: p.date,
  body: d.body,
  annotations: d.annotations.map(toAnnotation),
  cover: d.cover,
  version: p.version,
});

export const withCover = (d: Draft, cover: string | undefined): Draft => ({
  ...d,
  cover,
});
