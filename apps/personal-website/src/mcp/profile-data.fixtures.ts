export const organizationFixtures = [
  { id: 'en/codegreen', collection: 'organizations' as const, data: { name: 'CodeGreen', language: 'en', link: 'https://www.codegreen.org' } },
  { id: 'en/jubo', collection: 'organizations' as const, data: { name: 'Jubo', language: 'en' } },
  { id: 'en/master', collection: 'organizations' as const, data: { name: 'Master University', language: 'en' } },
];

export const experienceFixtures = [
  {
    id: 'en/6',
    collection: 'experiences' as const,
    data: {
      type: 'job' as const,
      language: 'en',
      organization: { collection: 'organizations' as const, id: 'en/codegreen' },
      position: 'Senior Frontend Engineer',
      startAt: new Date('2022-07-01'),
      endAt: new Date('2024-10-01'),
      technologies: [] as string[],
      projects: [{ collection: 'projects' as const, id: 'en/opencgt' }],
    },
    body: 'Worked at a startup from the ground up.',
  },
  {
    id: 'en/5',
    collection: 'experiences' as const,
    data: {
      type: 'job' as const,
      language: 'en',
      organization: { collection: 'organizations' as const, id: 'en/jubo' },
      position: 'Software Intern',
      startAt: new Date('2020-12-01'),
      endAt: new Date('2021-06-01'),
      technologies: ['react', 'flutter'],
      projects: [] as { collection: 'projects'; id: string }[],
    },
    body: 'Maintained long-term care applications.',
  },
  {
    id: 'en/2',
    collection: 'experiences' as const,
    data: {
      type: 'education' as const,
      language: 'en',
      organization: { collection: 'organizations' as const, id: 'en/master' },
      position: 'Master of Computer Science',
      startAt: new Date('2018-09-01'),
      endAt: new Date('2020-06-01'),
      technologies: [] as string[],
      projects: [] as { collection: 'projects'; id: string }[],
    },
    body: 'Graduate studies.',
  },
];

export const projectFixtures = [
  {
    id: 'en/opencgt',
    collection: 'projects' as const,
    data: {
      name: 'OpenCGT',
      language: 'en',
      technologies: ['nextjs', 'auth0', 'mui', 'playwright', 'vitest'],
      organization: { collection: 'organizations' as const, id: 'en/codegreen' },
      experience: { collection: 'experiences' as const, id: 'en/6' },
    },
    body: 'Led frontend development for a B2B product.',
  },
];

export const skillFixtures = [
  { id: 'en/ts', collection: 'skills' as const, data: { name: 'TypeScript', icon: 'typescript', tags: ['languages'] }, body: '' },
];

export const fixturesByCollection = {
  organizations: organizationFixtures,
  experiences: experienceFixtures,
  projects: projectFixtures,
  skills: skillFixtures,
};
