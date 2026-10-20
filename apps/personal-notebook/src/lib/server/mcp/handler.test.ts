import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  createMcpFetchHandler,
  forwardTools,
  gatewayAuth,
  httpToolCaller,
  registerTools,
} from '@rainforest-dev/mcp-kit';
import { NOTEBOOK_TOOL_DEFINITIONS } from '@rainforest-dev/notebook-tools';
import { beforeAll, describe, expect, it } from 'vitest';

import { appendPages, createNotebook } from '@/lib/server/notebooks';
import { pagePng, setUpNotebookShelf } from '@/test';

import { liveNotebookApi } from './api';
import { auditLine } from './audit';
import { GATEWAY_HEADER, LOGIN_HEADER, notebookMcpHandler } from './handler';

const SECRET = 'notebook-mcp-test-secret';
const URL_ = 'https://notebook.example.test/notebooks/mcp';

const lines: string[] = [];
const notebook = notebookMcpHandler(
  { NOTEBOOK_MCP_SECRET: SECRET },
  liveNotebookApi,
  (line) => lines.push(line),
);

let notebookId = 0;
let pageIds: number[] = [];

beforeAll(async () => {
  setUpNotebookShelf('notebook-mcp-');
  notebookId = (await createNotebook('MCP Log')).id;
  const files = await Promise.all(
    [31, 32].map(async (fill) => ({
      name: `p${fill}.png`,
      type: 'image/png',
      bytes: await pagePng(fill),
    })),
  );
  pageIds = (await appendPages(notebookId, files)).added;
});

const listTools = (headers: Record<string, string>) =>
  notebook(
    new Request(URL_, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  );

describe('notebook MCP endpoint', () => {
  it('answers 404 while the secret is unset', async () => {
    const off = notebookMcpHandler({}, liveNotebookApi, () => undefined);
    const response = await off(
      new Request(URL_, {
        method: 'POST',
        headers: { [GATEWAY_HEADER]: SECRET, [LOGIN_HEADER]: 'reader' },
      }),
    );
    expect(response.status).toBe(404);
  });

  it.each<Record<string, string>>([
    {},
    { [GATEWAY_HEADER]: 'wrong', [LOGIN_HEADER]: 'reader' },
    { [GATEWAY_HEADER]: SECRET },
    { 'x-calibre-gateway': SECRET, [LOGIN_HEADER]: 'reader' },
  ])('answers 401 to %j', async (headers) => {
    expect((await listTools(headers)).status).toBe(401);
  });

  it('lists the nine notebook tools to the gateway', async () => {
    const response = await listTools({
      [GATEWAY_HEADER]: SECRET,
      [LOGIN_HEADER]: 'reader',
    });
    expect(response.status).toBe(200);
    const { result } = await response.json();
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(
      NOTEBOOK_TOOL_DEFINITIONS.map((t) => t.name),
    );
  });
});

describe('forwarded from another server, as calibre does', () => {
  // A stand-in for calibre's MCP server: the definitions alone, each call sent to the notebook.
  const calibre = createMcpFetchHandler(
    { name: 'calibre-mcp', version: '0.0.0' },
    (server) =>
      registerTools(
        server,
        forwardTools(
          NOTEBOOK_TOOL_DEFINITIONS,
          httpToolCaller({
            url: URL_,
            headers: { [GATEWAY_HEADER]: SECRET },
            userHeader: LOGIN_HEADER,
            fetch: (url, init) => notebook(new Request(url, init)),
          }),
        ),
      ),
    {
      auth: gatewayAuth({
        header: 'x-calibre-gateway',
        secret: 'calibre-secret',
        userHeader: LOGIN_HEADER,
      }),
    },
  );

  async function connect() {
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL('https://calibre.example.test/mcp'),
        {
          fetch: (url, init) => calibre(new Request(url, init)),
          requestInit: {
            headers: {
              'x-calibre-gateway': 'calibre-secret',
              [LOGIN_HEADER]: 'reader',
            },
          },
        },
      ),
    );
    return client;
  }

  it('lists notebooks, reads pages as images and saves a transcription', async () => {
    const client = await connect();

    const listed = await client.callTool({
      name: 'list_notebooks',
      arguments: {},
    });
    expect(JSON.stringify(listed.content)).toContain('MCP Log');

    const pages = await client.callTool({
      name: 'get_notebook_pages',
      arguments: { notebookId },
    });
    expect(pages.isError).toBeFalsy();
    const blocks = pages.content as Array<{ type: string }>;
    expect(blocks.filter((b) => b.type === 'image')).toHaveLength(2);

    const saved = await client.callTool({
      name: 'set_page_transcription',
      arguments: { pageId: pageIds[0], transcription: '• water plants' },
    });
    expect(saved.isError).toBeFalsy();
    const preview = await client.callTool({
      name: 'list_notebook_pages',
      arguments: { notebookId },
    });
    expect(JSON.stringify(preview.content)).toContain('water plants');
    await client.close();
  });

  it('passes the notebook server’s error on', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'rename_notebook',
      arguments: { notebookId: 9999, name: 'Nope' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('Notebook 9999 not found');
    await client.close();
  });

  it('audits each call on the notebook side under the caller’s login', () => {
    const audited = lines.map((line) => JSON.parse(line));
    expect(audited).toContainEqual(
      expect.objectContaining({
        tool: 'get_notebook_pages',
        login: 'reader',
        notebookId,
        results: 2,
        ok: true,
      }),
    );
  });
});

describe('auditLine', () => {
  it('keeps the ids and counts, not the input', () => {
    expect(
      auditLine(
        {
          tool: 'set_page_transcription',
          user: 'reader',
          input: { pageId: 4, transcription: 'private words' },
          ok: true,
          result: { pageNumber: 1 },
          ms: 3.4,
        } as never,
        new Date('2026-10-19T00:00:00Z'),
      ),
    ).toEqual({
      kind: 'mcp',
      ts: '2026-10-19T00:00:00.000Z',
      login: 'reader',
      tool: 'set_page_transcription',
      pageId: 4,
      results: 1,
      ms: 3,
      ok: true,
    });
  });
});
