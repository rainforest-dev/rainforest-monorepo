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

// Single source of truth for each tool's name/description — server.registerTool below reads
// from these instead of repeating the strings, and llms.txt.ts imports MCP_TOOLS to describe
// this server's capabilities without maintaining a second, hand-written copy of the same list
// that could silently drift out of sync if a tool were renamed/added/removed here.
export const MCP_TOOLS = [
  {
    name: 'get_profile_summary',
    description: 'Professional profile overview: counts and top technologies',
  },
  { name: 'get_work_experience', description: 'Work history, optionally filtered by technology' },
  { name: 'get_education', description: 'Academic background' },
  {
    name: 'get_projects',
    description: 'Portfolio projects, optionally filtered by technology',
  },
  { name: 'get_skills', description: 'Technical skills inventory' },
  {
    name: 'search_by_technology',
    description: 'Substring-match a technology name across all experiences and projects',
  },
] as const;

// Same rationale as MCP_TOOLS, for the resource URI templates registered below. `{+id}`
// (RFC 6570 reserved expansion), not `{id}` — our ids contain slashes (e.g. `en/6`), and
// plain `{id}` expansion only matches a single path segment, so this is the real template
// clients need, not a simplified display form.
export const MCP_RESOURCES = [
  { uriTemplate: 'profile://experience/{+id}', title: 'Work/Education Experience' },
  { uriTemplate: 'profile://project/{+id}', title: 'Project' },
  { uriTemplate: 'profile://skill/{+id}', title: 'Skill' },
] as const;

const [profileSummaryTool, workExperienceTool, educationTool, projectsTool, skillsTool, searchTool] =
  MCP_TOOLS;
const [experienceResource, projectResource, skillResource] = MCP_RESOURCES;

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
        profileSummaryTool.name,
        { description: profileSummaryTool.description, inputSchema: { lang: langSchema } },
        async ({ lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await getProfileSummary({ lang })) }],
        }),
      );

      server.registerTool(
        workExperienceTool.name,
        {
          description: workExperienceTool.description,
          inputSchema: { technology: technologySchema, lang: langSchema },
        },
        async ({ technology, lang }) => ({
          content: [
            { type: 'text', text: JSON.stringify(await getWorkExperience({ technology, lang })) },
          ],
        }),
      );

      server.registerTool(
        educationTool.name,
        { description: educationTool.description, inputSchema: { lang: langSchema } },
        async ({ lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await getEducation({ lang })) }],
        }),
      );

      server.registerTool(
        projectsTool.name,
        {
          description: projectsTool.description,
          inputSchema: { technology: technologySchema, lang: langSchema },
        },
        async ({ technology, lang }) => ({
          content: [
            { type: 'text', text: JSON.stringify(await getProjects({ technology, lang })) },
          ],
        }),
      );

      server.registerTool(
        skillsTool.name,
        { description: skillsTool.description, inputSchema: { lang: langSchema } },
        async ({ lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await getSkills({ lang })) }],
        }),
      );

      server.registerTool(
        searchTool.name,
        { description: searchTool.description, inputSchema: { query: z.string(), lang: langSchema } },
        async ({ query, lang }) => ({
          content: [{ type: 'text', text: JSON.stringify(await searchByTechnology(query, { lang })) }],
        }),
      );

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
          return { contents: [{ uri: uri.href, text: JSON.stringify(experience) }] };
        },
      );

      server.registerResource(
        'project',
        new ResourceTemplate(projectResource.uriTemplate, { list: undefined }),
        { title: projectResource.title, mimeType: 'application/json' },
        async (uri, { id }) => {
          const project = await getProjectById(id as string);
          if (!project) throw new Error(`Project not found: ${id}`);
          return { contents: [{ uri: uri.href, text: JSON.stringify(project) }] };
        },
      );

      server.registerResource(
        'skill',
        new ResourceTemplate(skillResource.uriTemplate, { list: undefined }),
        { title: skillResource.title, mimeType: 'application/json' },
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
