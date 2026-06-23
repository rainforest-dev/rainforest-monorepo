import { describe, it, expect } from 'vitest';
import { detectFeedFormat, extractFeedMeta } from './feedCheck.js';

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Astro Blog</title>
    <item><title>Post 1</title></item>
    <item><title>Post 2</title></item>
    <item><title>Post 3</title></item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Web.dev</title>
  <entry><title>Entry 1</title></entry>
  <entry><title>Entry 2</title></entry>
</feed>`;

const HTML_FIXTURE = `<!DOCTYPE html><html><head><title>Not a feed</title></head></html>`;

describe('detectFeedFormat', () => {
  it('detects RSS', () => expect(detectFeedFormat(RSS_FIXTURE)).toBe('rss'));
  it('detects Atom', () => expect(detectFeedFormat(ATOM_FIXTURE)).toBe('atom'));
  it('returns null for HTML', () => expect(detectFeedFormat(HTML_FIXTURE)).toBeNull());
});

describe('extractFeedMeta', () => {
  it('extracts title and item count from RSS', () => {
    const meta = extractFeedMeta(RSS_FIXTURE, 'rss');
    expect(meta.title).toBe('Astro Blog');
    expect(meta.itemCount).toBe(3);
  });

  it('extracts title and entry count from Atom', () => {
    const meta = extractFeedMeta(ATOM_FIXTURE, 'atom');
    expect(meta.title).toBe('Web.dev');
    expect(meta.itemCount).toBe(2);
  });
});
