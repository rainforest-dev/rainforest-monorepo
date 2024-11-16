import { IExperience, IOrganization, ISkill, SkillTag } from '@types';
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
  email: 'rainforestnick@gmail.com',
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

export const organizations: Record<string, IOrganization> = {
  bachelor: {
    name: 'ntu',
    department: 'ce',
    link: 'https://www.ce.ntu.edu.tw',
  },
  webim: {
    name: 'webim',
    link: 'https://webim.com.tw',
  },
  master: {
    name: 'ntu',
    department: 'caece',
    link: 'https://www.caece.net',
  },
  gss: {
    name: 'gss',
    link: 'https://www.gss.com.tw',
  },
  jubo: {
    name: 'jubo',
    link: 'https://jubo-health.com',
  },
  codegreen: {
    name: 'codegreen',
    link: 'https://www.codegreen.org',
  },
};

export const experience: IExperience[] = [
  {
    type: 'education',
    organization: organizations.bachelor,
    position: 'degree-bachelor',
    startAt: '2015-09',
    endAt: '2019-06',
  },
  {
    type: 'job',
    organization: organizations.webim,
    position: 'position-rd-assistant',
    startAt: '2018-07',
    endAt: '2019-10',
    description: 'job-webim-description',
    technologies: ['vue', 'swift'],
  },
  {
    type: 'education',
    organization: organizations.master,
    position: 'degree-master',
    startAt: '2019-09',
    endAt: '2021-08',
    technologies: ['python', 'pytorch', 'fastapi'],
  },
  {
    type: 'job',
    organization: organizations.gss,
    position: 'position-frontend-intern',
    startAt: '2020-07',
    endAt: '2020-11',
    description: 'job-gss-description',
    technologies: ['vue'],
  },
  {
    type: 'job',
    organization: organizations.jubo,
    position: 'position-software-intern',
    startAt: '2020-12',
    endAt: '2021-06',
    description: 'job-jubo-description',
    technologies: ['react', 'flutter'],
  },
  {
    type: 'job',
    organization: organizations.codegreen,
    position: 'position-senior-frontend-engineer',
    startAt: '2022-07',
    endAt: '2024-10',
    technologies: ['qwik'],
    projects: [
      {
        name: 'project-dex-name',
        description: [
          'project-dex-descriptions.0',
          'project-dex-descriptions.1',
          'project-dex-descriptions.2',
        ],
        technologies: ['nextjs', 'tailwindcss'],
      },
      {
        name: 'project-hoogii-name',
        description: [
          'project-hoogii-descriptions.0',
          'project-hoogii-descriptions.1',
        ],
        technologies: ['react', 'tailwindcss'],
      },
      {
        name: 'project-pyke-name',
        description: [
          'project-pyke-descriptions.0',
          'project-pyke-descriptions.1',
        ],
        technologies: ['nextjs', 'tailwindcss', 'vitest'],
      },
      {
        name: 'project-opencgt-name',
        description: [
          'project-opencgt-descriptions.0',
          'project-opencgt-descriptions.1',
          'project-opencgt-descriptions.2',
          'project-opencgt-descriptions.3',
        ],
        technologies: ['nextjs', 'auth0', 'mui', 'playwright', 'vitest'],
      },
    ],
  },
];

export const skills: ISkill[] = [
  {
    key: 'nextjs',
    description: [
      'skill-nextjs-descriptions.0',
      'skill-nextjs-descriptions.1',
      'skill-nextjs-descriptions.2',
      'skill-nextjs-descriptions.3',
    ],
  },
  {
    key: 'vue',
    description: ['skill-vue-descriptions.0', 'skill-vue-descriptions.1'],
  },
  {
    key: 'flutter',
    description: [],
  },
  {
    key: 'docker',
    description: ['skill-docker-descriptions.0', 'skill-docker-descriptions.1'],
  },
];

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
