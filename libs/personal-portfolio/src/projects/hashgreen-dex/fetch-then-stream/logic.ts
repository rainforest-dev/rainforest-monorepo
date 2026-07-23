/**
 * Prepend a newly-arrived trade to the tape and cap it, dropping the
 * oldest — the same fold every live surface (stats, tape, ledger) uses when
 * an Ably message lands. Pure — never mutates `tape`.
 */
export function pushTrade<T>(tape: T[], trade: T, cap: number): T[] {
  return [trade, ...tape].slice(0, cap);
}

/**
 * Every market subscribes to exactly one channel — mirrors
 * `useAbly({ channelName, events, callback })`'s single-channel contract.
 */
export function channelFor(market: string): string {
  return `market:${market}`;
}

/**
 * The lifecycle a `useAbly` mount/unmount produces. Unsubscribe always runs
 * before subscribe, matching the effect's cleanup-then-resubscribe order —
 * so switching markets never leaves two channels open at once, and turning
 * "Live" off only unsubscribes.
 */
export function lifecycleLog(
  previousChannel: string | null,
  nextChannel: string | null,
): string[] {
  const lines: string[] = [];
  if (previousChannel) lines.push(`unsubscribe(${previousChannel})`);
  if (nextChannel) lines.push(`subscribe(${nextChannel})`);
  return lines;
}
