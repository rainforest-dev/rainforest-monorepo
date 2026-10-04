import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { auditLine, resultCount } from './audit.ts';
import { GATEWAY_HEADER, LOGIN_HEADER, readLastImport } from './handler.ts';
import {
  buildFixture,
  connect,
  type Fixture,
  handlerFor,
  LOGIN,
  rpc,
  SECRET,
} from './testing.ts';

let fixture: Fixture;

beforeAll(async () => {
  fixture = await buildFixture();
});

afterAll(() => fixture.cleanup());

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const AUTHED = { [GATEWAY_HEADER]: SECRET, [LOGIN_HEADER]: LOGIN };

describe('auth', () => {
  it.each([undefined, ''])(
    'answers 404 to everything while the secret is %j',
    async (secret) => {
      const handler = handlerFor(fixture.deps, undefined, {
        MEMORIES_MCP_SECRET: secret,
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
    { 'cf-access-authenticated-user-email': 'bob@example.com' },
  ])('answers 401 to %j', async (headers) => {
    const response = await handlerFor(fixture.deps)(rpc(headers));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('tools');
  });

  it('answers 200 with the gateway secret and a login', async () => {
    const response = await handlerFor(fixture.deps)(rpc(AUTHED));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools).toHaveLength(4);
  });

  it('answers 405 to GET once authenticated', async () => {
    expect((await handlerFor(fixture.deps)(rpc(AUTHED, 'GET'))).status).toBe(
      405,
    );
  });
});

describe('the /mcp route', () => {
  const route = async () => {
    vi.resetModules();
    const { ALL } = await import('@/pages/mcp.ts');
    return (request: Request) =>
      ALL({ request } as Parameters<typeof ALL>[0]) as Promise<Response>;
  };

  it('is 404 without MEMORIES_MCP_SECRET', async () => {
    vi.stubEnv('MEMORIES_MCP_SECRET', '');
    expect((await (await route())(rpc(AUTHED))).status).toBe(404);
  });

  it('is 401 without the gateway header when the secret is set', async () => {
    vi.stubEnv('MEMORIES_MCP_SECRET', SECRET);
    const call = await route();
    expect((await call(rpc({ [LOGIN_HEADER]: LOGIN }))).status).toBe(401);
  });

  it('is 200 through the gateway when the secret is set', async () => {
    vi.stubEnv('MEMORIES_MCP_SECRET', SECRET);
    vi.stubEnv('MEMORIES_DATA_DIR', join(fixture.root, 'data'));
    const call = await route();
    const response = await call(
      rpc(AUTHED, 'POST', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_people', arguments: {} },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.structuredContent.owner).toBe('bob');
  });
});

describe('audit', () => {
  it('writes one line per call with login, tool, dates, count, duration and outcome', async () => {
    const lines: string[] = [];
    const client = await connect(
      handlerFor(fixture.deps, (line) => lines.push(line)),
    );
    await client.callTool({
      name: 'search_memories',
      arguments: { query: '秘密的拉麵', from: '2025-11-01', to: '2025-11-03' },
    });
    await client.callTool({
      name: 'get_day',
      arguments: { date: '2025-11-01', limit: 5 },
    });
    await client.callTool({
      name: 'get_coverage',
      arguments: { from: '2025-11-03', to: '2025-11-01' },
    });
    await client.callTool({ name: 'list_people', arguments: {} });
    await client.close();

    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed).toEqual([
      {
        kind: 'mcp',
        ts: expect.any(String),
        login: LOGIN,
        tool: 'search_memories',
        from: '2025-11-01',
        to: '2025-11-03',
        results: expect.any(Number),
        ms: expect.any(Number),
        ok: true,
      },
      expect.objectContaining({
        tool: 'get_day',
        date: '2025-11-01',
        results: 5,
        ok: true,
      }),
      expect.objectContaining({ tool: 'get_coverage', results: 0, ok: false }),
      expect.objectContaining({ tool: 'list_people', results: 2, ok: true }),
    ]);
    expect(lines.join('\n')).not.toContain('拉麵');
    expect(lines.join('\n')).not.toMatch(/snippet|text|Alice|Bob/);
  });

  it('logs an unexpected failure to stderr but not an input error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const lines: string[] = [];
    const client = await connect(
      handlerFor(
        {
          ...fixture.deps,
          people: async () => {
            throw new Error('people.json is broken');
          },
        },
        (line) => lines.push(line),
      ),
    );
    const result = await client.callTool({
      name: 'list_people',
      arguments: {},
    });
    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Internal error' }],
    });
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ ok: false });
    expect(spy).toHaveBeenCalledTimes(1);
    await client.callTool({
      name: 'get_coverage',
      arguments: { from: '2025-11-03', to: '2025-11-01' },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    await client.close();
  });

  it('counts the main list of each result', () => {
    expect(resultCount({ results: [1, 2] })).toBe(2);
    expect(resultCount({ date: 'x', prev: 'y' })).toBe(0);
    expect(resultCount(undefined)).toBe(0);
    expect(
      auditLine(
        {
          tool: 'get_day',
          input: { date: '2025-11-01', cursor: 0 },
          ok: true,
          ms: 1.6,
          result: { events: [1] },
        },
        new Date('2025-11-01T00:00:00Z'),
      ),
    ).toEqual({
      kind: 'mcp',
      ts: '2025-11-01T00:00:00.000Z',
      login: 'unknown',
      tool: 'get_day',
      date: '2025-11-01',
      results: 1,
      ms: 2,
      ok: true,
    });
  });
});

describe('readLastImport', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'memories-import-'));
    mkdirSync(join(root, 'auto-import'));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const write = (state: unknown) =>
    writeFileSync(
      join(root, 'auto-import', 'state.json'),
      typeof state === 'string' ? state : JSON.stringify(state),
    );

  it('reports the last run and whether it succeeded', async () => {
    write({
      lastRunAt: '2025-11-04T03:30:00Z',
      lastSuccessAt: '2025-11-04T03:30:00Z',
    });
    expect(await readLastImport(root)).toEqual({
      at: '2025-11-04T03:30:00Z',
      ok: true,
    });
    write({
      lastRunAt: '2025-11-05T03:30:00Z',
      lastSuccessAt: '2025-11-04T03:30:00Z',
    });
    expect(await readLastImport(root)).toEqual({
      at: '2025-11-05T03:30:00Z',
      ok: false,
    });
  });

  it('is undefined without a readable state file', async () => {
    write('{not json');
    expect(await readLastImport(root)).toBeUndefined();
    expect(await readLastImport(join(root, 'missing'))).toBeUndefined();
    expect(await readLastImport(undefined)).toBeUndefined();
  });
});
