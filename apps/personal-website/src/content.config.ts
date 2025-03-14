import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { supportedLocales } from '@rainforest-dev/personal-data';
import { glob, type LoaderContext } from 'astro/loaders';
import { defineCollection, reference, z } from 'astro:content';
import { mapKeys } from 'lodash-es';

import { tags } from './utils';

const blogs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
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
  loader: glob({ pattern: '**/*.json', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    portfolio: z.string().url(),
  }),
});

const organizations = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/organizations' }),
  schema: z.object({
    name: z.string(),
    language: z.enum(supportedLocales),
    department: z.string().optional(),
    link: z.string().url().optional(),
  }),
});

const experiences = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/experiences' }),
  schema: z.object({
    type: z.enum(tags.experience),
    language: z.enum(supportedLocales),
    organization: reference('organizations'),
    position: z.string(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional(),
    technologies: z.array(z.enum(tags.skills)).default([]),
    projects: z.array(reference('projects')).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    name: z.string(),
    language: z.enum(supportedLocales),
    technologies: z.array(z.enum(tags.skills)),
    organization: reference('organizations'),
    experience: reference('experiences'),
  }),
});

const skills = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/skills',
  }),
  schema: z.object({
    name: z.string(),
    icon: z.enum(tags.skills),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = {
  blogs,
  authors,
  organizations,
  experiences,
  projects,
  skills,
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({
    loader: async () => {
      const files = import.meta.glob('./content/i18n/**/*.json', {
        eager: true,
      }) as { [key: string]: { default: Record<string, string> } };

      const translations = Object.entries(files).reduce(
        (acc, [path, module]) => {
          // dirnames are the locales
          const locale = path.split('/').slice(-2)[0];
          // filenames are the namespaces
          const namespace = path
            .split('/')
            .slice(-1)[0]
            .replace(/\.\w+$/, '');

          const translations = mapKeys(module.default, (_, key) =>
            namespace === 'common' ? key : `${namespace}.${key}`,
          );

          return {
            ...acc,
            [locale]: {
              ...acc[locale],
              ...translations,
            },
          };
        },
        {} as Record<string, Record<string, string>>,
      );
      return translations;
    },
    // i18nLoader(),
    schema: i18nSchema({
      extend: z.object({
        en: z.string().optional(),
        zh: z.string().optional(),
        title: z.string(),
        'metadata-title': z.string(),
        'metadata-description': z.string(),
        'info-name-first_formal': z.string(),
        'info-name-last_formal': z.string(),
        'info-name-first_informal': z.string(),
        'info-name-last_informal': z.string(),
        'info-fullname_formal': z.string(),
        'info-fullname_informal': z.string(),
        'info-location_city': z.string(),
        'info-location_country': z.string(),
        'info-job-position': z.string(),
        nextjs: z.string().optional(),
        tailwindcss: z.string().optional(),
        mui: z.string().optional(),
        fastapi: z.string().optional(),
        blog: z.string(),
        resume: z.string(),
        portfolio: z.string(),
        experience: z.string(),
        skills: z.string(),
        'skills-frontend': z.string(),
        'skills-backend': z.string(),
        'skills-tools': z.string(),
        'skills-languages': z.string(),
        'skills-devops': z.string().optional(),
        resources: z.string(),
        'social-media': z.string(),
        linkedin: z.string().optional(),
        github: z.string().optional(),
        'contact-me-title': z.string(),
        'contact-me-description': z.string(),
        'contact-me-from-person': z.string(),
        'contact-me-from-company': z.string(),
        'contact-me-subject': z.string(),
        'contact-me-message': z.string(),
        'contact-me-submit': z.string(),
        'home.hero-summaries.0': z.string().optional(),
        'home.hero-summaries.1': z.string().optional(),
        'home.hero-summaries.2': z.string().optional(),
        'home.hero-summaries': z.array(z.string()),
        'home.hero-brief': z.string(),
        'home.ntu': z.string(),
        'home.ce': z.string(),
        'home.caece': z.string(),
        'home.webim': z.string(),
        'home.gss': z.string(),
        'home.jubo': z.string(),
        'home.codegreen': z.string(),
        'home.degree-bachelor': z.string(),
        'home.degree-master': z.string(),
        'home.position-rd-assistant': z.string(),
        'home.position-frontend-intern': z.string(),
        'home.position-software-intern': z.string(),
        'home.position-senior-frontend-engineer': z.string(),
        'home.project-dex-name': z.string().optional(),
        'home.project-dex-descriptions.0': z.string().optional(),
        'home.project-dex-descriptions.1': z.string().optional(),
        'home.project-dex-descriptions.2': z.string().optional(),
        'home.project-dex-descriptions': z.array(z.string()),
        'home.project-hoogii-name': z.string().optional(),
        'home.project-hoogii-descriptions.0': z.string().optional(),
        'home.project-hoogii-descriptions.1': z.string().optional(),
        'home.project-hoogii-descriptions': z.array(z.string()),
        'home.project-pyke-name': z.string().optional(),
        'home.project-pyke-descriptions.0': z.string().optional(),
        'home.project-pyke-descriptions.1': z.string().optional(),
        'home.project-pyke-descriptions': z.array(z.string()),
        'home.project-opencgt-name': z.string().optional(),
        'home.project-opencgt-descriptions.0': z.string().optional(),
        'home.project-opencgt-descriptions.1': z.string().optional(),
        'home.project-opencgt-descriptions.2': z.string().optional(),
        'home.project-opencgt-descriptions.3': z.string().optional(),
        'home.project-opencgt-descriptions': z.array(z.string()),
        'home.experience-type-job': z.string(),
        'home.experience-type-education': z.string(),
        'home.job-webim-description': z.string(),
        'home.job-gss-description': z.string(),
        'home.job-jubo-description': z.string(),
        'home.skill-nextjs-descriptions.0': z.string().optional(),
        'home.skill-nextjs-descriptions.1': z.string().optional(),
        'home.skill-nextjs-descriptions.2': z.string().optional(),
        'home.skill-nextjs-descriptions.3': z.string().optional(),
        'home.skill-nextjs-descriptions': z.array(z.string()),
        'home.skill-vue-descriptions.0': z.string().optional(),
        'home.skill-vue-descriptions.1': z.string().optional(),
        'home.skill-vue-descriptions': z.array(z.string()),
        'home.skill-docker-descriptions.0': z.string().optional(),
        'home.skill-docker-descriptions.1': z.string().optional(),
        'home.skill-docker-descriptions': z.array(z.string()),
        'resume.metadata-title': z.string().optional(),
        'resume.key-skills': z.string(),
        'resume.education': z.string(),
        'resume.website': z.string(),
        'resume.education-description': z.string(),
        'blog.metadata-title': z.string().optional(),
        'blog.metadata-description': z.string(),
      }),
    }),
  }),
};
