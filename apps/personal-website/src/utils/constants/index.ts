import { IExperience, IOrganization, ISkill, SkillTag } from '@types';

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

export const resume = {
  info: {
    dateOfBirth: '1997-02-18',
    email: 'rainforestnick@gmail.com',
    phone: '+886981352355',
    links: {
      linkedin: 'yulin-cheng',
      github: 'rainforest-dev',
      website: 'https://rainforest.tools',
    },
  },
  hero: {
    tags: ['nextjs', 'docker', 'vue', 'flutter'],
  },
  experience: [
    {
      organization: {
        name: 'National Taiwan University',
        department: 'Civil Engineering',
        link: '',
      },
      type: 'education',
      position: 'bachelor degree',
      description: '',
      startAt: '2015-09',
      endAt: '2019-06',
      tags: [],
    },
    {
      organization: {
        name: 'WeBIM Service',
        link: '',
      },
      type: 'job',
      position: 'Research and Development Assistant',
      description:
        'Utilize Swift and Vue for the development of a digital twin product.',
      startAt: '2018-07',
      endAt: '2019-10',
      tags: ['vue', 'swift'],
    },
    {
      organization: {
        name: 'National Taiwan University',
        department: 'CAECE',
        link: '',
      },
      type: 'education',
      position: 'master degree',
      description: '',
      startAt: '2019-09',
      endAt: '2021-08',
      tags: ['python', 'pytorch', 'fastapi'],
    },
    {
      organization: {
        name: 'Galaxy Software Services, GSS',
        link: '',
      },
      type: 'job',
      position: 'Frontend Intern',
      description:
        'Provide support for the maintenance and enhancement of Software as a Service (SaaS) products.',
      startAt: '2020-07',
      endAt: '2020-11',
      tags: ['vue'],
    },
    {
      organization: {
        name: 'Jubo Health',
        link: '',
      },
      type: 'job',
      position: 'Software Intern',
      description:
        'Maintain and develop applications for long-term care facilities.',
      startAt: '2020-12',
      endAt: '2021-06',
      tags: ['react', 'flutter'],
    },
    {
      organization: {
        name: 'CodeGreen',
        link: 'https://www.codegreen.org',
      },
      type: 'job',
      position: 'Senior Frontend Engineer',
      description:
        'The engineering team utilizes Jira for project management and adheres to an agile development methodology, employing a two-week iteration cycle.',
      startAt: '2022-07',
      endAt: '2024-10',
      tags: [
        'react',
        'nextjs',
        'tailwindcss',
        'mui',
        'auth0',
        'qwik',
        'playwright',
        'vitest',
      ],
      projects: [
        {
          name: 'Hashgreen Dex',
          description: [
            'The first decentralized exchange (DEX) on Chia blockchain',
            'The frontend utilizes Next.js and Styled Components in conjunction with TailwindCSS for styling purposes.',
            'Particularly focusing on SEO and performance optimization for a long list of hundreds of CATs to display.',
          ],
        },
        {
          name: 'Hoogii Wallet',
          description: [
            'A web3 cryptocurrency extension wallet on Google Chrome',
            'Develop the Chrome extension using Vite and React, and ensure that it adheres to the manifest v3 specification.',
          ],
        },
        {
          name: 'HashgreenSwap',
          description: [
            'The first Automated Market Maker (AMM) on Chia blockchain',
            'Introduced the monorepo tool, Nx, to maintain product and unit tests, end-to-end tests, loading tests, and UI libraries separately while ensuring greater maintainability.',
          ],
        },
        {
          name: 'OpenCGT',
          description: [
            'Develop B2B products utilizing the Next.js app router.',
            'Implemented social logins utilizing Auth.js and Auth0.',
            'Implemented role-based authorizations using Cabin.js.',
            'Construct an automated Continuous Integration/Continuous Deployment pipeline utilizing NX to streamline the product release process and minimize manual effort.',
          ],
        },
      ],
    },
  ],
  skills: [
    {
      key: 'nextjs',
      name: 'Next.js',
      description: [
        "Proficient in Next.js App Router, utilizing React's latest features such as Server Components and Streaming with Suspense for optimal performance and scalability.",
        'Strong understanding of server-side rendering and dynamic loading techniques using Next.js App Router.',
        'Experience with Auth.js has enabled me to create secure and scalable authentication solutions using Next.js App Router, ensuring that user data is protected and authorized correctly.',
        'I possess expertise in styling Next.js projects, having leveraged MUI and TailwindCSS to design visually appealing and user-friendly interfaces.',
      ],
    },
    {
      key: 'vue',
      name: 'Vue',
      description: [
        'Familiar with both Vue 2 Options API and latest Composition API',
        'Have experience with state management packages such as Vuex and Pinia.',
      ],
    },
    {
      key: 'flutter',
      name: 'Flutter',
      description: [],
    },
    {
      key: 'docker',
      name: 'Docker',
      description: [
        'Implemented a Docker-based Continuous Integration and Continuous Deployment (CI/CD) pipeline for my frontend project. This pipeline streamlines the build, testing, and deployment processes, thereby minimizing manual errors.',
        'Automated routine tasks using a custom Docker-based script, ensuring consistency and efficiency across multiple environments.',
      ],
    },
  ],
} as const;
