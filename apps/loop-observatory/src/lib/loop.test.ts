import { describe, expect, it } from 'vitest';

import type { MachineBudget } from './budget.js';
import {
  budgetMode,
  budgetModesByMachine,
  parseHandoffIndex,
  parseProgress,
  parseTaskQueue,
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
      { task: 'Migrate legacy vault schema', reason: 'waiting on owner decision' },
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
  return { machine: 'm', claude: c, codex: null, agy: null, written_at: 0, stale_minutes };
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
