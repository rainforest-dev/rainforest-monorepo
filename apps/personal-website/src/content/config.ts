import { z, defineCollection, reference } from 'astro:content';

import { glob, file } from 'astro/loaders';

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

export const collections = {
  blog,
  authors,
};
