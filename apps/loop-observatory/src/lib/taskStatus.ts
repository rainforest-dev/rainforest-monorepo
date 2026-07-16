/**
 * Status → themed color mapping for sprint tasks, shared by the Kanban board and
 * the flow graph so the two views agree on what each status looks like.
 *
 * This module is intentionally free of `node:*` imports: the board and flow are
 * client-hydrated islands, so anything they import at runtime must stay
 * browser-safe (the task *types* still come type-only from `tasks.ts`). Colors
 * reuse the themed chart/status tokens from `app.css` (light + dark aware).
 */

/** Canonical Notion status order (also the fallback when the file omits it). */
export const DEFAULT_STATUSES = [
  'Backlog',
  'Not started',
  'In progress / PR',
  'In QA',
  'Done',
  'Released',
  'Closed',
  'Blocked',
] as const;

/**
 * Columns the board always renders even when empty — the active middle of the
 * flow, so a sprint never looks "missing" a stage just because no card sits in
 * it yet.
 */
export const ALWAYS_SHOWN_STATUSES: readonly string[] = [
  'Not started',
  'In progress / PR',
  'In QA',
  'Done',
];

// Flow-stage colors drawn from the themed tokens: grey (parked) → blue (queued)
// → amber (in flight) → aqua (in review) → green (done) → red (blocked). The loop
// sub-states (below the divider) reuse the same palette so a "PR ready" pill reads
// as the same aqua "in review" family as the column it lives in.
const STATUS_COLOR: Record<string, string> = {
  Backlog: 'var(--muted-foreground)',
  'Not started': 'var(--chart-1)',
  'In progress / PR': 'var(--status-warning)',
  'In QA': 'var(--chart-2)',
  Done: 'var(--status-good)',
  Released: 'var(--status-good)',
  Closed: 'var(--muted-foreground)',
  Blocked: 'var(--status-critical)',
  // Loop sub-states (finer than the Notion columns above).
  Queued: 'var(--chart-1)',
  'Needs tuning': 'var(--status-warning)',
  'Spec drafted': 'var(--chart-1)',
  'Split drafted': 'var(--chart-1)',
  'In progress': 'var(--status-warning)',
  'PR ready': 'var(--chart-2)',
  Merged: 'var(--status-good)',
};

/** Themed color for a status; unknown statuses fall back to the muted token. */
export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? 'var(--muted-foreground)';
}

/** Translucent fill (the status color at low alpha) for cards/nodes/pills. */
export function statusSoftBg(status: string): string {
  return `color-mix(in oklab, ${statusColor(status)} 12%, transparent)`;
}

/**
 * Loop sub-states finer than Notion's columns → the board column they place in.
 * The loop tracks a richer lifecycle than Notion's collapsed columns, so e.g.
 * "PR ready" and "In progress" both live in the one "In progress / PR" lane,
 * while "Spec drafted" / "Split drafted" hold in the "Not started" lane (see
 * loop.md §6). The card/detail then surface the precise sub-state on top.
 */
const LOOP_STAGE_COLUMN: Record<string, string> = {
  Queued: 'Not started',
  'Needs tuning': 'Not started',
  // Draft = a holding state in the "Not started" lane while the owner makes the
  // revise / split decision. On decision the task LEAVES draft → plain "Not
  // started" task(s)/sub-task(s) (overlay entry cleared; a split becomes real
  // Notion sub-tasks that re-sync as their own notes).
  'Spec drafted': 'Not started',
  'Split drafted': 'Not started',
  'In progress': 'In progress / PR',
  'PR ready': 'In progress / PR',
  Merged: 'Done',
};

/**
 * The board column a loop status places its card in, or `null` when the loop
 * label shouldn't move the card at all (an unknown loop-only label). A loop
 * status that is itself a real board column maps to that column; a finer
 * sub-state maps via `LOOP_STAGE_COLUMN`.
 */
function loopColumn(
  loopStatus: string | null | undefined,
  statuses: readonly string[],
): string | null {
  if (!loopStatus) return null;
  if (statuses.includes(loopStatus)) return loopStatus;
  const col = LOOP_STAGE_COLUMN[loopStatus];
  return col && statuses.includes(col) ? col : null;
}

/**
 * The column a card/node should render in. The loop overlay wins when it has one
 * (the loop moved the task) — either a real column directly, or a finer sub-state
 * mapped onto its column; otherwise the Notion status wins for placement.
 */
export function effectiveStatus(
  notionStatus: string,
  loopStatus: string | null | undefined,
  statuses: readonly string[],
): string {
  return loopColumn(loopStatus, statuses) ?? notionStatus;
}

/**
 * The loop label to surface as a pill next to a card — shown whenever the loop
 * tracks a state more specific than the column it sits in: a finer sub-state
 * ("PR ready" inside the "In progress / PR" lane) or a label that doesn't move
 * the card at all ("Needs tuning"). Returns `null` when the loop status *is* the
 * column (the ◆ marker already conveys "loop-tracked") or is unset.
 */
export function loopStageLabel(
  loopStatus: string | null | undefined,
  statuses: readonly string[],
): string | null {
  if (!loopStatus) return null;
  const col = loopColumn(loopStatus, statuses);
  if (col === null) return loopStatus; // label that doesn't move the card
  return loopStatus === col ? null : loopStatus; // finer than its column
}

// Priority palette per the board legend: P0 red, P1 orange, P2 green, P3 blue.
const PRIORITY_COLOR: Record<string, string> = {
  P0: 'var(--status-critical)',
  P1: 'var(--status-warning)',
  P2: 'var(--status-good)',
  P3: 'var(--chart-1)',
};

/** Themed color for a priority label, or `null` when the task has no priority. */
export function priorityColor(priority: string | null): string | null {
  if (!priority) return null;
  return PRIORITY_COLOR[priority] ?? 'var(--muted-foreground)';
}

/** Visual treatment for a task's scope badge, shared by the board and flow. */
export interface ScopeBadge {
  label: string;
  color: string;
  bg: string;
}

/**
 * Scope → subtle badge style. `personal` (from Obsidian) gets a violet accent
 * (themed via `--scope-personal`); everything else (`work`, from Notion) stays
 * neutral/muted so it recedes.
 */
export function scopeBadge(scope: string): ScopeBadge {
  if (scope === 'personal') {
    return {
      label: 'personal',
      color: 'var(--scope-personal)',
      bg: 'color-mix(in oklab, var(--scope-personal) 14%, transparent)',
    };
  }
  return { label: 'work', color: 'var(--muted-foreground)', bg: 'var(--muted)' };
}
