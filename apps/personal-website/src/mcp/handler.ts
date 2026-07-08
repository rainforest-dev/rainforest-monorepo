import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getEducation,
  getExperienceById,
  getProfileSummary,
  getProjectById,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from '@rainforest-dev/personal-data';
import type { SkillTag } from '@types';
import { tags } from '@utils/constants';
import { getEntry } from 'astro:content';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

const langSchema = z.enum(['en', 'zh']).optional();
// Derived from the same tags.skills vocabulary the content schemas use (content.config.ts),
// rather than a plain z.string() — this makes the parsed value a real SkillTag, not just a
// string, so the tool handlers below no longer need an `as any` cast to call getWorkExperience/
// getProjects (which require SkillTag, not string).
const technologySchema = z.enum(tags.skills as unknown as [SkillTag, ...SkillTag[]]).optional();

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
      server.registerTool(
        'get_profile_summary',
        {
          description: 'Professional profile overview: counts and top technologies',
          inputSchema: { lang: langSchema },
        },
        async ({ lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await getProfileSummary({ lang })) }],
        }),
      );

      server.registerTool(
        'get_work_experience',
        {
          description: 'Work history, optionally filtered by technology',
          inputSchema: { technology: technologySchema, lang: langSchema },
        },
        async ({ technology, lang }) => ({
          content: [
            { type: 'text', text: JSON.stringify(await getWorkExperience({ technology, lang })) },
          ],
        }),
      );

      server.registerTool(
        'get_education',
        { description: 'Academic background', inputSchema: { lang: langSchema } },
        async ({ lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await getEducation({ lang })) }],
        }),
      );

      server.registerTool(
        'get_projects',
        {
          description: 'Portfolio projects, optionally filtered by technology',
          inputSchema: { technology: technologySchema, lang: langSchema },
        },
        async ({ technology, lang }) => ({
          content: [
            { type: 'text', text: JSON.stringify(await getProjects({ technology, lang })) },
          ],
        }),
      );

      server.registerTool(
        'get_skills',
        { description: 'Technical skills inventory', inputSchema: { lang: langSchema } },
        async ({ lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await getSkills({ lang })) }],
        }),
      );

      server.registerTool(
        'search_by_technology',
        {
          description: 'Substring-match a technology name across all experiences and projects',
          inputSchema: { query: z.string(), lang: langSchema },
        },
        async ({ query, lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await searchByTechnology(query, { lang })) }],
        }),
      );

      // `{+id}` (RFC 6570 reserved expansion) is required, not `{id}` — our ids contain
      // slashes (e.g. `en/6`), and plain `{id}` expansion only matches a single path segment.
      //
      // experience/project resources return the same *resolved* shape as the tools above
      // (resolved organization, merged technologies) — not a raw content-collection entry.
      // A raw entry's `organization` field is an unresolved `{id, collection}` pointer the
      // client has no way to dereference itself (there's no `profile://organization/{id}`
      // resource), so returning it as-is would be a dead end, not just "a different view".
      server.registerResource(
        'experience',
        new ResourceTemplate('profile://experience/{+id}', { list: undefined }),
        { title: 'Work/Education Experience', mimeType: 'application/json' },
        async (uri, { id }) => {
          const experience = await getExperienceById(id as string);
          if (!experience) throw new Error(`Experience not found: ${id}`);
          return { contents: [{ uri: uri.href, text: JSON.stringify(experience) }] };
        },
      );

      server.registerResource(
        'project',
        new ResourceTemplate('profile://project/{+id}', { list: undefined }),
        { title: 'Project', mimeType: 'application/json' },
        async (uri, { id }) => {
          const project = await getProjectById(id as string);
          if (!project) throw new Error(`Project not found: ${id}`);
          return { contents: [{ uri: uri.href, text: JSON.stringify(project) }] };
        },
      );

      server.registerResource(
        'skill',
        new ResourceTemplate('profile://skill/{+id}', { list: undefined }),
        { title: 'Skill', mimeType: 'application/json' },
        async (uri, { id }) => {
          const entry = await getEntry('skills', id as string);
          if (!entry) throw new Error(`Skill not found: ${id}`);
          return { contents: [{ uri: uri.href, text: JSON.stringify(entry.data) }] };
        },
      );
    },
    {},
    { basePath },
  );
}
