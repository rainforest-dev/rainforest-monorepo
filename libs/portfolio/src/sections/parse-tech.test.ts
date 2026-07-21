import { describe, expect, it } from 'vitest';

import { parseTech } from './parse-tech';

describe('parseTech', () => {
  it('splits prose into text and code segments on backticks', () => {
    expect(parseTech('a `b` c')).toEqual([
      { text: 'a ', code: false },
      { text: 'b', code: true },
      { text: ' c', code: false },
    ]);
  });
  it('returns a single text segment when there are no code spans', () => {
    expect(parseTech('plain')).toEqual([{ text: 'plain', code: false }]);
  });
});
