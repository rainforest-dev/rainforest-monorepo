import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BOOK_TOOL_DEFINITIONS } from '@rainforest-dev/book-tools';
import type { MergedSearchResponse } from '@rainforest-dev/library-contract';
import { NOTEBOOK_TOOL_DEFINITIONS } from '@rainforest-dev/notebook-tools';
import { describe, expect, it, vi } from 'vitest';

import { GATEWAY_HEADER, libraryMcpHandler, LOGIN_HEADER } from './mcp';

const SECRET = 'library-secret';
const LOGIN = 'octocat';
const ENDPOINT = 'https://library.example.test/api/mcp';
const AUTHED = { [GATEWAY_HEADER]: SECRET, [LOGIN_HEADER]: LOGIN };

const ENV = {
  LIBRARY_MCP_SECRET: SECRET,
  LIBRARY_BOOKS_URL: 'http://books.example.test/books/',
  LIBRARY_BOOKS_MCP_SECRET: 'books-secret',
  LIBRARY_NOTEBOOKS_URL: 'http://notebooks.example.test/notebooks',
  LIBRARY_NOTEBOOKS_MCP_SECRET: 'notebooks-secret',
};

const MERGED: MergedSearchResponse = {
  results: [{ kind: 'book', id: '135', title: 'Rust', href: '/books/b/135' }],
  sources: [{ collection: 'books', ok: true, count: 1 }],
};

/** Every forwarded call, and a canned result for it. */
function fakeApps() {
  const requests: Request[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const request = new Request(url, init);
    requests.push(request.clone());
    const { id } = (await request.json()) as { id: number };
    return Response.json({
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: '{"ok":true}' }] },
    });
  };
  return { requests, fetch: fetch as typeof globalThis.fetch };
}

async function connect(handler: (request: Request) => Promise<Response>) {
  const client = new Client({ name: 'hall-test', version: '0.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(ENDPOINT), {
      fetch: (url, init) => handler(new Request(url, init)),
      requestInit: { headers: AUTHED },
    }),
  );
  return client;
}

const listRequest = (headers: Record<string, string>) =>
  new Request(ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });

describe('library MCP', () => {
  it('answers 404 without a secret and 401 without the gateway header or a login', async () => {
    expect((await libraryMcpHandler({})(listRequest(AUTHED))).status).toBe(404);
    const handler = libraryMcpHandler(ENV);
    expect((await handler(listRequest({}))).status).toBe(401);
    expect(
      (await handler(listRequest({ [GATEWAY_HEADER]: SECRET }))).status,
    ).toBe(401);
  });

  it('lists search_library, then every book and notebook tool', async () => {
    const client = await connect(libraryMcpHandler(ENV));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      'search_library',
      ...BOOK_TOOL_DEFINITIONS.map((t) => t.name),
      ...NOTEBOOK_TOOL_DEFINITIONS.map((t) => t.name),
    ]);
  });

  it('searches the whole library', async () => {
    const search = vi.fn(async () => MERGED);
    const client = await connect(libraryMcpHandler(ENV, { search }));
    const result = await client.callTool({
      name: 'search_library',
      arguments: { query: '  rust ' },
    });
    expect(search).toHaveBeenCalledWith('rust', undefined);
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([
      {
        type: 'text',
        text: JSON.stringify({
          results: [
            {
              ...MERGED.results[0],
              href: 'https://library.rainforest.tools/books/b/135',
            },
          ],
          sources: MERGED.sources,
        }),
      },
    ]);
  });

  it('narrows the search and caps the hits', async () => {
    const hit = MERGED.results[0];
    const search = vi.fn(async () => ({
      ...MERGED,
      results: [hit, { ...hit, id: '136' }, { ...hit, id: '137' }],
    }));
    const client = await connect(libraryMcpHandler(ENV, { search }));
    const result = await client.callTool({
      name: 'search_library',
      arguments: { query: 'rust', collections: ['books'], limit: 2 },
    });
    expect(search).toHaveBeenCalledWith('rust', ['books']);
    const [content] = result.content as { text: string }[];
    expect(
      (JSON.parse(content?.text ?? '') as MergedSearchResponse).results.map(
        (r) => r.id,
      ),
    ).toEqual(['135', '136']);
  });

  it('forwards a book tool to calibre and a notebook tool to the notebook app, with the login', async () => {
    const apps = fakeApps();
    const client = await connect(libraryMcpHandler(ENV, { fetch: apps.fetch }));
    await client.callTool({ name: 'get_book', arguments: { bookId: 135 } });
    await client.callTool({ name: 'list_notebooks', arguments: {} });
    const [book, notebook] = apps.requests;
    expect(book?.url).toBe('http://books.example.test/books/mcp');
    expect(book?.headers.get('x-calibre-gateway')).toBe('books-secret');
    expect(book?.headers.get(LOGIN_HEADER)).toBe(LOGIN);
    expect(notebook?.url).toBe('http://notebooks.example.test/notebooks/mcp');
    expect(notebook?.headers.get('x-notebook-gateway')).toBe(
      'notebooks-secret',
    );
    expect(notebook?.headers.get(LOGIN_HEADER)).toBe(LOGIN);
  });

  it('keeps an unconfigured collection listed and says why a call cannot run', async () => {
    const client = await connect(
      libraryMcpHandler({ LIBRARY_MCP_SECRET: SECRET }),
    );
    const result = await client.callTool({
      name: 'get_book',
      arguments: { bookId: 1 },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      'LIBRARY_BOOKS_MCP_SECRET',
    );
  });
});
