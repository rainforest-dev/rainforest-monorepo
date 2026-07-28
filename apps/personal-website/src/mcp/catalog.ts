import {
  getEducation,
  getProfileSummary,
  getProjects,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from '@rainforest-dev/personal-data';
import type { SkillTag } from '@types';
import type { ToolDescriptor } from '@utils/ai';
import { tags } from '@utils/constants';
// zod@3.25 ships the v4 implementation under this subpath, with `z.toJSONSchema` available
// (unlike the classic v3 namespace at the package root). Building every schema here from this
// one import — rather than v3's `z` for `params` and v4's for JSON Schema — is what lets one
// Zod definition feed both `server.registerTool` (the MCP SDK's zod-compat layer accepts v4
// schemas directly) and `toToolDescriptors` below without a second, incompatible schema tree:
// v3- and v4-built schema instances have different internal shapes and mixing them throws at
// `toJSONSchema()` time (`Cannot read properties of undefined (reading 'def')`).
import { z } from 'zod/v4';

const langSchema = z.enum(['en', 'zh']).optional();
const technologySchema = z
  .enum(tags.skills as unknown as [SkillTag, ...SkillTag[]])
  .optional();

/**
 * One tool, defined once.
 *
 * `run` returns plain data — no MCP envelope, no formatting — so every consumer can shape it
 * for itself. `summarise` is what lets the palette show a sentence without a model writing one:
 * it composes from `run`'s actual result, so the strip cannot state something untrue.
 */
export interface ProfileTool {
  name: string;
  description: string;
  /** Zod raw shape, which is what the MCP SDK's registerTool expects. */
  params: z.ZodRawShape;
  run: (args: Record<string, never>) => Promise<unknown>;
  /** One line for the answer strip, or null when there is nothing worth saying. */
  summarise: (result: never, args: Record<string, never>) => string | null;
}

const count = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const PROFILE_TOOLS: ProfileTool[] = [
  {
    name: 'get_profile_summary',
    description: 'Professional profile overview: counts and top technologies',
    params: { lang: langSchema },
    run: ({ lang }) => getProfileSummary({ lang }),
    summarise: (result: { experienceCount: number; projectCount: number }) =>
      `${plural(result.experienceCount, 'role', 'roles')} and ${plural(result.projectCount, 'project', 'projects')} on record.`,
  },
  {
    name: 'get_work_experience',
    description: 'Work history, optionally filtered by technology',
    params: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getWorkExperience({ technology, lang }),
    summarise: (result: unknown[], { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'role', 'roles')}.`
        : `${plural(count(result), 'role', 'roles')} on record.`,
  },
  {
    name: 'get_education',
    description: 'Academic background',
    params: { lang: langSchema },
    run: ({ lang }) => getEducation({ lang }),
    summarise: (result: unknown[]) =>
      `${plural(count(result), 'qualification', 'qualifications')} on record.`,
  },
  {
    name: 'get_projects',
    description: 'Portfolio projects, optionally filtered by technology',
    params: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getProjects({ technology, lang }),
    summarise: (result: unknown[], { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'project', 'projects')}.`
        : `${plural(count(result), 'project', 'projects')} on record.`,
  },
  {
    name: 'get_skills',
    description: 'Technical skills inventory',
    params: { lang: langSchema },
    run: ({ lang }) => getSkills({ lang }),
    summarise: (result: unknown[]) =>
      `${plural(count(result), 'skill', 'skills')} listed.`,
  },
  {
    name: 'search_by_technology',
    description:
      'Substring-match a technology name across all experiences and projects',
    params: { query: z.string(), lang: langSchema },
    run: ({ query, lang }) => searchByTechnology(query, { lang }),
    summarise: (
      result: { experiences: unknown[]; projects: unknown[] },
      { query },
    ) => {
      const total = count(result.experiences) + count(result.projects);
      return total === 0
        ? `No records mention ${query}.`
        : `${query} appears in ${plural(count(result.experiences), 'role', 'roles')} and ${plural(count(result.projects), 'project', 'projects')}.`;
    },
  },
];

/**
 * Adapter for the palette and WebMCP: JSON Schema instead of Zod, plain data instead of an
 * MCP envelope. `inputSchema` is the same shape `selectTool()` passes as `responseConstraint`
 * and the same shape WebMCP's `registerTool()` expects.
 */
export function toToolDescriptors(): ToolDescriptor[] {
  return PROFILE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(z.object(tool.params)) as Record<
      string,
      unknown
    >,
    execute: tool.run as ToolDescriptor['execute'],
  }));
}
