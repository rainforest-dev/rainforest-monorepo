import { describe, expect, it } from 'vitest';

import {
  notebookPageFileName,
  notebookPdfFileName,
} from './notebook-file-names';

describe('notebookPdfFileName', () => {
  const page = (createdAt: string) => ({ createdAt });
  const name = (
    notebook: Partial<Parameters<typeof notebookPdfFileName>[0]>,
  ): string =>
    notebookPdfFileName({
      name: '2026 Q3',
      startedOn: null,
      endedOn: null,
      pages: [],
      ...notebook,
    });

  it('names an archived notebook by its start and end dates', () => {
    expect(name({ startedOn: '2026-07-01', endedOn: '2026-10-14' })).toBe(
      'BuJo 2026-07-01_2026-10-14 2026 Q3.pdf',
    );
  });

  it('falls back to the first and last upload dates', () => {
    const pages = [
      page('2026-10-14 09:00:00'),
      page('2026-08-02 12:00:00'),
      page('2026-09-30 23:59:59'),
    ];
    expect(name({ pages })).toBe('BuJo 2026-08-02_2026-10-14 2026 Q3.pdf');
  });

  it('writes one date when the range is a single day', () => {
    expect(name({ pages: [page('2026-10-14 09:00:00')] })).toBe(
      'BuJo 2026-10-14 2026 Q3.pdf',
    );
  });

  it('keeps out characters a file system rejects', () => {
    expect(name({ name: 'Work/Home: A5', startedOn: '2026-01-01' })).toBe(
      'BuJo 2026-01-01 Work-Home- A5.pdf',
    );
  });
});

describe('notebookPageFileName', () => {
  const name = (page: Partial<Parameters<typeof notebookPageFileName>[0]>) =>
    notebookPageFileName({
      notebookName: 'Bullet Journal 2026-08',
      position: 18,
      pageDate: null,
      mimeType: 'image/jpeg',
      ...page,
    });

  it('names a page by notebook, padded position and written date', () => {
    expect(name({ pageDate: '2026-08-20' })).toBe(
      'BuJo Bullet Journal 2026-08 p018 2026-08-20.jpg',
    );
  });

  it('leaves the date out until a transcription records it', () => {
    expect(name({})).toBe('BuJo Bullet Journal 2026-08 p018.jpg');
  });

  it('keeps the stored image type and out characters a file system rejects', () => {
    expect(
      name({ notebookName: 'Work/Home', position: 3, mimeType: 'image/png' }),
    ).toBe('BuJo Work-Home p003.png');
  });
});
