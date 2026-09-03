import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type MachineBudget,
  type MachineBudgetMap,
  readMachineBudgets,
} from './budget.js';
import { engineDrift, readEngineReports } from './engineVersions.js';
import { epochOf } from './loopFreshness.js';
import {
  latestRunPerTask,
  openRuns,
  readHandoffs,
  readProgress,
  readRuns,
} from './loopVault.js';
import { stripHtmlComments } from './markdown.js';

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
  /**
   * Which engine release each machine runs, or how they disagree. Null when no
   * machine has published one -- distinct from "they agree", which is the
   * reading that let a three-release gap sit unnoticed.
   */
  engines: string | null;
  budget_mode_by_machine: Record<string, BudgetMode>;
  /** Provenance for the three file-backed sections above. */
  sources: {
    /** Cross-machine: every `loop-runs.<machine>.jsonl` in the vault. */
    runs: SourceStatus;
    /** Cross-machine: the mirror every `loopctl set` publishes. */
    progress: SourceStatus;
    /** This host only -- $LOOP_HOME/handoffs is machine-local. */
    handoffs: SourceStatus;
  };
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

/**
 * Where one of this panel's answers came from, and how old that answer is.
 *
 * Without this the panel could not tell "the source is gone" from "the source
 * says nothing", because `readFileOrEmpty` returned `''` for both. Measured
 * 2026-09-02 on the live app: all three files below were last written
 * 2026-07-30 and carry content from 2026-07-11..13, because they belong to the
 * retired `vault` source adapter -- no project uses `source: vault` any more,
 * so nothing writes them. The panel rendered "No task currently claimed",
 * "Nothing blocked" and "No handoffs recorded", every one of which reads as a
 * statement about now.
 */
export interface SourceStatus {
  /**
   * Short name shown beside every section, e.g. `loop-runs.<machine>.jsonl`.
   * Written out rather than derived from `path`, because two of these three
   * paths are directory globs and `basename` on them yields `<project>` and
   * the empty string -- neither of which names the source to a reader.
   */
  label: string;
  /** Named in the UI, so a reader can see which file an answer came from. */
  path: string;
  /** False when the file could not be read at all -- absent, or unreadable. */
  present: boolean;
  /**
   * Newest date in the file's OWN CONTENT, never its mtime. iCloud rewrites
   * mtimes on sync, and 266 files in this vault share one synthetic timestamp
   * from a bulk restore on 2026-07-30, so mtime is not a freshness signal here.
   * Null means the file was read but holds no dated entry to age.
   */
  newestEntry: string | null;
  /**
   * The same instant as `newestEntry`, kept as epoch ms so the panel can age it
   * against a ticking clock. The date string alone made the reader subtract.
   */
  newestEntryAt: number | null;
  /**
   * When the server opened this source. Distinct from `newestEntryAt`, and the
   * distinction is the point: a file read four seconds ago can hold content
   * seven weeks old, and only the second number says whether the loop is alive.
   */
  readAt: number;
}

function readSource(path: string): { text: string; present: boolean } {
  try {
    return { text: readFileSync(path, 'utf-8'), present: true };
  } catch {
    return { text: '', present: false };
  }
}

/** The newest `YYYY-MM-DD` anywhere in the text, or null if it carries none. */
export function newestDateIn(content: string): string | null {
  const found = content.match(/\d{4}-\d{2}-\d{2}/g);
  if (!found?.length) return null;
  return found.reduce((a, b) => (a >= b ? a : b));
}

/** Strip markdown checkbox/list prefix and inline HTML comments from a task line. */
function cleanTaskText(line: string): string {
  const withoutBullet = line
    .replace(/^\s*[-*]\s*\[[ xX]\]\s*/, '') // "- [ ] " / "- [x] "
    .replace(/^\s*[-*]\s*/, ''); // bare list bullet
  return stripHtmlComments(withoutBullet).trim(); // inline round markers etc.
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
function usageDir(): string {
  return join(vaultBase(), '_system', 'usage');
}

export function readLoopState(nowMs: number = Date.now()): LoopState {
  const handoffs = readSource(handoffIndexPath());

  // Derived from what the machines write now, across BOTH of them.
  const runs = readRuns(usageDir());
  const rows = readProgress(usageDir());

  const claimed: ClaimedTask[] = openRuns(runs).map((r) => ({
    task: `${r.task_id ?? r.task ?? 'unknown task'} · ${r.machine ?? '?'} · started ${r.started_at ?? '?'}`,
  }));
  const blocked: BlockedTask[] = latestRunPerTask(runs)
    .filter((r) => r.status === 'blocked')
    .map((r) => ({
      task: `${r.task_id ?? r.task ?? 'unknown task'} · ${r.machine ?? '?'}`,
      reason: r.note ?? 'no reason recorded on the run',
    }));
  const recent_rounds: RoundMarker[] = runs.slice(0, 6).map((r) => ({
    date: (r.started_at ?? '').slice(0, 10) || 'undated',
    note: `${r.machine ?? '?'} · ${r.project ?? '?'} · ${r.status ?? 'no status'}`,
  }));
  const recent_progress: ProgressEntry[] = rows.slice(0, 5).map((r) => ({
    date: (r.updated_at ?? '').slice(0, 10) || 'undated',
    title: `${r.key} — ${r.loop_status ?? 'no status'}`,
  }));
  // Cross-machine now. The retired INDEX.md is still read below, only so the
  // panel can say it is gone if someone is still looking at an old vault.
  // <vault>/_system/handoffs, beside usage/ rather than inside it: handoffs are
  // documents a person reads, not per-machine telemetry.
  const published = readHandoffs(join(vaultBase(), '_system'));
  const last_handoff = published.length
    ? `${published[0]!.machine} · ${published[0]!.project} · ${published[0]!.stamp}`
    : parseHandoffIndex(handoffs.text);
  const budget_mode_by_machine = budgetModesByMachine(
    readMachineBudgets(nowMs),
  );

  return {
    claimed,
    blocked,
    recent_rounds,
    recent_progress,
    last_handoff,
    engines: engineDrift(readEngineReports(usageDir())),
    budget_mode_by_machine,
    sources: {
      // Named for what they are, not for what the panel used to read. `runs`
      // and `progress` are per-machine files in the vault and cover both
      // machines; `handoffs` is the one section that cannot, because
      // $LOOP_HOME/handoffs is machine-local and only this host's is mounted.
      runs: {
        label: 'loop-runs.<machine>.jsonl',
        path: join(usageDir(), 'loop-runs.<machine>.jsonl'),
        present: runs.length > 0,
        newestEntry: (runs[0]?.started_at ?? '').slice(0, 10) || null,
        newestEntryAt: epochOf(runs[0]?.started_at),
        readAt: nowMs,
      },
      progress: {
        label: 'tasks-progress.json',
        path: join(usageDir(), 'tasks-progress.json'),
        present: rows.length > 0,
        newestEntry: (rows[0]?.updated_at ?? '').slice(0, 10) || null,
        newestEntryAt: epochOf(rows[0]?.updated_at),
        readAt: nowMs,
      },
      handoffs: {
        label: 'handoffs/<machine>/<project>/',
        path: join(vaultBase(), '_system', 'handoffs/<machine>/<project>/'),
        present: published.length > 0,
        newestEntry: published[0]?.stamp.slice(0, 10) ?? null,
        newestEntryAt: epochOf(published[0]?.stamp),
        readAt: nowMs,
      },
    },
  };
}
