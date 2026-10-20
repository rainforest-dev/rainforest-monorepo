import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from './proxy';

const ORIGIN = 'https://library.example';
// Next matches the path inside the base path against the whole pattern.
const matcher = new RegExp(`^(?:${config.matcher.join('|')})$`);

describe('proxy matcher', () => {
  it.each(['/', '/books/3', '/read/3', '/zh'])(
    'runs on the page %s',
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  it.each([
    '/api/books/3/cover',
    '/files/a/b.epub',
    '/opds',
    '/opds/books',
    '/mcp',
    '/_next/static/chunk.js',
    '/_shell/inter.woff2',
    '/oidn/NOTICE',
    '/favicon.ico',
  ])('leaves %s alone', (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});

describe('proxy', () => {
  it('rewrites a page to the browser’s locale', () => {
    const response = proxy(
      new NextRequest(`${ORIGIN}/read/3`, {
        headers: { 'accept-language': 'en-US' },
      }),
    );
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      `${ORIGIN}/en/read/3`,
    );
  });

  it('redirects a locale-prefixed URL to the plain one', () => {
    const response = proxy(new NextRequest(`${ORIGIN}/en/books/3?q=x`));
    expect(response.headers.get('location')).toBe(`${ORIGIN}/books/3?q=x`);
  });
});
