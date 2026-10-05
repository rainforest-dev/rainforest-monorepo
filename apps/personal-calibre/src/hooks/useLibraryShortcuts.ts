'use client';

import {
  hasModifier,
  isInOverlay,
  isTypingTarget,
  listenForShortcuts,
} from '@rainforest-dev/rainforest-ui/interaction';
import { useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { nextView, parseLibraryParams, resolveShortcut } from '@/lib';
import { useLibrary } from '@/providers';

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
    return listenForShortcuts((event) => {
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
        modified: hasModifier(event),
        typing: isTypingTarget(target),
        inOverlay: isInOverlay(target),
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
    });
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
