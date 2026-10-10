# Memories Day Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show leave and WFH days, read from a private `markers.json`, on the day, month and year views of personal-memories and through its MCP.

**Architecture:** A client-safe model (`src/lib/markers.ts`) defines markers and their display helpers. A server store (`src/lib/server/markers-store.ts`) loads and validates `$MEMORIES_DATA_DIR/markers.json` with an mtime cache, exactly as `people-store.ts` loads `people.json`. `indexDays` learns to include extra dates, so a day with markers and no messages becomes a real day everywhere the day index is used. Views read marker views from one server helper; MCP gets a `markers` dependency.

**Tech Stack:** Astro 6 SSR, React islands, Tailwind v4 with the shared shadcn plugin tokens, zod from `astro/zod`, Vitest 4, Playwright, `@rainforest-dev/mcp-kit`.

**Spec:** `docs/superpowers/specs/2026-10-10-memories-day-markers-design.md`

## Global Constraints

- All work is in `apps/personal-memories` and `apps/personal-memories-e2e`. Run tasks through Nx: `pnpm nx test personal-memories`, `pnpm nx typecheck personal-memories`, `pnpm nx lint personal-memories`, `pnpm nx e2e personal-memories-e2e`.
- No real name or real message anywhere in the repository. Fixtures use the fictional `alice` / `bob` (`Alice` / `Bob`) already in `src/cli/fixture.ts`.
- `kind` is `"wfh"` or `"leave"`; `part` is `"full"`, `"am"` or `"pm"`. Labels: `WFH`, `請假`; `全天`, `上午`, `下午`.
- `(date, person, part)` is unique, and a `full` marker excludes `am` and `pm` for the same person and date.
- Colours: `wfh` → `info`, `leave` → `warning` (semantic tokens only; no palette classes, no hex, no `dark:`).
- Markers ignore the source filter. `get_coverage` keeps counting events only.
- Imports: `@/…` across directories, `./file` within one; `.astro` components by file path; never `../` under `src` except in `src/cli` and `src/lib/ingest`. `import-x/no-cycle` must stay green.
- Comments: none, except one line naming an external constraint or a lint-suppression reason. Before each commit run `git diff -U0 --cached | grep -E '^\+\s*(//|/\*|\*|#)'` and delete any hit that is not on that list.
- Commits: conventional, scope `personal-memories` or `personal-memories-e2e`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never disable GPG signing.
- Before writing Playwright tests, read the `playwright-best-practices` skill if it is installed; otherwise follow the patterns in the existing specs.

## Review Focus

1. **`people.json` missing while `markers.json` exists.** Legacy people use names as ids, so every marker's person is unknown. Expected: the markers are ignored with one log line, and every page still renders. Test: `markerSource` unknown-person case (Task 1).
2. **A marker whose `event` is not in the timeline** (message edited and re-ingested). Expected: the marker still shows, without a 原訊息 link in the UI and without `postedOn` in MCP. Tests: `markerViews` without postedOn (Task 1), `list_markers` omits `postedOn` (Task 4).
3. **`markers.json` becomes invalid while the app runs.** Expected: the previous good copy keeps serving; with no previous copy, no markers. Test: `markerSource` invalid-after-valid case (Task 1).
4. **A marker on the day its own message was posted.** Expected: the link is an in-page `#ev-…` anchor and lands on the message. Test: e2e `markers.spec.ts` Bob 11-01 case (Task 5).
5. **Streaming into a marker-only day.** Expected: the day partial for a day with markers and no events answers 200 and renders the marker row. Test: e2e partial request (Task 5).

---

## File Structure

Create:

- `apps/personal-memories/src/lib/markers.ts`: marker types, labels, view building, bars, summary and day detail. Client-safe.
- `apps/personal-memories/src/lib/markers.test.ts`
- `apps/personal-memories/src/lib/server/markers-store.ts`: schema, resolution against people, `loadMarkers`, `markerSource`, `getMarkers`, `postedOnLookup`.
- `apps/personal-memories/src/lib/server/markers-store.test.ts`
- `apps/personal-memories/src/lib/server/day-index.ts`: `getDayIndex`, `getMarkerViews`.
- `apps/personal-memories/src/components/marker-classes.ts`: kind → token class maps.
- `apps/personal-memories/src/components/day/DayMarkers.astro`: the marker row of a day section.
- `apps/personal-memories/src/components/HeatBars.astro`: the bars inside a year heatmap cell.
- `apps/personal-memories/src/components/month/MonthBadges.astro`: badges in a month cell.
- `apps/personal-memories-e2e/src/markers.spec.ts`

Modify:

- `apps/personal-memories/src/lib/days.ts` and `days.test.ts`: `indexDays(events, extraDates)`.
- `apps/personal-memories/src/lib/month-view.ts` and `month-view.test.ts`: `MonthCell.markers`, `hasDay`.
- `apps/personal-memories/src/lib/index.ts`, `src/lib/server/index.ts`: barrel exports.
- `apps/personal-memories/src/live.config.ts`, `src/pages/index.astro`, `src/pages/month/[month].astro`, `src/pages/day/[date].astro`, `src/pages/week/[isoWeek].astro`, `src/pages/days.json.ts`: use `getDayIndex`.
- `apps/personal-memories/src/components/DaySection.astro`, `Heatmap.astro`, `month/MonthCalendar.astro`, `month/MonthCellBody.astro`.
- `apps/personal-memories/src/lib/server/mcp/tools.ts`, `handler.ts`, `testing.ts`, `tools.test.ts`.
- `apps/personal-memories/src/cli/fixture.ts`.
- `apps/personal-memories-e2e/src/timeline.spec.ts`, `ai-parse.spec.ts`, `mcp.spec.ts`, and visual baselines that legitimately change.

---

### Task 1: Marker model and store

**Files:**

- Create: `apps/personal-memories/src/lib/markers.ts`, `src/lib/markers.test.ts`, `src/lib/server/markers-store.ts`, `src/lib/server/markers-store.test.ts`
- Modify: `apps/personal-memories/src/lib/index.ts`, `src/lib/server/index.ts`

**Interfaces:**

- Consumes: `cachedFile` (`src/lib/server/file-cache.ts`), `getPeople`, `PeopleConfig` (`people-store.ts`), `dataDir`, `TimelineState` (`store.ts`), `DATE_RE` (`src/lib/days.ts`), `taipeiDate` (`src/lib/weeks.ts`).
- Produces, from `@/lib` (`src/lib/markers.ts`):
  - `type MarkerKind = 'wfh' | 'leave'`, `type MarkerPart = 'full' | 'am' | 'pm'`
  - `type DayMarker = { date: string; person: string; kind: MarkerKind; part: MarkerPart; event: string }`
  - `type MarkerView = { person: string; name: string; owner: boolean; kind: MarkerKind; part: MarkerPart; event: string; postedOn?: string }`
  - `type MarkerBar = { person: string; segments: { kind: MarkerKind; part: MarkerPart }[] }`
  - `KIND_LABEL`, `PART_LABEL`, `markerLabel(m): string`
  - `markerViews(markers, people, owners, postedOn): MarkerView[]`
  - `markerViewsByDate(byDate, people, owners, postedOn): Map<string, MarkerView[]>`
  - `markerBars(views): MarkerBar[]`, `markerSummary(views): string`, `dominantKind(views): MarkerKind | undefined`, `dayDetail(total, noted, views?): string`
- Produces, from `@/lib/server` (`markers-store.ts`):
  - `type MarkerSet = { markers: readonly DayMarker[]; byDate: ReadonlyMap<string, readonly DayMarker[]>; dates: readonly string[] }`
  - `type MarkerFile = { markers: DayMarker[] }`
  - `NO_MARKERS: MarkerSet`
  - `parseMarkerFile(json: unknown): MarkerFile`, which throws a zod error
  - `resolveMarkers(file: MarkerFile, people: PeopleConfig): MarkerSet`, which throws on an unknown person
  - `loadMarkers(root: string | undefined, people: PeopleConfig): MarkerSet`, which is synchronous and throws on an invalid file
  - `markerSource(path, people: () => Promise<PeopleConfig>, options?: { log?: (m: string) => void; checkEveryMs?: number }): { get(): Promise<MarkerSet> }`
  - `getMarkers(): Promise<MarkerSet>`
  - `postedOnLookup(state: TimelineState): (eventId: string) => string | undefined`

- [ ] **Step 1: Write the failing model tests**

`apps/personal-memories/src/lib/markers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  type DayMarker,
  dayDetail,
  dominantKind,
  markerBars,
  markerLabel,
  markerSummary,
  markerViews,
  markerViewsByDate,
} from './markers.ts';

const PEOPLE = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
];
const OWNERS = new Set(['Bob']);
const POSTED: Record<string, string> = { e1: '2025-11-02' };
const postedOn = (id: string) => POSTED[id];

const marker = (
  person: string,
  kind: DayMarker['kind'],
  part: DayMarker['part'],
  event = 'e1',
): DayMarker => ({ date: '2025-11-03', person, kind, part, event });

describe('markerLabel', () => {
  it('joins kind and part', () => {
    expect(markerLabel({ kind: 'leave', part: 'pm' })).toBe('請假・下午');
    expect(markerLabel({ kind: 'wfh', part: 'full' })).toBe('WFH・全天');
  });
});

describe('markerViews', () => {
  it('names people, puts the owner first and orders a day am before pm', () => {
    const views = markerViews(
      [
        marker('alice', 'wfh', 'pm'),
        marker('alice', 'leave', 'am'),
        marker('bob', 'wfh', 'full'),
      ],
      PEOPLE,
      OWNERS,
      postedOn,
    );
    expect(views.map((v) => [v.name, v.owner, v.part])).toEqual([
      ['Bob', true, 'full'],
      ['Alice', false, 'am'],
      ['Alice', false, 'pm'],
    ]);
    expect(views[0]?.postedOn).toBe('2025-11-02');
  });

  it('leaves postedOn out when the source message is not in the timeline', () => {
    const [view] = markerViews(
      [marker('alice', 'leave', 'full', 'gone')],
      PEOPLE,
      OWNERS,
      postedOn,
    );
    expect(view).not.toHaveProperty('postedOn');
  });

  it('builds views per date', () => {
    const byDate = new Map([['2025-11-03', [marker('alice', 'wfh', 'am')]]]);
    expect(
      markerViewsByDate(byDate, PEOPLE, OWNERS, postedOn).get('2025-11-03'),
    ).toHaveLength(1);
  });
});

describe('bars, summary and detail', () => {
  const views = markerViews(
    [
      marker('alice', 'leave', 'am'),
      marker('alice', 'wfh', 'pm'),
      marker('bob', 'wfh', 'full'),
    ],
    PEOPLE,
    OWNERS,
    postedOn,
  );

  it('groups bars per person in view order', () => {
    expect(markerBars(views)).toEqual([
      { person: 'bob', segments: [{ kind: 'wfh', part: 'full' }] },
      {
        person: 'alice',
        segments: [
          { kind: 'leave', part: 'am' },
          { kind: 'wfh', part: 'pm' },
        ],
      },
    ]);
  });

  it('summarises per person', () => {
    expect(markerSummary(views)).toBe(
      'Bob WFH・全天，Alice 請假・上午、WFH・下午',
    );
    expect(markerSummary([])).toBe('');
  });

  it('prefers leave as the dominant kind', () => {
    expect(dominantKind(views)).toBe('leave');
    expect(dominantKind(views.filter((v) => v.kind === 'wfh'))).toBe('wfh');
    expect(dominantKind([])).toBeUndefined();
  });

  it('extends the day detail only when there are markers', () => {
    expect(dayDetail(3, true)).toBe('3 則 · 已寫回憶');
    expect(dayDetail(0, false, views.slice(0, 1))).toBe('0 則 · Bob WFH・全天');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm nx test personal-memories -- src/lib/markers.test.ts`
Expected: FAIL, because `./markers.ts` does not exist.

- [ ] **Step 3: Write `src/lib/markers.ts`**

```ts
export type MarkerKind = 'wfh' | 'leave';
export type MarkerPart = 'full' | 'am' | 'pm';

export type DayMarker = {
  date: string;
  person: string;
  kind: MarkerKind;
  part: MarkerPart;
  event: string;
};

export type MarkerView = {
  person: string;
  name: string;
  owner: boolean;
  kind: MarkerKind;
  part: MarkerPart;
  event: string;
  postedOn?: string;
};

export type MarkerBar = {
  person: string;
  segments: { kind: MarkerKind; part: MarkerPart }[];
};

type Named = { id: string; name: string };

export const KIND_LABEL: Record<MarkerKind, string> = {
  wfh: 'WFH',
  leave: '請假',
};

export const PART_LABEL: Record<MarkerPart, string> = {
  full: '全天',
  am: '上午',
  pm: '下午',
};

const PART_ORDER: Record<MarkerPart, number> = { full: 0, am: 0, pm: 1 };

export const markerLabel = (m: { kind: MarkerKind; part: MarkerPart }) =>
  `${KIND_LABEL[m.kind]}・${PART_LABEL[m.part]}`;

export function markerViews(
  markers: readonly DayMarker[],
  people: readonly Named[],
  owners: ReadonlySet<string>,
  postedOn: (eventId: string) => string | undefined,
): MarkerView[] {
  const rank = new Map(people.map((p, i) => [p.id, i]));
  const rankOf = (id: string) => rank.get(id) ?? people.length;
  return markers
    .map((m) => {
      const name = people.find((p) => p.id === m.person)?.name ?? m.person;
      const posted = postedOn(m.event);
      return {
        person: m.person,
        name,
        owner: owners.has(name),
        kind: m.kind,
        part: m.part,
        event: m.event,
        ...(posted ? { postedOn: posted } : {}),
      };
    })
    .sort(
      (a, b) =>
        Number(b.owner) - Number(a.owner) ||
        rankOf(a.person) - rankOf(b.person) ||
        PART_ORDER[a.part] - PART_ORDER[b.part],
    );
}

export function markerViewsByDate(
  byDate: ReadonlyMap<string, readonly DayMarker[]>,
  people: readonly Named[],
  owners: ReadonlySet<string>,
  postedOn: (eventId: string) => string | undefined,
): Map<string, MarkerView[]> {
  return new Map(
    [...byDate].map(([date, list]) => [
      date,
      markerViews(list, people, owners, postedOn),
    ]),
  );
}

export function markerBars(views: readonly MarkerView[]): MarkerBar[] {
  const bars = new Map<string, MarkerBar>();
  for (const v of views) {
    const bar = bars.get(v.person) ?? { person: v.person, segments: [] };
    bar.segments.push({ kind: v.kind, part: v.part });
    bars.set(v.person, bar);
  }
  return [...bars.values()];
}

export function markerSummary(views: readonly MarkerView[]): string {
  const labels = new Map<string, string[]>();
  for (const v of views)
    labels.set(v.name, [...(labels.get(v.name) ?? []), markerLabel(v)]);
  return [...labels]
    .map(([name, list]) => `${name} ${list.join('、')}`)
    .join('，');
}

export const dominantKind = (
  views: readonly MarkerView[],
): MarkerKind | undefined =>
  views.some((v) => v.kind === 'leave')
    ? 'leave'
    : views.length > 0
      ? 'wfh'
      : undefined;

export function dayDetail(
  total: number,
  noted: boolean,
  views: readonly MarkerView[] = [],
): string {
  return [`${total} 則`, noted && '已寫回憶', markerSummary(views)]
    .filter(Boolean)
    .join(' · ');
}
```

Add `export * from './markers.ts';` to `src/lib/index.ts`, between `./lightbox.ts` and `./month-view.ts`.

- [ ] **Step 4: Run the model tests**

Run: `pnpm nx test personal-memories -- src/lib/markers.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing store tests**

`apps/personal-memories/src/lib/server/markers-store.test.ts`:

```ts
import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  loadMarkers,
  markerSource,
  NO_MARKERS,
  parseMarkerFile,
  postedOnLookup,
  resolveMarkers,
} from './markers-store.ts';
import { parsePeople } from './people-store.ts';
import { parseTimeline } from './store.ts';

const PEOPLE = parsePeople({
  owner: 'bob',
  people: [
    { id: 'bob', name: 'Bob' },
    { id: 'alice', name: 'Alice' },
  ],
});

const m = (over: Record<string, unknown> = {}) => ({
  date: '2025-11-03',
  person: 'alice',
  kind: 'leave',
  part: 'am',
  event: 'e1',
  ...over,
});

const tempFile = (body: unknown) => {
  const dir = mkdtempSync(join(tmpdir(), 'memories-markers-'));
  const path = join(dir, 'markers.json');
  writeFileSync(path, typeof body === 'string' ? body : JSON.stringify(body));
  return { dir, path };
};

describe('parseMarkerFile', () => {
  it('accepts a morning of leave and an afternoon at home', () => {
    const file = parseMarkerFile({
      markers: [m(), m({ kind: 'wfh', part: 'pm' })],
    });
    expect(file.markers).toHaveLength(2);
  });

  it.each([
    ['an impossible date', [m({ date: '2025-02-30' })]],
    ['a malformed date', [m({ date: '2025-2-3' })]],
    ['an unknown kind', [m({ kind: 'sick' })]],
    ['a duplicate part', [m(), m()]],
    ['full beside a half day', [m(), m({ part: 'full' })]],
    ['a half day beside full', [m({ part: 'full' }), m({ part: 'pm' })]],
  ])('rejects %s', (_, markers) => {
    expect(() => parseMarkerFile({ markers })).toThrow();
  });

  it('lets two people share a day and part', () => {
    expect(() =>
      parseMarkerFile({ markers: [m(), m({ person: 'bob' })] }),
    ).not.toThrow();
  });
});

describe('resolveMarkers', () => {
  it('indexes by date in date order', () => {
    const set = resolveMarkers(
      parseMarkerFile({
        markers: [m({ date: '2025-11-04', part: 'full' }), m()],
      }),
      PEOPLE,
    );
    expect(set.dates).toEqual(['2025-11-03', '2025-11-04']);
    expect(set.byDate.get('2025-11-03')).toHaveLength(1);
  });

  it('rejects a person missing from people.json', () => {
    expect(() =>
      resolveMarkers(
        parseMarkerFile({ markers: [m({ person: 'carol' })] }),
        PEOPLE,
      ),
    ).toThrow(/carol/);
  });
});

describe('loadMarkers', () => {
  it('returns no markers without a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'memories-markers-'));
    expect(loadMarkers(dir, PEOPLE)).toBe(NO_MARKERS);
    expect(loadMarkers(undefined, PEOPLE)).toBe(NO_MARKERS);
  });

  it('reads the file in the data directory', () => {
    const { dir } = tempFile({ markers: [m()] });
    expect(loadMarkers(dir, PEOPLE).markers).toHaveLength(1);
  });
});

describe('markerSource', () => {
  const people = async () => PEOPLE;

  it('reloads when the file changes', async () => {
    const { path } = tempFile({ markers: [m()] });
    const source = markerSource(path, people, { checkEveryMs: 0 });
    expect((await source.get()).markers).toHaveLength(1);
    writeFileSync(
      path,
      JSON.stringify({ markers: [m(), m({ kind: 'wfh', part: 'pm' })] }),
    );
    utimesSync(path, new Date(), new Date(Date.now() + 5000));
    expect((await source.get()).markers).toHaveLength(2);
  });

  it('keeps the previous copy when the file turns invalid', async () => {
    const { path } = tempFile({ markers: [m()] });
    const log = vi.fn();
    const source = markerSource(path, people, { checkEveryMs: 0, log });
    await source.get();
    writeFileSync(path, '{ not json');
    utimesSync(path, new Date(), new Date(Date.now() + 5000));
    expect((await source.get()).markers).toHaveLength(1);
    expect(log).toHaveBeenCalled();
  });

  it('serves no markers when the first copy is invalid', async () => {
    const { path } = tempFile({ markers: [m({ part: 'noon' })] });
    const source = markerSource(path, people, {
      checkEveryMs: 0,
      log: () => undefined,
    });
    expect(await source.get()).toBe(NO_MARKERS);
  });

  it('ignores the whole file, once logged, when a person is unknown', async () => {
    const { path } = tempFile({ markers: [m()] });
    const legacy = parsePeople({ people: [{ id: 'Alice', name: 'Alice' }] });
    const log = vi.fn();
    const source = markerSource(path, async () => legacy, {
      checkEveryMs: 0,
      log,
    });
    expect(await source.get()).toBe(NO_MARKERS);
    expect(await source.get()).toBe(NO_MARKERS);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('returns the same set while nothing changes', async () => {
    const { path } = tempFile({ markers: [m()] });
    const source = markerSource(path, people, { checkEveryMs: 0 });
    expect(await source.get()).toBe(await source.get());
  });
});

describe('postedOnLookup', () => {
  it('maps an event id to its Taipei date', () => {
    const state = parseTimeline(
      'timeline.json',
      JSON.stringify({
        generatedAt: '2025-11-05T00:00:00Z',
        events: [
          {
            id: 'e1',
            source: 'slack',
            at: '2025-11-02T00:30:00+08:00',
            author: 'Alice',
          },
        ],
      }),
    );
    const lookup = postedOnLookup(state);
    expect(lookup('e1')).toBe('2025-11-02');
    expect(lookup('missing')).toBeUndefined();
    expect(postedOnLookup({ status: 'missing', path: undefined })('e1')).toBe(
      undefined,
    );
  });
});
```

If `parsePeople` rejects people without `emails`, check `fileSchema` in `people-store.ts`: `emails` has `.default([])`, so the objects above are valid.

- [ ] **Step 6: Run them and watch them fail**

Run: `pnpm nx test personal-memories -- src/lib/server/markers-store.test.ts`
Expected: FAIL, because `./markers-store.ts` does not exist.

- [ ] **Step 7: Write `src/lib/server/markers-store.ts`**

```ts
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
```

Add `export * from './markers-store.ts';` to `src/lib/server/index.ts`, between `./embed.ts` and `./note-vectors.ts`.

- [ ] **Step 8: Run the store tests, typecheck and lint**

Run: `pnpm nx test personal-memories -- src/lib/server/markers-store.test.ts src/lib/markers.test.ts`
Expected: PASS.
Run: `pnpm nx typecheck personal-memories && pnpm nx lint personal-memories`
Expected: both succeed. A `no-cycle` error means an import went through a barrel; import the file directly, as above.

- [ ] **Step 9: Commit**

```bash
git add apps/personal-memories/src/lib/markers.ts apps/personal-memories/src/lib/markers.test.ts apps/personal-memories/src/lib/server/markers-store.ts apps/personal-memories/src/lib/server/markers-store.test.ts apps/personal-memories/src/lib/index.ts apps/personal-memories/src/lib/server/index.ts
git commit -m "feat(personal-memories): load leave and WFH markers from markers.json

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Marker days in the day index, and the day row

**Files:**

- Modify: `apps/personal-memories/src/lib/days.ts`, `src/lib/days.test.ts`, `src/live.config.ts`, `src/pages/day/[date].astro`, `src/pages/week/[isoWeek].astro`, `src/pages/days.json.ts`, `src/components/DaySection.astro`, `src/lib/server/index.ts`
- Create: `apps/personal-memories/src/lib/server/day-index.ts`, `src/components/marker-classes.ts`, `src/components/day/DayMarkers.astro`

**Interfaces:**

- Consumes: from Task 1, `getMarkers`, `postedOnLookup`, `markerViewsByDate`, `MarkerView`, `KIND_LABEL`, `PART_LABEL`, `MarkerKind`.
- Produces:
  - `indexDays(events: readonly TimelineEvent[], extraDates?: readonly string[]): DayIndex`. Each extra date maps to `[]` unless it already has events.
  - `getDayIndex(): Promise<DayIndex | undefined>` and `getMarkerViews(): Promise<Map<string, MarkerView[]>>` from `@/lib/server`.
  - `KIND_BG: Record<MarkerKind, string>` and `KIND_BADGE: Record<MarkerKind, 'info' | 'warning'>` from `@/components/marker-classes.ts`.

- [ ] **Step 1: Write the failing index test**

Append inside `describe('days', …)` in `src/lib/days.test.ts`:

```ts
it('adds extra dates as days without events, and caches per date list', () => {
  const extra = ['2025-10-30', '2025-11-03'];
  const withMarkers = indexDays(EVENTS, extra);
  expect(withMarkers.dates).toEqual(['2025-10-30', '2025-11-01', '2025-11-03']);
  expect(withMarkers.byDate.get('2025-10-30')).toEqual([]);
  expect(withMarkers.byDate.get('2025-11-03')?.map((e) => e.id)).toEqual(['c']);
  expect(indexDays(EVENTS, extra)).toBe(withMarkers);
  expect(indexDays(EVENTS)).toBe(index);
  expect(neighbours(withMarkers, '2025-11-01')).toEqual({
    prev: '2025-10-30',
    next: '2025-11-03',
  });
  expect(summarize(withMarkers)[0]).toMatchObject({
    date: '2025-10-30',
    total: 0,
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm nx test personal-memories -- src/lib/days.test.ts`
Expected: FAIL. `'2025-10-30'` is missing from `dates`.

- [ ] **Step 3: Extend `indexDays` in `src/lib/days.ts`**

Replace the `cache` constant and `indexDays` with:

```ts
const NO_DATES: readonly string[] = [];

const cache = new WeakMap<
  readonly TimelineEvent[],
  WeakMap<readonly string[], DayIndex>
>();

export function indexDays(
  events: readonly TimelineEvent[],
  extraDates: readonly string[] = NO_DATES,
): DayIndex {
  let byExtra = cache.get(events);
  const hit = byExtra?.get(extraDates);
  if (hit) return hit;
  const byDate = new Map<string, TimelineEvent[]>();
  const sorted = events
    .map((event, i) => ({ event, i, t: Date.parse(event.at) }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  for (const { event } of sorted) {
    const date = taipeiDate(event.at);
    const list = byDate.get(date);
    if (list) list.push(event);
    else byDate.set(date, [event]);
  }
  for (const date of extraDates) if (!byDate.has(date)) byDate.set(date, []);
  const index = { dates: [...byDate.keys()].sort(), byDate };
  if (!byExtra) cache.set(events, (byExtra = new WeakMap()));
  byExtra.set(extraDates, index);
  return index;
}
```

The cache stays effective because `getMarkers` returns the same `MarkerSet`, and so the same `dates` array, until `markers.json` or `people.json` changes.

- [ ] **Step 4: Run the index tests**

Run: `pnpm nx test personal-memories -- src/lib/days.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `src/lib/server/day-index.ts`**

```ts
import { type DayIndex, indexDays } from '@/lib/days.ts';
import { markerViewsByDate, type MarkerView } from '@/lib/markers.ts';

import { getMarkers, postedOnLookup } from './markers-store.ts';
import { getPeople } from './people-store.ts';
import { getTimeline } from './store.ts';

export async function getDayIndex(): Promise<DayIndex | undefined> {
  const [state, markers] = await Promise.all([getTimeline(), getMarkers()]);
  return state.status === 'ready'
    ? indexDays(state.timeline.events, markers.dates)
    : undefined;
}

export async function getMarkerViews(): Promise<Map<string, MarkerView[]>> {
  const [state, people, markers] = await Promise.all([
    getTimeline(),
    getPeople(),
    getMarkers(),
  ]);
  return markerViewsByDate(
    markers.byDate,
    people.people,
    people.owners,
    postedOnLookup(state),
  );
}
```

Add `export * from './day-index.ts';` to `src/lib/server/index.ts`, right after `./embed.ts`.

- [ ] **Step 6: Route every day-index consumer through `getDayIndex`**

`src/live.config.ts`: import `getDayIndex` instead of `getTimeline` from `@/lib/server`, drop `indexDays` from the `@/lib` import, and replace both loader bodies:

```ts
  async loadCollection() {
    const index = await getDayIndex();
    if (!index) return { entries: [] };
    return {
      entries: summarize(index).map((summary) => ({
        id: summary.date,
        data: { summary },
      })),
    };
  },
  async loadEntry({ filter }) {
    if (!DATE_RE.test(filter.date)) return undefined;
    const index = await getDayIndex();
    const events = index?.byDate.get(filter.date);
    if (!index || !events) return undefined;
    const [summary] = summarize({ dates: [filter.date], byDate: index.byDate });
    return {
      id: filter.date,
      data: { summary, events, ...neighbours(index, filter.date) },
    };
  },
```

`src/pages/day/[date].astro`: add `getDayIndex` to the `@/lib/server` import, drop `indexDays` from `@/lib`, and replace the `dates` and `months` constants with:

```ts
const index = await getDayIndex();
const dates = index?.dates ?? [];
```

```ts
const months = index ? scrubberMonths(summarize(index)) : [];
```

`src/pages/week/[isoWeek].astro`:

```astro
---
import { dayForWeek } from '@/lib';
import { getDayIndex } from '@/lib/server';

const { isoWeek = '' } = Astro.params;
const index = await getDayIndex();
const day = index ? dayForWeek(index, isoWeek) : undefined;
if (day) return Astro.redirect(`/day/${day}`, 301);
return new Response('Not found', { status: 404 });
---
```

`src/pages/days.json.ts`:

```ts
import type { APIRoute } from 'astro';

import { summarize } from '@/lib';
import { getDayIndex } from '@/lib/server';

export const GET: APIRoute = async () => {
  const index = await getDayIndex();
  const days = index
    ? summarize(index).map(({ date, total }) => ({ date, total }))
    : [];
  return Response.json(days, {
    headers: { 'Cache-Control': 'private, no-cache' },
  });
};
```

`src/actions/index.ts` stays as it is: a marker-only day has no events to annotate either way.

- [ ] **Step 7: Add the token map `src/components/marker-classes.ts`**

```ts
import type { MarkerKind } from '@/lib';

export const KIND_BG: Record<MarkerKind, string> = {
  wfh: 'bg-info',
  leave: 'bg-warning',
};

export const KIND_BADGE: Record<MarkerKind, 'info' | 'warning'> = {
  wfh: 'info',
  leave: 'warning',
};
```

- [ ] **Step 8: Add `src/components/day/DayMarkers.astro`**

```astro
---
import { KIND_BG } from '@/components/marker-classes.ts';
import { KIND_LABEL, type MarkerView, PART_LABEL } from '@/lib';

type Props = { date: string; views: readonly MarkerView[] };

const { date, views } = Astro.props;

const sourceHref = (v: MarkerView) =>
  v.postedOn === date ? `#ev-${v.event}` : `/day/${v.postedOn}#ev-${v.event}`;
---

{
  views.length > 0 && (
    <ul
      data-day-markers
      aria-label="出勤"
      class="text-meta flex flex-wrap gap-x-4 gap-y-1"
    >
      {views.map((v) => (
        <li
          data-marker-kind={v.kind}
          data-marker-part={v.part}
          class="flex items-center gap-1.5"
        >
          <span
            aria-hidden="true"
            class:list={['size-2 rounded-full', KIND_BG[v.kind]]}
          />
          <span>
            {v.name} {KIND_LABEL[v.kind]}（{PART_LABEL[v.part]}）
          </span>
          {v.postedOn && (
            <a
              href={sourceHref(v)}
              data-marker-source
              class="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              → 原訊息
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 9: Render the row in `src/components/DaySection.astro`**

Add `getMarkerViews` to the `@/lib/server` import and the component import:

```ts
import DayMarkers from '@/components/day/DayMarkers.astro';
```

After `const people = await getPeople();` add:

```ts
const markerViews = (await getMarkerViews()).get(date) ?? [];
```

In `<header>`, directly after the closing `</div>` of the `flex flex-wrap items-center gap-x-3 gap-y-1.5` block and before the `hours && firsts` block, add:

```astro
<DayMarkers date={date} views={markerViews} />
```

- [ ] **Step 10: Verify, then commit**

Run: `pnpm nx test personal-memories && pnpm nx typecheck personal-memories && pnpm nx lint personal-memories`
Expected: all pass.

Then run a real page against the e2e fixture plus a hand-made marker file:

```bash
D=$(mktemp -d) && node apps/personal-memories/src/cli/fixture.ts "$D/data" >/dev/null
node -e '
const fs=require("fs");const p=process.argv[1];
const t=JSON.parse(fs.readFileSync(p+"/timeline.json","utf8"));
const e=t.events.find(e=>e.source==="slack"&&e.text==="Thread reply");
fs.writeFileSync(p+"/markers.json",JSON.stringify({markers:[{date:"2025-11-04",person:"alice",kind:"leave",part:"full",event:e.id}]}));
' "$D/data"
MEMORIES_DATA_DIR="$D/data" pnpm nx dev personal-memories
```

Open `http://127.0.0.1:3004/day/2025-11-04`. Expected: the page is 200, shows 「Alice 請假（全天）→ 原訊息」 and 「0 則」, and the link goes to `/day/2025-11-02#ev-…`. Stop the server and run `rm -rf "$D"`.

```bash
git add apps/personal-memories/src
git commit -m "feat(personal-memories): open days that only have markers and list markers on the day

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Month badges and heatmap bars

**Files:**

- Modify: `apps/personal-memories/src/lib/month-view.ts`, `src/lib/month-view.test.ts`, `src/pages/index.astro`, `src/pages/month/[month].astro`, `src/components/Heatmap.astro`, `src/components/month/MonthCalendar.astro`, `src/components/month/MonthCellBody.astro`
- Create: `apps/personal-memories/src/components/HeatBars.astro`, `src/components/month/MonthBadges.astro`

**Interfaces:**

- Consumes: from Task 1, `MarkerView`, `markerBars`, `markerLabel`, `dayDetail`, `dominantKind`. From Task 2, `getDayIndex`, `getMarkerViews`, `KIND_BG`, `KIND_BADGE`.
- Produces:
  - `MonthCell.markers?: MarkerView[]`
  - `dayCell(date, events, noted, read, markers?)`
  - `monthView(index, month, noted, read, markers?)`
  - `dayCells(index, noted, read, markers?)`, where `markers` is `ReadonlyMap<string, readonly MarkerView[]>` and defaults to empty
  - `hasDay(cell: { total: number; markers?: readonly unknown[] }): boolean`

- [ ] **Step 1: Write the failing month-view test**

Append to `src/lib/month-view.test.ts`. Reuse the file's existing fixtures; read its top first, as it already builds an index and a `read` function. The test shape:

```ts
describe('markers on month cells', () => {
  const view = {
    person: 'alice',
    name: 'Alice',
    owner: false,
    kind: 'leave',
    part: 'full',
    event: 'e1',
  } as const;

  it('attaches markers and treats a marker-only day as a day', () => {
    const index = indexDays([], ['2025-11-04']);
    const markers = new Map([['2025-11-04', [view]]]);
    const cells = dayCells(index, new Set(), () => undefined, markers);
    const cell = cells.get('2025-11-04');
    expect(cell?.total).toBe(0);
    expect(cell?.markers).toEqual([view]);
    expect(cell && hasDay(cell)).toBe(true);
    expect(hasDay({ total: 0 })).toBe(false);
    expect(hasDay({ total: 2 })).toBe(true);
    const month = monthView(
      index,
      '2025-11',
      new Set(),
      () => undefined,
      markers,
    );
    const found = month?.weeks.flat().find((c) => c?.date === '2025-11-04');
    expect(found?.markers).toEqual([view]);
  });
});
```

Import `indexDays` from `./days.ts` and `hasDay` from `./month-view.ts` if the file does not import them yet.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm nx test personal-memories -- src/lib/month-view.test.ts`
Expected: FAIL. `hasDay` is not exported.

- [ ] **Step 3: Extend `src/lib/month-view.ts`**

Add the import `import type { MarkerView } from './markers.ts';`. Add `markers?: MarkerView[];` to `MonthCell`. Then:

```ts
type MarkerMap = ReadonlyMap<string, readonly MarkerView[]>;

const NO_MARKERS: MarkerMap = new Map();

export const hasDay = (cell: { total: number; markers?: readonly unknown[] }) =>
  cell.total > 0 || (cell.markers?.length ?? 0) > 0;
```

Give `dayCell` a fifth parameter `markers: readonly MarkerView[] = []`, and before `return cell;` add:

```ts
if (markers.length > 0) cell.markers = [...markers];
```

In `monthView`, add a fifth parameter `markers: MarkerMap = NO_MARKERS` and pass `markers.get(date)` to `dayCell`. In `dayCells`, do the same: a fourth parameter `markers: MarkerMap = NO_MARKERS`, and `dayCell(date, index.byDate.get(date) ?? [], noted.has(date), read, markers.get(date))`.

- [ ] **Step 4: Run the month-view tests**

Run: `pnpm nx test personal-memories -- src/lib/month-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Feed markers into the pages**

`src/pages/index.astro`: import `getDayIndex, getMarkerViews` alongside `getTimeline, notesStore`; drop `indexDays` from the `@/lib` import. Replace the `index` and `previews` constants with:

```ts
const [index, markers] = await Promise.all([getDayIndex(), getMarkerViews()]);
const previews = index
  ? dayCells(index, noted, (d) => store?.read(d), markers)
  : new Map();
```

Pass `markers={markers}` to `<Heatmap>`.

`src/pages/month/[month].astro`: same imports. Replace the `index` and `view` constants with:

```ts
const [index, markers] = await Promise.all([getDayIndex(), getMarkerViews()]);
const store = notesStore();
const view = index
  ? monthView(
      index,
      month,
      store?.dates() ?? new Set(),
      (d) => store?.read(d),
      markers,
    )
  : undefined;
```

Remove the now-duplicate `const store = notesStore();` line.

- [ ] **Step 6: Add `src/components/HeatBars.astro`**

```astro
---
import { KIND_BG } from '@/components/marker-classes.ts';
import { markerBars, type MarkerPart, type MarkerView } from '@/lib';

type Props = { views: readonly MarkerView[] };

const bars = markerBars(Astro.props.views);

const SPAN: Record<MarkerPart, string> = {
  full: 'inset-x-0',
  am: 'left-0 w-1/2',
  pm: 'right-0 w-1/2',
};
---

{
  bars.length > 0 && (
    <span
      aria-hidden="true"
      data-marker-bars
      class="absolute inset-x-0.5 bottom-0.5 flex flex-col gap-px"
    >
      {bars.map((bar) => (
        <span data-marker-bar={bar.person} class="relative h-[3px]">
          {bar.segments.map((s) => (
            <span
              data-kind={s.kind}
              data-part={s.part}
              class:list={[
                'absolute inset-y-0 rounded-[1px]',
                SPAN[s.part],
                KIND_BG[s.kind],
              ]}
            />
          ))}
        </span>
      ))}
    </span>
  )
}
```

- [ ] **Step 7: Update `src/components/Heatmap.astro`**

1. Props: add `markers: Map<string, MarkerView[]>;` and destructure `markers`. Add `dayDetail`, `dominantKind` and `type MarkerView` to the `@/lib` import. Add `import HeatBars from './HeatBars.astro';` and `import { KIND_BG } from './marker-classes.ts';`.
2. Add `const viewsOf = (date: string) => markers.get(date) ?? [];`.
3. `stop`: change the filter to `cell !== null && (cell.total > 0 || markers.has(cell.date))`.
4. `tooltip`: give it a `views: readonly MarkerView[]` parameter and set `detail: dayDetail(total, isNoted, views)`.
5. Desktop cell: compute `const views = viewsOf(cell.date);` and pass `views` to `tooltip`. Change the link condition from `cell.total > 0 ?` to `cell.total > 0 || views.length > 0 ?`. Inside both the `<a>` and the `<span>` branches, add `<HeatBars views={views} />` after `{dot}`.
6. Phone bars: in the `row.cells.map((cell) => { … })` callback, after `const lvl = level(cell.total);`, add `const kind = dominantKind(viewsOf(cell.date));`. Then replace the returned bar `<span …>` with:

```astro
<span class="flex flex-col items-center gap-px">
  <span
    class={`flex h-4 w-2 items-end justify-center rounded-[2px] pb-px ${LEVEL[lvl]}`}
  >
    {isNoted && <span class={`size-1 rounded-full ${dotClass(lvl)}`} />}
  </span>
  <span
    data-marker-dot={kind}
    class:list={['size-1 rounded-full', kind && KIND_BG[kind]]}></span>
</span>
```

Keep the empty-cell placeholder `<span class="h-4 w-2" />` as it is. 7. Phone `hasEvents`: change it to `row.cells.some((c) => c !== null && (c.total > 0 || markers.has(c.date)))`.

- [ ] **Step 8: Add `src/components/month/MonthBadges.astro`**

```astro
---
import { badgeVariants } from '@rainforest-dev/rainforest-react';

import { KIND_BADGE } from '@/components/marker-classes.ts';
import { initialOf, markerLabel, type MarkerView } from '@/lib';

type Props = { views: readonly MarkerView[] };

const { views } = Astro.props;
---

{
  views.map((v) => (
    <span
      data-marker-badge={v.kind}
      title={`${v.name} ${markerLabel(v)}`}
      class={badgeVariants({ variant: KIND_BADGE[v.kind] })}
    >
      {initialOf(v.name)} {markerLabel(v)}
    </span>
  ))
}
```

- [ ] **Step 9: Update `MonthCalendar.astro` and `MonthCellBody.astro`**

`MonthCalendar.astro`: add `dayDetail` and `hasDay` to the `@/lib` import. Set `const detail = (c: MonthCell) => dayDetail(c.total, c.noted, c.markers);`. Replace each of the three `cell.total > 0` / `c.total > 0` checks (`stop`, the grid branch and the list branch) with `hasDay(cell)` / `hasDay(c)`.

`MonthCellBody.astro`: add `import MonthBadges from './MonthBadges.astro';` and `const markers = cell.markers ?? [];`. Directly after the header `<span class:list={['text-meta flex items-center …']}>…</span>` block, insert:

```astro
{
  !row && markers.length > 0 && (
    <span
      class:list={[
        'relative mx-1.5 flex w-fit flex-wrap gap-1 rounded-md',
        cell.cover && 'bg-background/90 p-0.5',
      ]}
    >
      <MonthBadges views={markers} />
    </span>
  )
}
```

Replace the final `showText && (…)` block and the trailing `row && (<span class={badgeVariants…}>)` block with:

```astro
{
  !row &&
    showText &&
    (cell.memory ? (
      <span class="text-meta line-clamp-3 px-2.5 pb-2.5">{cell.memory}</span>
    ) : cell.excerpt ? (
      <span class="text-meta text-muted-foreground line-clamp-3 px-2.5 pb-2.5">
        「{cell.excerpt}」
      </span>
    ) : null)
}
{
  row && (
    <span class="flex min-w-0 flex-col gap-1">
      {markers.length > 0 && (
        <span class="flex flex-wrap gap-1">
          <MonthBadges views={markers} />
        </span>
      )}
      {cell.memory ? (
        <span class="text-meta line-clamp-3">{cell.memory}</span>
      ) : cell.excerpt ? (
        <span class="text-meta text-muted-foreground line-clamp-3">
          「{cell.excerpt}」
        </span>
      ) : null}
    </span>
  )
}
{
  row && (
    <span class={badgeVariants({ variant: 'muted' })}>{cell.total} 則</span>
  )
}
```

The row layout keeps its four grid columns: day, thumbnail, text, count.

- [ ] **Step 10: Verify, then commit**

Run: `pnpm nx test personal-memories && pnpm nx typecheck personal-memories && pnpm nx lint personal-memories`
Expected: all pass.

Repeat the dev-server check from Task 2 Step 10 with this marker file:

```json
{
  "markers": [
    {
      "date": "2025-11-03",
      "person": "alice",
      "kind": "leave",
      "part": "am",
      "event": "<Thread reply id>"
    },
    {
      "date": "2025-11-03",
      "person": "alice",
      "kind": "wfh",
      "part": "pm",
      "event": "<Thread reply id>"
    },
    {
      "date": "2025-11-04",
      "person": "alice",
      "kind": "leave",
      "part": "full",
      "event": "<Thread reply id>"
    }
  ]
}
```

Expected:

- On `/`, the 11-03 cell has a bar that is warning-coloured on its left half and info-coloured on its right half. The 11-04 cell is a link with a full-width warning bar.
- Hovering 11-03 shows 「Alice 請假・上午、WFH・下午」.
- `/month/2025-11` shows two badges on 11-03, and 11-04 is a link.
- At 390 px width, the phone bars show the dots.
- Switching the OS to dark mode keeps both colours legible.

```bash
git add apps/personal-memories/src
git commit -m "feat(personal-memories): show leave and WFH on the month and year views

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: MCP markers and the fixture

**Files:**

- Modify: `apps/personal-memories/src/lib/server/mcp/tools.ts`, `handler.ts`, `testing.ts`, `tools.test.ts`, `src/cli/fixture.ts`

**Interfaces:**

- Consumes: from Task 1, `MarkerSet`, `getMarkers`, `loadMarkers`, `postedOnLookup`, `DayMarker`.
- Produces:
  - `McpDeps.markers: () => Promise<MarkerSet>`
  - `get_day` output `markers?: { person, personId, kind, part, eventId, postedOn? }[]`
  - Tool `list_markers({ from?, to?, person?, kind? })` → `{ markers: { date, person, personId, kind, part, eventId, postedOn? }[] }`
  - `writeMarkerFixture(root: string, timeline: Timeline): void`, exported from `src/cli/fixture.ts`. The fixture markers are: Bob `wfh` `full` on 2025-11-01 from his 11-01 message 「Morning @Alice」; Alice `leave` `am` and `wfh` `pm` on 2025-11-03, and `leave` `full` on 2025-11-04, all three from her 11-02 「Thread reply」.

- [ ] **Step 1: Write the fixture markers**

In `src/cli/fixture.ts`, add `import type { Timeline } from '../lib/server/timeline.ts';` and:

```ts
const slackEvent = (timeline: Timeline, author: string, text: string) => {
  const event = timeline.events.find(
    (e) => e.source === 'slack' && e.author === author && e.text === text,
  );
  if (!event)
    throw new Error(`fixture has no Slack message "${text}" by ${author}`);
  return event.id;
};

export function writeMarkerFixture(root: string, timeline: Timeline) {
  const morning = slackEvent(timeline, 'Bob', 'Morning @Alice');
  const reply = slackEvent(timeline, 'Alice', 'Thread reply');
  const markers = [
    {
      date: '2025-11-01',
      person: 'bob',
      kind: 'wfh',
      part: 'full',
      event: morning,
    },
    {
      date: '2025-11-03',
      person: 'alice',
      kind: 'leave',
      part: 'am',
      event: reply,
    },
    {
      date: '2025-11-03',
      person: 'alice',
      kind: 'wfh',
      part: 'pm',
      event: reply,
    },
    {
      date: '2025-11-04',
      person: 'alice',
      kind: 'leave',
      part: 'full',
      event: reply,
    },
  ];
  writeFileSync(
    join(root, 'markers.json'),
    JSON.stringify({ markers }, null, 2),
  );
}
```

Change the end of `writeFixtureDataDir` to:

```ts
const timeline = ingest(root, () => undefined);
writeMarkerFixture(root, timeline);
return timeline;
```

- [ ] **Step 2: Wire the dependency**

`handler.ts`: `import { getMarkers } from '@/lib/server/markers-store.ts';` and add `markers: getMarkers,` to `liveDeps`.

`testing.ts`: `import { loadMarkers } from '@/lib/server/markers-store.ts';`. After `const people = loadPeople(data);` add `const markers = loadMarkers(data, people);`, and add `markers: async () => markers,` to the returned `deps`.

`tools.ts`: add `markers: () => Promise<MarkerSet>;` to `McpDeps`, with the imports:

```ts
import type { DayMarker } from '@/lib/markers.ts';
import { type MarkerSet, postedOnLookup } from '@/lib/server/markers-store.ts';
```

- [ ] **Step 3: Write the failing MCP tests**

In `tools.test.ts`, change the tools/list test to expect five names, with `'list_markers'` appended after `'get_coverage'`, and retitle it `'lists the five tools, all read-only and closed-world'`. Then add:

```ts
describe('markers', () => {
  it('get_day returns the markers of a day with events', async () => {
    const out = await ok('get_day', { date: '2025-11-03' });
    expect(out['markers']).toEqual([
      {
        person: 'Alice',
        personId: 'alice',
        kind: 'leave',
        part: 'am',
        eventId: expect.any(String),
        postedOn: '2025-11-02',
      },
      expect.objectContaining({ kind: 'wfh', part: 'pm' }),
    ]);
  });

  it('get_day opens a day that only has markers', async () => {
    const out = await ok('get_day', { date: '2025-11-04' });
    expect(out).toMatchObject({
      date: '2025-11-04',
      prev: '2025-11-03',
      counts: { line: 0, slack: 0, photo: 0 },
      events: [],
      markers: [expect.objectContaining({ kind: 'leave', part: 'full' })],
    });
  });

  it('get_day ignores the source filter for markers', async () => {
    const out = await ok('get_day', { date: '2025-11-01', sources: ['photo'] });
    expect(out['markers']).toEqual([
      expect.objectContaining({
        person: 'Bob',
        kind: 'wfh',
        postedOn: '2025-11-01',
      }),
    ]);
  });

  it('list_markers filters by range, person and kind', async () => {
    const all = await ok('list_markers');
    expect((all['markers'] as unknown[]).length).toBe(4);
    const leave = await ok('list_markers', {
      person: 'alice',
      kind: 'leave',
      from: '2025-11-04',
    });
    expect(leave['markers']).toEqual([
      expect.objectContaining({ date: '2025-11-04', part: 'full' }),
    ]);
  });

  it('list_markers rejects an unknown person and a reversed range', async () => {
    expect(await errorText('list_markers', { person: 'carol' })).toMatch(
      /list_people/,
    );
    expect(
      await errorText('list_markers', { from: '2025-11-04', to: '2025-11-01' }),
    ).toMatch(/after/);
  });

  it('list_markers leaves postedOn out when the source message is gone', async () => {
    const lost = handlerFor({
      ...fixture.deps,
      markers: async () => ({
        markers: [
          {
            date: '2025-11-05',
            person: 'bob',
            kind: 'wfh',
            part: 'am',
            event: 'gone',
          },
        ],
        byDate: new Map(),
        dates: [],
      }),
    });
    const other = await connect(lost);
    const result = await other.callTool({
      name: 'list_markers',
      arguments: {},
    });
    await other.close();
    const [marker] = (result.structuredContent as { markers: object[] })
      .markers;
    expect(marker).not.toHaveProperty('postedOn');
  });
});
```

`ok` and `errorText` are the helpers already defined in this file; reuse them.

- [ ] **Step 4: Run them and watch them fail**

Run: `pnpm nx test personal-memories -- src/lib/server/mcp/tools.test.ts`
Expected: FAIL. `list_markers` is missing, and `get_day` has no `markers`.

- [ ] **Step 5: Implement in `tools.ts`**

Near the `timelineSource` constant add:

```ts
const markerKind = z.enum(['wfh', 'leave']);

const markerOutput = {
  person: z.string(),
  personId: z.string(),
  kind: markerKind,
  part: z.enum(['full', 'am', 'pm']),
  eventId: z.string(),
  postedOn: z.string().optional(),
};

function markerView(
  marker: DayMarker,
  people: readonly Person[],
  postedOn: (eventId: string) => string | undefined,
) {
  const posted = postedOn(marker.event);
  return {
    person: people.find((p) => p.id === marker.person)?.name ?? marker.person,
    personId: marker.person,
    kind: marker.kind,
    part: marker.part,
    eventId: marker.event,
    ...(posted ? { postedOn: posted } : {}),
  };
}
```

`get_day`:

- Description: append `'Also returns the leave and WFH markers that apply to the day, whatever sources says. '` before the url sentence.
- Output: add `markers: z.array(z.object(markerOutput)).optional(),`.
- `run`: replace the first two lines with:

```ts
const timeline = await readyTimeline(deps);
const [state, markers] = await Promise.all([deps.timeline(), deps.markers()]);
const index = indexDays(timeline.events, markers.dates);
```

After `const page = …` add:

```ts
const postedOn = postedOnLookup(state);
const dayMarkers = (markers.byDate.get(day) ?? []).map((m) =>
  markerView(m, people, postedOn),
);
```

In the returned object, add `...(dayMarkers.length ? { markers: dayMarkers } : {}),` after `events`.

New tool, before `memoriesTools`:

```ts
const listMarkers = (deps: McpDeps) =>
  defineTool({
    name: 'list_markers',
    title: 'List leave and WFH days',
    description:
      'Lists attendance markers: the days a person was on leave or worked from home, read from their work-chat messages. ' +
      'date is the day a marker applies to; postedOn is the day its source message was posted, when that message is in the album. ' +
      'from and to (YYYY-MM-DD) narrow the dates; person takes an id from list_people; kind is leave or wfh.',
    input: {
      from: date().optional(),
      to: date().optional(),
      person: z.string().optional(),
      kind: markerKind.optional(),
    },
    output: {
      markers: z.array(z.object({ date: z.string(), ...markerOutput })),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async ({ from, to, person, kind }) => {
      checkRange(from, to);
      const [state, people, markers] = await Promise.all([
        deps.timeline(),
        deps.people(),
        deps.markers(),
      ]);
      if (person !== undefined && !people.people.some((p) => p.id === person))
        throw new ToolInputError(
          `Unknown person id ${person}; list_people names the ids.`,
        );
      const postedOn = postedOnLookup(state);
      return {
        markers: markers.markers
          .filter(
            (m) =>
              (!from || m.date >= from) &&
              (!to || m.date <= to) &&
              (!person || m.person === person) &&
              (!kind || m.kind === kind),
          )
          .map((m) => ({
            date: m.date,
            ...markerView(m, people.people, postedOn),
          })),
      };
    },
  });
```

Append `listMarkers(deps),` to `memoriesTools`. `get_coverage` keeps `indexDays(timeline.events)` with no marker dates.

- [ ] **Step 6: Run the whole unit suite**

Run: `pnpm nx test personal-memories && pnpm nx typecheck personal-memories && pnpm nx lint personal-memories`
Expected: PASS. If an older test broke only because `markers.json` now sits in the fixture data directory, or because 2025-11-04 is now a day, fix the expectation and record why in the commit body. Any other failure is a bug: investigate it.

- [ ] **Step 7: Commit**

```bash
git add apps/personal-memories/src
git commit -m "feat(personal-memories): expose leave and WFH markers through the MCP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end

**Files:**

- Create: `apps/personal-memories-e2e/src/markers.spec.ts`
- Modify: `apps/personal-memories-e2e/src/timeline.spec.ts`, `ai-parse.spec.ts`, `mcp.spec.ts`; snapshot files of visual specs that legitimately change

**Interfaces:**

- Consumes: the fixture markers from Task 4, and the `data-*` hooks from Tasks 2 and 3 (`data-day-markers`, `data-marker-kind`, `data-marker-part`, `data-marker-source`, `data-marker-bars`, `data-marker-bar`, `data-kind`, `data-part`, `data-marker-badge`).

- [ ] **Step 1: Read the testing guidance**

Read `playwright-best-practices` if it is installed (`ls ~/.claude/skills ~/.agents/skills 2>/dev/null`). Then read `timeline.spec.ts` lines 1–60 and `navigation.spec.ts` lines 1–40 to reuse their helpers (`waitForAppBarReady`, `visibleCell`, `stops`).

- [ ] **Step 2: Write `src/markers.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('the year heatmap draws leave and WFH bars and opens a marker-only day', async ({
  page,
}) => {
  await page.goto('/');
  const split = page.locator(
    'a[data-date="2025-11-03"] [data-marker-bar="alice"]',
  );
  await expect(
    split.locator('[data-kind="leave"][data-part="am"]'),
  ).toHaveCount(1);
  await expect(split.locator('[data-kind="wfh"][data-part="pm"]')).toHaveCount(
    1,
  );
  await expect(page.locator('a[data-date="2025-11-03"]')).toHaveAttribute(
    'aria-label',
    /Alice 請假・上午、WFH・下午/,
  );
  const owner = page.locator('a[data-date="2025-11-01"] [data-marker-bar]');
  await expect(owner.first()).toHaveAttribute('data-marker-bar', 'bob');
  const leaveOnly = page.locator('a[data-date="2025-11-04"]');
  await expect(leaveOnly).toHaveAttribute('href', '/day/2025-11-04');
  await expect(
    leaveOnly.locator('[data-kind="leave"][data-part="full"]'),
  ).toHaveCount(1);
});

test('the month calendar badges marker days and links a marker-only day', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  const cell = page.locator('a[data-date="2025-11-03"]:visible');
  await expect(cell.locator('[data-marker-badge]')).toHaveText([
    /A 請假・上午/,
    /A WFH・下午/,
  ]);
  await expect(page.locator('a[data-date="2025-11-04"]:visible')).toHaveCount(
    1,
  );
});

test('a marker-only day lists its marker and links back to the message', async ({
  page,
}) => {
  const response = await page.goto('/day/2025-11-04');
  expect(response?.status()).toBe(200);
  const row = page.locator('#day-2025-11-04 [data-day-markers] li');
  await expect(row).toHaveText(/Alice 請假（全天）/);
  const link = row.locator('[data-marker-source]');
  await expect(link).toHaveAttribute('href', /^\/day\/2025-11-02#ev-/);
  await link.click();
  await expect(page).toHaveURL(/\/day\/2025-11-02#ev-/);
  const id = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
});

test('a marker posted on its own day links within the page', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const link = page.locator(
    '#day-2025-11-01 [data-day-markers] [data-marker-source]',
  );
  await expect(link).toHaveAttribute('href', /^#ev-/);
});

test('markers stay when the source filter hides Slack', async ({ page }) => {
  await page.goto('/day/2025-11-03');
  await page.getByRole('button', { name: 'Slack' }).click();
  await expect(
    page.locator('#day-2025-11-03 [data-day-markers] li'),
  ).toHaveCount(2);
});

test('the stream partial serves a marker-only day', async ({ request }) => {
  const response = await request.get('/day/2025-11-04/partial');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('data-day-markers');
});
```

For the Slack toggle, check how `timeline.spec.ts` operates `SourceFilter` (it is a toggle group item named 「Slack」) and use the same locator.

- [ ] **Step 3: Run the new spec**

Run: `pnpm nx e2e personal-memories-e2e -- markers.spec.ts`
Expected: PASS. A failure here is a bug in Tasks 2–4: fix the code, not the test.

- [ ] **Step 4: Run the whole suite and update only the expected changes**

Run: `pnpm nx e2e personal-memories-e2e`

These assertions change because 2025-11-04 is now a day; update them:

- `timeline.spec.ts` 「home is a heatmap of the fixture days」: `toHaveCount(4)` becomes `5`.
- `ai-parse.spec.ts` lines 114–122: the nearest day to 2025-11-20 becomes `2025-11-04` (text 「按 Enter 跳到最近的 2025-11-04」, alert 「…最近的 2025-11-04」, URL `/day/2025-11-04`).
- `mcp.spec.ts`: the tool count becomes 5, and the sorted name list gains `'list_markers'`.
- Visual baselines of the 11-03 day, the 2025-11 month and the year heatmap (`nav-visual.spec.ts`, `v2c-visual.spec.ts`). Open the diff images in `test-output`, confirm the only change is the new badges, bars or row, then run `pnpm nx e2e personal-memories-e2e -- <spec> --update-snapshots` for those specs only.

Any other failure is a regression. Investigate it instead of updating it.

- [ ] **Step 5: Final checks and commit**

Run: `pnpm nx affected -t lint test typecheck` and `pnpm format:check`
Expected: all green.

Run the comment check from Global Constraints over the whole branch: `git diff -U0 main... | grep -E '^\+\s*(//|/\*|\*|#)'`.

```bash
git add apps/personal-memories-e2e apps/personal-memories/src
git commit -m "test(personal-memories-e2e): cover leave and WFH markers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the PR (private data, outside the repository)

These steps do not belong to the implementation tasks. They are listed so the executor stops here.

1. Convert the spreadsheet into `$MEMORIES_DATA_DIR/slack/where-are-you/<date>.json` with a throwaway script kept outside the repository. Map senders to the existing ids in `slack/users.json`, and drop join messages and other people's replies. Run `ingest`.
2. Read every message, write `markers.json` with the `people.json` ids, and list each ambiguous reading for the owner.
3. After the owner confirms, put the file in place. It loads without a restart.
