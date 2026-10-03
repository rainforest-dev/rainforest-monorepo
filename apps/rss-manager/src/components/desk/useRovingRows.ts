import {
  createRovingController,
  type NavKey,
  type RovingController,
} from '@rainforest-dev/rainforest-ui/interaction';
import { useCallback, useEffect, useRef, useState } from 'react';

export const ROW_SELECTOR = 'tr[data-nav-key]';

export interface RowFocusRequest {
  name?: string | null;
  index?: number;
  page?: number;
  replacing?: unknown;
  ifIdle?: boolean;
}

export interface RovingRows {
  ref: (el: HTMLElement | null) => void;
  stop: string | null;
  rowAt: (target: EventTarget | null) => string | null;
  move: (key: NavKey) => boolean;
  focus: (request: RowFocusRequest) => void;
  focusNow: (request: RowFocusRequest) => void;
}

const keyOf = (el: HTMLElement) => el.dataset['navKey'] ?? '';

function applyRequest(container: HTMLElement, wanted: RowFocusRequest) {
  const active = document.activeElement;
  if (
    wanted.ifIdle &&
    active &&
    active !== document.body &&
    !container.contains(active)
  )
    return;
  const rows = [...container.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
  const target =
    rows.find((row) => wanted.name != null && keyOf(row) === wanted.name) ??
    (wanted.index === undefined
      ? undefined
      : rows[Math.min(wanted.index, rows.length - 1)]);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest' });
}

export function useRovingRows(
  names: readonly string[],
  { page, data }: { page: number; data: unknown },
): RovingRows {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const controller = useRef<RovingController | null>(null);
  const request = useRef<RowFocusRequest | null>(null);

  useEffect(() => {
    if (!container) return;
    const roving = createRovingController({
      container,
      items: ROW_SELECTOR,
      keyOf,
      mode: 'list',
      homeEnd: 'page',
    });
    controller.current = roving;
    const onFocusIn = (event: FocusEvent) => {
      const row = event.target;
      if (row instanceof HTMLElement && row.matches(ROW_SELECTOR))
        setFocused(keyOf(row));
    };
    container.addEventListener('focusin', onFocusIn);
    return () => {
      container.removeEventListener('focusin', onFocusIn);
      roving.destroy();
      controller.current = null;
    };
  }, [container]);

  useEffect(() => {
    const wanted = request.current;
    if (
      !wanted ||
      (wanted.page !== undefined && wanted.page !== page) ||
      (wanted.replacing !== undefined && wanted.replacing === data)
    )
      return;
    request.current = null;
    if (container) applyRequest(container, wanted);
  });

  const rowAt = useCallback(
    (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      target.matches(ROW_SELECTOR) &&
      container?.contains(target)
        ? keyOf(target)
        : null,
    [container],
  );

  const stop =
    focused !== null && names.includes(focused) ? focused : (names[0] ?? null);

  return {
    ref: setContainer,
    stop,
    rowAt,
    move: (key) => controller.current?.move(key) ?? false,
    focus: (wanted) => {
      request.current = wanted;
    },
    focusNow: (wanted) => {
      if (container) applyRequest(container, wanted);
    },
  };
}
