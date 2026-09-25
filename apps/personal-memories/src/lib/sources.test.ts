import { describe, expect, it } from 'vitest';

import { hiddenFrom, SOURCES } from './sources.ts';

describe('sources', () => {
  it('lists every source in order with its shared label', () => {
    expect(SOURCES).toEqual([
      { source: 'line', label: 'LINE' },
      { source: 'slack', label: 'Slack' },
      { source: 'photo', label: '照片' },
    ]);
  });

  it('turns the visible list into the hidden one', () => {
    expect(hiddenFrom(['line'])).toEqual(['slack', 'photo']);
  });
});
