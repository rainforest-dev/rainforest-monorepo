import type { KeyHint } from '@rainforest-dev/rainforest-react';

import type { Source, Topic } from '@/lib/registry.types';

import {
  canActivate,
  canActivateTopic,
  canDeclineTopic,
  canResubscribe,
  canRetire,
} from './actions.js';
import { DESK_TABS, type DeskTab } from './params.js';

export type RowMoveKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export type DeskCommand =
  | { type: 'move'; key: RowMoveKey }
  | { type: 'page'; page: number }
  | { type: 'open' }
  | { type: 'toggle' }
  | { type: 'activate' }
  | { type: 'retire' }
  | { type: 'decline' }
  | { type: 'resubscribe' }
  | { type: 'focus-search' }
  | { type: 'tab'; tab: DeskTab }
  | { type: 'close-pane' }
  | { type: 'clear-selection' }
  | { type: 'leave-select-mode' };

export type ViewCommand = Exclude<
  DeskCommand,
  { type: 'focus-search' } | { type: 'tab' }
>;

export interface ViewKeyState {
  paneOpen: boolean;
  hasSelection: boolean;
  selectMode: boolean;
  page: number;
  pageCount: number;
  writable: boolean;
}

export type RowKeyState =
  | { source: Pick<Source, 'status' | 'stale'>; pending: boolean }
  | { topic: Pick<Topic, 'status'>; pending: boolean }
  | { queueItem: true; pending: false };

export interface DeskKeyInput {
  key: string;
  modified: boolean;
  typing: boolean;
  inOverlay: boolean;
  view: ViewKeyState | null;
  row: RowKeyState | null;
}

function pageStep(view: ViewKeyState, step: -1 | 1): DeskCommand | null {
  const page = view.page + step;
  return page >= 1 && page <= view.pageCount ? { type: 'page', page } : null;
}

function resolveTopicKey(
  key: string,
  topic: Pick<Topic, 'status'>,
  writes: boolean,
): DeskCommand | null | undefined {
  switch (key) {
    case 'a':
      return writes && canActivateTopic(topic) ? { type: 'activate' } : null;
    case 'd':
      return writes && canDeclineTopic(topic) ? { type: 'decline' } : null;
    case 'Enter':
    case 'r':
      return null;
    default:
      return undefined;
  }
}

function resolveSourceKey(
  key: string,
  source: Pick<Source, 'status' | 'stale'>,
  writes: boolean,
): DeskCommand | null | undefined {
  switch (key) {
    case 'Enter':
      return { type: 'open' };
    case 'a':
      return writes && canActivate(source) ? { type: 'activate' } : null;
    case 'r':
      if (canResubscribe(source)) return { type: 'resubscribe' };
      return writes && canRetire(source) ? { type: 'retire' } : null;
    default:
      return undefined;
  }
}

function resolveQueueKey(key: string): DeskCommand | undefined {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'Home':
    case 'End':
      return { type: 'move', key };
    case 'Enter':
      return { type: 'open' };
    default:
      return undefined;
  }
}

function resolveRowKey(
  key: string,
  row: RowKeyState,
  view: ViewKeyState,
): DeskCommand | null | undefined {
  if ('queueItem' in row) return resolveQueueKey(key);
  const writes = view.writable && !row.pending;
  switch (key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'Home':
    case 'End':
      return { type: 'move', key };
    case 'ArrowLeft':
      return pageStep(view, -1);
    case 'ArrowRight':
      return pageStep(view, 1);
    case 'x':
    case ' ':
      return { type: 'toggle' };
    default:
      return 'topic' in row
        ? resolveTopicKey(key, row.topic, writes)
        : resolveSourceKey(key, row.source, writes);
  }
}

function resolveEscape(view: ViewKeyState | null): DeskCommand | null {
  if (!view) return null;
  if (view.paneOpen) return { type: 'close-pane' };
  if (view.hasSelection) return { type: 'clear-selection' };
  if (view.selectMode) return { type: 'leave-select-mode' };
  return null;
}

export function resolveDeskKey(input: DeskKeyInput): DeskCommand | null {
  if (input.typing || input.inOverlay || input.modified) return null;
  const { key, view, row } = input;
  if (row && view) {
    const command = resolveRowKey(key, row, view);
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
      return view ? pageStep(view, -1) : null;
    case ']':
      return view ? pageStep(view, 1) : null;
    case 'Escape':
      return resolveEscape(view);
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

const TAB_HINT: DeskHint = { keys: ['1', '2', '3'], label: 'Switch tab' };

const TOPICS_HINTS: readonly DeskHint[] = [
  { keys: ['/'], label: 'Search' },
  { keys: ['↑', '↓'], label: 'Move' },
  { keys: ['x'], label: 'Select' },
  { keys: ['a'], label: 'Activate' },
  { keys: ['d'], label: 'Decline' },
  { keys: ['Esc'], label: 'Clear selection' },
  TAB_HINT,
];

const QUEUE_HINTS: readonly DeskHint[] = [
  { keys: ['↑', '↓'], label: 'Move' },
  { keys: ['Enter'], label: 'Open in Reader' },
  TAB_HINT,
];

export const DESK_HINTS: Record<DeskTab, readonly DeskHint[]> = {
  sources: SOURCES_HINTS,
  topics: TOPICS_HINTS,
  queue: QUEUE_HINTS,
};

export function deskHints(tab: DeskTab, paged: boolean): readonly KeyHint[] {
  return DESK_HINTS[tab]
    .filter((hint) => paged || !hint.paged)
    .map(({ keys, label }) => ({ keys, label }));
}
