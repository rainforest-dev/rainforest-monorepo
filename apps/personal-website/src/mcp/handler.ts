import { PORTFOLIO_MCP_RESOURCES, PORTFOLIO_MCP_TOOLS, registerPortfolioMcp } from '@rainforest-dev/portfolio/mcp';
import { createMcpHandler } from 'mcp-handler';

import { PROFILE_MCP_RESOURCES, PROFILE_MCP_TOOLS, registerProfileMcp } from './profile';

// Composition root: each domain contributes its own tool/resource registrations —
// registerProfileMcp here (stays in the app; depends on astro:content), registerPortfolioMcp
// from @rainforest-dev/portfolio/mcp (sources its own typed content, no astro:content).
// MCP_TOOLS/MCP_RESOURCES stay the single source of truth llms.txt.ts / llms-full.txt.ts
// read from to describe this server's capabilities.
export const MCP_TOOLS = [...PROFILE_MCP_TOOLS, ...PORTFOLIO_MCP_TOOLS];
export const MCP_RESOURCES = [...PROFILE_MCP_RESOURCES, ...PORTFOLIO_MCP_RESOURCES];

/**
 * Builds an MCP request handler mounted at `${basePath}/mcp` — mcp-handler validates the
 * incoming request's pathname against exactly that computed endpoint (see its
 * `deriveEndpointsFromBasePath`), so basePath must match wherever the caller actually
 * mounts the returned handler (e.g. '/api' for a route at src/pages/api/mcp.ts, or
 * omitted/'' for one at src/pages/mcp.ts). Each call creates an independent handler/server
 * instance — this exists so apps/personal-website can serve the same MCP tool surface at
 * more than one path without relying on vercel.json's host-based rewrite, which doesn't
 * reliably take effect ahead of Astro's own generated routing (see the routing-fix PR).
 */
export function createProfileMcpHandler(basePath?: string) {
  return createMcpHandler(
    (server) => {
      registerProfileMcp(server);
      registerPortfolioMcp(server);
    },
    {},
    { basePath },
  );
}
