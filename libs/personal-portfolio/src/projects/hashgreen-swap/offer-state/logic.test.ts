import { describe, expect, it } from 'vitest';

import { INITIAL_OFFER_STATE, nextOfferState } from './logic';

describe('offer-state logic — nextOfferState (connect/review/sign)', () => {
  it('starts idle/pending', () => {
    expect(INITIAL_OFFER_STATE).toEqual({ stage: 'idle', status: 'pending' });
  });

  it('moves idle -> connected on connect', () => {
    expect(nextOfferState(INITIAL_OFFER_STATE, { type: 'connect' })).toEqual({
      stage: 'connected',
      status: 'pending',
    });
  });

  it('moves connected -> review on review', () => {
    const connected = { stage: 'connected', status: 'pending' } as const;
    expect(nextOfferState(connected, { type: 'review' })).toEqual({
      stage: 'review',
      status: 'pending',
    });
  });

  it('routes review -> connected on reject, instead of signing a rejected offer', () => {
    const review = { stage: 'review', status: 'pending' } as const;
    expect(nextOfferState(review, { type: 'reject' })).toEqual({
      stage: 'connected',
      status: 'pending',
    });
  });

  it('moves review -> signing on approve', () => {
    const review = { stage: 'review', status: 'pending' } as const;
    expect(nextOfferState(review, { type: 'approve' })).toEqual({
      stage: 'signing',
      status: 'pending',
    });
  });

  it('ignores connect/review/approve outside their valid stage', () => {
    const idle = INITIAL_OFFER_STATE;
    expect(nextOfferState(idle, { type: 'review' })).toBe(idle);
    expect(nextOfferState(idle, { type: 'approve' })).toBe(idle);
    const connected = { stage: 'connected', status: 'pending' } as const;
    expect(nextOfferState(connected, { type: 'connect' })).toBe(connected);
  });
});

describe('offer-state logic — nextOfferState (offerStatusEnum: VALID -> IN_MEMPOOL -> ON_CHAIN)', () => {
  const signing = { stage: 'signing', status: 'pending' } as const;

  it('moves signing -> tracking/valid once the offer validates', () => {
    expect(nextOfferState(signing, { type: 'validated' })).toEqual({
      stage: 'tracking',
      status: 'valid',
    });
  });

  it('walks tracking through valid -> in_mempool -> on_chain in order', () => {
    let state = nextOfferState(signing, { type: 'validated' });
    expect(state.status).toBe('valid');

    state = nextOfferState(state, { type: 'submitted' });
    expect(state.status).toBe('in_mempool');
    expect(state.stage).toBe('tracking');

    state = nextOfferState(state, { type: 'confirmed' });
    expect(state.status).toBe('on_chain');
  });

  it('routes in_mempool -> invalid on a conflicting spend, instead of confirming', () => {
    const inMempool = { stage: 'tracking', status: 'in_mempool' } as const;
    expect(nextOfferState(inMempool, { type: 'conflict' })).toEqual({
      stage: 'tracking',
      status: 'invalid',
    });
  });

  it('cannot skip straight from valid to on_chain (must pass through in_mempool)', () => {
    const valid = { stage: 'tracking', status: 'valid' } as const;
    expect(nextOfferState(valid, { type: 'confirmed' })).toBe(valid);
    expect(nextOfferState(valid, { type: 'conflict' })).toBe(valid);
  });

  it('cannot conflict or confirm once already on_chain', () => {
    const onChain = { stage: 'tracking', status: 'on_chain' } as const;
    expect(nextOfferState(onChain, { type: 'confirmed' })).toBe(onChain);
    expect(nextOfferState(onChain, { type: 'conflict' })).toBe(onChain);
  });

  it('resets to idle/pending from any stage, including a tracked invalid offer', () => {
    const invalid = { stage: 'tracking', status: 'invalid' } as const;
    expect(nextOfferState(invalid, { type: 'reset' })).toEqual(
      INITIAL_OFFER_STATE,
    );
  });
});
