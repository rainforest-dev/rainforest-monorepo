'use client';

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { bookIdOfNavKey } from '@/lib/group-entries';
import {
  assignRowsByTop,
  isNavKey,
  type NavItem,
  type NavMode,
  pickTarget,
} from '@/lib/roving';

interface Options {
  navKeys: readonly string[];
  mode: NavMode;
  page: number;
  contentKey: string;
}

function collectItems(container: HTMLElement, mode: NavMode): NavItem[] {
  const items = Array.from(
    container.querySelectorAll<HTMLElement>('[data-nav-key]'),
  )
    .filter((el) => el.getClientRects().length > 0)
    .map((el, order) => {
      const r = el.getBoundingClientRect();
      return {
        key: el.dataset['navKey'] ?? '',
        row: el.dataset['navRow'] ?? '',
        order,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    });
  return mode === 'grid' && items.some((i) => i.row === '')
    ? assignRowsByTop(items)
    : items;
}

export function useRovingNav<T extends HTMLElement>({
  navKeys,
  mode,
  page,
  contentKey,
}: Options) {
  const containerRef = useRef<T>(null);
  const { focusId, setFocusId, pendingFocus, requestFocus, toggle, openBook } =
    useLibrary();
  const [active, setActive] = useState<string | null>(null);

  const stopKey =
    (active !== null && navKeys.includes(active) ? active : undefined) ??
    (focusId !== null
      ? navKeys.find((k) => bookIdOfNavKey(k) === focusId)
      : undefined) ??
    navKeys[0] ??
    null;

  const focusElement = useCallback((el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!pendingFocus || !container) return;
    if (pendingFocus.kind === 'first') {
      if (pendingFocus.page !== page) return;
      requestFocus(null);
      focusElement(container.querySelector<HTMLElement>('[data-nav-key]'));
      return;
    }
    requestFocus(null);
    focusElement(
      container.querySelector<HTMLElement>(
        `[data-book-id="${pendingFocus.id}"]`,
      ),
    );
  }, [pendingFocus, page, contentKey, requestFocus, focusElement]);

  const onItemFocus = useCallback(
    (key: string) => {
      setActive(key);
      setFocusId(bookIdOfNavKey(key));
    },
    [setFocusId],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const item = event.target instanceof HTMLElement ? event.target : null;
      const key = item?.dataset['navKey'];
      if (!key || event.altKey) return;
      if (isNavKey(event.key)) {
        event.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const target = pickTarget(
          collectItems(container, mode),
          key,
          event.key,
          { ctrl: event.ctrlKey || event.metaKey },
          mode,
        );
        if (target) {
          focusElement(
            container.querySelector<HTMLElement>(
              `[data-nav-key="${CSS.escape(target)}"]`,
            ),
          );
        }
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      const bookId = bookIdOfNavKey(key);
      if (event.key === 'Enter') {
        event.preventDefault();
        openBook(bookId);
      } else if (event.key === 'x' || event.key === ' ') {
        event.preventDefault();
        toggle(bookId);
      }
    },
    [focusElement, mode, openBook, toggle],
  );

  return { containerRef, stopKey, onItemFocus, onKeyDown };
}
