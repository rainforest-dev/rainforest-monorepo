export type GridLayout = 'year' | 'week' | 'list';
export type GridKey =
  'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const GRID_KEYS: readonly string[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

export const isGridKey = (key: string): key is GridKey =>
  GRID_KEYS.includes(key);

export const isGridLayout = (value: string | undefined): value is GridLayout =>
  value === 'year' || value === 'week' || value === 'list';

type Slot = { date: string; row: string; col: number };

function slotOf(date: string, layout: GridLayout): Slot {
  const month = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  if (layout === 'list') return { date, row: date, col: 0 };
  if (layout === 'year') return { date, row: month, col: day - 1 };
  const lead = new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1),
  ).getUTCDay();
  const index = lead + day - 1;
  return { date, row: `${month}/${Math.floor(index / 7)}`, col: index % 7 };
}

function rowsOf(dates: readonly string[], layout: GridLayout): Slot[][] {
  const rows: Slot[][] = [];
  for (const date of dates) {
    const slot = slotOf(date, layout);
    const last = rows.at(-1);
    if (last?.[0]?.row === slot.row) last.push(slot);
    else rows.push([slot]);
  }
  return rows;
}

function nearest(row: readonly Slot[], col: number): string | undefined {
  let best: Slot | undefined;
  for (const slot of row)
    if (!best || Math.abs(slot.col - col) < Math.abs(best.col - col))
      best = slot;
  return best?.date;
}

export function gridTarget(
  dates: readonly string[],
  current: string,
  key: GridKey,
  layout: GridLayout,
): string | undefined {
  const sorted = [...new Set(dates)].sort();
  const i = sorted.indexOf(current);
  if (i === -1) return undefined;
  if (key === 'ArrowLeft') return sorted[i - 1];
  if (key === 'ArrowRight') return sorted[i + 1];
  if (key === 'Home') return sorted[0];
  if (key === 'End') return sorted.at(-1);
  const rows = rowsOf(sorted, layout);
  const r = rows.findIndex((row) => row.some((slot) => slot.date === current));
  const next = rows[r + (key === 'ArrowDown' ? 1 : -1)];
  return next ? nearest(next, slotOf(current, layout).col) : undefined;
}
