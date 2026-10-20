import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from './proxy';

const ORIGIN = 'https://library.example';
// Next matches paths against the whole pattern.
const matcher = new RegExp(`^${config.matcher[0]}$`);

function run(path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(`${ORIGIN}${path}`, { headers }));
}

describe('proxy matcher', () => {
  it.each(['/', '/search', '/zh'])('runs on the page %s', (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each([
    '/api/items',
    '/_next/static/chunk.js',
    '/_shell/inter.woff2',
    '/oidn/weights.tza',
    '/favicon.ico',
  ])('leaves %s alone', (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});

describe('proxy', () => {
  it('rewrites / to the browser’s locale', () => {
    const response = run('/', { 'accept-language': 'en-US' });
    expect(response.headers.get('x-middleware-rewrite')).toBe(`${ORIGIN}/en`);
    expect(response.headers.get('vary')).toContain('Cookie');
  });

  it('redirects a locale-prefixed URL to the plain one', () => {
    const response = run('/zh?x=1');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/?x=1`);
  });
});
