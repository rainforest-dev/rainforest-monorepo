'use client';

import { useCallback, useRef } from 'react';

import type { useRovingNav } from '@/hooks';
import type { StudyBook } from '@/lib';

import type { StudyPull } from './useStudyPull';

export interface StudyOptionState {
  book: StudyBook;
  shelfKey: string;
  selected: boolean;
  open: boolean;
  pulled: boolean;
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
  onPointerDown: () => void;
  onClick: () => void;
}

export function useStudyOptionProps(
  nav: StudyNav,
  pull: StudyPull,
): (state: StudyOptionState) => StudyOptionAttributes {
  const { onItemFocus } = nav;
  const { isPulled, activate, onOptionFocus } = pull;
  const pressed = useRef<{ id: number; wasPulled: boolean } | null>(null);
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
      onFocus: () => {
        onItemFocus(book.navKey);
        onOptionFocus();
      },
      onPointerDown: () => {
        pressed.current = { id: book.id, wasPulled: isPulled(book.id) };
      },
      onClick: () => {
        const press = pressed.current;
        pressed.current = null;
        activate(
          book.id,
          press?.id === book.id ? press.wasPulled : isPulled(book.id),
        );
      },
    }),
    [onItemFocus, onOptionFocus, isPulled, activate],
  );
}
