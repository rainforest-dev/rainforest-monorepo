import {
  type NavKey,
  pickTarget,
} from '@rainforest-dev/rainforest-ui/interaction';

export {
  type NavKey as GridKey,
  isNavKey as isGridKey,
} from '@rainforest-dev/rainforest-ui/interaction';

export type GridLayout = 'year' | 'week' | 'list';

export const isGridLayout = (value: string | undefined): value is GridLayout =>
  value === 'year' || value === 'week' || value === 'list';

const WEEKS_PER_MONTH = 6;
const DAY_MS = 86_400_000;

export function slotOf(
  date: string,
  layout: GridLayout,
): { row: number; col: number } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  const day = Number(date.slice(8, 10));
  if (layout === 'list')
    return { row: Date.UTC(year, month, day) / DAY_MS, col: 0 };
  const monthRow = year * 12 + month;
  if (layout === 'year') return { row: monthRow, col: day - 1 };
  const index = new Date(Date.UTC(year, month, 1)).getUTCDay() + day - 1;
  return {
    row: monthRow * WEEKS_PER_MONTH + Math.floor(index / 7),
    col: index % 7,
  };
}

export function gridTarget(
  dates: readonly string[],
  current: string,
  key: NavKey,
  layout: GridLayout,
): string | undefined {
  const sorted = [...new Set(dates)].sort();
  if (!sorted.includes(current)) return undefined;
  const items = sorted.map((date, order) => ({
    key: date,
    order,
    ...slotOf(date, layout),
  }));
  return (
    pickTarget(items, current, key, { mode: 'grid', homeEnd: 'page' }) ??
    undefined
  );
}
