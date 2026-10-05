import {
  defineTool,
  type McpTool,
  ToolInputError,
} from '@rainforest-dev/mcp-kit';
import { z } from 'astro/zod';

import { DATE_RE, type DayIndex, indexDays, summarize } from '@/lib/days.ts';
import { nameOf, type Person } from '@/lib/people.ts';
import type { Embedder } from '@/lib/server/embed.ts';
import type { NotesStore } from '@/lib/server/notes-store.ts';
import type { PeopleConfig } from '@/lib/server/people-store.ts';
import {
  type Breaker,
  runSearch,
  type SearchIndex,
} from '@/lib/server/search-index.ts';
import type { TimelineState } from '@/lib/server/store.ts';
import type { TimelineEvent, TimelineSource } from '@/lib/server/timeline.ts';
import { taipeiTime } from '@/lib/weeks.ts';

export const TEXT_MAX = 2000;
export const NOTE_MAX = 8000;
export const OCR_MAX = 500;
export const DAY_RANGE_MAX = 366;

export type LastImport = { at: string; ok: boolean };

export type McpDeps = {
  timeline: () => Promise<TimelineState>;
  people: () => Promise<PeopleConfig>;
  notes: () => NotesStore | undefined;
  searchIndex: () => Promise<SearchIndex | undefined>;
  embedder: Embedder;
  breaker: Breaker;
  lastImport: () => Promise<LastImport | undefined>;
  publicUrl: string | undefined;
};

const SOURCES = ['line', 'slack', 'photo', 'note'] as const;
const source = z.enum(SOURCES);
const date = () =>
  z.string().regex(DATE_RE, 'expected a YYYY-MM-DD date in Asia/Taipei');

const LOCAL = String.raw`[\p{L}\p{N}._%+-]+`;
const DOMAIN = String.raw`@[\p{L}\p{N}.-]+\.[\p{L}]{2,}`;
const EMAIL_AT = new RegExp(LOCAL + DOMAIN, 'uy');
const EMAIL_AFTER_BREAK = new RegExp(
  String.raw`(?<![\p{L}\p{N}._%+-])` + LOCAL + DOMAIN,
  'gu',
);

const redactEmails = (text: string) => {
  let out = '';
  let from = 0;
  for (;;) {
    EMAIL_AT.lastIndex = from;
    let start = from;
    if (from === 0 || !EMAIL_AT.test(text)) {
      EMAIL_AFTER_BREAK.lastIndex = from;
      const match = EMAIL_AFTER_BREAK.exec(text);
      if (!match) break;
      start = match.index;
      EMAIL_AT.lastIndex = EMAIL_AFTER_BREAK.lastIndex;
    }
    out += `${text.slice(from, start)}[email]`;
    from = EMAIL_AT.lastIndex;
  }
  return out + text.slice(from);
};

const clip = (text: string, max: number) => {
  const chars = Array.from(redactEmails(text));
  return chars.length <= max
    ? chars.join('')
    : `${chars.slice(0, max - 1).join('')}…`;
};

async function readyTimeline(deps: McpDeps) {
  const state = await deps.timeline();
  if (state.status !== 'ready')
    throw new ToolInputError('The album has no timeline yet.');
  return state.timeline;
}

function checkRange(from: string | undefined, to: string | undefined) {
  if (from && to && from > to)
    throw new ToolInputError('from must not be after to.');
}

const DAY_MS = 24 * 60 * 60 * 1000;
const utc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const spanDays = (from: string, to: string) =>
  Math.round((utc(to) - utc(from)) / DAY_MS) + 1;

const searchMemories = (deps: McpDeps) =>
  defineTool({
    name: 'search_memories',
    title: 'Search memories',
    description:
      'Full-text and semantic search over the chat messages, photo metadata and diary notes in the album. ' +
      'Returns the best-matching days, newest-first on ties, each with one snippet. ' +
      'Resolve natural-language dates yourself and pass from and to together (YYYY-MM-DD, Asia/Taipei). ' +
      'people takes ids from list_people. Open a day with get_day.',
    input: {
      query: z.string().trim().min(1).max(200),
      from: date().optional(),
      to: date().optional(),
      people: z.array(z.string()).max(10).optional(),
      sources: z.array(source).optional(),
      limit: z.number().int().min(1).max(20).default(10),
    },
    output: {
      results: z.array(
        z.object({
          date: z.string(),
          source,
          snippet: z.string(),
          score: z.number(),
        }),
      ),
      semantic: z.enum(['on', 'off']),
      reason: z.string().optional(),
      stale: z.number().optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async ({ query, from, to, people, sources, limit }) => {
      if ((from === undefined) !== (to === undefined))
        throw new ToolInputError('Pass from and to together, or neither.');
      checkRange(from, to);
      const index = await deps.searchIndex();
      if (!index)
        return { results: [], semantic: 'off' as const, reason: 'no-index' };
      const scoped: SearchIndex = sources?.length
        ? {
            ...index,
            docs: index.docs.filter((d) => sources.includes(d.source)),
            ...(sources.includes('note') ? {} : { extra: undefined }),
          }
        : index;
      const found = await runSearch(
        scoped,
        {
          text: query,
          ...(from && to ? { range: { start: from, end: to } } : {}),
          ...(people?.length ? { people } : {}),
        },
        deps.embedder,
        deps.breaker,
      );
      return {
        results: found.results.slice(0, limit).map((r) => ({
          date: r.date,
          source: r.source,
          snippet: clip(r.snippet, TEXT_MAX),
          score: r.score,
        })),
        semantic: found.semantic,
        ...(found.reason ? { reason: found.reason } : {}),
        ...(found.stale ? { stale: found.stale } : {}),
      };
    },
  });

function neighboursOf(index: DayIndex, day: string) {
  const prev = index.dates.filter((d) => d < day).at(-1);
  const next = index.dates.find((d) => d > day);
  return { ...(prev ? { prev } : {}), ...(next ? { next } : {}) };
}

function eventView(event: TimelineEvent, people: readonly Person[]) {
  const meta = event.photo?.meta;
  const photo =
    event.source === 'photo'
      ? {
          labels: meta?.labels ?? [],
          ...(meta?.place ? { place: meta.place } : {}),
          venues: meta?.venues ?? [],
          people: (meta?.persons ?? []).map((n) => nameOf(people, 'photo', n)),
          ...(meta?.text?.length
            ? { text: clip(meta.text.join('\n'), OCR_MAX) }
            : {}),
          mediaCount: event.media?.length ?? 0,
        }
      : undefined;
  return {
    id: event.id,
    time: taipeiTime(event.at),
    source: event.source,
    author: nameOf(people, event.source, event.author),
    ...(event.text ? { text: clip(event.text, TEXT_MAX) } : {}),
    ...(photo ? { photo } : {}),
  };
}

function noteView(
  store: NotesStore | undefined,
  day: string,
  people: readonly Person[],
) {
  const read = store?.read(day);
  if (!read || read.parseError) return undefined;
  const { body, annotations } = read.note;
  if (!body.trim() && annotations.length === 0) return undefined;
  return {
    body: clip(body, NOTE_MAX),
    annotations: annotations.map((a) => ({
      time: taipeiTime(a.at),
      source: a.source,
      author: nameOf(people, a.source, a.author),
      excerpt: clip(a.excerpt, TEXT_MAX),
      ...(a.by ? { by: a.by } : {}),
      text: clip(a.body, TEXT_MAX),
    })),
  };
}

const timelineSource = z.enum(['line', 'slack', 'photo']);

const getDay = (deps: McpDeps) =>
  defineTool({
    name: 'get_day',
    title: 'Read a day',
    description:
      'Reads one day of the album (YYYY-MM-DD, Asia/Taipei): messages with their display-name authors, ' +
      'photo metadata (labels, place, people, OCR text; never the image), and the diary note with its annotations. ' +
      'Events page with cursor and limit; follow nextCursor for more. ' +
      'A day with no records returns only the nearest prev and next days. ' +
      'url opens the day for a human; it sits behind a login and cannot be fetched.',
    input: {
      date: date(),
      sources: z.array(source).optional(),
      cursor: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(200).default(100),
    },
    output: {
      date: z.string(),
      counts: z
        .object({ line: z.number(), slack: z.number(), photo: z.number() })
        .optional(),
      prev: z.string().optional(),
      next: z.string().optional(),
      url: z.string().optional(),
      events: z
        .array(
          z.object({
            id: z.string(),
            time: z.string(),
            source: timelineSource,
            author: z.string(),
            text: z.string().optional(),
            photo: z
              .object({
                labels: z.array(z.string()),
                place: z.string().optional(),
                venues: z.array(z.string()),
                people: z.array(z.string()),
                text: z.string().optional(),
                mediaCount: z.number(),
              })
              .optional(),
          }),
        )
        .optional(),
      note: z
        .object({
          body: z.string(),
          annotations: z.array(
            z.object({
              time: z.string(),
              source: timelineSource,
              author: z.string(),
              excerpt: z.string(),
              by: z.string().optional(),
              text: z.string(),
            }),
          ),
        })
        .optional(),
      nextCursor: z.number().optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async ({ date: day, sources, cursor, limit }) => {
      const timeline = await readyTimeline(deps);
      const index = indexDays(timeline.events);
      const all = index.byDate.get(day);
      if (!all) return { date: day, ...neighboursOf(index, day) };
      const people = (await deps.people()).people;
      const [summary] = summarize({ dates: [day], byDate: index.byDate });
      const shown = sources?.length
        ? all.filter((e) => sources.includes(e.source))
        : all;
      const page = shown.slice(cursor, cursor + limit);
      const note =
        !sources?.length || sources.includes('note')
          ? noteView(deps.notes(), day, people)
          : undefined;
      return {
        date: day,
        ...(summary ? { counts: summary.counts } : {}),
        ...neighboursOf(index, day),
        url: `${deps.publicUrl?.replace(/\/+$/, '') ?? ''}/day/${day}`,
        events: page.map((e) => eventView(e, people)),
        ...(note ? { note } : {}),
        ...(cursor + limit < shown.length
          ? { nextCursor: cursor + limit }
          : {}),
      };
    },
  });

const listPeople = (deps: McpDeps) =>
  defineTool({
    name: 'list_people',
    title: 'List people',
    description:
      'Lists the people in the album with their display names and per-source aliases. ' +
      'Use an id in search_memories.people. owner is the id of the album owner.',
    input: {},
    output: {
      people: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          aliases: z.object({
            line: z.array(z.string()).optional(),
            slack: z.array(z.string()).optional(),
            photo: z.array(z.string()).optional(),
          }),
        }),
      ),
      owner: z.string().optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async () => {
      const config = await deps.people();
      const people = config.people.map(({ id, name, aliases }) => ({
        id,
        name,
        aliases,
      }));
      const owner = people.find((p) => config.owners.has(p.name))?.id;
      return { people, ...(owner ? { owner } : {}) };
    },
  });

type Counts = Record<TimelineSource | 'note', number>;
const zero = (): Counts => ({ line: 0, slack: 0, photo: 0, note: 0 });

function bucketKeys(from: string, to: string, by: 'month' | 'day') {
  const keys: string[] = [];
  if (by === 'day') {
    for (let t = utc(from); t <= utc(to); t += DAY_MS)
      keys.push(new Date(t).toISOString().slice(0, 10));
    return keys;
  }
  let [year, month] = from.split('-').map(Number) as [number, number];
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > end) return keys;
    keys.push(key);
    month = month === 12 ? 1 : month + 1;
    if (month === 1) year++;
  }
}

const getCoverage = (deps: McpDeps) =>
  defineTool({
    name: 'get_coverage',
    title: 'Album coverage',
    description:
      'Reports how much the album holds and how fresh it is: first and last day, when the timeline was built, ' +
      'the last automatic import, totals per source, and counts per month or per day. ' +
      'from and to (YYYY-MM-DD) narrow the totals and buckets; by "day" needs a range of 366 days or fewer.',
    input: {
      from: date().optional(),
      to: date().optional(),
      by: z.enum(['month', 'day']).default('month'),
    },
    output: {
      firstDate: z.string().optional(),
      lastDate: z.string().optional(),
      generatedAt: z.string(),
      lastImport: z.object({ at: z.string(), ok: z.boolean() }).optional(),
      totals: z.object({
        line: z.number(),
        slack: z.number(),
        photo: z.number(),
        notes: z.number(),
      }),
      buckets: z.array(
        z.object({
          key: z.string(),
          line: z.number(),
          slack: z.number(),
          photo: z.number(),
          note: z.number(),
        }),
      ),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async ({ from, to, by }) => {
      checkRange(from, to);
      const timeline = await readyTimeline(deps);
      const index = indexDays(timeline.events);
      const firstDate = index.dates[0];
      const lastDate = index.dates.at(-1);
      const noteDates = [...(deps.notes()?.dates() ?? [])];
      const start = from ?? firstDate;
      const end = to ?? lastDate;
      if (by === 'day' && start && end && spanDays(start, end) > DAY_RANGE_MAX)
        throw new ToolInputError(
          `by "day" needs a range of ${DAY_RANGE_MAX} days or fewer; pass a narrower from and to.`,
        );
      const lastImport = await deps.lastImport();
      const lo = [start, firstDate].filter(Boolean).sort().at(-1);
      const hi = [end, lastDate].filter(Boolean).sort()[0];
      const keys = lo && hi && lo <= hi ? bucketKeys(lo, hi, by) : [];
      const buckets = new Map(keys.map((k) => [k, zero()]));
      const keyOf = (day: string) => (by === 'day' ? day : day.slice(0, 7));
      const inRange = (day: string) =>
        (!start || day >= start) && (!end || day <= end);
      const totals = zero();
      for (const summary of summarize(index)) {
        if (!inRange(summary.date)) continue;
        const bucket = buckets.get(keyOf(summary.date));
        for (const s of ['line', 'slack', 'photo'] as const) {
          totals[s] += summary.counts[s];
          if (bucket) bucket[s] += summary.counts[s];
        }
      }
      for (const day of noteDates) {
        if (!inRange(day)) continue;
        totals.note++;
        const bucket = buckets.get(keyOf(day));
        if (bucket) bucket.note++;
      }
      return {
        ...(firstDate ? { firstDate } : {}),
        ...(lastDate ? { lastDate } : {}),
        generatedAt: timeline.generatedAt,
        ...(lastImport ? { lastImport } : {}),
        totals: {
          line: totals.line,
          slack: totals.slack,
          photo: totals.photo,
          notes: totals.note,
        },
        buckets: [...buckets].map(([key, counts]) => ({ key, ...counts })),
      };
    },
  });

export const memoriesTools = (deps: McpDeps): McpTool[] => [
  searchMemories(deps),
  getDay(deps),
  listPeople(deps),
  getCoverage(deps),
];
