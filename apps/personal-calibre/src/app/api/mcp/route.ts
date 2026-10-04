import { calibreMcpHandler, liveLibrary } from '@/lib/server/mcp';

let handler: ((request: Request) => Promise<Response>) | undefined;

export const POST = (request: Request): Promise<Response> =>
  (handler ??= calibreMcpHandler(process.env, liveLibrary))(request);
