import { describe, expect, it } from 'vitest';

import { fold, queryTerms, trimEdges, whitespaceTerms } from './text';

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

describe('fold', () => {
  it('applies NFKC and lowercases', () => {
    expect(fold('ＶＵＥ　Ａｓｔｒｏ')).toBe('vue astro');
  });
});

describe('whitespaceTerms', () => {
  it('folds, splits, dedupes and keeps edge punctuation', () => {
    expect(whitespaceTerms('  C++  c++ Ｒｕｓｔ ')).toEqual(['c++', 'rust']);
  });

  it('returns nothing for blank input', () => {
    expect(whitespaceTerms('   ')).toEqual([]);
  });
});

describe('trimEdges', () => {
  it('strips punctuation and symbols at both ends only', () => {
    expect(trimEdges('「台南」')).toBe('台南');
    expect(trimEdges('a.b')).toBe('a.b');
  });
});
