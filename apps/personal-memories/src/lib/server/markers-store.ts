import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'astro/zod';

import { DATE_RE } from '@/lib/days.ts';
import type { DayMarker, MarkerPart } from '@/lib/markers.ts';
import { taipeiDate } from '@/lib/weeks.ts';

import { type CachedFile, cachedFile } from './file-cache.ts';
import { getPeople, type PeopleConfig } from './people-store.ts';
import { dataDir, type TimelineState } from './store.ts';

export type MarkerSet = {
  markers: readonly DayMarker[];
  byDate: ReadonlyMap<string, readonly DayMarker[]>;
  dates: readonly string[];
};

export type MarkerFile = { markers: DayMarker[] };

export const NO_MARKERS: MarkerSet = {
  markers: [],
  byDate: new Map(),
  dates: [],
};

const isCalendarDate = (date: string) => {
  if (!DATE_RE.test(date)) return false;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === date;
};

const fileSchema = z
  .object({
    markers: z.array(
      z.object({
        date: z
          .string()
          .refine(isCalendarDate, 'expected a real YYYY-MM-DD date'),
        person: z.string().min(1),
        kind: z.enum(['wfh', 'leave']),
        part: z.enum(['full', 'am', 'pm']),
        event: z.string().min(1),
      }),
    ),
  })
  .superRefine((file, ctx) => {
    const parts = new Map<string, Set<MarkerPart>>();
    for (const m of file.markers) {
      const key = `${m.person} on ${m.date}`;
      const seen = parts.get(key) ?? new Set<MarkerPart>();
      if (seen.has(m.part))
        ctx.addIssue({
          code: 'custom',
          message: `two ${m.part} markers for ${key}`,
        });
      else if (seen.size > 0 && (m.part === 'full' || seen.has('full')))
        ctx.addIssue({
          code: 'custom',
          message: `a full-day marker beside a half-day one for ${key}`,
        });
      seen.add(m.part);
      parts.set(key, seen);
    }
  });

export const parseMarkerFile = (json: unknown): MarkerFile =>
  fileSchema.parse(json);

export function resolveMarkers(
  file: MarkerFile,
  people: PeopleConfig,
): MarkerSet {
  const ids = new Set(people.people.map((p) => p.id));
  const unknown = [...new Set(file.markers.map((m) => m.person))].filter(
    (id) => !ids.has(id),
  );
  if (unknown.length > 0)
    throw new Error(
      `markers.json names people missing from people.json: ${unknown.join(', ')}`,
    );
  const markers = [...file.markers].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const byDate = new Map<string, DayMarker[]>();
  for (const m of markers) {
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }
  return { markers, byDate, dates: [...byDate.keys()] };
}

const markersPath = (root: string | undefined) =>
  root && join(root, 'markers.json');

export function loadMarkers(
  root: string | undefined,
  people: PeopleConfig,
): MarkerSet {
  const path = markersPath(root);
  if (!path || !existsSync(path)) return NO_MARKERS;
  return resolveMarkers(
    parseMarkerFile(JSON.parse(readFileSync(path, 'utf8'))),
    people,
  );
}

type Loaded = { file: MarkerFile };

const EMPTY: Loaded = { file: { markers: [] } };

type SourceOptions = {
  log?: (message: string) => void;
  checkEveryMs?: number;
};

export function markerSource(
  path: string | undefined,
  people: () => Promise<PeopleConfig>,
  { log = console.error, checkEveryMs }: SourceOptions = {},
) {
  const file: CachedFile<Loaded> = cachedFile(
    path,
    (contents) =>
      contents === undefined
        ? EMPTY
        : { file: parseMarkerFile(JSON.parse(contents)) },
    { log, ...(checkEveryMs === undefined ? {} : { checkEveryMs }) },
  );
  const resolved = new WeakMap<Loaded, WeakMap<PeopleConfig, MarkerSet>>();
  return {
    async get(): Promise<MarkerSet> {
      const [loaded, config] = await Promise.all([
        file.get().catch(() => EMPTY),
        people(),
      ]);
      if (loaded === EMPTY) return NO_MARKERS;
      let byPeople = resolved.get(loaded);
      if (!byPeople) resolved.set(loaded, (byPeople = new WeakMap()));
      let set = byPeople.get(config);
      if (!set) {
        try {
          set = resolveMarkers(loaded.file, config);
        } catch (error) {
          log(`[memories] ${path} is ignored: ${String(error)}`);
          set = NO_MARKERS;
        }
        byPeople.set(config, set);
      }
      return set;
    },
  };
}

let source: ReturnType<typeof markerSource> | undefined;

export const getMarkers = (): Promise<MarkerSet> =>
  (source ??= markerSource(markersPath(dataDir()), getPeople)).get();

export const postedOnLookup =
  (state: TimelineState) =>
  (eventId: string): string | undefined => {
    const event =
      state.status === 'ready' ? state.byId.get(eventId) : undefined;
    return event && taipeiDate(event.at);
  };
