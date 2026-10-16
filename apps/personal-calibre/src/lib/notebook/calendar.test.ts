import { describe, expect, it } from 'vitest';

import { calendarDays, type CalendarPage, notebookSlots } from './calendar';

const page = (
  id: number,
  pageDate: string,
  extra: Partial<CalendarPage> = {},
): CalendarPage => ({
  id,
  notebookId: 1,
  notebookName: 'BuJo',
  position: id,
  pageDate,
  transcription: null,
  ...extra,
});

describe('calendarDays', () => {
  it('places pages on their day in notebook then page order', () => {
    const weeks = calendarDays('2026-10', [
      page(3, '2026-10-11', { notebookId: 2, position: 1 }),
      page(2, '2026-10-11', { position: 9 }),
      page(1, '2026-10-11', { position: 4, transcription: '• Sunday\nwalk' }),
      page(4, '2026-10-12'),
    ]);
    // October 2026 starts on a Thursday.
    expect(weeks[0]?.slice(0, 4)).toEqual([null, null, null, null]);
    const days = weeks.flat().filter((day) => day !== null);
    expect(days).toHaveLength(31);
    const eleventh = days.find((day) => day.date === '2026-10-11');
    expect(eleventh?.pages.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(eleventh?.heading).toBe('Sunday');
    expect(days.find((day) => day.date === '2026-10-12')?.heading).toBe(
      undefined,
    );
    expect(days.find((day) => day.date === '2026-10-13')?.pages).toEqual([]);
  });

  it('takes the heading from the first page that has one', () => {
    const [day] = calendarDays('2026-10', [
      page(1, '2026-10-01'),
      page(2, '2026-10-01', { transcription: 'Thursday' }),
    ])
      .flat()
      .filter((d) => d?.date === '2026-10-01');
    expect(day?.heading).toBe('Thursday');
  });
});

describe('notebookSlots', () => {
  it('gives notebooks colour slots by id and wraps past the last', () => {
    const slots = notebookSlots(
      [9, 2, 5, 2].map((notebookId, i) =>
        page(i, '2026-10-01', { notebookId }),
      ),
      2,
    );
    expect([...slots]).toEqual([
      [2, 0],
      [5, 1],
      [9, 0],
    ]);
  });
});
