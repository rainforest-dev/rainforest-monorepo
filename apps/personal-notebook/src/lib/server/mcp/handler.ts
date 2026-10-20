import {
  createMcpFetchHandler,
  gatewayAuth,
  registerTools,
} from '@rainforest-dev/mcp-kit';
import {
  type NotebookToolApi,
  notebookTools,
} from '@rainforest-dev/notebook-tools';

import { auditCall } from './audit';

/** Calibre forwards its notebook tools here with this header; nothing else should reach it. */
export const GATEWAY_HEADER = 'x-notebook-gateway';
export const LOGIN_HEADER = 'x-forwarded-login';
export const SECRET_ENV = 'NOTEBOOK_MCP_SECRET';
export const MCP_SERVER = { name: 'notebook-mcp', version: '0.1.0' };

/** Answers 404 while `NOTEBOOK_MCP_SECRET` is unset, and 401 without the matching header. */
export function notebookMcpHandler(
  env: Record<string, string | undefined>,
  api: NotebookToolApi,
  write?: (line: string) => void,
): (request: Request) => Promise<Response> {
  const tools = notebookTools(api);
  const onCall = auditCall(write);
  return createMcpFetchHandler(
    MCP_SERVER,
    (server) => registerTools(server, tools, { onCall }),
    {
      auth: gatewayAuth({
        header: GATEWAY_HEADER,
        secret: env[SECRET_ENV],
        userHeader: LOGIN_HEADER,
      }),
    },
  );
}
