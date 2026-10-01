import {
  createRovingController,
  type RovingController,
} from '@rainforest-dev/rainforest-ui/interaction';

import { type GridKey, isGridLayout, slotOf } from '@/lib/grid-nav.ts';

const controllers = new WeakMap<HTMLElement, RovingController>();

function controllerOf(cell: Element): RovingController | undefined {
  const grid = cell.closest<HTMLElement>('[data-grid]');
  const layout = grid?.dataset['grid'];
  if (!grid || !isGridLayout(layout)) return undefined;
  let controller = controllers.get(grid);
  if (!controller) {
    const dateOf = (el: HTMLElement) => el.dataset['date'] ?? '';
    controller = createRovingController({
      container: grid,
      items: 'a[data-date]',
      keyOf: dateOf,
      rowOf: (el) => slotOf(dateOf(el), layout).row,
      colOf: (el) => slotOf(dateOf(el), layout).col,
      mode: 'grid',
      homeEnd: 'page',
    });
    controllers.set(grid, controller);
  }
  return controller;
}

export function setStop(cell: HTMLElement) {
  controllerOf(cell)?.setStop(cell);
}

export function moveInGrid(key: GridKey) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.dataset['date']) return;
  controllerOf(active)?.move(key);
}
