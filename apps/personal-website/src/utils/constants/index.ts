export const defaultSourceColor = '#66b2b2' as const;

export const resume = {
  hero: {
    name: { first: 'Rainforest', last: 'Cheng' },
    position: 'Senior frontend engineer',
    location: 'Tainan, Taiwan',
    summaries: [
      '6 years of experience developing with Vue and React.',
      'Proficient in Continuous Integration/Continuous Deployment (CI/CD) and container technology for frontend development.',
      'Past work in digital twins, blockchain, elderly care, and cell gene therapy.',
    ],
    tags: ['vue', 'react', 'flutter', 'docker'],
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
      position: 'Research And Development Assistant',
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
