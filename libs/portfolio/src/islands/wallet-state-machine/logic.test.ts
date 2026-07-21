import { describe, expect, it } from 'vitest';

import { nextWalletStage } from './logic';

describe('wallet-state-machine logic — nextWalletStage', () => {
  it('moves Unspecified -> Initial on connect', () => {
    expect(nextWalletStage('unspecified', { type: 'connect' })).toBe(
      'initial',
    );
  });

  it('moves Initial -> Pairing when a wallet is picked', () => {
    expect(nextWalletStage('initial', { type: 'select-wallet' })).toBe(
      'pairing',
    );
  });

  it('moves Pairing -> Connected once pairing completes', () => {
    expect(nextWalletStage('pairing', { type: 'paired' })).toBe('connected');
  });

  it('routes Pairing -> Error on reject, instead of hanging', () => {
    expect(nextWalletStage('pairing', { type: 'reject' })).toBe('error');
  });

  it('routes Pairing -> Error on timeout, instead of hanging', () => {
    expect(nextWalletStage('pairing', { type: 'timeout' })).toBe('error');
  });

  it('ignores select-wallet, paired, reject, and timeout outside their valid stage', () => {
    expect(nextWalletStage('unspecified', { type: 'select-wallet' })).toBe(
      'unspecified',
    );
    expect(nextWalletStage('initial', { type: 'paired' })).toBe('initial');
    expect(nextWalletStage('connected', { type: 'reject' })).toBe(
      'connected',
    );
  });

  it('resets to Unspecified from any stage, including Error', () => {
    expect(nextWalletStage('error', { type: 'reset' })).toBe('unspecified');
    expect(nextWalletStage('connected', { type: 'reset' })).toBe(
      'unspecified',
    );
  });

  it('is idempotent: connecting again from Initial stays at Initial', () => {
    expect(nextWalletStage('initial', { type: 'connect' })).toBe('initial');
  });

  it('routes "try again" (a connect event) from Error back to Initial', () => {
    expect(nextWalletStage('error', { type: 'connect' })).toBe('initial');
  });
});
