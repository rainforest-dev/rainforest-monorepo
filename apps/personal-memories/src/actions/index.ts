import { z } from 'astro/zod';
import { ActionError, defineAction } from 'astro:actions';

import { DATE_RE, indexDays } from '../lib/days.ts';
import { originOf, stampAuthors, viewerName } from '../lib/notes/authors.ts';
import { notePayload, toPayload } from '../lib/notes/payload.ts';
import { notesStore, UnreadableNoteError } from '../lib/notes/store.ts';
import { getTimeline } from '../lib/store.ts';

const date = z.string().regex(DATE_RE);

const annotation = z.object({
  eventId: z.string(),
  at: z.string(),
  source: z.enum(['line', 'slack', 'photo']),
  author: z.string(),
  excerpt: z.string(),
  body: z.string(),
  by: z.string().max(80).optional(),
  origin: z.string().max(64).optional(),
});

const dayEvents = (d: string) => {
  const state = getTimeline();
  return state.status === 'ready'
    ? (indexDays(state.timeline.events).byDate.get(d) ?? [])
    : [];
};

export const server = {
  getNote: defineAction({
    input: z.object({ date }),
    handler: ({ date: d }, context) =>
      notePayload(
        notesStore(),
        d,
        dayEvents(d),
        viewerName(context.request.headers),
      ),
  }),
  saveNote: defineAction({
    input: z.object({
      date,
      body: z.string(),
      annotations: z.array(annotation),
      cover: z.string().optional(),
      version: z.string(),
    }),
    handler: ({ date: d, version, ...edit }, context) => {
      const store = notesStore();
      if (!store?.writable) {
        throw new ActionError({
          code: 'FORBIDDEN',
          message: 'notes are read-only',
        });
      }
      const viewer = viewerName(context.request.headers);
      const signedAnnotations = stampAuthors(
        edit.annotations,
        store.read(d).note.annotations,
        viewer,
      );
      const signed = { ...edit, annotations: signedAnnotations };
      let result;
      try {
        result = store.write(d, signed, version);
      } catch (error) {
        if (!(error instanceof UnreadableNoteError)) throw error;
        throw new ActionError({
          code: 'UNPROCESSABLE_CONTENT',
          message: error.message,
        });
      }
      if (result.ok) {
        return {
          ok: true as const,
          version: result.version,
          annotations: signedAnnotations.map((a) => ({
            by: a.by,
            origin: originOf(a),
          })),
        };
      }
      const current = toPayload(result.current, true, dayEvents(d));
      if (viewer) current.viewer = viewer;
      return { ok: false as const, current };
    },
  }),
};
