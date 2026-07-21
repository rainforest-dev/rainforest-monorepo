/**
 * Prepend a newly-arrived transaction to the feed and cap the result to
 * `cap` entries, dropping the oldest. Pure — never mutates `feed`, mirrors
 * how an Ably `useChannel` message handler would fold a new message into
 * local state.
 */
export function applyTransaction<T>(feed: T[], tx: T, cap: number): T[] {
  return [tx, ...feed].slice(0, cap);
}
