export const NAV_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
] as const;
export type NavKey = (typeof NAV_KEYS)[number];
export type NavMode = 'grid' | 'list';

export interface NavRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NavItem {
  key: string;
  row: number;
  order: number;
  col?: number;
  rect?: NavRect;
}

export interface PickOptions {
  mode?: NavMode;
  homeEnd?: 'row' | 'page';
  ctrl?: boolean;
}

const VERTICAL_WEIGHT = 4;

/** Whether a `KeyboardEvent.key` is one of the keys `pickTarget` handles. */
export function isNavKey(key: string): key is NavKey {
  return NAV_KEYS.some((k) => k === key);
}

/** Gives each item the rounded top of its rect as its row. */
export function assignRowsByTop(
  items: readonly Omit<NavItem, 'row'>[],
): NavItem[] {
  return items.map((item) => ({
    ...item,
    row: Math.round(item.rect?.top ?? 0),
  }));
}

const centerX = (rect: NavRect) => rect.left + rect.width / 2;

function distance(item: NavItem, current: NavItem, down: boolean): number {
  if (!item.rect || !current.rect)
    return Math.abs((item.col ?? 0) - (current.col ?? 0));
  const gap = down
    ? item.rect.top - (current.rect.top + current.rect.height)
    : current.rect.top - (item.rect.top + item.rect.height);
  return (
    Math.abs(centerX(item.rect) - centerX(current.rect)) +
    VERTICAL_WEIGHT * Math.max(0, gap)
  );
}

function nearestVertical(
  ordered: readonly NavItem[],
  current: NavItem,
  down: boolean,
): NavItem | null {
  let row: number | undefined;
  for (const item of ordered) {
    const beyond = down ? item.row > current.row : item.row < current.row;
    const closer =
      row === undefined || (down ? item.row < row : item.row > row);
    if (beyond && closer) row = item.row;
  }
  let best: NavItem | null = null;
  let bestScore = Infinity;
  for (const item of ordered) {
    if (item.row !== row) continue;
    const score = distance(item, current, down);
    if (score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Picks the key of the item a navigation key moves to, or `null` at an edge.
 * Falls back to the first item when `current` is missing.
 */
export function pickTarget(
  items: readonly NavItem[],
  current: string | null,
  key: NavKey,
  options: PickOptions = {},
): string | null {
  const { mode = 'grid', homeEnd = 'row', ctrl = false } = options;
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((item) => item.key === current);
  const item = ordered[index];
  if (!item) return ordered[0]?.key ?? null;

  if (key === 'Home' || key === 'End') {
    const scope =
      homeEnd === 'page' || ctrl
        ? ordered
        : ordered.filter((i) => i.row === item.row);
    return (key === 'Home' ? scope[0] : scope.at(-1))?.key ?? null;
  }

  const step = (delta: number) => ordered[index + delta]?.key ?? null;
  if (mode === 'list') {
    if (key === 'ArrowUp') return step(-1);
    if (key === 'ArrowDown') return step(1);
    return null;
  }
  if (key === 'ArrowLeft') return step(-1);
  if (key === 'ArrowRight') return step(1);
  return nearestVertical(ordered, item, key === 'ArrowDown')?.key ?? null;
}
