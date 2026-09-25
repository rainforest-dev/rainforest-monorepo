import { describe, expect, it } from 'vitest';

import { hiddenFrom, parseHidden, visibleFrom } from './sources.ts';

describe('sources', () => {
  it('reads the stored hidden list defensively', () => {
    expect(parseHidden('["photo","nope",3]')).toEqual(['photo']);
    expect(parseHidden('{')).toEqual([]);
    expect(parseHidden('"photo"')).toEqual([]);
    expect(parseHidden(null)).toEqual([]);
  });

  it('converts between hidden and visible', () => {
    expect(visibleFrom(['photo'])).toEqual(['line', 'slack']);
    expect(hiddenFrom(['line'])).toEqual(['slack', 'photo']);
  });
});
