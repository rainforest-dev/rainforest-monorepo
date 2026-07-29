/**
 * Board column sort modes: how a column orders its cards, independent of
 * which column they are grouped into. `board` reproduces today's behaviour
 * (`order` ascending); the other three rank by a different signal and still
 * tie-break on `order`, so cards sharing a key don't reshuffle between
 * renders.
 *
 * Pure comparators only — free of Vue and of `node:*` imports. TasksBoard.vue
 * and TasksPanel.vue are client-hydrated islands (see taskStatus.ts), so
 * anything they import at runtime must stay browser-safe; the `SprintTask`
 * type below is imported type-only for the same reason.
 *
 * There is no existing priority comparator in TypeScript to reuse — the
 * `priority_key` that ranks P0-P3 lives in loopctl's Python and isn't
 * reachable from here, so `priorityRank` below is written fresh.
 */

import type { OutboxState } from './greenlightOutbox.js';
import type { SprintTask } from './tasks.js';

export type SortMode = 'board' | 'priority' | 'points' | 'relay';

export interface SortModeOption {
  id: SortMode;
  label: string;
}

/** Dropdown/segmented-control options, in display order. */
export const SORT_MODES: readonly SortModeOption[] = [
  { id: 'board', label: 'Board' },
  { id: 'priority', label: 'Priority' },
  { id: 'points', label: 'Points' },
  { id: 'relay', label: 'Relay' },
];

export const DEFAULT_SORT_MODE: SortMode = 'board';

/** `order` ascending — every mode ties on this so equal-key cards hold still. */
function byOrder(a: SprintTask, b: SprintTask): number {
  return a.order - b.order;
}

// P0 (most urgent) → P3; anything else, including no priority, sorts last.
const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function priorityRank(priority: SprintTask['priority']): number {
  if (priority == null) return Number.POSITIVE_INFINITY;
  return PRIORITY_RANK[priority] ?? Number.POSITIVE_INFINITY;
}

function pointsRank(points: SprintTask['points']): number {
  return points ?? Number.POSITIVE_INFINITY;
}

// applied/duplicate (Air has it) → pending (queued) → failed (needs a look)
// → none/unset (no relay activity at all) last.
const RELAY_RANK: Record<OutboxState, number> = {
  applied: 0,
  duplicate: 0,
  pending: 1,
  failed: 2,
  none: 3,
};

function relayRank(state: SprintTask['outboxState']): number {
  return RELAY_RANK[state ?? 'none'] ?? RELAY_RANK.none;
}

export function compareByPriority(a: SprintTask, b: SprintTask): number {
  return priorityRank(a.priority) - priorityRank(b.priority) || byOrder(a, b);
}

export function compareByPoints(a: SprintTask, b: SprintTask): number {
  return pointsRank(a.points) - pointsRank(b.points) || byOrder(a, b);
}

export function compareByRelay(a: SprintTask, b: SprintTask): number {
  return relayRank(a.outboxState) - relayRank(b.outboxState) || byOrder(a, b);
}

/**
 * Comparator for each mode. `Array#sort` is stable, so a tie (score 0) keeps
 * the pair's existing array order — which is exactly what `board`'s
 * `order`-ascending tie-break needs when two cards share an `order` value.
 */
export const SORT_COMPARATORS: Record<SortMode, (a: SprintTask, b: SprintTask) => number> = {
  board: byOrder,
  priority: compareByPriority,
  points: compareByPoints,
  relay: compareByRelay,
};
