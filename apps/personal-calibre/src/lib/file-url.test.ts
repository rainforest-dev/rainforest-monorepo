import { describe, expect, it } from 'vitest';

import { staticDownloadUrl } from './file-url';

describe('staticDownloadUrl', () => {
  it('encodes each path segment and lowercases the extension', () => {
    expect(
      staticDownloadUrl(
        'Mara Ostrand/The Salt Archive (1)',
        'The Salt Archive',
        'EPUB',
      ),
    ).toBe(
      '/files/Mara%20Ostrand/The%20Salt%20Archive%20(1)/The%20Salt%20Archive.epub',
    );
  });
});
