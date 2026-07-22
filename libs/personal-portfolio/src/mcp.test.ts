import { describe, expect, it } from 'vitest';

import { caseStudyResource, PORTFOLIO_MCP_RESOURCES } from './mcp';

describe('portfolio MCP surface', () => {
  it('exposes the case-study resource URI template', () => {
    expect(PORTFOLIO_MCP_RESOURCES[0].uriTemplate).toBe('portfolio://case-study/{+slug}');
  });

  it('resolves a known slug to its case study', () => {
    expect(caseStudyResource('hoogii-wallet').slug).toBe('hoogii-wallet');
  });

  it('throws for an unknown slug', () => {
    expect(() => caseStudyResource('nope')).toThrow('Case study not found: nope');
  });
});
