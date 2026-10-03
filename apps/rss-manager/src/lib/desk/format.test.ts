import { describe, expect, it } from 'vitest';

import { daysAgo, feedHost } from './format.js';

const NOW = Date.parse('2026-10-03T12:00:00Z');

describe('daysAgo', () => {
  it.each([
    ['2026-10-03', 'today'],
    ['2026-10-02', '1d ago'],
    ['2026-09-21', '12d ago'],
    ['2026-11-01', 'today'],
  ])('%s is %s', (date, label) => {
    expect(daysAgo(date, NOW)).toBe(label);
  });

  it('gives nothing for a date it cannot read', () => {
    expect(daysAgo('someday', NOW)).toBeNull();
  });
});

describe('feedHost', () => {
  it('takes the host, with the port', () => {
    expect(feedHost('http://127.0.0.1:3033/a/rss.xml')).toBe('127.0.0.1:3033');
    expect(feedHost('https://example.com/feed')).toBe('example.com');
  });

  it('falls back to the text when it is not a URL', () => {
    expect(feedHost('not a url')).toBe('not a url');
  });
});
