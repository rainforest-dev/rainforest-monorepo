import {
  assignRowsByTop,
  type NavItem,
  type NavKey,
  type NavMode,
  pickTarget,
} from './roving.js';

export interface RovingControllerOptions {
  container: HTMLElement;
  items: string;
  keyOf: (el: HTMLElement) => string;
  rowOf?: (el: HTMLElement) => number;
  colOf?: (el: HTMLElement) => number;
  mode?: NavMode;
  homeEnd?: 'row' | 'page';
}

export interface RovingController {
  move(key: NavKey, mods?: { ctrl?: boolean }): boolean;
  setStop(el: HTMLElement): void;
  destroy(): void;
}

/**
 * Keeps one tab stop among the cells of a container and moves focus between
 * them with `pickTarget`.
 */
export function createRovingController(
  options: RovingControllerOptions,
): RovingController {
  const { container, items, keyOf, rowOf, colOf, mode, homeEnd } = options;

  const cells = () => [...container.querySelectorAll<HTMLElement>(items)];
  const rendered = () => cells().filter((el) => el.getClientRects().length > 0);

  const rectOf = (el: HTMLElement) => {
    const { left, top, width, height } = el.getBoundingClientRect();
    return { left, top, width, height };
  };

  const place = (el: HTMLElement, order: number) => ({
    key: keyOf(el),
    order,
    ...(colOf ? { col: colOf(el) } : { rect: rectOf(el) }),
  });

  const navItems = (els: readonly HTMLElement[]): NavItem[] =>
    rowOf
      ? els.map((el, order) => ({ ...place(el, order), row: rowOf(el) }))
      : assignRowsByTop(els.map(place));

  const setStop = (el: HTMLElement) => {
    for (const cell of cells()) cell.tabIndex = -1;
    el.tabIndex = 0;
  };

  const current = (els: readonly HTMLElement[]) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && els.includes(active)) return active;
    return els.find((el) => el.tabIndex === 0) ?? null;
  };

  const move = (key: NavKey, mods: { ctrl?: boolean } = {}) => {
    const els = rendered();
    const from = current(els);
    const target = pickTarget(navItems(els), from && keyOf(from), key, {
      mode,
      homeEnd,
      ctrl: mods.ctrl,
    });
    const next = els.find((el) => keyOf(el) === target);
    if (!next || next === from) return false;
    setStop(next);
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest' });
    return true;
  };

  const onFocusIn = (event: FocusEvent) => {
    const cell =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(items)
        : null;
    if (cell && container.contains(cell)) setStop(cell);
  };
  container.addEventListener('focusin', onFocusIn);

  return {
    move,
    setStop,
    destroy: () => container.removeEventListener('focusin', onFocusIn),
  };
}
