import { describe, expect, it } from 'vitest';

import { indexDays } from './days.ts';
import { firstLine, monthView, type NoteReader } from './month-view.ts';
import { emptyNote } from './notes/format.ts';
import type { TimelineEvent } from './timeline.ts';

const SIGNALS = {
  favorite: false,
  people: 0,
  screenshot: false,
  movie: false,
  burstPick: true,
};

const events: TimelineEvent[] = [
  {
    id: 'm1',
    source: 'line',
    at: '2025-11-01T09:00:00+08:00',
    author: 'Alice',
    text: 'Morning   there',
  },
  {
    id: 'p1',
    source: 'photo',
    at: '2025-11-01T10:00:00+08:00',
    author: 'photo',
    media: [{ path: '/a.jpg' }],
    photo: { ...SIGNALS, favorite: true },
  },
  {
    id: 'p2',
    source: 'photo',
    at: '2025-11-01T10:05:00+08:00',
    author: 'photo',
    media: [{ path: '/b.jpg' }],
    photo: SIGNALS,
  },
  {
    id: 'm2',
    source: 'slack',
    at: '2025-11-03T08:00:00+08:00',
    author: 'Bob',
    text: 'Coffee first',
  },
  {
    id: 'm3',
    source: 'line',
    at: '2025-12-02T08:00:00+08:00',
    author: 'Bob',
    text: 'December',
  },
];
const index = indexDays(events);

const notes: Record<string, ReturnType<NoteReader>> = {
  '2025-11-01': {
    note: { ...emptyNote('2025-11-01'), body: '## 下雨\n\n其他', cover: 'p2' },
  },
  '2025-11-03': { note: { ...emptyNote('2025-11-03'), body: '- 咖啡' } },
  '2025-11-05': { note: emptyNote('2025-11-05'), parseError: true },
};
const read: NoteReader = (date) => notes[date];
const noted = new Set(Object.keys(notes));

const cellOf = (view: ReturnType<typeof monthView>, date: string) =>
  view?.weeks.flat().find((c) => c?.date === date);

describe('monthView', () => {
  it('rejects malformed months and months outside the data', () => {
    expect(monthView(index, '2025-13', noted, read)).toBeUndefined();
    expect(monthView(index, '2025-10', noted, read)).toBeUndefined();
    expect(monthView(index, '2026-01', noted, read)).toBeUndefined();
  });

  it('builds Sunday-first weeks with totals and neighbours inside the range', () => {
    const view = monthView(index, '2025-11', noted, read);
    expect(view?.weeks[0]?.[6]?.date).toBe('2025-11-01');
    expect(view?.weeks[0]?.[0]).toBeNull();
    expect(view?.total).toBe(4);
    expect(view?.prev).toBeUndefined();
    expect(view?.next).toBe('2025-12');
    expect(monthView(index, '2025-12', noted, read)?.prev).toBe('2025-11');
  });

  it('uses the manual cover and keeps days without events', () => {
    const view = monthView(index, '2025-11', noted, read);
    expect(cellOf(view, '2025-11-01')).toMatchObject({
      total: 3,
      noted: true,
      cover: 'p2',
    });
    expect(cellOf(view, '2025-11-02')).toEqual({
      date: '2025-11-02',
      day: 2,
      total: 0,
      noted: false,
    });
  });

  it('falls back to the automatic cover when the manual one is not on the day', () => {
    const stale: NoteReader = (date) =>
      date === '2025-11-01'
        ? { note: { ...emptyNote(date), cover: 'gone' } }
        : read(date);
    expect(
      cellOf(monthView(index, '2025-11', noted, stale), '2025-11-01')?.cover,
    ).toBe('p1');
  });

  it('takes the first memory line and the first message excerpt', () => {
    const view = monthView(index, '2025-11', noted, read);
    expect(cellOf(view, '2025-11-03')).toMatchObject({
      memory: '咖啡',
      excerpt: 'Coffee first',
    });
    expect(cellOf(view, '2025-11-01')).toMatchObject({
      memory: '下雨',
      excerpt: 'Morning there',
    });
  });

  it('treats an unreadable note as noted without memory or manual cover', () => {
    expect(
      cellOf(monthView(index, '2025-11', noted, read), '2025-11-05'),
    ).toEqual({
      date: '2025-11-05',
      day: 5,
      total: 0,
      noted: true,
    });
  });
});

describe('firstLine', () => {
  it('strips Markdown markers and skips blank lines', () => {
    expect(firstLine('\n\n## 標題\n內文')).toBe('標題');
    expect(firstLine('> 引用')).toBe('引用');
    expect(firstLine('1. 第一')).toBe('第一');
    expect(firstLine('  \n')).toBeUndefined();
  });
});
