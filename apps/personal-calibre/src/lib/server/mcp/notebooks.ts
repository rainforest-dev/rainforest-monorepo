import {
  forwardTools,
  httpToolCaller,
  type McpTool,
  type RemoteToolCall,
  ToolInputError,
} from '@rainforest-dev/mcp-kit';
import { NOTEBOOK_TOOL_DEFINITIONS } from '@rainforest-dev/notebook-tools';

/** The header and secret personal-notebook's `/notebooks/mcp` checks. */
export const NOTEBOOK_GATEWAY_HEADER = 'x-notebook-gateway';
export const NOTEBOOK_URL_ENV = 'NOTEBOOK_INTERNAL_URL';
export const NOTEBOOK_SECRET_ENV = 'NOTEBOOK_MCP_SECRET';

const unconfigured: RemoteToolCall = async (name) => {
  throw new ToolInputError(
    `${name}: notebooks moved to personal-notebook, and this server has no ${NOTEBOOK_URL_ENV} and ${NOTEBOOK_SECRET_ENV} to reach it`,
  );
};

/**
 * The nine notebook tools, run by personal-notebook. Calibre still lists them so a client keeps
 * one server; each call goes to `<NOTEBOOK_INTERNAL_URL>/mcp` with the caller's login under
 * `userHeader`. Unconfigured, the tools stay listed and every call says why it cannot run.
 */
export function notebookToolsFromEnv(
  env: Record<string, string | undefined>,
  {
    userHeader,
    fetch: fetchImpl,
  }: { userHeader: string; fetch?: typeof fetch },
): McpTool[] {
  const base = env[NOTEBOOK_URL_ENV]?.trim().replace(/\/+$/, '');
  const secret = env[NOTEBOOK_SECRET_ENV]?.trim();
  const call =
    base && secret
      ? httpToolCaller({
          url: `${base}/mcp`,
          headers: { [NOTEBOOK_GATEWAY_HEADER]: secret },
          userHeader,
          ...(fetchImpl && { fetch: fetchImpl }),
        })
      : unconfigured;
  return forwardTools(NOTEBOOK_TOOL_DEFINITIONS, call);
}
