import { liveNotebookApi, notebookMcpHandler } from '@/lib/server/mcp';

let handler: ((request: Request) => Promise<Response>) | undefined;

export const POST = (request: Request): Promise<Response> =>
  (handler ??= notebookMcpHandler(process.env, liveNotebookApi))(request);
