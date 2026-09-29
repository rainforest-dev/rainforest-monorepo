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
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NavItem {
  key: string;
  row: string;
  order: number;
  rect: NavRect;
}

const VERTICAL_WEIGHT = 4;

export function isNavKey(key: string): key is NavKey {
  return NAV_KEYS.some((k) => k === key);
}

export function assignRowsByTop(items: readonly NavItem[]): NavItem[] {
  return items.map((item) => ({
    ...item,
    row: String(Math.round(item.rect.y)),
  }));
}

const centerX = (rect: NavRect) => rect.x + rect.width / 2;

function nearestVertical(
  items: readonly NavItem[],
  current: NavItem,
  down: boolean,
): NavItem | null {
  let best: NavItem | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    if (item.row === current.row) continue;
    const gap = down
      ? item.rect.y - (current.rect.y + current.rect.height)
      : current.rect.y - (item.rect.y + item.rect.height);
    if (gap < -1) continue;
    const score =
      Math.abs(centerX(item.rect) - centerX(current.rect)) +
      VERTICAL_WEIGHT * Math.max(0, gap);
    if (score < bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

export function pickTarget(
  items: readonly NavItem[],
  current: string,
  key: NavKey,
  mods: { ctrl: boolean },
  mode: NavMode = 'grid',
): string | null {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((item) => item.key === current);
  const item = ordered[index];
  if (!item) return ordered[0]?.key ?? null;

  if (key === 'Home' || key === 'End') {
    const scope = mods.ctrl
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
