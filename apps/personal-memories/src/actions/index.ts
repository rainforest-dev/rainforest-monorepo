import { z } from 'astro/zod';
import { ActionError, defineAction } from 'astro:actions';

import {
  DATE_RE,
  EMOTION_IDS,
  indexDays,
  ISLAND_IDS,
  parseOrbKey,
  PERSON_COLORS,
} from '@/lib';
import {
  originOf,
  stampAuthors,
  UnknownAuthorError,
  viewerName,
} from '@/lib/notes';
import {
  getNoteVectors,
  getPeople,
  getTimeline,
  notePayload,
  notesStore,
  orbPair,
  orbsStore,
  publicPeople,
  toPayload,
  UnreadableNoteError,
  viewerId,
} from '@/lib/server';

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

const dayEvents = async (d: string) => {
  const state = await getTimeline();
  return state.status === 'ready'
    ? (indexDays(state.timeline.events).byDate.get(d) ?? [])
    : [];
};

export const server = {
  getNote: defineAction({
    input: z.object({ date }),
    handler: async ({ date: d }, context) => {
      const people = await getPeople();
      return notePayload(
        notesStore(),
        d,
        await dayEvents(d),
        viewerName(context.request.headers, people.people),
        publicPeople(people),
      );
    },
  }),
  saveNote: defineAction({
    input: z.object({
      date,
      body: z.string(),
      annotations: z.array(annotation),
      cover: z.string().optional(),
      version: z.string(),
    }),
    handler: async ({ date: d, version, ...edit }, context) => {
      const store = notesStore();
      if (!store?.writable) {
        throw new ActionError({
          code: 'FORBIDDEN',
          message: 'notes are read-only',
        });
      }
      const people = await getPeople();
      const viewer = viewerName(context.request.headers, people.people);
      let signedAnnotations;
      try {
        signedAnnotations = stampAuthors(
          edit.annotations,
          store.read(d).note.annotations,
          viewer,
          new Set(people.people.map((p) => p.name)),
        );
      } catch (error) {
        if (!(error instanceof UnknownAuthorError)) throw error;
        throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      }
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
        getNoteVectors()
          .refresh(d)
          .catch((error: unknown) =>
            console.error('[memories] note search refresh failed', error),
          );
        return {
          ok: true as const,
          version: result.version,
          annotations: signedAnnotations.map((a) => ({
            by: a.by,
            origin: originOf(a),
          })),
        };
      }
      const current = toPayload(
        result.current,
        true,
        await dayEvents(d),
        publicPeople(people),
      );
      if (viewer) current.viewer = viewer;
      return { ok: false as const, current };
    },
  }),
  setOrb: defineAction({
    input: z.object({
      key: z.string().max(220),
      emotion: z.enum(EMOTION_IDS).nullable().optional(),
      island: z.enum(ISLAND_IDS).nullable().optional(),
      core: z.boolean().optional(),
    }),
    handler: async ({ key, ...patch }, context) => {
      const store = orbsStore();
      if (!store?.writable)
        throw new ActionError({
          code: 'FORBIDDEN',
          message: 'orbs are read-only',
        });
      const people = await getPeople();
      const person = viewerId(context.request.headers, people);
      if (
        !person ||
        !orbPair(people, PERSON_COLORS).some((p) => p.id === person)
      )
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'sign in through Access to pick',
        });
      const parsed = parseOrbKey(key);
      const state = await getTimeline();
      const known =
        parsed &&
        state.status === 'ready' &&
        (parsed.kind === 'day'
          ? indexDays(state.timeline.events).byDate.has(parsed.date)
          : state.byId.get(parsed.eventId)?.source === 'photo');
      if (!known)
        throw new ActionError({ code: 'NOT_FOUND', message: 'unknown memory' });
      const file = store.update(key, person, patch);
      return { entry: file.orbs[key] ?? {} };
    },
  }),
};
