// These schemas are mirrored in apps/personal-website/src/content.config.ts (same shape,
// but using Astro's `reference()` helper for the organization/project/experience fields
// instead of the plain strings used here — Astro's content-collection references can't be
// shared with this framework-agnostic library, so the two definitions can't be unified).
// apps/personal-website's collections read the same underlying files as this library (see
// content.config.ts's own comment for why they weren't consolidated into one reader), so
// if the content shape changes here, update content.config.ts's schemas to match, and
// vice versa.
import { z } from 'zod';

import { experienceTypes, locales, skillTags } from './vocab';

export const organizationSchema = z.object({
  name: z.string(),
  language: z.enum(locales),
  department: z.string().optional(),
  link: z.string().url().optional(),
});

export const experienceSchema = z.object({
  type: z.enum(experienceTypes),
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
