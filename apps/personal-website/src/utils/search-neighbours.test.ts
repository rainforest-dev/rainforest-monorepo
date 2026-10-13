import { describe, expect, it } from 'vitest';

import { fuseRankings, neighbourRanking } from './search-neighbours';

const FILE = {
  terms: {
    database: [
      ['b', 0.8],
      ['c', 0.75],
    ] as [string, number][],
    datastore: [
      ['c', 0.9],
      ['d', 0.71],
    ] as [string, number][],
    資料庫: [['e', 0.8]] as [string, number][],
  },
};

describe('neighbourRanking', () => {
  it('merges every term the query prefixes, keeping each record at its best score', () => {
    expect(neighbourRanking('data', FILE)).toEqual(['c', 'b', 'd']);
  });

  it('folds the query', () => {
    expect(neighbourRanking(' ＤＡＴＡＢＡＳＥ ', FILE)).toEqual(['b', 'c']);
  });

  it('starts at two characters', () => {
    expect(neighbourRanking('d', FILE)).toEqual([]);
    expect(neighbourRanking('資', FILE)).toEqual([]);
    expect(neighbourRanking('資料', FILE)).toEqual(['e']);
  });
});

describe('fuseRankings', () => {
  it('keeps the lexical order when there are no neighbours', () => {
    expect(fuseRankings(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('appends neighbour-only records after a lexical hit they do not share', () => {
    expect(fuseRankings(['a'], ['z'])).toEqual(['a', 'z']);
  });

  it('lifts a record found by both rankings', () => {
    expect(fuseRankings(['a', 'b'], ['b'])).toEqual(['b', 'a']);
  });
});
