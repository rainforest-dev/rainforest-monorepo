import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { expect, test } from '@playwright/test';

import { callTool, GATEWAY_HEADERS, MCP_SECRET, mcpClient } from './mcp-client';

const LIST = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
const JSON_RPC = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
};

let client: Client;

test.beforeAll(async ({ baseURL }) => {
  client = await mcpClient(baseURL ?? '');
});

test.afterAll(async () => {
  await client.close();
});

test('answers 401 without the gateway secret and a login', async ({
  request,
}) => {
  const rejected: Record<string, string>[] = [
    {},
    { 'x-memories-gateway': 'wrong', 'x-forwarded-login': 'e2e-agent' },
    { 'x-memories-gateway': MCP_SECRET },
    { 'cf-access-authenticated-user-email': 'bob@example.com' },
  ];
  for (const headers of rejected) {
    const response = await request.post('/mcp', {
      headers: { ...JSON_RPC, ...headers },
      data: LIST,
    });
    expect(response.status(), JSON.stringify(headers)).toBe(401);
  }
  for (const path of ['/mcp', '/mcp/'])
    expect((await request.get(path)).status(), path).toBe(401);
});

test('answers tools/list over raw JSON-RPC with the gateway headers', async ({
  request,
}) => {
  const response = await request.post('/mcp', {
    headers: { ...JSON_RPC, ...GATEWAY_HEADERS },
    data: LIST,
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { result: { tools: unknown[] } };
  expect(body.result.tools).toHaveLength(5);
});

test('initializes and lists five read-only tools', async () => {
  expect(client.getServerVersion()).toMatchObject({ name: 'memories' });
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual([
    'get_coverage',
    'get_day',
    'list_markers',
    'list_people',
    'search_memories',
  ]);
  for (const tool of tools)
    expect(tool.annotations).toMatchObject({
      readOnlyHint: true,
      openWorldHint: false,
    });
});

test('search_memories finds the ramen day through the fake embedder', async () => {
  const out = await callTool<{
    results: { date: string; snippet: string }[];
    semantic: string;
  }>(client, 'search_memories', { query: '拉麵' });
  expect(out.semantic).toBe('on');
  expect(out.results[0]).toMatchObject({
    date: '2025-11-03',
    snippet: expect.stringContaining('拉麵'),
  });
});

test('get_day returns display names and photo metadata, never paths', async () => {
  const out = await callTool<{
    url: string;
    events: { author: string; photo?: { labels: string[] } }[];
  }>(client, 'get_day', { date: '2025-11-01', limit: 200 });
  expect(out.url).toBe('https://memories.example.test/day/2025-11-01');
  const authors = new Set(out.events.map((e) => e.author));
  expect(authors).toContain('Bob');
  expect(authors).toContain('Alice');
  expect(out.events.some((e) => e.photo?.labels.includes('Ramen'))).toBe(true);
  const json = JSON.stringify(out);
  expect(json).not.toContain('@example.com');
  expect(json).not.toContain('test-output');
  expect(json).not.toMatch(/"(chat|path|media)"/);
});

test('list_people and get_coverage answer from the fixture', async () => {
  const people = await callTool<{ people: { id: string }[]; owner?: string }>(
    client,
    'list_people',
  );
  expect(people.people.map((p) => p.id).sort()).toEqual(['alice', 'bob']);
  expect(people.owner).toBe('bob');
  expect(JSON.stringify(people)).not.toContain('@');

  const coverage = await callTool<{ firstDate: string; buckets: unknown[] }>(
    client,
    'get_coverage',
  );
  expect(coverage.firstDate).toBe('2025-10-31');
  expect(coverage.buckets.length).toBeGreaterThan(0);
});
