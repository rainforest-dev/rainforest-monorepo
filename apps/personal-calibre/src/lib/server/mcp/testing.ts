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

export const NOTEBOOK_ID = 5;
export const PAGE_COUNT = 12;

const NOTEBOOK = {
  id: NOTEBOOK_ID,
  name: 'Field Log',
  status: 'active',
  startedOn: '2026-01-01',
  endedOn: null,
  createdAt: '2026-01-01 00:00:00',
  pageCount: PAGE_COUNT,
  coverPageId: 501,
};

export const notebookPage = (position: number) => ({
  id: 500 + position,
  notebookId: NOTEBOOK_ID,
  position,
  pageNumber: position,
  pageDate: null,
  fileName: `page-${position}.png`,
  mimeType: 'image/png',
  bytes: 3,
  transcription: position === 1 ? '• tidy the desk' : null,
  transcribedAt: null,
  source: 'upload',
  createdAt: '2026-01-02 00:00:00',
});

export type FakeLibrary = Record<keyof CalibreLibrary, Mock>;

export function fakeLibrary(): FakeLibrary {
  return {
    getBookList: vi.fn(async () => ({ books: [BOOK], total: 1 })),
    getGroupedBookList: vi.fn(async () => ({ groups: [] })),
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
    listNotebooks: vi.fn(async () => [NOTEBOOK]),
    getNotebookPages: vi.fn(
      async (
        id: number,
        { from = 1, to = PAGE_COUNT, limit = PAGE_COUNT } = {},
      ) =>
        id === NOTEBOOK_ID
          ? Array.from({ length: PAGE_COUNT }, (_, i) => notebookPage(i + 1))
              .filter((page) => page.position >= from && page.position <= to)
              .slice(0, limit)
          : null,
    ),
    readPageFile: vi.fn(async (id: number) => ({
      data: Buffer.from(`img${id}`),
      mimeType: 'image/png',
      fileName: `${id}.png`,
    })),
    setPageTranscription: vi.fn(
      async (
        id: number,
        input: {
          transcription: string;
          pageNumber?: number;
          pageDate?: string;
        },
      ) =>
        id === 501
          ? { ...notebookPage(1), ...input, transcribedAt: '2026-10-12' }
          : null,
    ),
  };
}

export const handlerFor = (
  library: FakeLibrary,
  write: (line: string) => void = () => undefined,
  env: Record<string, string | undefined> = { CALIBRE_MCP_SECRET: SECRET },
) => calibreMcpHandler(env, library as unknown as CalibreLibrary, write);

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
