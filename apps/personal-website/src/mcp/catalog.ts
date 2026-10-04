import {
  defineTool,
  type McpTool,
  toJsonSchema,
} from '@rainforest-dev/mcp-kit/tool';
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
import { z } from 'zod';

const langSchema = z.enum(['en', 'zh']).optional();
const technologySchema = z
  .enum(tags.skills as unknown as [SkillTag, ...SkillTag[]])
  .optional();

export interface ProfileTool extends McpTool {
  summarise: (result: never, input: Record<string, never>) => string | null;
}

const count = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function defineProfileTool<I extends z.ZodRawShape, R>(tool: {
  name: string;
  description: string;
  input: I;
  run: (input: z.output<z.ZodObject<I>>) => Promise<R>;
  summarise: (result: R, input: z.output<z.ZodObject<I>>) => string | null;
}): ProfileTool {
  const { summarise, ...spec } = tool;
  return {
    ...defineTool({ ...spec, annotations: { readOnlyHint: true } }),
    summarise: summarise as unknown as ProfileTool['summarise'],
  };
}

export const PROFILE_TOOLS: ProfileTool[] = [
  defineProfileTool({
    name: 'get_profile_summary',
    description: 'Professional profile overview: counts and top technologies',
    input: { lang: langSchema },
    run: ({ lang }) => getProfileSummary({ lang }),
    summarise: (result) =>
      `${plural(result.experienceCount, 'role', 'roles')} and ${plural(result.projectCount, 'project', 'projects')} on record.`,
  }),
  defineProfileTool({
    name: 'get_work_experience',
    description: 'Work history, optionally filtered by technology',
    input: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getWorkExperience({ technology, lang }),
    summarise: (result, { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'role', 'roles')}.`
        : `${plural(count(result), 'role', 'roles')} on record.`,
  }),
  defineProfileTool({
    name: 'get_education',
    description: 'Academic background',
    input: { lang: langSchema },
    run: ({ lang }) => getEducation({ lang }),
    summarise: (result) =>
      `${plural(count(result), 'qualification', 'qualifications')} on record.`,
  }),
  defineProfileTool({
    name: 'get_projects',
    description: 'Portfolio projects, optionally filtered by technology',
    input: { technology: technologySchema, lang: langSchema },
    run: ({ technology, lang }) => getProjects({ technology, lang }),
    summarise: (result, { technology }) =>
      technology
        ? `${technology} appears in ${plural(count(result), 'project', 'projects')}.`
        : `${plural(count(result), 'project', 'projects')} on record.`,
  }),
  defineProfileTool({
    name: 'get_skills',
    description: 'Technical skills inventory',
    input: { lang: langSchema },
    run: ({ lang }) => getSkills({ lang }),
    summarise: (result) =>
      `${plural(count(result), 'skill', 'skills')} listed.`,
  }),
  defineProfileTool({
    name: 'search_by_technology',
    description:
      'Substring-match a technology name across all experiences and projects',
    input: { query: z.string(), lang: langSchema },
    run: ({ query, lang }) => searchByTechnology(query, { lang }),
    summarise: (result, { query }) => {
      const total = count(result.experiences) + count(result.projects);
      return total === 0
        ? `No records mention ${query}.`
        : `${query} appears in ${plural(count(result.experiences), 'role', 'roles')} and ${plural(count(result.projects), 'project', 'projects')}.`;
    },
  }),
];

export function toToolDescriptors(): ToolDescriptor[] {
  return PROFILE_TOOLS.map((tool) => {
    const { name, description, inputSchema } = toJsonSchema(tool);
    const schema = z.object(tool.input);
    return {
      name,
      description,
      inputSchema,
      // An on-device model can ignore the responseConstraint it was given, so parse first.
      execute: async (input) => tool.run(schema.parse(input), {}),
    };
  });
}
