export interface RelayContext {
  isValidWallet: boolean;
  isLocked: boolean;
  isConnected: boolean;
}

export type RelayOutcome =
  | 'IS_VALID_WALLET'
  | 'IS_LOCK'
  | 'IS_CONNECTED'
  | 'pass';

/**
 * The background script's fixed gate order before forwarding a dApp
 * request: wallet validity, then lock state, then connection state. Order
 * matters — an invalid *and* locked wallet reports IS_VALID_WALLET, not
 * IS_LOCK, because that check runs first.
 */
export function evaluateRelay(ctx: RelayContext): RelayOutcome {
  if (!ctx.isValidWallet) return 'IS_VALID_WALLET';
  if (ctx.isLocked) return 'IS_LOCK';
  if (!ctx.isConnected) return 'IS_CONNECTED';
  return 'pass';
}
