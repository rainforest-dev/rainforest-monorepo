import { z, defineCollection } from 'astro:content';

const projectsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    description: z.string(),
    preview: z.object({
      src: z.string(),
      alt: z.string(),
    }),
    from: z.date(),
    to: z.optional(z.date()),
    tags: z.array(z.string()),
  }),
});

export const collections = {
  projects: projectsCollection,
};
