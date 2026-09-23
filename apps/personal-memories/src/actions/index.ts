import { z } from 'astro/zod';
import { ActionError, defineAction } from 'astro:actions';

import { DATE_RE, indexDays } from '../lib/days.ts';
import { notePayload, toPayload } from '../lib/notes/payload.ts';
import { notesStore } from '../lib/notes/store.ts';
import { getTimeline } from '../lib/store.ts';

const date = z.string().regex(DATE_RE);

const annotation = z.object({
  eventId: z.string(),
  at: z.string(),
  source: z.enum(['line', 'slack', 'photo']),
  author: z.string(),
  excerpt: z.string(),
  body: z.string(),
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
    handler: ({ date: d }) => notePayload(notesStore(), d, dayEvents(d)),
  }),
  saveNote: defineAction({
    input: z.object({
      date,
      body: z.string(),
      annotations: z.array(annotation),
      cover: z.string().optional(),
      version: z.string(),
    }),
    handler: ({ date: d, version, ...edit }) => {
      const store = notesStore();
      if (!store?.writable) {
        throw new ActionError({
          code: 'FORBIDDEN',
          message: 'notes are read-only',
        });
      }
      const result = store.write(d, edit, version);
      return result.ok
        ? { ok: true as const, version: result.version }
        : {
            ok: false as const,
            current: toPayload(result.current, true, dayEvents(d)),
          };
    },
  }),
};
