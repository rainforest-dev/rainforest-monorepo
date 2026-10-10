import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createMcpFetchHandler,
  gatewayAuth,
  registerTools,
} from '@rainforest-dev/mcp-kit';
import { z } from 'astro/zod';

import { sharedEmbedders } from '@/lib/server/embed.ts';
import { getMarkers } from '@/lib/server/markers-store.ts';
import { getNoteVectors } from '@/lib/server/note-vectors.ts';
import { notesStore } from '@/lib/server/notes-store.ts';
import { getPeople } from '@/lib/server/people-store.ts';
import { breaker, getSearchIndex } from '@/lib/server/search-index.ts';
import { dataDir, getTimeline } from '@/lib/server/store.ts';

import { auditCall } from './audit.ts';
import { type LastImport, type McpDeps, memoriesTools } from './tools.ts';

export const GATEWAY_HEADER = 'x-memories-gateway';
export const LOGIN_HEADER = 'x-forwarded-login';
export const MCP_SERVER = { name: 'memories', version: '0.0.1' };

const importState = z.object({
  lastRunAt: z.string(),
  lastSuccessAt: z.string().optional(),
});

export async function readLastImport(
  root: string | undefined,
): Promise<LastImport | undefined> {
  if (!root) return undefined;
  try {
    const raw = await readFile(join(root, 'auto-import', 'state.json'), 'utf8');
    const state = importState.parse(JSON.parse(raw));
    return {
      at: state.lastRunAt,
      ok:
        state.lastSuccessAt !== undefined &&
        state.lastSuccessAt >= state.lastRunAt,
    };
  } catch {
    return undefined;
  }
}

export const liveDeps = (env: Record<string, string | undefined>): McpDeps => ({
  timeline: getTimeline,
  people: getPeople,
  markers: getMarkers,
  notes: notesStore,
  searchIndex: async () => {
    const index = await getSearchIndex();
    return index && { ...index, extra: getNoteVectors() };
  },
  embedder: sharedEmbedders().foreground,
  breaker: breaker(),
  lastImport: () => readLastImport(dataDir()),
  publicUrl: env['MEMORIES_PUBLIC_URL'] || undefined,
});

export function memoriesMcpHandler(
  env: Record<string, string | undefined>,
  deps: McpDeps = liveDeps(env),
  write?: (line: string) => void,
): (request: Request) => Promise<Response> {
  const tools = memoriesTools(deps);
  const onCall = auditCall(write);
  return createMcpFetchHandler(
    MCP_SERVER,
    (server) => registerTools(server, tools, { onCall }),
    {
      auth: gatewayAuth({
        header: GATEWAY_HEADER,
        secret: env['MEMORIES_MCP_SECRET'],
        userHeader: LOGIN_HEADER,
      }),
    },
  );
}
