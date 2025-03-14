import { getGitHubUrl, getLinkedInUrl, info } from '@rainforest-dev/personal-data';
import type { ILink, SkillTag } from '@types';

export const defaultSourceColor = '#66b2b2' as const;

export const resumeDateFormat = 'MMM yyyy' as const;

export const tags = {
  skills: [
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
  ],
  experience: ['job', 'education'],
} as const;

export const hero = {
  tags: ['nextjs', 'docker', 'vue', 'flutter'] as SkillTag[],
};

export const links: {
  internal: ILink[];
  external: ILink[];
} = {
  internal: [
    {
      label: 'resume',
      href: '/resume',
      i18n: true,
    },
    {
      label: 'blog',
      href: '/blog',
    },
    {
      label: 'portfolio',
      href: 'https://www.cake.me/rainforest-cheng-bbc4f2/portfolios',
      external: true,
    },
  ],
  external: [
    {
      label: 'linkedin',
      href: getLinkedInUrl(info.links.linkedin),
      icon: 'linkedin',
      external: true,
    },
    {
      label: 'github',
      href: getGitHubUrl(info.links.github),
      icon: 'github',
      external: true,
    },
  ],
};
