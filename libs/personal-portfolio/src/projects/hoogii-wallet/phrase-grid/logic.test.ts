import { describe, expect, it } from 'vitest';

import { distributePaste, isValidWord } from './logic';

const WORDLIST = new Set(['abandon', 'ability', 'able', 'about']);

describe('phrase-grid logic', () => {
  it('flags a non-empty word missing from the wordlist, but not an empty cell', () => {
    expect(isValidWord('', WORDLIST)).toBe(true);
    expect(isValidWord('abandon', WORDLIST)).toBe(true);
    expect(isValidWord('zzzz', WORDLIST)).toBe(false);
  });

  it('splits a pasted phrase across cells by whitespace', () => {
    expect(distributePaste('abandon ability able', 12)).toEqual([
      'abandon',
      'ability',
      'able',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });
});
