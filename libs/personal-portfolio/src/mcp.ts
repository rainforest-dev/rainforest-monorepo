import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getCaseStudy } from './content';
import type { CaseStudy } from './content/types';

// Same rationale as apps/personal-website/src/mcp/profile.ts's PROFILE_MCP_TOOLS/
// PROFILE_MCP_RESOURCES: single source of truth for name/description/URI template, read by
// both registerPortfolioMcp below and the app's llms.txt.ts (via handler.ts's composed
// MCP_TOOLS/MCP_RESOURCES) so the two can't drift out of sync.
export const PORTFOLIO_MCP_RESOURCES = [
  { uriTemplate: 'portfolio://case-study/{+slug}', title: 'Case study' },
] as const;
export const PORTFOLIO_MCP_TOOLS = [
  { name: 'get_case_study', description: 'Full interactive case study for a project slug' },
] as const;

const [caseStudyResourceDef] = PORTFOLIO_MCP_RESOURCES;
const [getCaseStudyTool] = PORTFOLIO_MCP_TOOLS;

/**
 * Looks up a case study by slug, throwing (rather than returning undefined) when it's
 * missing — both the resource reader and the tool handler below need that same
 * not-found-is-an-error behavior, so it's centralized here instead of duplicated at each
 * call site.
 */
export function caseStudyResource(slug: string): CaseStudy {
  const study = getCaseStudy(slug);
  if (!study) throw new Error(`Case study not found: ${slug}`);
  return study;
}

/**
 * Registers the portfolio case-study resource + tool on an MCP server. Sources its data
 * from this lib's own typed content registry (libs/personal-portfolio/src/content) — no astro:content
 * dependency, unlike apps/personal-website/src/mcp/profile.ts's skill resource — so this can
 * be composed into any host's MCP server, not just the Astro app's.
 */
export function registerPortfolioMcp(server: McpServer): void {
  server.registerResource(
    'case-study',
    new ResourceTemplate(caseStudyResourceDef.uriTemplate, { list: undefined }),
    { title: caseStudyResourceDef.title, mimeType: 'application/json' },
    async (uri, { slug }) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(caseStudyResource(slug as string)) }],
    }),
  );

  server.registerTool(
    getCaseStudyTool.name,
    { description: getCaseStudyTool.description, inputSchema: { slug: z.string() } },
    async ({ slug }) => ({
      content: [{ type: 'text', text: JSON.stringify(caseStudyResource(slug)) }],
    }),
  );
}
