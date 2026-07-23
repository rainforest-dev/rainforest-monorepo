export type WalletStage =
  | 'unspecified'
  | 'initial'
  | 'pairing'
  | 'connected'
  | 'error';

export type WalletEvent =
  | { type: 'connect' }
  | { type: 'select-wallet' }
  | { type: 'paired' }
  | { type: 'reject' }
  | { type: 'timeout' }
  | { type: 'reset' };

/**
 * The `WalletStageEnum` transition table — one source of truth instead of a
 * scatter of booleans. WalletConnect pairing is its own explicit stage
 * because it can be rejected or time out; both route to `error` rather than
 * leaving the UI hanging in `pairing` forever. `reset` always returns to
 * `unspecified`, from any stage including `error`. `connect` is reused by
 * the error panel's "try again" button, so it also re-enters from `error`.
 */
export function nextWalletStage(
  stage: WalletStage,
  event: WalletEvent,
): WalletStage {
  if (event.type === 'reset') return 'unspecified';

  switch (event.type) {
    case 'connect':
      return stage === 'unspecified' || stage === 'error' ? 'initial' : stage;
    case 'select-wallet':
      return stage === 'initial' ? 'pairing' : stage;
    case 'paired':
      return stage === 'pairing' ? 'connected' : stage;
    case 'reject':
    case 'timeout':
      return stage === 'pairing' ? 'error' : stage;
    default:
      return stage;
  }
}
