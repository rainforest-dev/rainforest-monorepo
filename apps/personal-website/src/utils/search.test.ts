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
});

describe('searchRecords', () => {
  it('returns only matches, best first', () => {
    const hits = searchRecords('nextjs', RECORDS);
    expect(hits.map((h) => h.id)).toEqual(['p/opencgt', 'p/dex']);
  });

  it('returns everything for an empty query, so the palette opens populated', () => {
    expect(searchRecords('', RECORDS)).toHaveLength(RECORDS.length);
  });

  it('is stable for equal scores', () => {
    const once = searchRecords('nextjs', RECORDS).map((h) => h.id);
    const twice = searchRecords('nextjs', RECORDS).map((h) => h.id);
    expect(once).toEqual(twice);
  });
});
