import { request } from 'node:http';

import { expect, test } from '@playwright/test';

import { BASE_URL } from './support/library';
import { rpc } from './support/mcp';

// Next serves nothing outside basePath, so every path callers used before the move to /books is
// a redirect. On the old hostname pages go to the library; feeds, APIs and MCP stay on it.
const OLD_HOST = 'calibre.rainforest.tools';
const LIBRARY = 'https://library.rainforest.tools';

// node:http, because fetch drops a Host header it is given.
const location = (
  path: string,
  init: { host?: string; method?: 'GET' | 'POST' } = {},
) =>
  new Promise<{ status: number; location: string | null }>(
    (resolve, reject) => {
      const req = request(
        new URL(path, BASE_URL),
        {
          method: init.method ?? 'GET',
          headers: init.host ? { host: init.host } : {},
        },
        (res) => {
          res.resume();
          resolve({
            status: res.statusCode ?? 0,
            location: res.headers.location ?? null,
          });
        },
      );
      req.on('error', reject);
      req.end();
    },
  );

test.describe('legacy URLs', () => {
  test('pages on the old hostname move to the library, query kept', async () => {
    expect(await location('/?q=Halvik', { host: OLD_HOST })).toEqual({
      status: 308,
      location: `${LIBRARY}/books?q=Halvik`,
    });
    expect(await location('/read/1', { host: OLD_HOST })).toEqual({
      status: 308,
      location: `${LIBRARY}/books/read/1`,
    });
    expect(await location('/notebooks/7?page=2', { host: OLD_HOST })).toEqual({
      status: 308,
      location: `${LIBRARY}/notebooks/7?page=2`,
    });
  });

  test('feeds, APIs and MCP keep answering under the base path', async () => {
    for (const host of [OLD_HOST, undefined]) {
      for (const path of [
        '/opds',
        '/opds/books?page=2',
        '/api/books/1/cover',
      ]) {
        const { status, location: to } = await location(path, { host });
        expect(status).toBe(308);
        expect(to).toBe(`/books${path}`);
      }
      expect(await location('/mcp', { host, method: 'POST' })).toEqual({
        status: 308,
        location: '/books/mcp',
      });
    }
  });

  test('a redirected MCP call still reaches the server', async ({
    request,
  }) => {
    const response = await rpc(request, '/mcp', 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'calibre-e2e', version: '0.0.0' },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).result.serverInfo.name).toBe('calibre-mcp');
  });

  test('a book page from before the base path opens the book', async () => {
    expect(await location('/books/38')).toEqual({
      status: 308,
      location: '/books/books/38',
    });
  });

  test('the bare root opens the library', async () => {
    const { status, location: to } = await location('/');
    expect(status).toBe(307);
    expect(to).toBe('/books');
  });
});
