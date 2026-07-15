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
// → amber (in flight) → aqua (in review) → green (done) → red (blocked).
const STATUS_COLOR: Record<string, string> = {
  Backlog: 'var(--muted-foreground)',
  'Not started': 'var(--chart-1)',
  'In progress / PR': 'var(--status-warning)',
  'In QA': 'var(--chart-2)',
  Done: 'var(--status-good)',
  Released: 'var(--status-good)',
  Closed: 'var(--muted-foreground)',
  Blocked: 'var(--status-critical)',
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
 * The status a card/node should render as. When the loop reports a `loopStatus`
 * that is one of the board's real statuses, it overrides the Notion status
 * (the loop moved the task); a loop-only label (e.g. "Needs tuning") does not
 * move the card — the Notion status wins for placement.
 */
export function effectiveStatus(
  notionStatus: string,
  loopStatus: string | null | undefined,
  statuses: readonly string[],
): string {
  return loopStatus && statuses.includes(loopStatus) ? loopStatus : notionStatus;
}

/** Whether `loopStatus` is a loop-only label (set, but not a real board column). */
export function isLoopOnlyStatus(
  loopStatus: string | null | undefined,
  statuses: readonly string[],
): boolean {
  return Boolean(loopStatus) && !statuses.includes(loopStatus as string);
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
