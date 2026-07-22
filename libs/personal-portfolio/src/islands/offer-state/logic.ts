/** Wallet backends unified behind one `IWallet.createOffer` interface. */
export type WalletBackend = 'goby' | 'hoogii' | 'chia';

export type OfferStage =
  | 'idle'
  | 'connected'
  | 'review'
  | 'signing'
  | 'tracking';

/**
 * `offerStatusEnum` — the real Chia offer lifecycle. A swap is a signed
 * offer that walks VALID -> IN_MEMPOOL -> ON_CHAIN; INVALID means a coin it
 * spent was used elsewhere first (a conflicting spend), not a generic error.
 */
export type OfferStatus =
  | 'pending'
  | 'valid'
  | 'in_mempool'
  | 'on_chain'
  | 'invalid';

export interface OfferState {
  stage: OfferStage;
  status: OfferStatus;
}

export type OfferEvent =
  | { type: 'connect' }
  | { type: 'review' }
  | { type: 'reject' }
  | { type: 'approve' }
  | { type: 'validated' }
  | { type: 'submitted' }
  | { type: 'confirmed' }
  | { type: 'conflict' }
  | { type: 'reset' };

export const INITIAL_OFFER_STATE: OfferState = {
  stage: 'idle',
  status: 'pending',
};

/**
 * The offer's transition table — one source of truth for both the
 * connect/review/sign UI flow and the on-chain `offerStatusEnum` walk that
 * happens once it's broadcast. `reset` always returns to `idle`, from any
 * stage.
 */
export function nextOfferState(
  state: OfferState,
  event: OfferEvent,
): OfferState {
  if (event.type === 'reset') return INITIAL_OFFER_STATE;

  switch (event.type) {
    case 'connect':
      return state.stage === 'idle'
        ? { stage: 'connected', status: 'pending' }
        : state;
    case 'review':
      return state.stage === 'connected'
        ? { ...state, stage: 'review' }
        : state;
    case 'reject':
      return state.stage === 'review'
        ? { stage: 'connected', status: 'pending' }
        : state;
    case 'approve':
      return state.stage === 'review'
        ? { stage: 'signing', status: 'pending' }
        : state;
    case 'validated':
      return state.stage === 'signing'
        ? { stage: 'tracking', status: 'valid' }
        : state;
    case 'submitted':
      return state.stage === 'tracking' && state.status === 'valid'
        ? { ...state, status: 'in_mempool' }
        : state;
    case 'confirmed':
      return state.stage === 'tracking' && state.status === 'in_mempool'
        ? { ...state, status: 'on_chain' }
        : state;
    case 'conflict':
      return state.stage === 'tracking' && state.status === 'in_mempool'
        ? { ...state, status: 'invalid' }
        : state;
    default:
      return state;
  }
}
