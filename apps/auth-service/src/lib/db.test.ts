import { describe, it, expect } from 'vitest';

// AUTH_DB_PATH must be set before importing db.ts — the module captures it lazily on first getDb() call.
// Static imports would be resolved before this line, breaking the isolation.
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
    expect(result).toMatchObject({ id: 'cred-id-1', publicKey: 'base64pubkey==', counter: 0 });
  });

  it('lists all credentials', () => {
    saveCredential({ id: 'cred-list-1', publicKey: 'listkey==', counter: 0, transports: [] });
    const all = listCredentials();
    expect(all.length).toBeGreaterThan(0);
  });

  it('updates counter', () => {
    updateCounter('cred-id-1', 5);
    const result = getCredential('cred-id-1');
    expect(result?.counter).toBe(5);
  });

  it('throws when updating counter for non-existent id', () => {
    expect(() => updateCounter('does-not-exist', 5)).toThrow('Credential not found or counter did not advance');
  });
});
