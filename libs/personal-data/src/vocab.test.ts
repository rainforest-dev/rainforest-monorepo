import { describe, expect, it } from 'vitest';

import { experienceTypes, locales, skillTags } from './vocab';

describe('vocab', () => {
  it('exposes the skill tag vocabulary as a readonly tuple', () => {
    expect(skillTags).toContain('typescript');
    expect(skillTags).toContain('nextjs');
    expect(skillTags.length).toBe(22);
  });

  it('exposes job/education as the only experience types', () => {
    expect(experienceTypes).toEqual(['job', 'education']);
  });

  it('exposes en/zh as the only supported locales', () => {
    expect(locales).toEqual(['en', 'zh']);
  });
});
