import { libraryMcpHandler } from '@/lib/server';

let handler: ((request: Request) => Promise<Response>) | undefined;

/** `POST /api/mcp`: the library MCP server, reached only through the OAuth gateway. */
export const POST = (request: Request): Promise<Response> =>
  (handler ??= libraryMcpHandler(process.env))(request);
