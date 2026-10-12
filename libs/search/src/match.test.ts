import { describe, expect, it } from 'vitest';

import { matchesAllTerms, ngramSimilarity, tieredMatch } from './match';

describe('matchesAllTerms', () => {
  it('needs every term in some field, after folding', () => {
    expect(matchesAllTerms(['Hacker News', 'tech'], ['hacker', 'TECH'])).toBe(
      true,
    );
    expect(matchesAllTerms(['Hacker News'], ['hacker', 'rust'])).toBe(false);
  });

  it('matches everything when there are no terms', () => {
    expect(matchesAllTerms(['x'], [])).toBe(true);
  });

  it('matches full-width input', () => {
    expect(matchesAllTerms(['Rust Blog'], ['ｒｕｓｔ'])).toBe(true);
  });
});

describe('tieredMatch', () => {
  const r = {
    title: 'PostgreSQL',
    keywords: ['database', 'relational'],
    expanded: ['資料庫'],
  };

  it('keeps the website tiers', () => {
    expect(tieredMatch('', r)).toBe(1);
    expect(tieredMatch('postgresql', r)).toBe(100);
    expect(tieredMatch('Postgre', r)).toBe(75);
    expect(tieredMatch('gres', r)).toBe(50);
    expect(tieredMatch('Relational', r)).toBe(30);
    expect(tieredMatch('data', r)).toBe(15);
    expect(tieredMatch('資料', r)).toBe(5);
    expect(tieredMatch('資', r)).toBe(0);
    expect(tieredMatch('mongo', r)).toBe(0);
  });

  it('folds full-width input', () => {
    expect(tieredMatch('ＰｏｓｔｇｒｅＳＱＬ', r)).toBe(100);
  });
});

describe('ngramSimilarity', () => {
  it('measures query coverage by bigrams and trigrams', () => {
    expect(ngramSimilarity('三體', '三體 II')).toBe(1);
    expect(ngramSimilarity('ab', 'xyz')).toBe(0);
    expect(ngramSimilarity('a', 'cat')).toBe(1);
  });
});
