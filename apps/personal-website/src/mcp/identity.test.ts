// @vitest-environment node
import { info } from '@utils/constants';
import { describe, expect, it } from 'vitest';

import { PROFILE_TOOLS } from './catalog';
import { getProfileIdentity } from './identity';

const find = (name: string) => {
  const tool = PROFILE_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`no such tool: ${name}`);
  return tool;
};

describe('getProfileIdentity', () => {
  it('reads headline and location from the site locale files', async () => {
    expect(await getProfileIdentity('en')).toMatchObject({
      headline: 'Senior Frontend Engineer',
      location: { city: 'Taipei', country: 'Taiwan' },
    });
    expect((await getProfileIdentity('zh')).headline).toBe('資深前端工程師');
  });

  it('lists the website and GitHub links', async () => {
    expect((await getProfileIdentity()).links).toEqual({
      website: 'https://rainforest.tools',
      github: 'https://github.com/rainforest-dev',
    });
  });

  it('does not expose a name', async () => {
    const json = JSON.stringify(await getProfileIdentity()).toLowerCase();
    expect(json).not.toMatch(/name/);
    expect(json).not.toContain('linkedin');
    expect(json).not.toContain(info.links.linkedin.toLowerCase());
  });
});

describe('get_profile_summary', () => {
  it('returns identity fields alongside the counts', async () => {
    const result = (await find('get_profile_summary').run(
      { lang: 'en' },
      {},
    )) as Record<string, unknown>;
    expect(result).toMatchObject({
      headline: 'Senior Frontend Engineer',
      location: { city: 'Taipei', country: 'Taiwan' },
    });
    expect(result.links).toBeDefined();
    expect(result.experienceCount).toBeGreaterThan(0);
    expect(result).not.toHaveProperty('name');
  });
});

describe('get_education', () => {
  it('returns degree and field', async () => {
    const result = (await find('get_education').run(
      { lang: 'en' },
      {},
    )) as Array<{ degree?: string; field?: string }>;
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((e) => e.degree === 'Bachelor Degree')).toBe(true);
    expect(result.some((e) => e.field === 'Civil Engineering')).toBe(true);
  });
});
