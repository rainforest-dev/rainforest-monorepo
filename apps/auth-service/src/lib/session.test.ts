import { describe, it, expect } from 'vitest';

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

const { signSession, verifySession } = await import('./session.js');

describe('session', () => {
  it('signs and verifies a valid token', async () => {
    const token = await signSession();
    expect(typeof token).toBe('string');
    expect(await verifySession(token)).toBe(true);
  });

  it('rejects a tampered token', async () => {
    const token = await signSession();
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifySession(tampered)).toBe(false);
  });

  it('rejects an empty string', async () => {
    expect(await verifySession('')).toBe(false);
  });
});
