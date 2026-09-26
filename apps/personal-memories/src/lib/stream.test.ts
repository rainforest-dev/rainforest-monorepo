import { describe, expect, it } from 'vitest';

import {
  authorAccents,
  firstEventPerHour,
  groupRuns,
  hourCounts,
  initialOf,
  ownersFromEnv,
  rowLabel,
  thumbSrcset,
} from './stream.ts';
import type { TimelineEvent } from './timeline.ts';

const ev = (
  id: string,
  author: string,
  source: TimelineEvent['source'] = 'line',
  at = '2025-11-01T09:00:00+08:00',
): TimelineEvent => ({ id, source, at, author });

const shape = (events: TimelineEvent[]) =>
  groupRuns(events).map((run) => run.events.map((e) => e.id).join(','));

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
    const runs = groupRuns([
      ev('a', 'Alice'),
      ev('p', 'photo', 'photo'),
      ev('b', 'Alice'),
    ]);
    expect(runs.map((r) => r.kind)).toEqual(['text', 'photos', 'text']);
    expect(runs.map((r) => r.events.map((e) => e.id))).toEqual([
      ['a'],
      ['p'],
      ['b'],
    ]);
  });

  it('collects consecutive photos into one run', () => {
    const runs = groupRuns([
      ev('p1', 'photo', 'photo'),
      ev('p2', 'photo', 'photo'),
      ev('p3', 'photo', 'photo'),
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.kind).toBe('photos');
    expect(runs[0]?.events.map((e) => e.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('shows the time on the first event of a run only', () => {
    const runs = groupRuns([
      ev('a', 'Alice'),
      ev('b', 'Alice'),
      ev('c', 'Bob'),
      ev('d', 'Bob'),
    ]);
    expect(runs.flatMap((r) => r.events.map((e) => e.showTime))).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('carries author and source, and no owner flag', () => {
    const runs = groupRuns([ev('a', 'Alice'), ev('b', 'Bob', 'slack')]);
    expect(runs).toEqual([
      expect.objectContaining({
        kind: 'text',
        author: 'Alice',
        source: 'line',
      }),
      expect.objectContaining({ kind: 'text', author: 'Bob', source: 'slack' }),
    ]);
    expect(runs[0]).not.toHaveProperty('isOwner');
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

describe('firstEventPerHour', () => {
  it('maps each hour to its first event and leaves empty hours undefined', () => {
    const firsts = firstEventPerHour([
      ev('a', 'Alice', 'line', '2025-11-01T09:05:00+08:00'),
      ev('b', 'Bob', 'line', '2025-11-01T09:40:00+08:00'),
      ev('c', 'Alice', 'line', '2025-11-01T13:00:00+08:00'),
    ]);
    expect(firsts).toHaveLength(24);
    expect(firsts[9]).toBe('a');
    expect(firsts[13]).toBe('c');
    expect(firsts[10]).toBeUndefined();
  });

  it('buckets by the Taipei hour whatever offset the event carries', () => {
    expect(
      firstEventPerHour([ev('x', 'Bob', 'line', '2025-11-01T01:30:00Z')])[9],
    ).toBe('x');
  });
});

describe('authorAccents', () => {
  const at = (hour: number) =>
    `2025-11-01T${String(hour).padStart(2, '0')}:00:00+08:00`;

  it('gives every owner name chart-2 and the first other person chart-4', () => {
    const accents = authorAccents(
      [
        ev('1', 'Carol', 'line', at(9)),
        ev('2', 'Bob', 'line', at(8)),
        ev('3', 'Bobby', 'slack', at(10)),
        ev('4', 'Alice', 'line', at(7)),
      ],
      new Set(['Bob', 'Bobby']),
    );
    expect(accents.get('Bob')).toBe(2);
    expect(accents.get('Bobby')).toBe(2);
    expect(accents.get('Alice')).toBe(4);
    expect(accents.get('Carol')).toBe(1);
  });

  it('orders later people by first appearance, not input order or count, and cycles 1, 3, 5', () => {
    const accents = authorAccents(
      [
        ev('1', 'E', 'line', at(12)),
        ev('2', 'D', 'line', at(11)),
        ev('3', 'D', 'line', at(13)),
        ev('4', 'C', 'line', at(10)),
        ev('5', 'B', 'line', at(9)),
        ev('6', 'A', 'line', at(8)),
        ev('7', 'F', 'line', at(14)),
      ],
      new Set(),
    );
    expect(Object.fromEntries(accents)).toEqual({
      A: 4,
      B: 1,
      C: 3,
      D: 5,
      E: 1,
      F: 3,
    });
  });

  it('ignores photos and blank authors, and leaves chart-2 unused without an owner', () => {
    const accents = authorAccents(
      [
        ev('1', 'photo', 'photo', at(7)),
        ev('2', '', 'line', at(8)),
        ev('3', 'Alice', 'line', at(9)),
      ],
      new Set(),
    );
    expect([...accents]).toEqual([['Alice', 4]]);
  });

  it('gives an owner who never writes nothing, and the rest their usual order', () => {
    const accents = authorAccents(
      [ev('1', 'Alice', 'line', at(9)), ev('2', 'Carol', 'line', at(10))],
      new Set(['Bob']),
    );
    expect(Object.fromEntries(accents)).toEqual({ Alice: 4, Carol: 1 });
  });

  it('breaks a tie on first appearance by name', () => {
    const accents = authorAccents([ev('1', 'Zoe'), ev('2', 'Amy')], new Set());
    expect(Object.fromEntries(accents)).toEqual({ Amy: 4, Zoe: 1 });
  });

  it('returns the same map for the same events and owners, and recomputes for other owners', () => {
    const events = [ev('1', 'Bob'), ev('2', 'Alice')];
    const first = authorAccents(events, new Set(['Bob']));
    expect(authorAccents(events, new Set(['Bob']))).toBe(first);
    expect(authorAccents(events, new Set(['Alice'])).get('Alice')).toBe(2);
  });
});

describe('initialOf', () => {
  it('takes the first character, upper-cased', () => {
    expect(initialOf('alice 🌷')).toBe('A');
    expect(initialOf('  ')).toBe('?');
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

describe('rowLabel', () => {
  it('names a row by author, Taipei time and excerpt', () => {
    expect(rowLabel('Bob', '2025-10-31T16:07:00Z', 'Yes, reading.')).toBe(
      'Bob，00:07：Yes, reading.',
    );
  });

  it('leaves out the excerpt when the message has no text', () => {
    expect(rowLabel('Bob', '2025-11-01T09:30:00+08:00', '')).toBe('Bob，09:30');
  });
});
