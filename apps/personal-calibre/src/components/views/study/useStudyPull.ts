'use client';

import { type RefObject, useCallback, useRef, useState } from 'react';

import { bookIdOfNavKey } from '@/lib';
import { useLibrary } from '@/providers';

export interface StudyPull {
  pulledId: number | null;
  scrubbing: boolean;
  isPulled: (bookId: number) => boolean;
  activate: (bookId: number, wasPulled: boolean) => void;
  pullAt: (bookId: number, options?: { scroll?: boolean }) => void;
  step: (delta: -1 | 1) => void;
  dismiss: () => void;
  onOptionFocus: () => void;
  setScrubbing: (scrubbing: boolean) => void;
}

export function useStudyPull({
  navKeys,
  containerRef,
  scrollOnStep,
}: {
  navKeys: readonly string[];
  containerRef: RefObject<HTMLElement | null>;
  scrollOnStep: boolean;
}): StudyPull {
  const { focusId, selectMode, toggle, openBook } = useLibrary();
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const onPage =
    focusId !== null && navKeys.some((key) => bookIdOfNavKey(key) === focusId);
  const pulledId = onPage && focusId !== dismissed ? focusId : null;
  const pulledRef = useRef(pulledId);
  pulledRef.current = pulledId;

  const pullAt = useCallback(
    (bookId: number, { scroll = false }: { scroll?: boolean } = {}) => {
      setDismissed(null);
      const element = containerRef.current?.querySelector<HTMLElement>(
        `[data-book-id="${bookId}"]`,
      );
      if (!element) return;
      element.focus({ preventScroll: true, focusVisible: false });
      if (scroll) element.scrollIntoView({ block: 'nearest' });
    },
    [containerRef],
  );

  const activate = useCallback(
    (bookId: number, wasPulled: boolean) => {
      if (selectMode) toggle(bookId);
      else if (wasPulled) openBook(bookId);
      else pullAt(bookId);
    },
    [selectMode, toggle, openBook, pullAt],
  );

  const step = useCallback(
    (delta: -1 | 1) => {
      const from = pulledRef.current;
      const index = navKeys.findIndex((key) => bookIdOfNavKey(key) === from);
      const target = index < 0 ? undefined : navKeys[index + delta];
      if (target) pullAt(bookIdOfNavKey(target), { scroll: scrollOnStep });
    },
    [navKeys, pullAt, scrollOnStep],
  );

  const isPulled = useCallback(
    (bookId: number) => pulledRef.current === bookId,
    [],
  );
  const dismiss = useCallback(() => setDismissed(pulledRef.current), []);
  const onOptionFocus = useCallback(() => setDismissed(null), []);

  return {
    pulledId,
    scrubbing,
    isPulled,
    activate,
    pullAt,
    step,
    dismiss,
    onOptionFocus,
    setScrubbing,
  };
}
