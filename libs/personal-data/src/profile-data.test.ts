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
  getYearsOfExperience,
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
    const auth0Jobs = await getWorkExperience({
      technology: 'auth0',
      lang: 'en',
    });
    expect(auth0Jobs.some((j) => j.id === 'en/6')).toBe(true);
  });

  it('getEducation returns only education-type entries', async () => {
    const education = await getEducation({ lang: 'en' });
    expect(education.every((e) => e.id !== 'en/6')).toBe(true);
  });

  // `asOf` is pinned so this suite doesn't start failing on a future date. At 2026-07 the
  // full-time entries are en/6 (2022-07 → 2024-10, 27mo) and en/7 (2025-05 → open, 14mo) = 41mo.
  it('getYearsOfExperience counts only full-time roles, summing durations', async () => {
    const years = await getYearsOfExperience({
      lang: 'en',
      asOf: new Date('2026-07-01'),
    });
    expect(years).toBe(3);
  });

  it('getYearsOfExperience excludes student-era internships', async () => {
    // en/2, en/4 and en/5 add ~25 further months but are tagged `internship`; counting them
    // would push the total past 5 years.
    const jobs = await getWorkExperience({ lang: 'en' });
    const interns = jobs.filter((j) => j.employment === 'internship');
    expect(interns.length).toBeGreaterThan(0);
    const years = await getYearsOfExperience({
      lang: 'en',
      asOf: new Date('2026-07-01'),
    });
    expect(years).toBeLessThan(5);
  });

  it('getYearsOfExperience grows an open-ended role with the clock', async () => {
    const at2026 = await getYearsOfExperience({
      lang: 'en',
      asOf: new Date('2026-07-01'),
    });
    const at2028 = await getYearsOfExperience({
      lang: 'en',
      asOf: new Date('2028-07-01'),
    });
    expect(at2028).toBe(at2026 + 2);
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

  it('getProjects exposes featured/order and an id whose last segment is a stable slug', async () => {
    const projects = await getProjects({ lang: 'en' });
    const hoogii = projects.find((p) => p.id === 'en/hoogii-wallet');
    expect(hoogii?.featured).toBe(true);
    expect(hoogii?.id.split('/').pop()).toBe('hoogii-wallet');
    // order is optional in the schema — current fixtures don't set it, so it stays undefined.
    expect(hoogii?.order).toBeUndefined();
  });

  it('getProjects exposes startAt so the portfolio index can sort newest-first', async () => {
    const projects = await getProjects({ lang: 'en' });
    const opencgt = projects.find((p) => p.id === 'en/opencgt');
    const dex = projects.find((p) => p.id === 'en/hashgreen-dex');
    expect(opencgt?.startAt.getFullYear()).toBe(2024);
    expect(dex?.startAt.getFullYear()).toBe(2022);
    // The index renders newest first; this is the comparison it relies on.
    expect(opencgt!.startAt.getTime()).toBeGreaterThan(dex!.startAt.getTime());
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
