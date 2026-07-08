import { describe, expect, it } from 'vitest';

import {
  getEducation,
  getExperienceById,
  getProfileSummary,
  getProjectById,
  getProjects,
  getSkillById,
  getSkills,
  getWorkExperience,
  searchByTechnology,
} from './profile-data';

describe('profile-data', () => {
  it('getWorkExperience returns resolved organizations and merged technologies', async () => {
    const jobs = await getWorkExperience({ lang: 'en' });
    const codegreen = jobs.find((j) => j.id === 'en/6');
    expect(codegreen?.organization.name).toBe('CodeGreen');
    // en/6 has no direct technologies but links to en/opencgt, which has auth0 —
    // this is the exact regression this test structure was written to catch
    // (see original design's "resolveExperience technologies bug" fix).
    expect(codegreen?.technologies).toContain('auth0');
  });

  it('getWorkExperience filters by technology using the merged set', async () => {
    const auth0Jobs = await getWorkExperience({ technology: 'auth0', lang: 'en' });
    expect(auth0Jobs.some((j) => j.id === 'en/6')).toBe(true);
  });

  it('getEducation returns only education-type entries', async () => {
    const education = await getEducation({ lang: 'en' });
    expect(education.every((e) => e.id !== 'en/6')).toBe(true);
  });

  it('getExperienceById resolves the same shape as getWorkExperience', async () => {
    const entry = await getExperienceById('en/6');
    expect(entry?.organization.name).toBe('CodeGreen');
    expect(entry?.technologies).toContain('auth0');
  });

  it('getProjects resolves organization and returns declared technologies', async () => {
    const projects = await getProjects({ lang: 'en' });
    const opencgt = projects.find((p) => p.id === 'en/opencgt');
    expect(opencgt?.organization.name).toBe('CodeGreen');
    expect(opencgt?.technologies).toContain('nextjs');
  });

  it('getProjectById returns the same shape as getProjects', async () => {
    const project = await getProjectById('en/opencgt');
    expect(project?.name).toBe('OpenCGT');
  });

  it('getSkills returns entries scoped to the requested language', async () => {
    const skills = await getSkills({ lang: 'en' });
    expect(skills.some((s) => s.id === 'en/ts')).toBe(true);
    expect(skills.every((s) => s.id.startsWith('en/'))).toBe(true);
  });

  it('getProfileSummary counts experiences/projects/skills and ranks technologies', async () => {
    const summary = await getProfileSummary({ lang: 'en' });
    expect(summary.experienceCount).toBeGreaterThan(0);
    expect(summary.projectCount).toBeGreaterThan(0);
    expect(summary.skillCount).toBeGreaterThan(0);
    expect(summary.topTechnologies.length).toBeGreaterThan(0);
  });

  it('searchByTechnology substring-matches across experiences and projects', async () => {
    const results = await searchByTechnology('next', { lang: 'en' });
    expect(results.projects.some((p) => p.id === 'en/opencgt')).toBe(true);
  });

  it('getSkillById returns the same shape as getSkills entries', async () => {
    const skill = await getSkillById('en/ts');
    expect(skill?.name).toBe('TypeScript');
    expect(skill?.icon).toBe('typescript');
  });

  it('getSkillById returns undefined for an unknown id', async () => {
    expect(await getSkillById('en/does-not-exist')).toBeUndefined();
  });
});
