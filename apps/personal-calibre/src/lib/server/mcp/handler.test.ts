import { ToolInputError } from '@rainforest-dev/mcp-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { auditLine, resultCount } from './audit';
import { GATEWAY_HEADER, LOGIN_HEADER } from './handler';
import {
  AUTHED,
  connect,
  fakeLibrary,
  handlerFor,
  LOGIN,
  rpc,
  SECRET,
} from './testing';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('auth', () => {
  it.each([undefined, '', '  '])(
    'answers 404 to everything while the secret is %j',
    async (secret) => {
      const handler = handlerFor(fakeLibrary(), undefined, {
        CALIBRE_MCP_SECRET: secret,
      });
      for (const method of ['POST', 'GET'])
        expect((await handler(rpc(AUTHED, method))).status).toBe(404);
    },
  );

  it.each<Record<string, string>>([
    {},
    { [GATEWAY_HEADER]: 'wrong' },
    { [GATEWAY_HEADER]: `${SECRET}-and-more` },
    { [GATEWAY_HEADER]: SECRET },
    { [GATEWAY_HEADER]: SECRET, [LOGIN_HEADER]: '  ' },
    { [LOGIN_HEADER]: LOGIN },
    { 'x-memories-gateway': SECRET, [LOGIN_HEADER]: LOGIN },
    { 'x-github-token': 'gho_x', [LOGIN_HEADER]: LOGIN },
  ])('answers 401 to %j', async (headers) => {
    const library = fakeLibrary();
    const response = await handlerFor(library)(
      rpc(headers, 'POST', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'add_tag', arguments: { bookId: 41, tagName: 'x' } },
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('tools');
    expect(library.getOrCreateTag).not.toHaveBeenCalled();
  });

  it('answers 200 with the gateway secret and a login', async () => {
    const response = await handlerFor(fakeLibrary())(rpc(AUTHED));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools).toHaveLength(10);
  });

  it('answers 405 to GET once authenticated', async () => {
    expect((await handlerFor(fakeLibrary())(rpc(AUTHED, 'GET'))).status).toBe(
      405,
    );
  });
});

describe('over the SDK client', () => {
  it('initializes and lists books', async () => {
    const library = fakeLibrary();
    const client = await connect(handlerFor(library));
    expect(client.getServerVersion()?.name).toBe('calibre-mcp');
    const result = await client.callTool({
      name: 'list_books',
      arguments: { query: 'salt', tagId: 3 },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ total: 1 });
    expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual(
      result.structuredContent,
    );
    expect(library.getBookList).toHaveBeenCalledWith({
      q: 'salt',
      tagId: 3,
      page: 1,
      limit: 30,
    });
    await client.close();
  });

  it('groups when groupBy is set', async () => {
    const library = fakeLibrary();
    const client = await connect(handlerFor(library));
    await client.callTool({
      name: 'list_books',
      arguments: { groupBy: 'series', delivered: false },
    });
    expect(library.getGroupedBookList).toHaveBeenCalledWith({
      q: undefined,
      delivered: false,
      groupBy: 'series',
    });
    expect(library.getBookList).not.toHaveBeenCalled();
    await client.close();
  });

  it('reports a missing book as an input error', async () => {
    const client = await connect(handlerFor(fakeLibrary()));
    const result = await client.callTool({
      name: 'get_book',
      arguments: { bookId: 999 },
    });
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Book 999 not found' }],
    });
    await client.close();
  });

  it('keeps library input errors and hides anything else', async () => {
    const library = fakeLibrary();
    library.createBookDeliveryEvent.mockRejectedValueOnce(
      new ToolInputError('Unknown delivery platform'),
    );
    library.deleteBookDeliveryEvent.mockRejectedValueOnce(
      new Error('SQLITE_BUSY at /library/app.db'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = await connect(handlerFor(library));
    const added = await client.callTool({
      name: 'add_delivery',
      arguments: { bookId: 41, platformKey: 'nope' },
    });
    expect(added.content).toEqual([
      { type: 'text', text: 'Unknown delivery platform' },
    ]);
    const removed = await client.callTool({
      name: 'remove_delivery',
      arguments: { bookId: 41, deliveryId: 1 },
    });
    expect(removed.content).toEqual([{ type: 'text', text: 'Internal error' }]);
    await client.close();
  });

  it('runs the write tools against the library', async () => {
    const library = fakeLibrary();
    const client = await connect(handlerFor(library));
    const tagged = await client.callTool({
      name: 'add_tag',
      arguments: { bookId: 41, tagName: 'sea' },
    });
    expect(tagged.structuredContent).toEqual({
      ok: true,
      bookId: 41,
      tagId: 7,
      tagName: 'sea',
    });
    expect(library.addTagToBook).toHaveBeenCalledWith(41, 7);
    expect(library.revalidateBookTagCache).toHaveBeenCalledWith(41);

    const bulk = await client.callTool({
      name: 'bulk_add_delivery',
      arguments: { bookIds: [1, 2, 3], platformKey: 'kobo' },
    });
    expect(bulk.structuredContent).toEqual({
      ok: true,
      count: 3,
      platformKey: 'kobo',
    });

    const tags = await client.callTool({ name: 'list_tags', arguments: {} });
    expect(tags.structuredContent).toBeUndefined();
    expect(JSON.parse((tags.content as { text: string }[])[0].text)).toEqual([
      { id: 1, name: 'sea' },
    ]);
    await client.close();
  });
});

describe('audit', () => {
  it('writes one line per call with ids and counts, never free text', async () => {
    const lines: string[] = [];
    const client = await connect(
      handlerFor(fakeLibrary(), (line) => lines.push(line)),
    );
    await client.callTool({
      name: 'list_books',
      arguments: { query: 'a private search', platformKey: 'kobo' },
    });
    await client.callTool({
      name: 'add_tag',
      arguments: { bookId: 41, tagName: 'secret-tag' },
    });
    await client.callTool({
      name: 'bulk_add_delivery',
      arguments: { bookIds: [1, 2], platformKey: 'kobo', note: 'a note' },
    });
    await client.close();

    const parsed = lines.map((line) => JSON.parse(line));
    expect(parsed).toMatchObject([
      { kind: 'mcp', login: LOGIN, tool: 'list_books', results: 1, ok: true },
      { tool: 'add_tag', bookId: 41, results: 1, ok: true },
      { tool: 'bulk_add_delivery', bookIds: 2, results: 2, ok: true },
    ]);
    const all = lines.join('\n');
    for (const text of ['a private search', 'secret-tag', 'a note', 'kobo'])
      expect(all).not.toContain(text);
  });

  it('records failures as ok:false with no results', () => {
    expect(
      auditLine(
        {
          tool: 'remove_tag',
          input: { bookId: 1, tagId: 2 },
          ok: false,
          ms: 3.4,
          error: new Error('x'),
        },
        new Date('2026-10-04T00:00:00Z'),
      ),
    ).toEqual({
      kind: 'mcp',
      ts: '2026-10-04T00:00:00.000Z',
      login: 'unknown',
      tool: 'remove_tag',
      bookId: 1,
      tagId: 2,
      results: 0,
      ms: 3,
      ok: false,
    });
  });

  it.each([
    [[1, 2, 3], 3],
    [{ books: [1], total: 9 }, 1],
    [{ groups: [1, 2] }, 2],
    [{ ok: true, count: 4 }, 4],
    [{ ok: true }, 1],
    [null, 0],
  ])('counts %j as %i', (result, count) => {
    expect(resultCount(result)).toBe(count);
  });
});
