import { describe, expect, it } from 'vitest';

import { languagesFor, queryLanguage } from './query-language';

describe('queryLanguage', () => {
  it('treats any CJK character as Chinese and everything else as English', () => {
    expect(queryLanguage('拉麵')).toBe('zh');
    expect(queryLanguage('ramen 拉麵')).toBe('zh');
    expect(queryLanguage('ramen last christmas')).toBe('en');
  });
});

describe('languagesFor', () => {
  it('never repeats a language', () => {
    expect(languagesFor('en')).toEqual({ input: ['en'], output: ['en'] });
    expect(languagesFor('zh')).toEqual({ input: ['en', 'zh'], output: ['en'] });
  });
});
