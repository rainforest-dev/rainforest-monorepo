import { describe, expect, it } from 'vitest';

import { wrapLines } from './print';

/** Every character is 10 wide. */
const ctx = {
  measureText: (text: string) => ({ width: [...text].length * 10 }),
} as Pick<CanvasRenderingContext2D, 'measureText'>;

describe('wrapLines', () => {
  it('breaks between words', () => {
    expect(wrapLines(ctx, 'Moss and Stone Garden', 100, 3)).toEqual([
      'Moss and',
      'Stone',
      'Garden',
    ]);
  });

  it('breaks between any two CJK characters', () => {
    expect(wrapLines(ctx, '臺北市手作市集展覽', 40, 3)).toEqual([
      '臺北市手',
      '作市集展',
      '覽',
    ]);
  });

  it('ends a cut-off last line with an ellipsis', () => {
    expect(wrapLines(ctx, '一二三四五六七八九十', 40, 2)).toEqual([
      '一二三四',
      '五六七…',
    ]);
  });

  it('breaks a word too long for a line anywhere', () => {
    expect(wrapLines(ctx, 'abcdefghij', 40, 3)).toEqual(['abcd', 'efgh', 'ij']);
  });
});
