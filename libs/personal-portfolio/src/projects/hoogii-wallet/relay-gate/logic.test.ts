import { describe, expect, it } from 'vitest';

import { evaluateRelay } from './logic';

describe('relay-gate logic', () => {
  it('passes when the wallet is valid, unlocked, and connected', () => {
    expect(
      evaluateRelay({
        isValidWallet: true,
        isLocked: false,
        isConnected: true,
      }),
    ).toBe('pass');
  });

  it('blocks on IS_VALID_WALLET first, even if also locked', () => {
    expect(
      evaluateRelay({
        isValidWallet: false,
        isLocked: true,
        isConnected: true,
      }),
    ).toBe('IS_VALID_WALLET');
  });

  it('blocks on IS_LOCK when the wallet is valid but locked', () => {
    expect(
      evaluateRelay({
        isValidWallet: true,
        isLocked: true,
        isConnected: true,
      }),
    ).toBe('IS_LOCK');
  });

  it('blocks on IS_CONNECTED when valid and unlocked but not connected', () => {
    expect(
      evaluateRelay({
        isValidWallet: true,
        isLocked: false,
        isConnected: false,
      }),
    ).toBe('IS_CONNECTED');
  });
});
