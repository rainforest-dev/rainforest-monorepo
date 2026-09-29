'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { resolveShortcut } from '@/lib/keyboard';
import { parseLibraryParams } from '@/lib/library-params';
import { nextView } from '@/lib/prefs';

const TYPING =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const OVERLAY =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [data-slot="select-content"], [data-slot="popover-content"]';
const TOOLBAR = '[role="toolbar"]';

export function useLibraryShortcuts(enabled: boolean) {
  const {
    view,
    setView,
    closeBook,
    clear,
    selected,
    pageInfo,
    goToPage,
    focusId,
    requestFocus,
    focusAfterToolbar,
    isPending,
  } = useLibrary();
  const paneOpen = parseLibraryParams(useSearchParams()).book !== null;

  const stateRef = useRef({
    view,
    selected,
    pageInfo,
    focusId,
    paneOpen,
    isPending,
  });
  useLayoutEffect(() => {
    stateRef.current = {
      view,
      selected,
      pageInfo,
      focusId,
      paneOpen,
      isPending,
    };
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const {
        view: currentView,
        selected: currentSelected,
        pageInfo: currentPageInfo,
        focusId: currentFocusId,
        paneOpen: currentPaneOpen,
        isPending: currentIsPending,
      } = stateRef.current;
      const target = event.target instanceof Element ? event.target : null;
      const shortcut = resolveShortcut({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        typing: target?.closest(TYPING) != null,
        inOverlay: target?.closest(OVERLAY) != null,
        paneOpen: currentPaneOpen,
        hasSelection: currentSelected.size > 0,
        page: currentPageInfo.page,
        pageCount: currentPageInfo.pageCount,
      });
      if (!shortcut) return;
      if (shortcut.type === 'go-to-page' && currentIsPending) return;
      event.preventDefault();
      switch (shortcut.type) {
        case 'focus-search':
          document
            .querySelector<HTMLInputElement>('[data-library-search] input')
            ?.focus();
          break;
        case 'next-view':
          if (
            currentFocusId !== null &&
            document.activeElement?.closest('[data-view-region]')
          ) {
            requestFocus({ kind: 'book', id: currentFocusId });
          }
          setView(nextView(currentView));
          break;
        case 'close-pane':
          closeBook();
          break;
        case 'clear-selection':
          if (target?.closest(TOOLBAR)) focusAfterToolbar();
          clear();
          break;
        case 'go-to-page':
          goToPage(shortcut.page);
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    setView,
    closeBook,
    clear,
    goToPage,
    requestFocus,
    focusAfterToolbar,
  ]);
}
