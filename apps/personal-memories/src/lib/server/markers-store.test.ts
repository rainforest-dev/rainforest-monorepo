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

const touch = (path: string) =>
  utimesSync(path, new Date(), new Date(Date.now() + 5000));

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
    touch(path);
    expect((await source.get()).markers).toHaveLength(2);
  });

  it('keeps the previous copy when the file turns invalid', async () => {
    const { path } = tempFile({ markers: [m()] });
    const log = vi.fn();
    const source = markerSource(path, people, { checkEveryMs: 0, log });
    await source.get();
    writeFileSync(path, '{ not json');
    touch(path);
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

  it('ignores the whole file, logged once, when a person is unknown', async () => {
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

  it('serves no markers, without touching people, when there is no file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'memories-markers-'));
    const people = vi.fn(async () => {
      throw new Error('people.json is unreadable');
    });
    const source = markerSource(join(dir, 'markers.json'), people, {
      checkEveryMs: 0,
    });
    expect(await source.get()).toBe(NO_MARKERS);
    expect(people).not.toHaveBeenCalled();
  });

  it('serves no markers, logged once, when people.json cannot be read', async () => {
    const { path } = tempFile({ markers: [m()] });
    const log = vi.fn();
    const source = markerSource(
      path,
      async () => {
        throw new Error('people.json is unreadable');
      },
      { checkEveryMs: 0, log },
    );
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
    expect(
      postedOnLookup({ status: 'missing', path: undefined })('e1'),
    ).toBeUndefined();
  });
});
