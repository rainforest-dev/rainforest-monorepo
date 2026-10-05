import { describe, expect, it } from 'vitest';

import { queryTerms } from './terms.ts';

describe('queryTerms', () => {
  it('splits on any whitespace, including the ideographic space', () => {
    expect(queryTerms('台南 麵')).toEqual(['台南', '麵']);
    expect(queryTerms('台南　麵')).toEqual(['台南', '麵']);
  });

  it('drops punctuation at the edges and normalises width and case', () => {
    expect(queryTerms('拉麵！')).toEqual(['拉麵']);
    expect(queryTerms('ＲＡＭＥＮ, noodle?')).toEqual(['ramen', 'noodle']);
  });

  it('returns nothing for blank or punctuation-only input', () => {
    expect(queryTerms('   ')).toEqual([]);
    expect(queryTerms('！？')).toEqual([]);
  });

  it('removes duplicates', () => {
    expect(queryTerms('麵 麵')).toEqual(['麵']);
  });
});
