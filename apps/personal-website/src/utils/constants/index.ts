import { SkillTag } from '@types';
import { getGitHubUrl, getLinkedInUrl } from '@utils';

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
  ],
  experience: ['job', 'education'],
} as const;

export const info = {
  dateOfBirth: '1997-02-18',
  email: 'contact@rainforest.tools',
  phone: '+886981352355',
  links: {
    linkedin: 'yulin-cheng',
    github: 'rainforest-dev',
    website: 'https://rainforest.tools',
  },
};

export const hero = {
  tags: ['nextjs', 'docker', 'vue', 'flutter'] as SkillTag[],
};

export const links = {
  internal: [
    {
      key: 'resume',
      href: '/resume',
    },
    {
      key: 'blog',
      href: '/blog',
    },
  ],
  external: [
    {
      key: 'linkedin',
      href: getLinkedInUrl(info.links.linkedin),
    },
    {
      key: 'github',
      href: getGitHubUrl(info.links.github),
    },
  ],
};
