export const resume = {
  hero: {
    title: 'Rainforest Cheng',
    summaries: [
      'Senior frontend engineer from Tainan, Taiwan.',
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
      description: ['Dex', 'Hoogii', 'Pyke', 'OpenCGT'],
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
          ],
        },
        {
          name: 'Hoogii Wallet',
          description: [
            'A web3 cryptocurrency extension wallet on Google Chrome',
          ],
        },
        {
          name: 'HashgreenSwap',
          description: [
            'The first Automated Market Maker (AMM) on Chia blockchain',
          ],
        },
        {
          name: 'OpenCGT',
          description: [''],
        },
      ],
    },
  ],
  skills: [
    {
      key: 'nextjs',
      name: 'Next.js',
      description: [],
    },
    {
      key: 'vue',
      name: 'Vue',
      description: [],
    },
    {
      key: 'flutter',
      name: 'Flutter',
      description: [],
    },
    {
      key: 'docker',
      name: 'Docker',
      description: [],
    },
  ],
} as const;
