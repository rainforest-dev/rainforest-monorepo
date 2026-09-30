import { type GridKey, gridTarget, isGridLayout } from '../grid-nav.ts';

const CELL = 'a[data-date]';

export function setStop(cell: HTMLElement) {
  const grid = cell.closest<HTMLElement>('[data-grid]');
  if (!grid) return;
  for (const other of grid.querySelectorAll<HTMLElement>(
    `${CELL}[tabindex="0"]`,
  ))
    other.tabIndex = -1;
  cell.tabIndex = 0;
}

export function moveInGrid(key: GridKey) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  const grid = active.closest<HTMLElement>('[data-grid]');
  const layout = grid?.dataset['grid'];
  const date = active.dataset['date'];
  if (!grid || !isGridLayout(layout) || !date) return;
  const cells = [...grid.querySelectorAll<HTMLElement>(CELL)];
  const target = gridTarget(
    cells.flatMap((cell) => cell.dataset['date'] ?? []),
    date,
    key,
    layout,
  );
  const next = cells.find((cell) => cell.dataset['date'] === target);
  if (!next) return;
  setStop(next);
  next.focus();
}
