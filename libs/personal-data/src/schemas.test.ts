import { describe, expect, it } from 'vitest';

import {
  experienceSchema,
  organizationSchema,
  projectSchema,
  skillSchema,
} from './schemas';

describe('schemas', () => {
  it('parses a valid organization', () => {
    const org = organizationSchema.parse({
      name: 'CodeGreen',
      link: 'https://www.codegreen.org',
      language: 'en',
    });
    expect(org.name).toBe('CodeGreen');
  });

  it('rejects an organization with an invalid language', () => {
    expect(() =>
      organizationSchema.parse({ name: 'X', language: 'fr' }),
    ).toThrow();
  });

  it('parses a valid experience with reference fields as plain string ids', () => {
    const exp = experienceSchema.parse({
      type: 'job',
      language: 'en',
      organization: 'en/codegreen',
      position: 'Senior Frontend Engineer',
      startAt: '2022-07',
      endAt: '2024-10',
      projects: ['en/opencgt'],
    });
    expect(exp.organization).toBe('en/codegreen');
    expect(exp.technologies).toEqual([]);
    expect(exp.startAt).toBeInstanceOf(Date);
  });

  it('rejects an experience with an unknown technology tag', () => {
    expect(() =>
      experienceSchema.parse({
        type: 'job',
        language: 'en',
        organization: 'en/codegreen',
        position: 'X',
        startAt: '2022-07',
        technologies: ['not-a-real-tag'],
      }),
    ).toThrow();
  });

  it('parses a valid project', () => {
    const project = projectSchema.parse({
      name: 'OpenCGT',
      language: 'en',
      technologies: ['nextjs', 'auth0'],
      organization: 'en/codegreen',
      experience: 'en/6',
    });
    expect(project.technologies).toEqual(['nextjs', 'auth0']);
  });

  it('rejects a project with an unknown technology tag', () => {
    expect(() =>
      projectSchema.parse({
        name: 'OpenCGT',
        language: 'en',
        technologies: ['not-a-real-tag'],
        organization: 'en/codegreen',
        experience: 'en/6',
      }),
    ).toThrow();
  });

  it('parses a valid skill with default empty tags', () => {
    const skill = skillSchema.parse({ name: 'TypeScript', icon: 'typescript' });
    expect(skill.tags).toEqual([]);
  });

  it('rejects a skill with an unknown icon tag', () => {
    expect(() =>
      skillSchema.parse({ name: 'TypeScript', icon: 'not-a-real-tag' }),
    ).toThrow();
  });
});
