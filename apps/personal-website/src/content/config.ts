import { tags } from '@utils/constants';
import { supportedLngs } from '@utils/i18n';
import { glob } from 'astro/loaders';
import { defineCollection, reference, z } from 'astro:content';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/blog' }),
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
    portfolio: z.string().url(),
  }),
});

const organizations = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/organizations' }),
  schema: z.object({
    name: z.string(),
    languages: z.enum(supportedLngs),
    department: z.string().optional(),
    link: z.string().url().optional(),
  }),
});

const experiences = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/experiences' }),
  schema: z.object({
    type: z.enum(['education', 'job']),
    organization: reference('organizations'),
    position: z.string(),
    startAt: z.string(),
    endAt: z.string().optional(),
    description: z.array(z.string()).optional(),
    technologies: z.array(z.enum(tags.skills)).optional(),
    projects: z.array(reference('projects')).optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/projects' }),
  schema: z.object({
    name: z.string(),
    languages: z.enum(supportedLngs),
    description: z.array(z.string()),
    technologies: z.array(z.enum(tags.skills)),
    organization: reference('organizations'),
    experience: reference('experiences'),
  }),
});

export const collections = {
  blog,
  authors,
  organizations,
  experiences,
  projects,
};
