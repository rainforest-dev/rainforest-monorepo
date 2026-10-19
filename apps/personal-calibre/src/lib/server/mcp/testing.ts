import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Mock, vi } from 'vitest';

import { calibreMcpHandler, GATEWAY_HEADER, LOGIN_HEADER } from './handler';
import type { CalibreLibrary } from './tools';

export const SECRET = 'test-secret';
export const LOGIN = 'octocat';
export const ENDPOINT = 'https://calibre.example.test/mcp';
export const AUTHED = { [GATEWAY_HEADER]: SECRET, [LOGIN_HEADER]: LOGIN };

const BOOK = { id: 41, title: 'Salt Ledger', authors: [], tags: [] };

export type FakeLibrary = Record<keyof CalibreLibrary, Mock>;

export function fakeLibrary(): FakeLibrary {
  return {
    getBookList: vi.fn(async () => ({ books: [BOOK], total: 1 })),
    getGroupedBookList: vi.fn(async () => ({ groups: [] })),
    searchBookList: vi.fn(async () => ({
      books: [BOOK],
      total: 1,
      semantic: 'off',
    })),
    getBook: vi.fn(async (id: number) => (id === BOOK.id ? BOOK : null)),
    listUndeliveredBooks: vi.fn(async () => ({ books: [], total: 0 })),
    listBookDeliveryEvents: vi.fn(async () => []),
    createBookDeliveryEvent: vi.fn(async () => undefined),
    bulkCreateDeliveryEvents: vi.fn(async (ids: number[]) => ({
      count: ids.length,
    })),
    deleteBookDeliveryEvent: vi.fn(async () => undefined),
    getFilterOptions: vi.fn(async () => ({
      authors: [],
      tags: [{ id: 1, name: 'sea' }],
      series: [],
    })),
    getOrCreateTag: vi.fn(() => 7),
    addTagToBook: vi.fn(),
    removeTagFromBook: vi.fn(),
    revalidateBookTagCache: vi.fn(),
  };
}

export const NOTEBOOK_INTERNAL_URL = 'http://notebook.example.test/notebooks';
export const NOTEBOOK_SECRET = 'notebook-test-secret';

/** Calls to personal-notebook, and the canned result each one gets back. */
export interface FakeNotebookServer {
  fetch: typeof fetch;
  requests: Request[];
  respond: (body: unknown, status?: number) => void;
}

export function fakeNotebookServer(): FakeNotebookServer {
  const requests: Request[] = [];
  let next: { body: unknown; status: number } = {
    body: { content: [{ type: 'text', text: '[]' }] },
    status: 200,
  };
  return {
    requests,
    respond: (body, status = 200) => {
      next = { body, status };
    },
    fetch: async (url, init) => {
      const request = new Request(url, init);
      requests.push(request.clone());
      const { id } = (await request.json()) as { id: number };
      return Response.json(
        next.status === 200 ? { jsonrpc: '2.0', id, result: next.body } : {},
        { status: next.status },
      );
    },
  };
}

export const handlerFor = (
  library: FakeLibrary,
  write: (line: string) => void = () => undefined,
  env: Record<string, string | undefined> = { CALIBRE_MCP_SECRET: SECRET },
  notebook?: FakeNotebookServer,
) =>
  calibreMcpHandler(
    notebook
      ? {
          NOTEBOOK_INTERNAL_URL,
          NOTEBOOK_MCP_SECRET: NOTEBOOK_SECRET,
          ...env,
        }
      : env,
    library as unknown as CalibreLibrary,
    write,
    notebook?.fetch,
  );

export async function connect(
  handler: (request: Request) => Promise<Response>,
  headers: Record<string, string> = AUTHED,
) {
  const client = new Client({ name: 'calibre-test', version: '0.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(ENDPOINT), {
      fetch: (url, init) => handler(new Request(url, init)),
      requestInit: { headers },
    }),
  );
  return client;
}

export const rpc = (
  headers: Record<string, string>,
  method = 'POST',
  body: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list' },
) =>
  new Request(ENDPOINT, {
    method,
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
