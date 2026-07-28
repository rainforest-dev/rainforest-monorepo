// The single source of truth for the technology/experience-type/locale vocabulary
// used both by this library's own Zod schemas and by apps/personal-website's UI
// (which imports these arrays via @rainforest-dev/personal-data instead of
// defining them locally — see docs/superpowers/specs/2026-07-07-personal-mcp-split-design.md §3).
export const skillTags = [
  'nextjs',
  'vue',
  'docker',
  'flutter',
  'react',
  'tailwindcss',
  'mui',
  'auth0',
  'qwik',
  'playwright',
  'vitest',
  'python',
  'pytorch',
  'fastapi',
  'swift',
  'github-actions',
  'nodejs',
  'nx',
  'vite',
  'typescript',
  'express',
  'terraform',
] as const;

export const experienceTypes = ['job', 'education'] as const;

// Distinguishes substantive employment from student-era internships/assistantships. Only
// `full-time` entries count toward the years-of-experience figure the hero renders, so the
// public number matches how a résumé screen counts it rather than spanning back to the first
// student role. Defaults to `full-time` — tag the exceptions, not the norm.
export const employmentTypes = ['full-time', 'internship'] as const;

export const locales = ['en', 'zh'] as const;

export type SkillTag = (typeof skillTags)[number];
export type ExperienceType = (typeof experienceTypes)[number];
export type EmploymentType = (typeof employmentTypes)[number];
export type Locale = (typeof locales)[number];
