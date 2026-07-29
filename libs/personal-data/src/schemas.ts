// These schemas are mirrored in apps/personal-website/src/content.config.ts (same shape,
// but using Astro's `reference()` helper for the organization/project/experience fields
// instead of the plain strings used here — Astro's content-collection references can't be
// shared with this framework-agnostic library, so the two definitions can't be unified).
// apps/personal-website's collections read the same underlying files as this library (see
// content.config.ts's own comment for why they weren't consolidated into one reader), so
// if the content shape changes here, update content.config.ts's schemas to match, and
// vice versa.
// The `/v4` subpath, not the package root: zod@3.25 ships BOTH implementations, and the root
// resolves to the classic v3 one. This library is bundled into the browser alongside
// apps/personal-website's MCP catalog, which needs v4's `z.toJSONSchema` — importing the root
// here put two entire copies of Zod in the client chunk. Keep this and ./loader.ts on the same
// subpath: a v4 error is not `instanceof` v3's `ZodError`, so a split would break loader.ts's
// error wrapping without failing to compile.
import { z } from 'zod/v4';

import { employmentTypes, experienceTypes, locales, skillTags } from './vocab';

export const organizationSchema = z.object({
  name: z.string(),
  language: z.enum(locales),
  department: z.string().optional(),
  link: z.string().url().optional(),
});

export const experienceSchema = z.object({
  type: z.enum(experienceTypes),
  employment: z.enum(employmentTypes).default('full-time'),
  language: z.enum(locales),
  organization: z.string(),
  position: z.string(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  technologies: z.array(z.enum(skillTags)).default([]),
  projects: z.array(z.string()).default([]),
});

export const projectSchema = z.object({
  name: z.string(),
  language: z.enum(locales),
  technologies: z.array(z.enum(skillTags)),
  organization: z.string(),
  experience: z.string(),
  // Sort key for the portfolio index (newest first). Required on purpose: a project with no
  // date can't be ordered, and defaulting one in would silently bury it at the end. The
  // case-study `period` strings in @rainforest-dev/personal-portfolio are display copy
  // ("2024 — Present", with inconsistent dashes) and deliberately not parsed for this.
  startAt: z.coerce.date(),
  featured: z.boolean().default(false),
  order: z.number().optional(),
});

export const skillSchema = z.object({
  name: z.string(),
  icon: z.enum(skillTags),
  tags: z.array(z.string()).default([]),
});

export type OrganizationData = z.infer<typeof organizationSchema>;
export type ExperienceData = z.infer<typeof experienceSchema>;
export type ProjectData = z.infer<typeof projectSchema>;
export type SkillData = z.infer<typeof skillSchema>;
