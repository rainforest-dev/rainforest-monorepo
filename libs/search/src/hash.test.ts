import { describe, expect, it } from 'vitest';

import { fnv1a, fnv1aBytes } from './hash';

describe('fnv1a', () => {
  it('matches the memories content hash, zero-padded to 8 hex digits', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
    expect(fnv1a('台南')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('fnv1aBytes', () => {
  it('prefixes the byte length and does not pad', () => {
    expect(fnv1aBytes(new Uint8Array())).toBe('0:811c9dc5');
    expect(fnv1aBytes(new Uint8Array([97]))).toBe('1:e40c292c');
  });
});
