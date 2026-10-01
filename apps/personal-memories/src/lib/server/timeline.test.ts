import { describe, expect, it } from 'vitest';

import { makeEvent, mergeTimelines, toTaipeiIso } from './timeline.ts';

describe('toTaipeiIso', () => {
  it('formats an instant with the +08:00 offset', () => {
    expect(toTaipeiIso(Date.parse('2025-12-31T16:30:00Z'))).toBe(
      '2026-01-01T00:30:00+08:00',
    );
  });
});

describe('mergeTimelines', () => {
  const line = makeEvent({
    source: 'line',
    at: '2025-11-01T09:00:00+08:00',
    author: 'Alice',
    text: 'hi',
  });
  const slack = makeEvent({
    source: 'slack',
    at: '2025-11-01T08:00:00+08:00',
    author: 'Bob',
    text: 'hi',
  });
  const photo = makeEvent({
    id: 'P1',
    source: 'photo',
    at: '2025-11-01T08:30:00+08:00',
    author: 'photo',
    media: [{ path: '/p.jpg' }],
  });

  it('sorts ascending by at across sources', () => {
    expect(mergeTimelines([line], [slack, photo]).map((e) => e.source)).toEqual(
      ['slack', 'photo', 'line'],
    );
  });

  it('keeps ids unique and stable when events are identical', () => {
    const ids = mergeTimelines([line, line], [line]).map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    expect(mergeTimelines([line, line], [line]).map((e) => e.id)).toEqual(ids);
  });
});
