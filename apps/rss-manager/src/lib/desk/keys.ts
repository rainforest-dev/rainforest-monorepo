import type { KeyHint } from '@rainforest-dev/rainforest-react';

import type { Source } from '@/lib/registry.types';

import { canActivate, canResubscribe, canRetire } from './actions.js';
import { DESK_TABS, type DeskTab } from './params.js';

export type RowMoveKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export type DeskCommand =
  | { type: 'move'; key: RowMoveKey }
  | { type: 'page'; page: number }
  | { type: 'open' }
  | { type: 'toggle' }
  | { type: 'activate' }
  | { type: 'retire' }
  | { type: 'resubscribe' }
  | { type: 'focus-search' }
  | { type: 'tab'; tab: DeskTab }
  | { type: 'close-pane' }
  | { type: 'clear-selection' }
  | { type: 'leave-select-mode' };

export type SourcesCommand = Exclude<
  DeskCommand,
  { type: 'focus-search' } | { type: 'tab' }
>;

export interface SourcesKeyState {
  paneOpen: boolean;
  hasSelection: boolean;
  selectMode: boolean;
  page: number;
  pageCount: number;
  writable: boolean;
}

export interface RowKeyState {
  source: Pick<Source, 'status' | 'stale'>;
  pending: boolean;
}

export interface DeskKeyInput {
  key: string;
  modified: boolean;
  typing: boolean;
  inOverlay: boolean;
  sources: SourcesKeyState | null;
  row: RowKeyState | null;
}

function pageStep(sources: SourcesKeyState, step: -1 | 1): DeskCommand | null {
  const page = sources.page + step;
  return page >= 1 && page <= sources.pageCount ? { type: 'page', page } : null;
}

function resolveRowKey(
  key: string,
  row: RowKeyState,
  sources: SourcesKeyState,
): DeskCommand | null | undefined {
  const writes = sources.writable && !row.pending;
  switch (key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'Home':
    case 'End':
      return { type: 'move', key };
    case 'ArrowLeft':
      return pageStep(sources, -1);
    case 'ArrowRight':
      return pageStep(sources, 1);
    case 'Enter':
      return { type: 'open' };
    case 'x':
    case ' ':
      return { type: 'toggle' };
    case 'a':
      return writes && canActivate(row.source) ? { type: 'activate' } : null;
    case 'r':
      if (canResubscribe(row.source)) return { type: 'resubscribe' };
      return writes && canRetire(row.source) ? { type: 'retire' } : null;
    default:
      return undefined;
  }
}

function resolveEscape(sources: SourcesKeyState | null): DeskCommand | null {
  if (!sources) return null;
  if (sources.paneOpen) return { type: 'close-pane' };
  if (sources.hasSelection) return { type: 'clear-selection' };
  if (sources.selectMode) return { type: 'leave-select-mode' };
  return null;
}

export function resolveDeskKey(input: DeskKeyInput): DeskCommand | null {
  if (input.typing || input.inOverlay || input.modified) return null;
  const { key, sources, row } = input;
  if (row && sources) {
    const command = resolveRowKey(key, row, sources);
    if (command !== undefined) return command;
  }
  switch (key) {
    case '/':
      return { type: 'focus-search' };
    case '1':
    case '2':
    case '3': {
      const tab = DESK_TABS[Number(key) - 1];
      return tab ? { type: 'tab', tab } : null;
    }
    case '[':
      return sources ? pageStep(sources, -1) : null;
    case ']':
      return sources ? pageStep(sources, 1) : null;
    case 'Escape':
      return resolveEscape(sources);
    default:
      return null;
  }
}

export interface DeskHint extends KeyHint {
  paged?: true;
}

const SOURCES_HINTS: readonly DeskHint[] = [
  { keys: ['/'], label: 'Search' },
  { keys: ['↑', '↓'], label: 'Move' },
  { keys: ['←', '→'], label: 'Page', paged: true },
  { keys: ['Enter'], label: 'Details' },
  { keys: ['x'], label: 'Select' },
  { keys: ['a'], label: 'Activate' },
  { keys: ['r'], label: 'Retire' },
  { keys: ['Esc'], label: 'Close, then clear' },
];

const TAB_HINTS: readonly DeskHint[] = [
  { keys: ['1', '2', '3'], label: 'Switch tab' },
];

export const DESK_HINTS: Record<DeskTab, readonly DeskHint[]> = {
  sources: SOURCES_HINTS,
  topics: TAB_HINTS,
  queue: TAB_HINTS,
};

export function deskHints(tab: DeskTab, paged: boolean): readonly KeyHint[] {
  return DESK_HINTS[tab]
    .filter((hint) => paged || !hint.paged)
    .map(({ keys, label }) => ({ keys, label }));
}
