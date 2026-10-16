import { describe, expect, it } from 'vitest';

import { previewUrl } from './links.ts';

describe('previewUrl', () => {
  it('encodes the target as a query parameter', () => {
    expect(previewUrl('https://a.com/?x=1&y=2')).toBe(
      '/link-preview.json?url=https%3A%2F%2Fa.com%2F%3Fx%3D1%26y%3D2',
    );
  });
});
