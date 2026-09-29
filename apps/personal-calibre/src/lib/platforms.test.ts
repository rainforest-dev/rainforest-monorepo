import { describe, expect, it } from 'vitest';

import { platformAbbr, platformName } from './platforms';

describe('platforms', () => {
  it('abbreviates the known platforms and falls back to three letters', () => {
    expect(platformAbbr('kobo')).toBe('KB');
    expect(platformAbbr('notebooklm')).toBe('NLM');
    expect(platformAbbr('readwise-reader')).toBe('RW');
    expect(platformAbbr('pocketbook')).toBe('POC');
  });

  it('names a platform by key', () => {
    const platforms = [{ id: 1, key: 'kobo', name: 'Kobo' }];
    expect(platformName(platforms, 'kobo')).toBe('Kobo');
    expect(platformName(platforms, 'other')).toBe('other');
  });
});
