import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRovingController } from './roving-dom.js';

const COLS = 3;

function mount(count: number) {
  const container = document.createElement('div');
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('button');
    cell.dataset['key'] = `k${i}`;
    cell.dataset['row'] = String(Math.floor(i / COLS));
    cell.dataset['col'] = String(i % COLS);
    cell.tabIndex = i === 0 ? 0 : -1;
    container.append(cell);
  }
  document.body.append(container);
  return container;
}

const cell = (container: HTMLElement, key: string) =>
  container.querySelector(`[data-key="${key}"]`) as HTMLElement;

describe('createRovingController', () => {
  let container: HTMLElement;
  let controller: ReturnType<typeof createRovingController>;

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
      function (this: HTMLElement) {
        const length = this.hidden ? 0 : 1;
        return { length } as DOMRectList;
      },
    );
    HTMLElement.prototype.scrollIntoView = vi.fn();
    container = mount(7);
    controller = createRovingController({
      container,
      items: 'button',
      keyOf: (el) => el.dataset['key'] ?? '',
      rowOf: (el) => Number(el.dataset['row']),
      colOf: (el) => Number(el.dataset['col']),
    });
  });

  afterEach(() => {
    controller.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  it('setStop leaves exactly one tab stop', () => {
    controller.setStop(cell(container, 'k4'));
    const stops = [...container.querySelectorAll('button')].filter(
      (el) => el.tabIndex === 0,
    );
    expect(stops.map((el) => el.dataset['key'])).toEqual(['k4']);
  });

  it('moves the tab stop to a cell that gains focus', () => {
    cell(container, 'k5').focus();
    expect(cell(container, 'k5').tabIndex).toBe(0);
    expect(cell(container, 'k0').tabIndex).toBe(-1);
  });

  it('moves focus by row and column and scrolls it into view', () => {
    cell(container, 'k1').focus();
    expect(controller.move('ArrowDown')).toBe(true);
    const next = cell(container, 'k4');
    expect(document.activeElement).toBe(next);
    expect(next.tabIndex).toBe(0);
    expect(next.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    expect(controller.move('ArrowRight')).toBe(true);
    expect(document.activeElement).toBe(cell(container, 'k5'));
    expect(controller.move('ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(cell(container, 'k6'));
  });

  it('honours Ctrl for Home and End', () => {
    cell(container, 'k4').focus();
    controller.move('End');
    expect(document.activeElement).toBe(cell(container, 'k5'));
    controller.move('Home', { ctrl: true });
    expect(document.activeElement).toBe(cell(container, 'k0'));
  });

  it('clamps at the edges and reports no move', () => {
    cell(container, 'k6').focus();
    expect(controller.move('ArrowRight')).toBe(false);
    expect(controller.move('ArrowDown')).toBe(false);
    expect(document.activeElement).toBe(cell(container, 'k6'));
  });

  it('starts from the tab stop when focus is outside the container', () => {
    controller.setStop(cell(container, 'k2'));
    expect(controller.move('ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(cell(container, 'k5'));
  });

  it('skips cells that are not rendered', () => {
    cell(container, 'k4').hidden = true;
    cell(container, 'k3').focus();
    controller.move('ArrowRight');
    expect(document.activeElement).toBe(cell(container, 'k5'));
  });

  it('derives rows from the rendered rects when rowOf is not given', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const row = Number(this.dataset['row']);
        const col = Number(this.dataset['col']);
        return new DOMRect(col * 170, row * 300, 148, 272);
      },
    );
    const byRect = createRovingController({
      container,
      items: 'button',
      keyOf: (el) => el.dataset['key'] ?? '',
    });
    cell(container, 'k2').focus();
    expect(byRect.move('ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(cell(container, 'k5'));
    byRect.destroy();
  });

  it('stops tracking focus after destroy', () => {
    controller.destroy();
    cell(container, 'k3').focus();
    expect(cell(container, 'k3').tabIndex).toBe(-1);
    expect(cell(container, 'k0').tabIndex).toBe(0);
  });
});
