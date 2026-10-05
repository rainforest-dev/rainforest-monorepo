import { expect, test } from '@playwright/test';

import { AUTHED, callTool, MCP_PATHS, rpc } from './support/mcp';
import { resetAppDb } from './support/reset-db';
import { bookById, BOOKS } from './support/seed';

test.beforeEach(() => resetAppDb());

test.describe('MCP gateway auth', () => {
  for (const path of MCP_PATHS) {
    test(`${path} answers 401 without the gateway secret`, async ({
      request,
    }) => {
      for (const headers of [
        {} as Record<string, string>,
        { 'x-forwarded-login': 'e2e' },
        { 'x-calibre-gateway': 'wrong', 'x-forwarded-login': 'e2e' },
        { 'x-calibre-gateway': AUTHED['x-calibre-gateway'] },
      ]) {
        const response = await rpc(request, path, 'tools/list', {}, headers);
        expect(response.status()).toBe(401);
        expect(await response.text()).not.toContain('list_books');
      }
    });

    test(`${path} initializes with the gateway secret`, async ({ request }) => {
      const response = await rpc(request, path, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'calibre-e2e', version: '0.0.0' },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.result.serverInfo.name).toBe('calibre-mcp');
    });
  }
});

test.describe('MCP tools', () => {
  test('lists every tool with its annotations', async ({ request }) => {
    const response = await rpc(request, '/mcp', 'tools/list');
    const { tools } = (await response.json()).result as {
      tools: { name: string; annotations: { readOnlyHint?: boolean } }[];
    };
    const readOnly = tools
      .filter((t) => t.annotations.readOnlyHint)
      .map((t) => t.name)
      .sort();
    expect(tools).toHaveLength(10);
    expect(readOnly).toEqual([
      'get_book',
      'list_books',
      'list_deliveries',
      'list_tags',
      'list_undelivered_books',
    ]);
  });

  test('list_books returns the fixture library', async ({ request }) => {
    const result = await callTool(request, 'list_books', { limit: 5 });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ total: BOOKS.length });
    expect(JSON.parse(result.content[0].text)).toEqual(
      result.structuredContent,
    );
  });

  test('get_book returns a book and reports a missing one', async ({
    request,
  }) => {
    const found = await callTool(request, 'get_book', { bookId: 41 });
    expect(found.structuredContent).toMatchObject({
      id: 41,
      title: bookById(41).title,
    });
    const missing = await callTool(request, 'get_book', { bookId: 99999 });
    expect(missing).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Book 99999 not found' }],
    });
  });

  test('records and removes a delivery', async ({ request }) => {
    const added = await callTool(request, 'add_delivery', {
      bookId: 41,
      platformKey: 'kobo',
      externalRef: 'https://example.com/shelf/41',
    });
    expect(added.structuredContent).toEqual({
      ok: true,
      bookId: 41,
      platformKey: 'kobo',
    });
    const history = await callTool(request, 'list_deliveries', { bookId: 41 });
    const events = JSON.parse(history.content[0].text) as {
      id: number;
      platformKey: string;
    }[];
    const kobo = events.find((e) => e.platformKey === 'kobo');
    expect(kobo).toBeDefined();
    await callTool(request, 'remove_delivery', {
      bookId: 41,
      deliveryId: kobo?.id,
    });
    const after = await callTool(request, 'list_deliveries', { bookId: 41 });
    expect(JSON.parse(after.content[0].text)).not.toContainEqual(
      expect.objectContaining({ id: kobo?.id }),
    );
  });

  test('keeps the unknown-platform message for the agent', async ({
    request,
  }) => {
    const result = await callTool(request, 'add_delivery', {
      bookId: 41,
      platformKey: 'nowhere',
    });
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Unknown delivery platform' }],
    });
  });
});
