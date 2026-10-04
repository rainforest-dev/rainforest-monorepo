import { describe, expect, it } from 'vitest';

import { scoreMatch, type Searchable, searchRecords } from './search';

const RECORDS: Searchable[] = [
  {
    id: 'p/opencgt',
    kind: 'project',
    title: 'OpenCGT',
    keywords: ['nextjs', 'auth0'],
    href: '/portfolio/opencgt',
  },
  {
    id: 'p/dex',
    kind: 'project',
    title: 'Hashgreen DEX',
    keywords: ['nextjs'],
    href: '/portfolio/hashgreen-dex',
  },
  {
    id: 's/ts',
    kind: 'skill',
    title: 'TypeScript',
    keywords: [],
    href: '/#skills',
  },
];

describe('scoreMatch', () => {
  it('ranks a title prefix above a mid-word hit', () => {
    expect(scoreMatch('Hash', 'Hashgreen DEX', [])).toBeGreaterThan(
      scoreMatch('green', 'Hashgreen DEX', []),
    );
  });

  it('scores keyword hits below title hits', () => {
    expect(scoreMatch('auth0', 'OpenCGT', ['auth0'])).toBeLessThan(
      scoreMatch('OpenCGT', 'OpenCGT', ['auth0']),
    );
  });

  it('is case-insensitive', () => {
    expect(scoreMatch('typescript', 'TypeScript', [])).toBeGreaterThan(0);
  });

  it('returns 0 when nothing matches', () => {
    expect(scoreMatch('rust', 'OpenCGT', ['auth0'])).toBe(0);
  });

  it('scores an expanded-term hit above 0 and below a keyword substring hit', () => {
    const expanded = scoreMatch('frontend', 'OpenCGT', ['auth0'], ['frontend']);
    expect(expanded).toBeGreaterThan(0);
    expect(expanded).toBeLessThan(scoreMatch('auth', 'OpenCGT', ['auth0']));
  });

  it('scores an empty expanded list exactly as before', () => {
    expect(scoreMatch('rust', 'OpenCGT', ['auth0'], [])).toBe(0);
    expect(scoreMatch('auth0', 'OpenCGT', ['auth0'], [])).toBe(
      scoreMatch('auth0', 'OpenCGT', ['auth0']),
    );
  });
});

describe('searchRecords', () => {
  it('returns only matches, best first', () => {
    const hits = searchRecords('nextjs', RECORDS);
    expect(hits.map((h) => h.id)).toEqual(['p/opencgt', 'p/dex']);
  });

  it('returns everything for an empty query, so the palette opens populated', () => {
    expect(searchRecords('', RECORDS)).toHaveLength(RECORDS.length);
  });

  it('finds a record that matches only through an expanded term', () => {
    const records = [{ ...RECORDS[0], expanded: ['前端'] }, RECORDS[1]];
    expect(searchRecords('前端', records).map((h) => h.id)).toEqual([
      'p/opencgt',
    ]);
  });

  it('ranks a direct keyword hit above an expansion-only hit', () => {
    const records = [
      { ...RECORDS[0], keywords: [], expanded: ['nextjs'] },
      { ...RECORDS[1], keywords: ['nextjs'] },
    ];
    expect(searchRecords('nextjs', records).map((h) => h.id)).toEqual([
      'p/dex',
      'p/opencgt',
    ]);
  });

  it('is stable for equal scores', () => {
    const once = searchRecords('nextjs', RECORDS).map((h) => h.id);
    const twice = searchRecords('nextjs', RECORDS).map((h) => h.id);
    expect(once).toEqual(twice);
  });
});
