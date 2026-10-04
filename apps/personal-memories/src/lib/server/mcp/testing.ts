import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { writeFixtureDataDir } from '@/cli/fixture.ts';
import { buildIndex } from '@/cli/ingest.ts';
import { buildSearchDocs } from '@/lib/ingest';
import { fakeEmbedder } from '@/lib/server/embed.ts';
import { noteVectors } from '@/lib/server/note-vectors.ts';
import { createNotesStore } from '@/lib/server/notes-store.ts';
import { loadPeople } from '@/lib/server/people-store.ts';
import { readSearchFiles } from '@/lib/server/search-files.ts';
import { breaker, makeIndex } from '@/lib/server/search-index.ts';
import { loadTimeline } from '@/lib/server/store.ts';

import { GATEWAY_HEADER, LOGIN_HEADER, memoriesMcpHandler } from './handler.ts';
import type { McpDeps } from './tools.ts';

export const SECRET = 'test-secret';
export const LOGIN = 'octocat';
export const CHAT_STEMS = ['chat', 'second-week', 'busy-day', 'dm-alice'];
export const EMAILS = ['alice@example.com', 'bob@example.com'];
export const RAMEN_DAY = '2025-11-03';
export const NOTE_EMAIL = 'someone.else@example.org';

const PEOPLE = {
  owner: 'bob',
  people: [
    {
      id: 'bob',
      name: 'Bob',
      emails: ['bob@example.com'],
      aliases: { slack: ['bob'] },
    },
    {
      id: 'alice',
      name: 'Alice',
      emails: ['alice@example.com'],
      aliases: { slack: ['alice'], line: ['Alice 🌷'] },
    },
  ],
};

export type Fixture = {
  root: string;
  deps: McpDeps;
  cleanup: () => void;
};

export async function buildFixture(): Promise<Fixture> {
  const root = mkdtempSync(join(tmpdir(), 'memories-mcp-'));
  const data = join(root, 'data');
  const notesDir = join(root, 'notes');
  mkdirSync(notesDir);
  const written = writeFixtureDataDir(data);
  writeFileSync(join(data, 'people.json'), JSON.stringify(PEOPLE));
  const embedder = fakeEmbedder();
  await buildIndex(data, written, embedder, () => undefined);

  const timeline = loadTimeline(data);
  if (timeline.status !== 'ready') throw new Error('fixture has no timeline');
  const people = loadPeople(data);
  const ramen = timeline.timeline.events.find((e) => e.text?.includes('拉麵'));
  if (!ramen) throw new Error('fixture has no ramen message');
  const store = createNotesStore(notesDir);
  store.write(
    RAMEN_DAY,
    {
      body: `筆記：海苔與溏心蛋。Reach me at ${NOTE_EMAIL}`,
      annotations: [
        {
          eventId: ramen.id,
          at: ramen.at,
          source: ramen.source,
          author: ramen.author,
          excerpt: '台南的拉麵',
          body: '下次要加麵',
          by: 'Alice',
        },
      ],
    },
    '',
  );
  const vectors = noteVectors(store, embedder);
  await vectors.sync();
  const index = makeIndex(
    buildSearchDocs(timeline.timeline.events, people.people),
    await readSearchFiles(data),
  );
  mkdirSync(join(data, 'auto-import'));
  writeFileSync(
    join(data, 'auto-import', 'state.json'),
    JSON.stringify({
      lastRunAt: '2025-11-04T03:30:00.000Z',
      lastSuccessAt: '2025-11-04T03:30:00.000Z',
      fingerprint: 'x',
    }),
  );

  return {
    root,
    deps: {
      timeline: async () => timeline,
      people: async () => people,
      notes: () => store,
      searchIndex: async () => ({ ...index, extra: vectors }),
      embedder,
      breaker: breaker(),
      lastImport: async () => ({ at: '2025-11-04T03:30:00.000Z', ok: true }),
      publicUrl: 'https://memories.example.test/',
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export const ENDPOINT = 'https://memories.example.test/mcp';

export const handlerFor = (
  deps: McpDeps,
  write: (line: string) => void = () => undefined,
  env: Record<string, string | undefined> = { MEMORIES_MCP_SECRET: SECRET },
) => memoriesMcpHandler(env, deps, write);

export async function connect(
  handler: (request: Request) => Promise<Response>,
  headers: Record<string, string> = {
    [GATEWAY_HEADER]: SECRET,
    [LOGIN_HEADER]: LOGIN,
  },
) {
  const client = new Client({ name: 'memories-test', version: '0.0.0' });
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
