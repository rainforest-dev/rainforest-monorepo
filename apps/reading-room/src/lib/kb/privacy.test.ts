import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REDACT_TERMS,
  isHiddenFrontmatter,
  isPrivateVaultPath,
  redactTerms,
} from './privacy';

describe('isHiddenFrontmatter', () => {
  it.each([
    [{ private: true }],
    [{ private: 'true' }],
    [{ wiki_exclude: true }],
    [{ wiki_exclude: 'yes' }],
    [{ tags: ['personal/health'] }],
    [{ tags: '#personal' }],
    [{ wiki_tag: 'project/angible' }],
    [{ tags: ['project/angible/billing'] }],
    [{ wiki_tag: 'Project/Angible/x' }],
  ])('hides %j', (fm) => {
    expect(isHiddenFrontmatter(fm)).toBe(true);
  });

  it.each([
    [{}],
    [{ private: false }],
    [{ tags: ['tech/react'] }],
    [{ tags: ['project/angible-like'] }],
  ])('shows %j', (fm) => {
    expect(isHiddenFrontmatter(fm)).toBe(false);
  });
});

describe('isPrivateVaultPath', () => {
  it.each([
    'notes/personal/contact',
    'Notes/Personal/identity',
    'projects/angible/dashboard/rbac',
    'readwise/personal/x',
  ])('withholds %s', (path) => {
    expect(isPrivateVaultPath(path)).toBe(true);
  });

  it('allows an ordinary note', () => {
    expect(isPrivateVaultPath('notes/frontend/react')).toBe(false);
  });
});

describe('redactTerms', () => {
  it('keeps the default and adds the variable on top', () => {
    expect(redactTerms(undefined)).toEqual(DEFAULT_REDACT_TERMS);
    expect(redactTerms('')).toEqual(DEFAULT_REDACT_TERMS);
    expect(redactTerms('  ')).toEqual(DEFAULT_REDACT_TERMS);
    expect(redactTerms(' Foo, bar ,,')).toEqual([
      ...DEFAULT_REDACT_TERMS,
      'foo',
      'bar',
    ]);
  });
});
