import { describe, expect, it } from 'vitest';

import { getCaseStudy, hasCaseStudy, listCaseStudies } from './index';

describe('case study registry', () => {
  it('lists case studies with 5 sections each and unique interaction kinds', () => {
    const studies = listCaseStudies();
    expect(studies.length).toBeGreaterThan(0);
    for (const study of studies) {
      expect(study.sections).toHaveLength(5);
      const kinds = study.sections.map((s) => s.interaction);
      expect(new Set(kinds).size).toBe(5);
    }
  });

  it('resolves a known slug and rejects an unknown one', () => {
    expect(hasCaseStudy('hoogii-wallet')).toBe(true);
    expect(getCaseStudy('hoogii-wallet')?.slug).toBe('hoogii-wallet');
    expect(hasCaseStudy('does-not-exist')).toBe(false);
    expect(getCaseStudy('does-not-exist')).toBeUndefined();
  });
});
