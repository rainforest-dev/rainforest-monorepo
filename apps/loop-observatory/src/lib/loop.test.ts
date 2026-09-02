import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MachineBudget } from './budget.js';
import {
  budgetMode,
  budgetModesByMachine,
  newestDateIn,
  parseHandoffIndex,
  parseProgress,
  parseTaskQueue,
  readLoopState,
} from './loop.js';

const QUEUE = `# Task Queue

## P1

- [ ] Process readwise needs-processing files (@loop) <!-- last round 2026-07-13: 247→242 (5 files) -->
  **Files**: readwise/

- [ ] Backfill missing domain frontmatter <!-- last round 2026-07-11: 262→259 (3 files) -->

## Blocked / needs human

- [ ] Migrate legacy vault schema [BLOCKED: waiting on owner decision]
`;

describe('parseTaskQueue', () => {
  const { claimed, blocked, recent_rounds } = parseTaskQueue(QUEUE);

  it('extracts claimed tasks (lines with @loop), stripping markup', () => {
    expect(claimed).toEqual([
      { task: 'Process readwise needs-processing files' },
    ]);
  });

  it('extracts blocked tasks with their reason', () => {
    expect(blocked).toEqual([
      {
        task: 'Migrate legacy vault schema',
        reason: 'waiting on owner decision',
      },
    ]);
  });

  it('extracts round markers, newest date first', () => {
    expect(recent_rounds).toEqual([
      { date: '2026-07-13', note: '247→242 (5 files)' },
      { date: '2026-07-11', note: '262→259 (3 files)' },
    ]);
  });

  it('is graceful on empty content', () => {
    const empty = parseTaskQueue('');
    expect(empty.claimed).toEqual([]);
    expect(empty.blocked).toEqual([]);
    expect(empty.recent_rounds).toEqual([]);
  });

  it('ignores doc/legend lines that quote the conventions in backticks', () => {
    // Mirrors the real Task-Queue.md header blockquote + section placeholders.
    const DOCS = `> 認領 = 行尾附 \`(@loop)\`;完成 = 打勾。

## Blocked / 需人工

_(agent 標記 \`[BLOCKED]\` 的項目移到這裡,附失敗簽名)_

## P1

- [ ] A real unclaimed task with no markers
`;
    const parsed = parseTaskQueue(DOCS);
    expect(parsed.claimed).toEqual([]);
    expect(parsed.blocked).toEqual([]);
  });
});

describe('parseProgress', () => {
  const PROGRESS = `# PROGRESS (append-only)

## 2026-07-11 — readwise tag processing (round 1)
- notes...

## 2026-07-13 — readwise tag processing (round 2)
- notes...

## 2026-07-13 — readwise tag processing (round 3)
- notes...
`;

  it('parses round headings newest-first', () => {
    const entries = parseProgress(PROGRESS);
    expect(entries[0]).toEqual({
      date: '2026-07-13',
      title: 'readwise tag processing (round 3)',
    });
    expect(entries).toHaveLength(3);
  });

  it('respects the limit (tail of the append-only log)', () => {
    const entries = parseProgress(PROGRESS, 2);
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toContain('round 3');
    expect(entries[1].title).toContain('round 2');
  });
});

describe('parseHandoffIndex', () => {
  it('returns null for an index with only header/comment lines', () => {
    const idx = `# Handoff Index

> Append one line per handoff.

<!-- format: - YYYY-MM-DD <slug> — ... -->`;
    expect(parseHandoffIndex(idx)).toBeNull();
  });

  it('returns the most recent entry line', () => {
    const idx = `# Handoff Index
- 2026-07-12 alpha — first handoff — see file.md
- 2026-07-13 beta — second handoff — see file2.md`;
    expect(parseHandoffIndex(idx)).toBe(
      '2026-07-13 beta — second handoff — see file2.md',
    );
  });
});

/** Build a nested Claude quota (only the 5-hour + weekly-all buckets matter here). */
function claude(h5: number, weekly: number): MachineBudget['claude'] {
  return {
    plan: 'pro',
    source_ts: null,
    five_hour: { used_pct: h5, resets_at: null },
    weekly_all: { used_pct: weekly, resets_at: null },
    weekly_by_model: null,
    bars: [],
  };
}

function mb(
  c: MachineBudget['claude'],
  stale_minutes: number | null,
): MachineBudget {
  return {
    machine: 'm',
    claude: c,
    codex: null,
    agy: null,
    written_at: 0,
    stale_minutes,
  };
}

describe('budgetMode', () => {
  it('dark when quota missing, claude absent, or stale > 10min', () => {
    expect(budgetMode(null)).toBe('dark');
    expect(budgetMode(mb(null, 1))).toBe('dark');
    expect(budgetMode(mb(claude(1, 1), 11))).toBe('dark');
    expect(budgetMode(mb(claude(1, 1), null))).toBe('dark');
  });

  it('red when 5h > 80 or weekly > 90', () => {
    expect(budgetMode(mb(claude(81, 10), 1))).toBe('red');
    expect(budgetMode(mb(claude(10, 91), 1))).toBe('red');
  });

  it('yellow when 5h >= 60 or weekly >= 85 (and not red)', () => {
    expect(budgetMode(mb(claude(60, 10), 1))).toBe('yellow');
    expect(budgetMode(mb(claude(10, 85), 1))).toBe('yellow');
  });

  it('green otherwise', () => {
    expect(budgetMode(mb(claude(35.4, 61.2), 2))).toBe('green');
  });

  it('maps a full machine map', () => {
    const modes = budgetModesByMachine({
      a: mb(claude(35.4, 61.2), 2),
      b: mb(claude(8, 22.5), 52),
    });
    expect(modes).toEqual({ a: 'green', b: 'dark' });
  });
});

describe('newestDateIn', () => {
  it('returns the newest date, not the first or last one written', () => {
    // The progress log is newest-first, so "last in the file" would be the
    // OLDEST entry -- the reading that makes a dead source look freshest.
    expect(newestDateIn('a 2026-07-11 b 2026-07-13 c 2026-07-12')).toBe(
      '2026-07-13',
    );
  });

  it('is null when the content carries no date to age', () => {
    expect(newestDateIn('# Task Queue\n\nnothing here')).toBeNull();
  });
});

describe('readLoopState source provenance', () => {
  let dir: string;
  const prev = process.env.VAULT_PATH;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'loop-src-'));
    process.env.VAULT_PATH = dir;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (prev === undefined) delete process.env.VAULT_PATH;
    else process.env.VAULT_PATH = prev;
  });

  it('reports an absent source as absent, not as an empty one', () => {
    // The defect this exists to catch: an unreadable source and one that holds
    // nothing produced the same empty arrays, so a retired file rendered as
    // "No task currently claimed" -- a sentence about now.
    const s = readLoopState(0);
    expect(s.sources.runs.present).toBe(false);
    expect(s.sources.progress.present).toBe(false);
    expect(s.sources.handoffs.present).toBe(false);
    expect(s.claimed).toEqual([]);
  });

  it('reads runs from every machine, not just one', () => {
    const u = join(dir, '_system', 'usage');
    mkdirSync(u, { recursive: true });
    writeFileSync(
      join(u, 'loop-runs.rainforest-mini.jsonl'),
      JSON.stringify({
        run_id: 'a',
        task_id: 'T-1',
        project: 'p',
        machine: 'rainforest-mini',
        started_at: '2026-08-25T01:00:00+00:00',
        ended_at: '2026-08-25T01:30:00+00:00',
        status: 'completed',
      }) + '\n',
    );
    writeFileSync(
      join(u, 'loop-runs.rainforest-air.jsonl'),
      JSON.stringify({
        run_id: 'b',
        task_id: 'AG-9',
        project: 'q',
        machine: 'rainforest-air',
        started_at: '2026-08-26T05:00:00+00:00',
        ended_at: '2026-08-26T05:10:00+00:00',
        status: 'advanced',
      }) + '\n',
    );
    const s = readLoopState(0);
    expect(s.sources.runs.present).toBe(true);
    // Newest first, across machines -- the Air's run is newer than the mini's.
    expect(s.recent_rounds[0]?.note).toContain('rainforest-air');
    expect(s.recent_rounds.map((r) => r.date)).toEqual([
      '2026-08-26',
      '2026-08-25',
    ]);
    expect(s.sources.runs.newestEntry).toBe('2026-08-26');
  });

  it('claims only runs that never ended', () => {
    const u = join(dir, '_system', 'usage');
    mkdirSync(u, { recursive: true });
    writeFileSync(
      join(u, 'loop-runs.m.jsonl'),
      JSON.stringify({
        run_id: 'done',
        task_id: 'T-done',
        machine: 'm',
        started_at: '2026-08-25T01:00:00+00:00',
        ended_at: '2026-08-25T01:30:00+00:00',
        status: 'completed',
      }) +
        '\n' +
        JSON.stringify({
          run_id: 'open',
          task_id: 'T-open',
          machine: 'm',
          started_at: '2026-08-26T01:00:00+00:00',
          status: 'in-flight',
        }) +
        '\n',
    );
    const s = readLoopState(0);
    expect(s.claimed).toHaveLength(1);
    expect(s.claimed[0]?.task).toContain('T-open');
  });

  it('a task blocked once and run again since is not still blocked', () => {
    const u = join(dir, '_system', 'usage');
    mkdirSync(u, { recursive: true });
    writeFileSync(
      join(u, 'loop-runs.m.jsonl'),
      JSON.stringify({
        run_id: 'old',
        task_id: 'T-1',
        project: 'p',
        machine: 'm',
        started_at: '2026-08-20T00:00:00+00:00',
        ended_at: '2026-08-20T00:10:00+00:00',
        status: 'blocked',
        note: 'waiting on review',
      }) +
        '\n' +
        JSON.stringify({
          run_id: 'new',
          task_id: 'T-1',
          project: 'p',
          machine: 'm',
          started_at: '2026-08-27T00:00:00+00:00',
          ended_at: '2026-08-27T00:10:00+00:00',
          status: 'completed',
        }) +
        '\n',
    );
    expect(readLoopState(0).blocked).toEqual([]);
  });

  it('survives an unparseable row without hiding the rest of the file', () => {
    const u = join(dir, '_system', 'usage');
    mkdirSync(u, { recursive: true });
    writeFileSync(
      join(u, 'loop-runs.m.jsonl'),
      '{ this is not json\n' +
        JSON.stringify({
          run_id: 'ok',
          task_id: 'T-2',
          machine: 'm',
          started_at: '2026-08-26T00:00:00+00:00',
          ended_at: '2026-08-26T00:05:00+00:00',
          status: 'completed',
        }) +
        '\n',
    );
    expect(readLoopState(0).recent_rounds).toHaveLength(1);
  });
});
