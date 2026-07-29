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

/**
 * Ties `run`'s argument shape and `summarise`'s `result` type to `params`, per call site.
 *
 * Without this, `params`, `run`, and `summarise` below are three independently-typed object
 * properties with no relationship enforced between them — `ProfileTool.run` is erased to
 * `(args: Record<string, never>) => Promise<unknown>`, so renaming a `params` key while leaving
 * `run`'s destructuring untouched compiles cleanly. The tool then advertises and validates the
 * new key, the handler destructures the old one and gets `undefined`, and it fails silently
 * (e.g. an unrecognised filter is just ignored, returning unfiltered results) — no type error,
 * no runtime error, nothing to catch it in review. `S`/`R` here are inferred fresh per
 * `defineTool(...)` call from `params` and `run`'s actual return value, so `run`'s parameter and
 * `summarise`'s `result` are checked against that call's own `params`/`run`, not the erased
 * common shape. The `as unknown as ProfileTool` on return is what erases back to that common
 * shape so heterogeneous entries can still collect into one `ProfileTool[]`.
 */
function defineTool<S extends z.ZodRawShape, R>(tool: {
  name: string;
  description: string;
  params: S;
  run: (args: z.infer<z.ZodObject<S>>) => Promise<R>;
  summarise: (result: R, args: z.infer<z.ZodObject<S>>) => string | null;
}): ProfileTool {
  return tool as unknown as ProfileTool;
}

export const PROFILE_TOOLS: ProfileTool[] = [
  defineTool({
    name: 'get_profile_summary',
    description: 'Professional profile overview: counts and top technologies',
    params: { lang: langSchema },
    run: ({ lang }) => getProfileSummary({ lang }),
    summarise: (result) =>
      `${plural(result.experienceCount, 'role', 'roles')} and ${plural(result.projectCount, 'project', 'projects')} on record.`,
  }),
  defineTool({
    name: 'get_work_experience',
    description: 'Work history, optionally filtered by technology',
    params: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getWorkExperience({ technology, lang }),
    summarise: (result, { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'role', 'roles')}.`
        : `${plural(count(result), 'role', 'roles')} on record.`,
  }),
  defineTool({
    name: 'get_education',
    description: 'Academic background',
    params: { lang: langSchema },
    run: ({ lang }) => getEducation({ lang }),
    summarise: (result) =>
      `${plural(count(result), 'qualification', 'qualifications')} on record.`,
  }),
  defineTool({
    name: 'get_projects',
    description: 'Portfolio projects, optionally filtered by technology',
    params: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getProjects({ technology, lang }),
    summarise: (result, { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'project', 'projects')}.`
        : `${plural(count(result), 'project', 'projects')} on record.`,
  }),
  defineTool({
    name: 'get_skills',
    description: 'Technical skills inventory',
    params: { lang: langSchema },
    run: ({ lang }) => getSkills({ lang }),
    summarise: (result) =>
      `${plural(count(result), 'skill', 'skills')} listed.`,
  }),
  defineTool({
    name: 'search_by_technology',
    description:
      'Substring-match a technology name across all experiences and projects',
    params: { query: z.string(), lang: langSchema },
    run: ({ query, lang }) => searchByTechnology(query, { lang }),
    summarise: (result, { query }) => {
      const total = count(result.experiences) + count(result.projects);
      return total === 0
        ? `No records mention ${query}.`
        : `${query} appears in ${plural(count(result.experiences), 'role', 'roles')} and ${plural(count(result.projects), 'project', 'projects')}.`;
    },
  }),
];

/**
 * Adapter for the palette and WebMCP: JSON Schema instead of Zod, plain data instead of an
 * MCP envelope. `inputSchema` is the same shape `selectTool()` passes as `responseConstraint`
 * and the same shape WebMCP's `registerTool()` expects.
 *
 * `execute` parses `input` against `params` before calling `run`. The MCP path doesn't need
 * this — `server.registerTool` already validates through the SDK's own zod-compat layer — but
 * this path feeds arguments a browser's on-device model produced from `inputSchema` as a
 * `responseConstraint`, and a model can accept a response schema and still not honour it.
 * Without this parse, a malformed arg reaches `run` (and the data layer) as `undefined` or the
 * wrong type instead of being rejected here.
 */
export function toToolDescriptors(): ToolDescriptor[] {
  return PROFILE_TOOLS.map((tool) => {
    const schema = z.object(tool.params);
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(schema) as Record<string, unknown>,
      execute: async (input) => tool.run(schema.parse(input) as never),
    };
  });
}
