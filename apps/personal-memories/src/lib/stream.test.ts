import { describe, expect, it } from 'vitest';

import { groupRuns, hourCounts, ownersFromEnv, thumbSrcset } from './stream.ts';
import type { TimelineEvent } from './timeline.ts';

const ev = (
  id: string,
  author: string,
  source: TimelineEvent['source'] = 'line',
  at = '2025-11-01T09:00:00+08:00',
): TimelineEvent => ({ id, source, at, author });

const OWNERS = new Set(['Bob']);

const shape = (events: TimelineEvent[]) =>
  groupRuns(events, OWNERS).map((run) => run.events.map((e) => e.id).join(','));

describe('groupRuns', () => {
  it('keeps consecutive messages from one author and source in one run', () => {
    expect(
      shape([ev('a', 'Alice'), ev('b', 'Alice'), ev('c', 'Alice')]),
    ).toEqual(['a,b,c']);
  });

  it('splits a run when the author changes', () => {
    expect(shape([ev('a', 'Alice'), ev('b', 'Bob'), ev('c', 'Alice')])).toEqual(
      ['a', 'b', 'c'],
    );
  });

  it('splits a run when the source changes', () => {
    expect(shape([ev('a', 'Alice'), ev('b', 'Alice', 'slack')])).toEqual([
      'a',
      'b',
    ]);
  });

  it('gives a photo between messages its own run', () => {
    const runs = groupRuns(
      [ev('a', 'Alice'), ev('p', 'photo', 'photo'), ev('b', 'Alice')],
      OWNERS,
    );
    expect(runs.map((r) => r.kind)).toEqual(['text', 'photos', 'text']);
    expect(runs.map((r) => r.events.map((e) => e.id))).toEqual([
      ['a'],
      ['p'],
      ['b'],
    ]);
  });

  it('collects consecutive photos into one run', () => {
    const runs = groupRuns(
      [
        ev('p1', 'photo', 'photo'),
        ev('p2', 'photo', 'photo'),
        ev('p3', 'photo', 'photo'),
      ],
      OWNERS,
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]?.kind).toBe('photos');
    expect(runs[0]?.events.map((e) => e.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('shows the time on the first event of a run only', () => {
    const runs = groupRuns(
      [ev('a', 'Alice'), ev('b', 'Alice'), ev('c', 'Bob'), ev('d', 'Bob')],
      OWNERS,
    );
    expect(runs.flatMap((r) => r.events.map((e) => e.showTime))).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('marks runs by an owner and carries author and source', () => {
    const runs = groupRuns([ev('a', 'Alice'), ev('b', 'Bob', 'slack')], OWNERS);
    expect(runs).toMatchObject([
      { kind: 'text', author: 'Alice', source: 'line', isOwner: false },
      { kind: 'text', author: 'Bob', source: 'slack', isOwner: true },
    ]);
  });
});

describe('ownersFromEnv', () => {
  it('splits comma-separated names and trims them', () => {
    expect(ownersFromEnv({ MEMORIES_OWNER: ' Bob , 我,, ' })).toEqual(
      new Set(['Bob', '我']),
    );
  });

  it('is empty when unset', () => {
    expect(ownersFromEnv({}).size).toBe(0);
  });
});

describe('hourCounts', () => {
  it('buckets events by Taipei hour', () => {
    const counts = hourCounts([
      ev('a', 'A', 'line', '2025-11-01T00:05:00+08:00'),
      ev('b', 'A', 'line', '2025-11-01T09:59:00+08:00'),
      ev('c', 'A', 'line', '2025-11-01T01:10:00Z'),
    ]);
    expect(counts).toHaveLength(24);
    expect(counts[0]).toBe(1);
    expect(counts[9]).toBe(2);
  });
});

describe('thumbSrcset', () => {
  it('offers every width for a large or unknown source', () => {
    expect(thumbSrcset('a b', 1)).toBe(
      '/thumb/a%20b?n=1&w=240 240w, /thumb/a%20b?n=1&w=480 480w, /thumb/a%20b?n=1&w=960 960w',
    );
  });

  it('describes a small source by its real width, since thumbs never upscale', () => {
    expect(thumbSrcset('a', 0, 300)).toBe(
      '/thumb/a?n=0&w=240 240w, /thumb/a?n=0&w=480 300w',
    );
    expect(thumbSrcset('a', 0, 1)).toBe('/thumb/a?n=0&w=240 1w');
  });
});
