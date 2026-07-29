import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type MachineBudget,
  type MachineBudgetMap,
  readMachineBudgets,
} from './budget.js';

/** Loop budget mode per the autonomous-task-loop §0 thresholds. */
export type BudgetMode = 'green' | 'yellow' | 'red' | 'dark';

export interface ClaimedTask {
  task: string;
}

export interface BlockedTask {
  task: string;
  reason: string;
}

/** A `<!-- last round <date>: <note> -->` marker from the task queue. */
export interface RoundMarker {
  date: string;
  note: string;
}

/** A round heading from PROGRESS.md (`## <date> — <title>`). */
export interface ProgressEntry {
  date: string;
  title: string;
}

export interface LoopState {
  claimed: ClaimedTask[];
  blocked: BlockedTask[];
  recent_rounds: RoundMarker[];
  recent_progress: ProgressEntry[];
  last_handoff: string | null;
  budget_mode_by_machine: Record<string, BudgetMode>;
}

function vaultBase(): string {
  return process.env.VAULT_PATH ?? '/vault';
}

export function taskQueuePath(): string {
  return join(vaultBase(), '_system', 'Task-Queue.md');
}

export function progressPath(): string {
  return join(vaultBase(), 'PROGRESS.md');
}

export function handoffIndexPath(): string {
  return join(vaultBase(), '.claude', 'handoffs', 'INDEX.md');
}

function readFileOrEmpty(path: string): string {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/** Strip markdown checkbox/list prefix and inline HTML comments from a task line. */
function cleanTaskText(line: string): string {
  return line
    .replace(/^\s*[-*]\s*\[[ xX]\]\s*/, '') // "- [ ] " / "- [x] "
    .replace(/^\s*[-*]\s*/, '') // bare list bullet
    .replace(/<!--.*?-->/g, '') // inline round markers etc.
    .trim();
}

/** Remove backtick-delimited inline code so legend/doc examples aren't matched. */
function stripInlineCode(line: string): string {
  return line.replace(/`[^`]*`/g, '');
}

/** A markdown task item: `- [ ] …` / `- [x] …` / `* [ ] …`. */
const CHECKBOX = /^\s*[-*]\s*\[[ xX]\]/;

/**
 * Parse the vault task queue into claimed tasks (`(@loop)`), blocked tasks
 * (`[BLOCKED...]`), and round markers (`<!-- last round <date>: <note> -->`).
 *
 * Only genuine checkbox task items are considered for claimed/blocked, and
 * backtick-quoted occurrences are ignored — so the header blockquote and the
 * section placeholders that *document* the `(@loop)` / `[BLOCKED]` conventions
 * are never mistaken for real tasks.
 */
export function parseTaskQueue(content: string): {
  claimed: ClaimedTask[];
  blocked: BlockedTask[];
  recent_rounds: RoundMarker[];
} {
  const claimed: ClaimedTask[] = [];
  const blocked: BlockedTask[] = [];
  const recent_rounds: RoundMarker[] = [];

  for (const raw of content.split('\n')) {
    const line = raw.replace(/\r$/, '');

    // Round markers can appear inline on a task line.
    const marker =
      /<!--\s*last round\s+(\d{4}-\d{2}-\d{2})\s*:\s*(.*?)\s*-->/i.exec(line);
    if (marker) {
      recent_rounds.push({ date: marker[1], note: marker[2].trim() });
    }

    if (!CHECKBOX.test(line)) continue; // only real task items below
    const probe = stripInlineCode(line);

    if (/\[BLOCKED/i.test(probe)) {
      // "[BLOCKED: reason]" or "[BLOCKED reason]" or bare "[BLOCKED]".
      const m = /\[BLOCKED\s*:?\s*([^\]]*)\]/i.exec(probe);
      const reason = m ? m[1].trim() : '';
      const task = cleanTaskText(line.replace(/\[BLOCKED[^\]]*\]/i, ''));
      if (task) blocked.push({ task, reason });
      continue;
    }

    if (probe.includes('(@loop)')) {
      const task = cleanTaskText(line.replace(/\(@loop\)/g, ''));
      if (task) claimed.push({ task });
    }
  }

  // Newest round markers first.
  recent_rounds.sort((a, b) => b.date.localeCompare(a.date));

  return { claimed, blocked, recent_rounds };
}

/**
 * Parse PROGRESS.md round headings (`## <YYYY-MM-DD> — <title>`), newest first.
 * The log is append-only (newest last on disk), so we take the tail and reverse.
 */
export function parseProgress(content: string, limit = 5): ProgressEntry[] {
  const entries: ProgressEntry[] = [];
  for (const raw of content.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const m = /^##\s+(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+?)\s*$/.exec(line);
    if (m) entries.push({ date: m[1], title: m[2].trim() });
  }
  return entries.slice(-limit).reverse();
}

/**
 * The most recent handoff entry from `.claude/handoffs/INDEX.md`. Entries are
 * `- ` list lines (newest last); the header/format comment lines are ignored.
 * Returns `null` for an empty or absent index.
 */
export function parseHandoffIndex(content: string): string | null {
  let last: string | null = null;
  for (const raw of content.split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (/^[-*]\s+/.test(line)) last = line.replace(/^[-*]\s+/, '').trim();
  }
  return last;
}

/**
 * Budget mode for one machine per the loop's §0 thresholds, from the Claude
 * quota (`five_hour` + `weekly_all` used-percentages):
 *   dark   — no/blank claude quota, or snapshot stale (> 10 min)
 *   red    — 5h > 80 or weekly > 90
 *   yellow — 5h >= 60 or weekly >= 85
 *   green  — otherwise
 */
export function budgetMode(mb: MachineBudget | null | undefined): BudgetMode {
  if (!mb || !mb.claude || mb.stale_minutes === null || mb.stale_minutes > 10) {
    return 'dark';
  }
  const h5 = mb.claude.five_hour?.used_pct ?? 0;
  const weekly = mb.claude.weekly_all?.used_pct ?? 0;
  if (h5 > 80 || weekly > 90) return 'red';
  if (h5 >= 60 || weekly >= 85) return 'yellow';
  return 'green';
}

export function budgetModesByMachine(
  map: MachineBudgetMap,
): Record<string, BudgetMode> {
  const out: Record<string, BudgetMode> = {};
  for (const [machine, mb] of Object.entries(map))
    out[machine] = budgetMode(mb);
  return out;
}

/** Read and combine all loop-state files. Graceful when any file is absent. */
export function readLoopState(nowMs: number = Date.now()): LoopState {
  const { claimed, blocked, recent_rounds } = parseTaskQueue(
    readFileOrEmpty(taskQueuePath()),
  );
  const recent_progress = parseProgress(readFileOrEmpty(progressPath()));
  const last_handoff = parseHandoffIndex(readFileOrEmpty(handoffIndexPath()));
  const budget_mode_by_machine = budgetModesByMachine(
    readMachineBudgets(nowMs),
  );

  return {
    claimed,
    blocked,
    recent_rounds,
    recent_progress,
    last_handoff,
    budget_mode_by_machine,
  };
}
