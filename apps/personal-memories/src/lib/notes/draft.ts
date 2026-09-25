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

export type SaveAnnotation = Annotation & { origin: string };

export const toAnnotation = (a: ResolvedAnnotation): SaveAnnotation => ({
  eventId: a.eventId,
  at: a.at,
  source: a.source,
  author: a.author,
  excerpt: a.excerpt,
  body: a.body,
  ...(a.by ? { by: a.by } : {}),
  origin: a.origin ?? 'new',
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

export type Stamp = { by?: string | undefined; origin: string };

const withStamp = (
  a: ResolvedAnnotation,
  stamp: Stamp,
): ResolvedAnnotation => ({
  eventId: a.eventId,
  at: a.at,
  source: a.source,
  author: a.author,
  excerpt: a.excerpt,
  body: a.body,
  status: a.status,
  ...(stamp.by ? { by: stamp.by } : {}),
  origin: stamp.origin,
});

export const applyStamps = (
  sent: readonly Pick<ResolvedAnnotation, 'eventId' | 'at' | 'origin'>[],
  now: readonly ResolvedAnnotation[],
  stamps: readonly Stamp[],
): ResolvedAnnotation[] =>
  now.map((a, i) => {
    const stamp = stamps[i];
    const was = sent[i];
    return stamp &&
      was &&
      was.eventId === a.eventId &&
      was.at === a.at &&
      was.origin === a.origin
      ? withStamp(a, stamp)
      : a;
  });
