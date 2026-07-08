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

export const locales = ['en', 'zh'] as const;

export type SkillTag = (typeof skillTags)[number];
export type ExperienceType = (typeof experienceTypes)[number];
export type Locale = (typeof locales)[number];
