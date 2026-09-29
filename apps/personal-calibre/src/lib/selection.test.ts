import { describe, expect, it } from 'vitest';

import {
  addIds,
  pageCheckState,
  removeIds,
  toggleId,
  togglePage,
} from './selection';

describe('selection', () => {
  it('toggles one id without mutating the input', () => {
    const start = new Set([1]);
    expect([...toggleId(start, 2)]).toEqual([1, 2]);
    expect([...toggleId(start, 1)]).toEqual([]);
    expect([...start]).toEqual([1]);
  });

  it('selects every matching id across pages for Select all N', () => {
    const matchingIds = Array.from({ length: 70 }, (_, i) => i + 1);
    expect(addIds(new Set([3]), matchingIds).size).toBe(70);
  });

  it('keeps ids from another page when the page changes', () => {
    const fromPageOne = new Set([1, 2]);
    const pageTwo = [31, 32, 33];
    expect(pageCheckState(fromPageOne, pageTwo)).toBe('none');
    expect(addIds(fromPageOne, [31]).size).toBe(3);
  });

  it('acts on the current page only from the header checkbox', () => {
    const selected = new Set([1, 31]);
    const pageTwo = [31, 32];
    expect(pageCheckState(selected, pageTwo)).toBe('some');
    const all = togglePage(selected, pageTwo);
    expect([...all].sort((a, b) => a - b)).toEqual([1, 31, 32]);
    expect(pageCheckState(all, pageTwo)).toBe('all');
    expect([...togglePage(all, pageTwo)]).toEqual([1]);
    expect([...removeIds(all, [1])].sort((a, b) => a - b)).toEqual([31, 32]);
  });

  it('reads an empty page as none', () => {
    expect(pageCheckState(new Set([1]), [])).toBe('none');
  });
});
