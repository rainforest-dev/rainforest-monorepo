import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

import {
  getEducation,
  getProfileSummary,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from '../../mcp/profile-data';

const langSchema = z.enum(['en', 'zh']).optional();
const technologySchema = z.string().optional();

const handler = createMcpHandler(
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
          { type: 'text', text: JSON.stringify(await getWorkExperience({ technology: technology as any, lang })) },
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
          { type: 'text', text: JSON.stringify(await getProjects({ technology: technology as any, lang })) },
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
    server.registerResource(
      'experience',
      new ResourceTemplate('profile://experience/{+id}', { list: undefined }),
      { title: 'Work/Education Experience', mimeType: 'application/json' },
      async (uri, { id }) => {
        const entry = await getEntry('experiences', id as string);
        if (!entry) throw new Error(`Experience not found: ${id}`);
        return { contents: [{ uri: uri.href, text: JSON.stringify(entry.data) }] };
      },
    );

    server.registerResource(
      'project',
      new ResourceTemplate('profile://project/{+id}', { list: undefined }),
      { title: 'Project', mimeType: 'application/json' },
      async (uri, { id }) => {
        const entry = await getEntry('projects', id as string);
        if (!entry) throw new Error(`Project not found: ${id}`);
        return { contents: [{ uri: uri.href, text: JSON.stringify(entry.data) }] };
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
  { basePath: '/api' },
);

// Stateless, POST-only per the design spec — same rationale as Task 4's spike.
export const POST: APIRoute = ({ request }) => handler(request);
