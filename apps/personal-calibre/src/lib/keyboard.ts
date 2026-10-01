import type { KeyHint as RowHint } from '@rainforest-dev/rainforest-react';

import type { View } from './prefs';

export interface KeyInput {
  key: string;
  modified: boolean;
  typing: boolean;
  inOverlay: boolean;
  paneOpen: boolean;
  hasSelection: boolean;
  page: number;
  pageCount: number;
}

export type Shortcut =
  | { type: 'focus-search' }
  | { type: 'next-view' }
  | { type: 'close-pane' }
  | { type: 'clear-selection' }
  | { type: 'go-to-page'; page: number };

export function resolveShortcut(input: KeyInput): Shortcut | null {
  if (input.typing || input.inOverlay || input.modified) return null;
  switch (input.key) {
    case '/':
      return { type: 'focus-search' };
    case 'v':
      return { type: 'next-view' };
    case 'Escape':
      if (input.paneOpen) return { type: 'close-pane' };
      return input.hasSelection ? { type: 'clear-selection' } : null;
    case '[':
      return input.page > 1
        ? { type: 'go-to-page', page: input.page - 1 }
        : null;
    case ']':
      return input.page < input.pageCount
        ? { type: 'go-to-page', page: input.page + 1 }
        : null;
    default:
      return null;
  }
}

export interface KeyHint extends RowHint {
  paged?: true;
}

const SEARCH: KeyHint = { keys: ['/'], label: 'Search' };
const SWITCH: KeyHint = { keys: ['v'], label: 'Switch view' };
const PAGE: KeyHint = { keys: ['[', ']'], label: 'Page', paged: true };
const OPEN: KeyHint = { keys: ['Enter'], label: 'Open' };
const SELECT_X: KeyHint = { keys: ['x'], label: 'Select' };
const CLOSE: KeyHint = { keys: ['Esc'], label: 'Close, then clear' };

export const KEY_HINTS: Record<View, readonly KeyHint[]> = {
  shelf: [
    SEARCH,
    SWITCH,
    { keys: ['←↑↓→'], label: 'Move' },
    { keys: ['Home', 'End'], label: 'Row ends' },
    PAGE,
    OPEN,
    SELECT_X,
    CLOSE,
  ],
  catalogue: [
    SEARCH,
    SWITCH,
    { keys: ['↑↓'], label: 'Move' },
    PAGE,
    { keys: ['Space'], label: 'Select' },
    OPEN,
    CLOSE,
  ],
  study: [
    SEARCH,
    SWITCH,
    { keys: ['←→'], label: 'Along shelf' },
    { keys: ['↑↓'], label: 'Between shelves' },
    { keys: ['Home', 'End'], label: 'Shelf ends' },
    PAGE,
    OPEN,
    SELECT_X,
    CLOSE,
  ],
};

export function hintsFor(view: View, paged: boolean): readonly KeyHint[] {
  return KEY_HINTS[view].filter((hint) => paged || !hint.paged);
}
