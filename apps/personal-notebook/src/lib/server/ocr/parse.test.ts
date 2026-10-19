import { describe, expect, it } from 'vitest';

import { parseOcr } from './parse';

describe('parseOcr', () => {
  it('reads the prompted format, putting headings first', () => {
    expect(
      parseOcr(
        'DATE: 2026-08-07, 2026-08-08\nPAGE: 13\nHEADINGS: Friday, Saturday\n\nTEXT:\n• first task\n  - a note\n',
      ),
    ).toEqual({
      transcription: 'Friday\nSaturday\n\n• first task\n  - a note',
      pageDate: '2026-08-07',
      pageNumber: 13,
    });
  });

  it('takes headings on their own lines and skips ones the text repeats', () => {
    expect(
      parseOcr(
        'DATE: none\nPAGE: none\nHEADINGS:\nReading list\nTEXT:\nReading list\n• one',
      ).transcription,
    ).toBe('Reading list\n• one');
  });

  it('turns a leading 「人」 bullet into x and leaves words alone', () => {
    expect(
      parseOcr('HEADINGS: none\nTEXT:\n人 done thing\n  人 nested\n人生規劃')
        .transcription,
    ).toBe('x done thing\n  x nested\n人生規劃');
  });

  it('drops impossible dates, page numbers and code fences', () => {
    expect(
      parseOcr('```\nDATE: 2026-02-30\nPAGE: 第 9 頁\nTEXT:\n• a\n```'),
    ).toEqual({ transcription: '• a', pageDate: null, pageNumber: null });
    expect(parseOcr('DATE: 2026-8-3\nPAGE: 0\nTEXT: inline').pageDate).toBe(
      '2026-08-03',
    );
  });

  it('keeps an answer that ignores the format as plain text', () => {
    expect(parseOcr('Just some words\nand more')).toEqual({
      transcription: 'Just some words\nand more',
      pageDate: null,
      pageNumber: null,
    });
    expect(parseOcr('   ').transcription).toBe('');
  });
});
