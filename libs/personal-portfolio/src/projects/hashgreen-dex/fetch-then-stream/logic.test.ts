import { describe, expect, it } from 'vitest';

import { channelFor, lifecycleLog, pushTrade } from './logic';

describe('fetch-then-stream logic — pushTrade', () => {
  it('prepends the newest trade', () => {
    const tape = [{ id: 2 }, { id: 1 }];
    expect(pushTrade(tape, { id: 3 }, 10)).toEqual([
      { id: 3 },
      { id: 2 },
      { id: 1 },
    ]);
  });

  it('caps the tape length, dropping the oldest', () => {
    const tape = [{ id: 3 }, { id: 2 }, { id: 1 }];
    expect(pushTrade(tape, { id: 4 }, 3)).toEqual([
      { id: 4 },
      { id: 3 },
      { id: 2 },
    ]);
  });

  it('does not mutate the input tape', () => {
    const tape = [{ id: 2 }, { id: 1 }];
    const original = [...tape];
    pushTrade(tape, { id: 3 }, 10);
    expect(tape).toEqual(original);
  });
});

describe('fetch-then-stream logic — channelFor', () => {
  it('derives one channel name per market', () => {
    expect(channelFor('HGN-USDC')).toBe('market:HGN-USDC');
    expect(channelFor('XCH-USDC')).toBe('market:XCH-USDC');
  });
});

describe('fetch-then-stream logic — lifecycleLog', () => {
  it('subscribes to the next channel on first mount (no previous channel)', () => {
    expect(lifecycleLog(null, 'market:HGN-USDC')).toEqual([
      'subscribe(market:HGN-USDC)',
    ]);
  });

  it('unsubscribes only, when toggling live off', () => {
    expect(lifecycleLog('market:HGN-USDC', null)).toEqual([
      'unsubscribe(market:HGN-USDC)',
    ]);
  });

  it('unsubscribes the old channel before subscribing to the new one when the market changes', () => {
    expect(lifecycleLog('market:HGN-USDC', 'market:XCH-USDC')).toEqual([
      'unsubscribe(market:HGN-USDC)',
      'subscribe(market:XCH-USDC)',
    ]);
  });

  it('produces no lines when there is nothing to subscribe or unsubscribe', () => {
    expect(lifecycleLog(null, null)).toEqual([]);
  });
});
