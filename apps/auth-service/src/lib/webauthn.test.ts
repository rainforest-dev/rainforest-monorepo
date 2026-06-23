import { describe, it, expect } from 'vitest';

const { storeChallenge, consumeChallenge, getRpConfig } = await import('./webauthn.js');

describe('challenge store', () => {
  it('stores and consumes a challenge once', () => {
    storeChallenge('reg', 'abc123');
    expect(consumeChallenge('reg')).toBe('abc123');
    expect(consumeChallenge('reg')).toBeNull(); // consumed
  });

  it('returns null for unknown key', () => {
    expect(consumeChallenge('unknown')).toBeNull();
  });
});

describe('getRpConfig', () => {
  it('returns rpID and origin from defaults', () => {
    const config = getRpConfig();
    expect(config.rpID).toBe('rainforest.tools');
    expect(config.origin).toBe('https://auth.rainforest.tools');
  });
});
