'use client';

import { useCallback } from 'react';

import type { useRovingNav } from '@/hooks';
import type { StudyBook } from '@/lib';
import { useLibrary } from '@/providers';

export interface StudyOptionState {
  book: StudyBook;
  shelfKey: string;
  selected: boolean;
  open: boolean;
  tabIndex: 0 | -1;
}

export type StudyNav = ReturnType<typeof useRovingNav<HTMLDivElement>>;

export interface StudyOptionAttributes {
  role: 'option';
  'aria-selected': boolean;
  'aria-label': string;
  'data-nav-key': string;
  'data-nav-row': string;
  'data-book-id': number;
  'data-open': true | undefined;
  'data-selected': true | undefined;
  lang: 'zh-Hant' | undefined;
  tabIndex: 0 | -1;
  onFocus: () => void;
  onClick: () => void;
}

export function useStudyOptionProps(
  nav: StudyNav,
): (state: StudyOptionState) => StudyOptionAttributes {
  const { selectMode, toggle, openBook } = useLibrary();
  const { onItemFocus } = nav;
  return useCallback(
    ({ book, shelfKey, selected, open, tabIndex }) => ({
      role: 'option',
      'aria-selected': selected,
      'aria-label': `${book.title}, ${book.authors.join(', ')}`,
      'data-nav-key': book.navKey,
      'data-nav-row': shelfKey,
      'data-book-id': book.id,
      'data-open': open || undefined,
      'data-selected': selected || undefined,
      lang: book.cjk ? 'zh-Hant' : undefined,
      tabIndex,
      onFocus: () => onItemFocus(book.navKey),
      onClick: () => (selectMode ? toggle(book.id) : openBook(book.id)),
    }),
    [onItemFocus, openBook, selectMode, toggle],
  );
}
