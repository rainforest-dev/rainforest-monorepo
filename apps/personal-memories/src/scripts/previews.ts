import {
  LONG_PRESS_MS,
  movedBeyond,
  placePreview,
  type Point,
  PREVIEW_HIDE_MS,
  PREVIEW_MOVE_PX,
  showDelay,
} from '@/lib';
import { openPreview } from '@/lib/client';

const CELL = '[data-preview-cell]';

type Timer = ReturnType<typeof setTimeout>;

let open: HTMLElement | undefined;
let pinned = false;
let showTimer: Timer | undefined;
let hideTimer: Timer | undefined;
let quiet: Element | undefined;
let press: { cell: HTMLElement; start: Point; timer: Timer } | undefined;
let swallow: HTMLElement | undefined;
let pendingRelease: HTMLElement | undefined;
let closingTap = false;

const cellOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>(CELL) : null;

const previewOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(':scope > [data-preview]');

function cancelTimers() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
}

function hide() {
  cancelTimers();
  const preview = open && previewOf(open);
  open = undefined;
  pinned = false;
  // Fall back to whatever popover is actually open, so a stale `open` (a bfcache restore, a state slip) can't leave a visible preview that Escape or a closing tap no longer reaches.
  const target = preview?.matches(':popover-open') ? preview : openPreview();
  target?.hidePopover();
}

export const closePreview = hide;

function show(cell: HTMLElement) {
  cancelTimers();
  if (open === cell) return;
  hide();
  const preview = previewOf(cell);
  if (!preview) return;
  preview.showPopover();
  open = cell;
  if (CSS.supports('position-area: top')) return;
  const { top, left } = placePreview(
    cell.getBoundingClientRect(),
    preview.getBoundingClientRect(),
    { width: innerWidth, height: innerHeight },
  );
  preview.style.top = `${top}px`;
  preview.style.left = `${left}px`;
}

function cancelPress() {
  if (press) clearTimeout(press.timer);
  press = undefined;
}

export function focusWithoutPreview(el: HTMLElement) {
  quiet = el;
  el.focus({ preventScroll: true });
  quiet = undefined;
}

export function startPreviews() {
  document.addEventListener(
    'toggle',
    (event) => {
      if (
        !(event instanceof ToggleEvent) ||
        event.newState !== 'closed' ||
        !open ||
        event.target !== previewOf(open)
      )
        return;
      // Releasing a long press light-dismisses the hint popover as an outside click; re-show it once.
      if (pinned && pendingRelease === open) {
        pendingRelease = undefined;
        return void previewOf(open)?.showPopover();
      }
      open = undefined;
      pinned = false;
    },
    true,
  );

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const cell = cellOf(event.target);
    if (!cell || cell.contains(event.relatedTarget as Node | null)) return;
    if (cell === open) return clearTimeout(hideTimer);
    clearTimeout(showTimer);
    const delay = showDelay(open !== undefined);
    if (delay === 0) show(cell);
    else showTimer = setTimeout(() => show(cell), delay);
  });

  document.addEventListener('pointerout', (event) => {
    if (event.pointerType !== 'mouse') return;
    const cell = cellOf(event.target);
    if (!cell || cell.contains(event.relatedTarget as Node | null)) return;
    clearTimeout(showTimer);
    if (cell === open && !pinned) hideTimer = setTimeout(hide, PREVIEW_HIDE_MS);
  });

  document.addEventListener('focusin', (event) => {
    const cell = cellOf(event.target);
    if (!cell || cell !== event.target || cell === quiet) return;
    if (cell.matches(':focus-visible')) show(cell);
  });

  document.addEventListener('focusout', (event) => {
    const cell = cellOf(event.target);
    if (cell && cell === open && !pinned && !cell.matches(':hover')) hide();
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      swallow = undefined;
      pendingRelease = undefined;
      closingTap = pinned;
      if (pinned) hide();
      if (event.pointerType !== 'touch') return;
      const cell = cellOf(event.target);
      if (!cell) return;
      press = {
        cell,
        start: { x: event.clientX, y: event.clientY },
        timer: setTimeout(() => {
          press = undefined;
          show(cell);
          pinned = true;
          swallow = cell;
          pendingRelease = cell;
        }, LONG_PRESS_MS),
      };
    },
    true,
  );

  document.addEventListener(
    'pointermove',
    (event) => {
      if (
        press &&
        event.pointerType === 'touch' &&
        movedBeyond(
          press.start,
          { x: event.clientX, y: event.clientY },
          PREVIEW_MOVE_PX,
        )
      )
        cancelPress();
    },
    { passive: true },
  );
  document.addEventListener('pointerup', cancelPress, true);
  document.addEventListener('pointercancel', cancelPress, true);

  document.addEventListener(
    'contextmenu',
    (event) => {
      if (press || (pinned && cellOf(event.target) === open))
        event.preventDefault();
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      // A touch's click always fires on whatever is under the finger, regardless of what pointerdown did.
      if (closingTap || (swallow && cellOf(event.target) === swallow)) {
        event.preventDefault();
        event.stopPropagation();
      }
      closingTap = false;
      swallow = undefined;
    },
    true,
  );

  if (!CSS.supports('position-area: top'))
    addEventListener(
      'scroll',
      () => {
        if (open) hide();
      },
      { capture: true, passive: true },
    );

  // A bfcache restore resurrects this module's state as-is; clear every per-gesture flag before the page freezes.
  window.addEventListener('pagehide', () => {
    cancelPress();
    hide();
    swallow = undefined;
    pendingRelease = undefined;
    closingTap = false;
  });
}
