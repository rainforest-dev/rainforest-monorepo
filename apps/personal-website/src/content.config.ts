import { tags } from '@utils/constants';
import { supportedLngs } from '@utils/i18n';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection, reference } from 'astro:content';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string(),
    author: reference('authors'),
    image: z
      .object({
        src: z.string(),
        alt: z.string(),
      })
      .optional(),
    tags: z.array(z.string()),
    relatedPosts: z.array(reference('blog')).default([]),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/authors' }),
  schema: z.object({
    name: z.string(),
    portfolio: z.url(),
  }),
});

// These four collections' data files live in libs/personal-data/src/data/* now (moved
// there, not duplicated, by the companion personal-data-library plan) — only the loader's
// `base` changed to point at the new location. Everything else (schema, reference() calls,
// Astro's own render() pipeline for the markdown body) is unchanged from before that move:
// the homepage (pages/[lang]/index.astro), the home experiences components, and the
// resume's ats-friendly.astro all still render this content exactly as they did, through
// Astro's own content-collection system. libs/personal-data (via its plain fs-based
// loader.ts) and this file are independent readers of the same underlying files — not a
// duplicated copy of the data, just two access paths to one source of truth.
const organizations = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: '../../libs/personal-data/src/data/organizations',
  }),
  schema: z.object({
    name: z.string(),
    language: z.enum(supportedLngs),
    department: z.string().optional(),
    link: z.url().optional(),
  }),
});

const experiences = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: '../../libs/personal-data/src/data/experiences',
  }),
  schema: z.object({
    type: z.enum(tags.experience),
    language: z.enum(supportedLngs),
    organization: reference('organizations'),
    position: z.string(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional(),
    technologies: z.array(z.enum(tags.skills)).default([]),
    projects: z.array(reference('projects')).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: '../../libs/personal-data/src/data/projects',
  }),
  schema: z.object({
    name: z.string(),
    language: z.enum(supportedLngs),
    technologies: z.array(z.enum(tags.skills)),
    organization: reference('organizations'),
    experience: reference('experiences'),
    featured: z.boolean().default(false),
    order: z.number().optional(),
  }),
});

const skills = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: '../../libs/personal-data/src/data/skills',
  }),
  schema: z.object({
    name: z.string(),
    icon: z.enum(tags.skills),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = {
  blog,
  authors,
  organizations,
  experiences,
  projects,
  skills,
};
