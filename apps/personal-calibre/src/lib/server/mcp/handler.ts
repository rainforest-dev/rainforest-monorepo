import {
  createMcpFetchHandler,
  gatewayAuth,
  registerTools,
} from '@rainforest-dev/mcp-kit';

import { auditCall } from './audit';
import { type CalibreLibrary, calibreTools } from './tools';

export const GATEWAY_HEADER = 'x-calibre-gateway';
export const LOGIN_HEADER = 'x-forwarded-login';
export const SECRET_ENV = 'CALIBRE_MCP_SECRET';
export const MCP_SERVER = { name: 'calibre-mcp', version: '0.2.0' };

export function calibreMcpHandler(
  env: Record<string, string | undefined>,
  library: CalibreLibrary,
  write?: (line: string) => void,
): (request: Request) => Promise<Response> {
  const tools = calibreTools(library);
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
