/** Two facing pages, as indexes into the notebook's pages; null where the cover or back board is. */
export interface Spread {
  left: number | null;
  right: number | null;
}

export type BookMode = 'spread' | 'single';

/**
 * How the pages open. Like a real notebook, the first page (the cover) sits alone on the right,
 * then pages pair up left and right. A phone shows one page at a time.
 */
export function spreadsOf(count: number, mode: BookMode): Spread[] {
  if (count <= 0) return [];
  if (mode === 'single')
    return Array.from({ length: count }, (_, i) => ({ left: null, right: i }));
  const spreads: Spread[] = [{ left: null, right: 0 }];
  for (let left = 1; left < count; left += 2)
    spreads.push({ left, right: left + 1 < count ? left + 1 : null });
  return spreads;
}

export function spreadOfPage(index: number, mode: BookMode): number {
  if (mode === 'single' || index <= 0) return Math.max(0, index);
  return Math.floor((index + 1) / 2);
}

/**
 * The page a spread is "on" for the URL: its first page in reading order, so narrowing to one page
 * at a time lands where the reader had got to rather than a page ahead.
 */
export const pageOfSpread = (spread: Spread): number =>
  spread.left ?? spread.right ?? 0;

/** How many pages lie under each side of an open spread, for drawing the stacked page edges. */
export function stackDepth(
  spread: Spread,
  count: number,
): { before: number; after: number } {
  const first = spread.left ?? spread.right ?? 0;
  const last = spread.right ?? spread.left ?? 0;
  return { before: first, after: Math.max(0, count - 1 - last) };
}

/** Edge thickness in px for `pages` pages, so a thick notebook looks thick and an empty side flat. */
export const edgeWidth = (pages: number, max = 14): number =>
  pages <= 0 ? 0 : Math.min(max, 2 + Math.round(Math.sqrt(pages) * 1.6));

export const TURN_MS = 450;

export const easeTurn = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** A drag finishes the turn past a third of the way, or on a flick toward it. */
export const commitsTurn = (progress: number, velocity: number): boolean =>
  progress > 0.35 || (velocity > 0.6 && progress > 0.05);
