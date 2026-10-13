import { describe, expect, it } from 'vitest';

import { type Searchable, searchRecords } from './search';

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
    href: '/portfolio/dex',
  },
];

describe('searchRecords folding', () => {
  it('matches full-width input the way search_by_technology does', () => {
    expect(searchRecords('ＮＥＸＴＪＳ', RECORDS).map((h) => h.id)).toEqual([
      'p/opencgt',
      'p/dex',
    ]);
  });
});
