import { describe, expect, it } from 'vitest';

import { isHiddenFrontmatter, isPrivateVaultPath } from './privacy';

describe('isHiddenFrontmatter', () => {
  it.each([
    [{ private: true }],
    [{ private: 'true' }],
    [{ wiki_exclude: true }],
    [{ wiki_exclude: 'yes' }],
    [{ tags: ['personal/health'] }],
    [{ tags: '#personal' }],
  ])('hides %j', (fm) => {
    expect(isHiddenFrontmatter(fm)).toBe(true);
  });

  it.each([
    [{}],
    [{ private: false }],
    [{ tags: ['tech/react'] }],
    [{ wiki_tag: 'project/angible' }],
  ])('shows %j', (fm) => {
    expect(isHiddenFrontmatter(fm)).toBe(false);
  });
});

describe('isPrivateVaultPath', () => {
  it.each([
    'notes/personal/contact',
    'Notes/Personal/identity',
    'readwise/personal/x',
  ])('withholds %s', (path) => {
    expect(isPrivateVaultPath(path)).toBe(true);
  });

  it('allows an ordinary note', () => {
    expect(isPrivateVaultPath('notes/frontend/react')).toBe(false);
    expect(isPrivateVaultPath('projects/angible/dashboard/rbac')).toBe(false);
  });
});
