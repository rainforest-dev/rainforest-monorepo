import { describe, expect, it } from 'vitest';

import { openTasks, parseTasks, type TaskPage } from './tasks';

const page = (
  id: number,
  transcription: string,
  pageDate: string | null = null,
  pageNumber: number | null = id,
): TaskPage => ({
  id,
  notebookId: 1,
  notebookName: 'Journal',
  position: id,
  pageNumber,
  pageDate,
  transcription,
});

describe('parseTasks', () => {
  it('reads each BuJo key and skips notes', () => {
    expect(
      parseTasks(
        [
          'DATE: 2026-10-14',
          'PAGE: 54',
          'HEADINGS: Tue',
          '',
          'TEXT:',
          '• Call the bank',
          '^ Draft the report',
          '○ Dentist 3pm',
          'x Pay rent',
          '人 Water plants',
          '> Book flights',
          '< Renew passport',
          '- a note about the day',
          'plain line',
        ].join('\n'),
      ).map((t) => [t.state, t.text]),
    ).toEqual([
      ['open', 'Call the bank'],
      ['progress', 'Draft the report'],
      ['event', 'Dentist 3pm'],
      ['done', 'Pay rent'],
      ['done', 'Water plants'],
      ['migrated', 'Book flights'],
      ['scheduled', 'Renew passport'],
    ]);
  });

  it('ignores the header block and keeps the parent of a sub-item', () => {
    expect(
      parseTasks('HEADINGS: • not a task\nTEXT:\n• Trip\n  • Pack\n• Gym'),
    ).toEqual([
      { text: 'Trip', state: 'open' },
      { text: 'Pack', state: 'open', parent: 'Trip' },
      { text: 'Gym', state: 'open' },
    ]);
  });

  it('reads a transcription a person typed without the OCR header', () => {
    expect(parseTasks('• Buy milk')).toEqual([
      { text: 'Buy milk', state: 'open' },
    ]);
    expect(parseTasks(null)).toEqual([]);
  });
});

describe('openTasks', () => {
  const now = new Date('2026-10-16T12:00:00Z');

  it('lists the latest copy of each item, newest first, with its first page', () => {
    const tasks = openTasks(
      [
        page(10, '• Call the bank\n• Pay rent', '2026-08-20'),
        page(11, 'x Pay rent\n> Call the bank', '2026-10-01'),
        page(12, '• Call  the bank!\n• Gym', '2026-10-14'),
      ],
      now,
    );
    expect(
      tasks.map((t) => [
        t.text,
        t.source.pageId,
        t.source.number,
        t.firstSeen?.pageId,
        t.stale,
      ]),
    ).toEqual([
      ['Gym', 12, 12, undefined, false],
      ['Call  the bank!', 12, 12, 10, true],
    ]);
  });

  it('drops an item crossed out on a later page', () => {
    expect(
      openTasks([page(1, '• Renew visa'), page(2, '人 Renew visa')], now),
    ).toEqual([]);
  });

  it('keeps events still ahead and drops the ones past', () => {
    expect(
      openTasks(
        [
          page(1, '○ Dentist', '2026-10-10'),
          page(2, '○ Concert', '2026-10-16'),
          page(3, '○ Wedding', null),
        ],
        now,
      ).map((t) => t.text),
    ).toEqual(['Wedding', 'Concert']);
  });

  it('uses the position when the page has no handwritten number', () => {
    const [task] = openTasks([page(5, '• Read', null, null)], now);
    expect(task?.source).toEqual({
      pageId: 5,
      notebookId: 1,
      notebookName: 'Journal',
      number: 5,
      pageDate: null,
    });
    expect(task?.stale).toBe(false);
  });
});
