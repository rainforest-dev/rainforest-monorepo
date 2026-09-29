import { describe, expect, it } from 'vitest';

import { resolveFilePath, staticDownloadUrl } from './files';

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

describe('resolveFilePath', () => {
  it('resolves a file inside the library', () => {
    expect(resolveFilePath('/library', 'book-1', 'book-1', 'PDF')).toBe(
      '/library/book-1/book-1.pdf',
    );
  });

  it('rejects a path that leaves the library', () => {
    expect(() =>
      resolveFilePath('/library', '../etc', 'passwd', 'txt'),
    ).toThrow('Path traversal detected');
  });
});
