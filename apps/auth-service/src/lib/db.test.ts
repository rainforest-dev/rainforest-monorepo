import { describe, it, expect } from 'vitest';

// Use in-memory DB for tests
process.env.AUTH_DB_PATH = ':memory:';

const { saveCredential, getCredential, listCredentials, updateCounter } =
  await import('./db.js');

describe('db', () => {
  const cred = {
    id: 'cred-id-1',
    publicKey: 'base64pubkey==',
    counter: 0,
    transports: ['internal'] as string[],
  };

  it('saves and retrieves a credential', () => {
    saveCredential(cred);
    const result = getCredential('cred-id-1');
    expect(result).toMatchObject({ id: 'cred-id-1', publicKey: 'base64pubkey==' });
  });

  it('lists all credentials', () => {
    const all = listCredentials();
    expect(all.length).toBeGreaterThan(0);
  });

  it('updates counter', () => {
    updateCounter('cred-id-1', 5);
    const result = getCredential('cred-id-1');
    expect(result?.counter).toBe(5);
  });
});
