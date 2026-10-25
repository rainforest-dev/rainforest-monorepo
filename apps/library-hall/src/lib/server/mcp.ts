import { BOOK_TOOL_DEFINITIONS } from '@rainforest-dev/book-tools';
import {
  LIBRARY_SEARCH_MAX_QUERY,
  type MergedSearchResponse,
} from '@rainforest-dev/library-contract';
import {
  createMcpFetchHandler,
  defineTool,
  forwardTools,
  gatewayAuth,
  httpToolCaller,
  type McpTool,
  registerTools,
  type RemoteToolCall,
  ToolInputError,
} from '@rainforest-dev/mcp-kit';
import { NOTEBOOK_TOOL_DEFINITIONS } from '@rainforest-dev/notebook-tools';
import { z } from 'zod';

import { searchLibrary } from './search';

type Env = Record<string, string | undefined>;

export const GATEWAY_HEADER = 'x-library-gateway';
export const LOGIN_HEADER = 'x-forwarded-login';
export const SECRET_ENV = 'LIBRARY_MCP_SECRET';
export const MCP_SERVER = { name: 'library-mcp', version: '0.1.0' };

/** Where each collection's tools run, and the gateway header its `/mcp` checks. */
export const FORWARDED_COLLECTIONS = {
  books: {
    tools: BOOK_TOOL_DEFINITIONS,
    header: 'x-calibre-gateway',
    secretEnv: 'LIBRARY_BOOKS_MCP_SECRET',
  },
  notebooks: {
    tools: NOTEBOOK_TOOL_DEFINITIONS,
    header: 'x-notebook-gateway',
    secretEnv: 'LIBRARY_NOTEBOOKS_MCP_SECRET',
  },
} as const;
type ForwardedCollection = keyof typeof FORWARDED_COLLECTIONS;

const unconfigured =
  (collection: ForwardedCollection, urlEnv: string, secretEnv: string) =>
  async (name: string): Promise<never> => {
    throw new ToolInputError(
      `${name}: this server has no ${urlEnv} and ${secretEnv} to reach the ${collection} collection`,
    );
  };

/**
 * One collection's tools, served here and run in the collection's own app at
 * `<LIBRARY_<NAME>_URL>/mcp` with the caller's login. Unconfigured, the tools stay listed and
 * every call says why it cannot run.
 */
export function forwardedTools(
  collection: ForwardedCollection,
  env: Env,
  fetchImpl?: typeof fetch,
): McpTool[] {
  const { tools, header, secretEnv } = FORWARDED_COLLECTIONS[collection];
  const urlEnv = `LIBRARY_${collection.toUpperCase()}_URL`;
  const base = env[urlEnv]?.trim().replace(/\/+$/, '');
  const secret = env[secretEnv]?.trim();
  const call: RemoteToolCall =
    base && secret
      ? httpToolCaller({
          url: `${base}/mcp`,
          headers: { [header]: secret },
          userHeader: LOGIN_HEADER,
          ...(fetchImpl && { fetch: fetchImpl }),
        })
      : unconfigured(collection, urlEnv, secretEnv);
  return forwardTools(tools, call);
}

export const searchLibraryTool = (
  search: (q: string) => Promise<MergedSearchResponse>,
): McpTool =>
  defineTool({
    name: 'search_library',
    title: 'Search the library',
    description:
      'Search the whole library at once: books, scanned notebook pages, the reading rack and the knowledge base. Each collection ranks by its own full-text plus semantic search, and the lists are merged by reciprocal rank fusion, best first. A hit has kind (book | notebook | article | kb), id, title, an optional subtitle and snippet, and href, a path on library.rainforest.tools. sources says which collections answered; one that is down is left out and the rest still answer. Use list_books or get_notebook_pages for more on a book or notebook hit.',
    input: {
      query: z.string().trim().min(1).max(LIBRARY_SEARCH_MAX_QUERY),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: ({ query }) => search(query),
  });

/** `search_library`, then the book and notebook tools, forwarded to the apps that run them. */
export function libraryTools(
  env: Env,
  {
    search = (q: string) => searchLibrary(q, env),
    fetch: fetchImpl,
  }: {
    search?: (q: string) => Promise<MergedSearchResponse>;
    fetch?: typeof fetch;
  } = {},
): McpTool[] {
  return [
    searchLibraryTool(search),
    ...forwardedTools('books', env, fetchImpl),
    ...forwardedTools('notebooks', env, fetchImpl),
  ];
}

export function libraryMcpHandler(
  env: Env,
  options?: Parameters<typeof libraryTools>[1],
): (request: Request) => Promise<Response> {
  const tools = libraryTools(env, options);
  return createMcpFetchHandler(
    MCP_SERVER,
    (server) =>
      registerTools(server, tools, {
        onCall: ({ tool, user, ok, ms, error }) => {
          if (!ok)
            console.warn(
              `[hall] mcp ${tool} by ${user ?? '?'} failed after ${Math.round(ms)} ms: ${String(error)}`,
            );
        },
      }),
    {
      auth: gatewayAuth({
        header: GATEWAY_HEADER,
        secret: env[SECRET_ENV],
        userHeader: LOGIN_HEADER,
      }),
    },
  );
}
