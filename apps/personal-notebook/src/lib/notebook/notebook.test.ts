import { describe, expect, it } from 'vitest';

import {
  classifyPage,
  commitsTurn,
  edgeWidth,
  notebookBacklinks,
  notebookIndex,
  notebookOutline,
  pageHeading,
  pageOfSpread,
  pageSegments,
  type PageText,
  spreadOfPage,
  spreadsOf,
  stackDepth,
} from '.';

const page = (
  id: number,
  transcription: string | null,
  extra: Partial<PageText> = {},
): PageText => ({
  id,
  position: id,
  pageNumber: null,
  pageDate: null,
  transcription,
  ...extra,
});

describe('pageHeading', () => {
  it('takes the first non-empty line without markers', () => {
    expect(pageHeading('\n\n## Index\n- a')).toBe('Index');
    expect(pageHeading('- **Sunday 10/11**')).toBe('Sunday 10/11');
    expect(pageHeading('   ')).toBeUndefined();
    expect(pageHeading(null)).toBeUndefined();
  });

  it('shortens long lines', () => {
    expect(pageHeading('字'.repeat(100))).toHaveLength(80);
  });
});

describe('classifyPage', () => {
  it.each([
    ['Index', null, 'setup'],
    ['目錄', null, 'setup'],
    ['Future Log 2026', null, 'setup'],
    ['October', null, 'setup'],
    ['10月', null, 'setup'],
    ['2026-10', null, 'setup'],
    ['Sunday 10/11', null, 'daily'],
    ['Wednesday', null, 'daily'],
    ['星期三 讀書', null, 'daily'],
    ['Oct 3', null, 'daily'],
    ['Reading list', '2026-10-03', 'daily'],
    ['Reading list', null, 'collection'],
  ] as const)('%s → %s', (title, date, group) => {
    expect(classifyPage(title, date)).toBe(group);
  });
});

describe('notebookOutline', () => {
  it('groups pages in setup, collection, daily order and skips untranscribed ones', () => {
    const outline = notebookOutline([
      page(1, null),
      page(2, 'Index'),
      page(3, 'Sunday 10/11'),
      page(4, 'Reading list'),
      page(5, 'October', { pageNumber: 9 }),
    ]);
    expect(
      outline.map((s) => [s.label, s.entries.map((e) => [e.title, e.number])]),
    ).toEqual([
      [
        'Setup',
        [
          ['Index', 2],
          ['October', 9],
        ],
      ],
      ['Collections', [['Reading list', 4]]],
      ['Daily', [['Sunday 10/11', 3]]],
    ]);
  });
});

describe('pageSegments', () => {
  const pages = [
    page(1, 'Index\n- Reading p. 3\n- Trip → 4\n- Missing p. 99', {
      pageDate: '2026-10-01',
    }),
    page(2, 'Plan for 10/3 and 2026-10-04, see https://example.com/a.', {
      pageDate: '2026-10-02',
    }),
    page(3, 'Saturday', { pageDate: '2026-10-03' }),
    page(4, 'Sunday', { pageDate: '2026-10-04' }),
  ];
  const index = notebookIndex(pages);

  it('links page references that resolve and leaves the rest as text', () => {
    const segments = pageSegments(pages[0] as PageText, index);
    expect(segments.filter((s) => s.kind === 'page')).toEqual([
      { kind: 'page', pageId: 3, text: 'p. 3' },
      { kind: 'page', pageId: 4, text: '→ 4' },
    ]);
    expect(segments.map((s) => s.text).join('')).toBe(pages[0]?.transcription);
  });

  it('links dates to the page dated that day, short dates in the page’s year', () => {
    const segments = pageSegments(pages[1] as PageText, index);
    expect(segments.filter((s) => s.kind !== 'text')).toEqual([
      { kind: 'date', pageId: 3, date: '2026-10-03', text: '10/3' },
      { kind: 'date', pageId: 4, date: '2026-10-04', text: '2026-10-04' },
      {
        kind: 'url',
        href: 'https://example.com/a',
        text: 'https://example.com/a',
      },
    ]);
  });

  it('never links a page to itself and returns nothing for an empty page', () => {
    const self = page(9, 'see p. 9', { pageNumber: 9 });
    expect(
      pageSegments(self, notebookIndex([self])).every((s) => s.kind === 'text'),
    ).toBe(true);
    expect(pageSegments(page(5, null), index)).toEqual([]);
  });

  it('lists backlinks once per referring page', () => {
    const backlinks = notebookBacklinks([
      ...pages,
      page(5, 'again p. 3 and p. 3'),
    ]);
    expect(backlinks.get(3)?.map((b) => b.pageId)).toEqual([1, 2, 5]);
    expect(backlinks.get(1)).toBeUndefined();
  });
});

describe('spreads', () => {
  it('opens with the cover alone on the right, then pairs', () => {
    expect(spreadsOf(4, 'spread')).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: null },
    ]);
    expect(spreadsOf(3, 'spread')).toHaveLength(2);
    expect(spreadsOf(2, 'single')).toEqual([
      { left: null, right: 0 },
      { left: null, right: 1 },
    ]);
    expect(spreadsOf(0, 'spread')).toEqual([]);
  });

  it('finds the spread holding a page', () => {
    expect([0, 1, 2, 3, 4].map((i) => spreadOfPage(i, 'spread'))).toEqual([
      0, 1, 1, 2, 2,
    ]);
    expect(spreadOfPage(3, 'single')).toBe(3);
    expect(pageOfSpread({ left: 3, right: null })).toBe(3);
    expect(pageOfSpread({ left: 3, right: 4 })).toBe(3);
    expect(pageOfSpread({ left: null, right: 0 })).toBe(0);
  });

  it('measures the page stacks either side', () => {
    expect(stackDepth({ left: null, right: 0 }, 57)).toEqual({
      before: 0,
      after: 56,
    });
    expect(stackDepth({ left: 55, right: 56 }, 57)).toEqual({
      before: 55,
      after: 0,
    });
    expect(edgeWidth(0)).toBe(0);
    expect(edgeWidth(56)).toBeLessThanOrEqual(14);
    expect(edgeWidth(2)).toBeLessThan(edgeWidth(40));
  });

  it('commits a drag past a third or on a flick', () => {
    expect(commitsTurn(0.4, 0)).toBe(true);
    expect(commitsTurn(0.2, 0)).toBe(false);
    expect(commitsTurn(0.1, 1)).toBe(true);
  });
});
