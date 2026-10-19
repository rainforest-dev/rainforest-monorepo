import { describe, expect, it } from 'vitest';

import { daysAgo, feedHost, topicSummary } from './format.js';

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

describe('topicSummary', () => {
  it('drops the date and provenance rss-discover appends', () => {
    expect(
      topicSummary(
        'VLANs, DNS and routers at home · _2026-09-01_ · proposed by rss-discover',
      ),
    ).toBe('VLANs, DNS and routers at home');
  });

  it('keeps a description with no date as it is', () => {
    expect(topicSummary('Typography · page layout')).toBe(
      'Typography · page layout',
    );
    expect(topicSummary('')).toBe('');
  });
});
