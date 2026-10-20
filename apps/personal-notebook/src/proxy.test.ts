import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from './proxy';

const ORIGIN = 'https://library.example';
// Next matches the path inside the base path against each entry.
const matcher = new RegExp(`^(?:${config.matcher.join('|')})$`);

describe('proxy matcher', () => {
  it.each(['/', '/12', '/zh'])('runs on the page %s', (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each([
    '/api/notebooks/1/pages',
    '/api/inbox/bujo',
    '/mcp',
    '/_next/static/chunk.js',
    '/_shell/inter.woff2',
    '/favicon.ico',
  ])('leaves %s alone', (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});

describe('proxy', () => {
  it('rewrites a page to the browser’s locale', () => {
    const response = proxy(
      new NextRequest(`${ORIGIN}/12`, {
        headers: { 'accept-language': 'en-US' },
      }),
    );
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      `${ORIGIN}/en/12`,
    );
  });

  it('redirects a locale-prefixed URL to the plain one', () => {
    const response = proxy(new NextRequest(`${ORIGIN}/zh/12?page=3`));
    expect(response.headers.get('location')).toBe(`${ORIGIN}/12?page=3`);
  });

  it('marks its rewrite, and passes the marked request through', () => {
    const rewrite = proxy(
      new NextRequest(`${ORIGIN}/`, {
        headers: { 'accept-language': 'en-US' },
      }),
    );
    expect(rewrite.headers.get('x-middleware-request-x-library-locale')).toBe(
      'en',
    );
    const again = proxy(
      new NextRequest(`${ORIGIN}/en`, {
        headers: { 'x-library-locale': 'en' },
      }),
    );
    expect(again.headers.get('x-middleware-next')).toBe('1');
    expect(again.headers.get('location')).toBeNull();
  });
});
