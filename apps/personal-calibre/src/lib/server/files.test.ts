import { describe, expect, it } from 'vitest';

import { resolveFilePath } from './files';

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
