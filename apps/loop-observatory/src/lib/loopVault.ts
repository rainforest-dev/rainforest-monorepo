import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Loop state derived from what the machines actually write, not from the files
 * the retired `vault` source adapter used to.
 *
 * Until 2026-09-02 the Loop status panel read `_system/Task-Queue.md`,
 * `PROGRESS.md` and `.claude/handoffs/INDEX.md`. Those belong to `source: vault`
 * and no project declares it any more (`grep -c "source: vault"` over
 * config.yaml returns 0), so nothing had written them since July and the panel
 * reported a dead subsystem as a healthy idle one.
 *
 * The files read here are written by the current mechanism, by BOTH machines,
 * and each row carries its own timestamps -- so freshness is a fact in the data
 * rather than a guess from an mtime. That matters more than usual here: 266
 * files in this vault share one synthetic mtime from a bulk restore.
 */

/** One row of `loop-runs.<machine>.jsonl`, as the runner appends it. */
export interface LoopRun {
  run_id: string | null;
  task: string | null;
  task_id: string | null;
  project: string | null;
  machine: string | null;
  executor: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string | null;
  note: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length ? v : null;
}

/** Every run row across every machine, newest first by `started_at`. */
export function readRuns(usageDir: string): LoopRun[] {
  let names: string[];
  try {
    names = readdirSync(usageDir);
  } catch {
    return [];
  }
  const out: LoopRun[] = [];
  for (const name of names) {
    if (!/^loop-runs\..+\.jsonl$/.test(name)) continue;
    let text: string;
    try {
      text = readFileSync(join(usageDir, name), 'utf-8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      let o: Record<string, unknown>;
      try {
        o = JSON.parse(t) as Record<string, unknown>;
      } catch {
        // One unparseable row must not hide every other run in the file.
        continue;
      }
      out.push({
        run_id: str(o.run_id),
        task: str(o.task),
        task_id: str(o.task_id),
        project: str(o.project),
        machine: str(o.machine),
        executor: str(o.executor),
        started_at: str(o.started_at),
        ended_at: str(o.ended_at),
        status: str(o.status),
        note: str(o.note),
      });
    }
  }
  return out.sort((a, b) =>
    (b.started_at ?? '').localeCompare(a.started_at ?? ''),
  );
}

/**
 * Runs still open: started, never ended.
 *
 * This is the honest reading of "claimed". The old panel printed "No task
 * currently claimed" from a file nothing wrote, so the sentence was true by
 * accident. Here the same words mean every recorded run reached an end -- on
 * 2026-09-02, 22 of 22.
 */
export function openRuns(runs: LoopRun[]): LoopRun[] {
  return runs.filter((r) => r.started_at && !r.ended_at);
}

/**
 * The newest run per task, so a task blocked once and resolved later does not
 * stay on the blocked list forever. Runs arrive newest-first, so the first one
 * seen for a key is the newest.
 */
export function latestRunPerTask(runs: LoopRun[]): LoopRun[] {
  const seen = new Set<string>();
  const out: LoopRun[] = [];
  for (const r of runs) {
    const key = `${r.project ?? ''}|${r.task_id ?? r.task ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** One entry of `tasks-progress.json`, the mirror every `loopctl set` writes. */
export interface ProgressRow {
  key: string;
  loop_status: string | null;
  note: string | null;
  project: string | null;
  machine: string | null;
  updated_at: string | null;
}

/**
 * Progress rows, newest first.
 *
 * Two shapes live in this file: 13 rows carry
 * `updated_at`/`updated_ts`/`machine`/`project`, and 6 older ones carry only
 * `loop_status`/`note`/`pr`. The undated ones sort last rather than being
 * dropped -- they are real history, they just cannot say when.
 */
export function readProgress(usageDir: string): ProgressRow[] {
  let raw: unknown;
  try {
    raw = JSON.parse(
      readFileSync(join(usageDir, 'tasks-progress.json'), 'utf-8'),
    );
  } catch {
    return [];
  }
  const tasks = (raw as { tasks?: Record<string, unknown> } | null)?.tasks;
  if (!tasks || typeof tasks !== 'object') return [];
  const out: ProgressRow[] = [];
  for (const [key, v] of Object.entries(tasks)) {
    const o = (v ?? {}) as Record<string, unknown>;
    out.push({
      key,
      loop_status: str(o.loop_status),
      note: str(o.note),
      project: str(o.project),
      machine: str(o.machine),
      updated_at: str(o.updated_at),
    });
  }
  return out.sort((a, b) =>
    (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
  );
}
