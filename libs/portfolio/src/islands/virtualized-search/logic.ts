export interface Market {
  code: string;
  name: string;
}

export interface ScoredMarket extends Market {
  score: number;
}

/**
 * Cosmetic stand-in for Fuse.js's scoring model over `code + name`: 0 is a
 * perfect match, 1 is "matches almost anything". Prefix and substring hits
 * score low; a character-order (subsequence) match with gaps scores higher;
 * anything that isn't even a subsequence returns Infinity so it's filtered.
 */
function scoreOf(query: string, market: Market): number {
  const q = query.toLowerCase();
  const s = `${market.code} ${market.name}`.toLowerCase();
  if (s === q) return 0;

  const idx = s.indexOf(q);
  if (idx === 0) return 0.02;
  if (idx > 0) return 0.05 + (idx / s.length) * 0.05;

  let searchFrom = 0;
  let lastMatch = -1;
  let gaps = 0;
  for (const char of q) {
    const found = s.indexOf(char, searchFrom);
    if (found === -1) return Infinity;
    if (lastMatch !== -1) gaps += found - lastMatch - 1;
    lastMatch = found;
    searchFrom = found + 1;
  }
  return Math.min(1, 0.15 + gaps / Math.max(s.length, q.length));
}

/**
 * Client-side fuzzy match mirroring the real `Fuse` config (`threshold:
 * 0.1`) scoring over currency code + name. An empty (or whitespace-only)
 * query short-circuits to the full, unranked list — the "All" tab.
 */
export function rankMarkets(
  query: string,
  markets: Market[],
  threshold = 0.1,
): ScoredMarket[] {
  if (query.trim().length === 0) {
    return markets.map((market) => ({ ...market, score: 0 }));
  }

  return markets
    .map((market) => ({ ...market, score: scoreOf(query, market) }))
    .filter(({ score }) => score <= threshold)
    .sort((a, b) => a.score - b.score);
}

export interface Window {
  /** First index to mount (inclusive). */
  start: number;
  /** Last index to mount (exclusive). */
  end: number;
  /** Height in px of the spacer above the mounted rows. */
  topPad: number;
  /** Height in px of the spacer below the mounted rows. */
  bottomPad: number;
}

/**
 * Cosmetic stand-in for `TableVirtuoso`'s windowing: given the current
 * scroll position, compute which row indices should actually be mounted
 * (plus an overscan buffer on each side) and the two spacer heights that
 * keep the scrollbar honest for the rows that aren't mounted.
 */
export function computeWindow(
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  total: number,
  overscan = 3,
): Window {
  const firstVisible = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(total, firstVisible + visibleCount + overscan);
  return {
    start,
    end,
    topPad: start * rowHeight,
    bottomPad: Math.max(0, (total - end) * rowHeight),
  };
}

export type Tab = 'all' | 'favorites';

/**
 * Toggle a market's favorite membership. Pure — returns a new `Set` and
 * never mutates the one passed in, so it's safe to hand straight to a
 * `setState` updater.
 */
export function toggleFavorite(
  favorites: ReadonlySet<string>,
  code: string,
): Set<string> {
  const next = new Set(favorites);
  if (next.has(code)) next.delete(code);
  else next.add(code);
  return next;
}

/** Filters the "All" vs "Favorites" tab. */
export function filterByTab<T extends { code: string }>(
  markets: T[],
  tab: Tab,
  favorites: ReadonlySet<string>,
): T[] {
  if (tab === 'favorites') return markets.filter((m) => favorites.has(m.code));
  return markets;
}

export const FAVORITES_STORAGE_KEY = 'rf-portfolio-dex-favorites';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/**
 * SSR/no-window-safe read of persisted favorites. `storage` is injected
 * (rather than reaching for `window.localStorage` directly) so this stays
 * pure and testable, and so a component can pass `undefined` during a
 * server-rendered pass instead of touching `window`. Recovers to an empty
 * set on missing, corrupt, or unexpectedly-shaped persisted data.
 */
export function readFavorites(storage: ReadableStorage | undefined): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * SSR/no-window-safe write of favorites. No-ops if storage is unavailable
 * or throws (quota exceeded, privacy mode) — losing persistence is fine,
 * losing the UI isn't.
 */
export function writeFavorites(
  storage: WritableStorage | undefined,
  favorites: ReadonlySet<string>,
): void {
  if (!storage) return;
  try {
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {
    // Ignore — see comment above.
  }
}
