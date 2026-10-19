import { afterEach, describe, expect, it, vi } from 'vitest';

import { showsCollections } from './libraryNav.js';

describe('showsCollections', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows the collections on the library hostname', () => {
    vi.stubEnv('LIBRARY_NAV', '');
    expect(
      showsCollections(new URL('https://library.rainforest.tools/rack')),
    ).toBe(true);
  });

  it('hides them on any other hostname', () => {
    vi.stubEnv('LIBRARY_NAV', '');
    expect(showsCollections(new URL('https://rss.rainforest.tools/rack'))).toBe(
      false,
    );
  });

  it('shows them anywhere when LIBRARY_NAV is on', () => {
    vi.stubEnv('LIBRARY_NAV', 'on');
    expect(showsCollections(new URL('http://127.0.0.1:4321/rack'))).toBe(true);
  });
});
