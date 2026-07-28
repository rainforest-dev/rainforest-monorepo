import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getExperienceById,
  getProjectById,
} from '@rainforest-dev/personal-data';
import { hasCaseStudy } from '@rainforest-dev/personal-portfolio/content';
import { info } from '@utils/constants';
import { getEntry } from 'astro:content';

import { PROFILE_TOOLS } from './catalog';

// Derived, not repeated. This list previously duplicated every name and description by hand
// alongside the registrations below; llms.txt.ts reads it via handler.ts's composed MCP_TOOLS.
export const PROFILE_MCP_TOOLS = PROFILE_TOOLS.map(({ name, description }) => ({
  name,
  description,
})) as ReadonlyArray<{ name: string; description: string }>;

// Same rationale as PROFILE_MCP_TOOLS, for the resource URI templates registered below. `{+id}`
// (RFC 6570 reserved expansion), not `{id}` — our ids contain slashes (e.g. `en/6`), and
// plain `{id}` expansion only matches a single path segment, so this is the real template
// clients need, not a simplified display form.
export const PROFILE_MCP_RESOURCES = [
  {
    uriTemplate: 'profile://experience/{+id}',
    title: 'Work/Education Experience',
  },
  { uriTemplate: 'profile://project/{+id}', title: 'Project' },
  { uriTemplate: 'profile://skill/{+id}', title: 'Skill' },
] as const;

const [experienceResource, projectResource, skillResource] =
  PROFILE_MCP_RESOURCES;

/**
 * Registers the profile tools/resources (profile summary, work experience, education,
 * projects, skills, technology search) on an MCP server. Stays in the app rather than moving
 * to a shared lib because the skill resource reads through `astro:content`'s `getEntry`,
 * which only resolves inside the Astro runtime.
 */
export function registerProfileMcp(server: McpServer): void {
  for (const tool of PROFILE_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.params },
      // The envelope is the MCP surface's concern, not the catalog's — `run` returns plain data.
      async (args) => ({
        content: [
          { type: 'text', text: JSON.stringify(await tool.run(args as never)) },
        ],
      }),
    );
  }

  // experience/project resources return the same *resolved* shape as the tools above
  // (resolved organization, merged technologies) — not a raw content-collection entry.
  // A raw entry's `organization` field is an unresolved `{id, collection}` pointer the
  // client has no way to dereference itself (there's no `profile://organization/{id}`
  // resource), so returning it as-is would be a dead end, not just "a different view".
  server.registerResource(
    'experience',
    new ResourceTemplate(experienceResource.uriTemplate, { list: undefined }),
    { title: experienceResource.title, mimeType: 'application/json' },
    async (uri, { id }) => {
      const experience = await getExperienceById(id as string);
      if (!experience) throw new Error(`Experience not found: ${id}`);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(experience) }],
      };
    },
  );

  server.registerResource(
    'project',
    new ResourceTemplate(projectResource.uriTemplate, { list: undefined }),
    { title: projectResource.title, mimeType: 'application/json' },
    async (uri, { id }) => {
      const project = await getProjectById(id as string);
      if (!project) throw new Error(`Project not found: ${id}`);
      // `id` is `<lang>/<slug>` (e.g. `en/hoogii-wallet`) — the slug is the last segment,
      // and doubles as the portfolio lib's case-study registry key.
      const slug = project.id.split('/').pop();
      const caseStudyUrl =
        slug && hasCaseStudy(slug)
          ? `${info.links.website}/portfolio/${slug}`
          : undefined;
      return {
        contents: [
          { uri: uri.href, text: JSON.stringify({ ...project, caseStudyUrl }) },
        ],
      };
    },
  );

  server.registerResource(
    'skill',
    new ResourceTemplate(skillResource.uriTemplate, { list: undefined }),
    { title: skillResource.title, mimeType: 'application/json' },
    async (uri, { id }) => {
      const entry = await getEntry('skills', id as string);
      if (!entry) throw new Error(`Skill not found: ${id}`);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(entry.data) }],
      };
    },
  );
}
