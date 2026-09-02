import { describe, expect, it } from 'vitest';

import type { SourceStatus } from './loop.js';
import {
  contentAge,
  emptyReason,
  epochOf,
  sourceMeta,
} from './loopFreshness.js';

const NOW = Date.parse('2026-09-02T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function src(over: Partial<SourceStatus> = {}): SourceStatus {
  return {
    label: 'loop-runs.<machine>.jsonl',
    path: '/vault/_system/usage/loop-runs.<machine>.jsonl',
    present: true,
    newestEntry: '2026-09-02',
    newestEntryAt: NOW - 4 * 60 * 1000,
    readAt: NOW - 30 * 1000,
    ...over,
  };
}

describe('epochOf', () => {
  it('parses the offset-bearing ISO stamps the runner writes', () => {
    expect(epochOf('2026-09-02T12:53:08+00:00')).toBe(
      Date.parse('2026-09-02T12:53:08Z'),
    );
  });

  it('falls back to the date prefix for a filesystem-safe handoff basename', () => {
    // `:` is not safe in a filename everywhere, so the runner may write the
    // stamp with dashes. Date.parse rejects that outright; the day is still a
    // real date and still worth a coarse age.
    expect(epochOf('2026-09-02T12-53-08Z')).toBe(Date.parse('2026-09-02'));
  });

  it('returns null rather than NaN for absent or unparseable stamps', () => {
    expect(epochOf(null)).toBeNull();
    expect(epochOf(undefined)).toBeNull();
    expect(epochOf('')).toBeNull();
    expect(epochOf('not a date at all')).toBeNull();
  });
});

describe('contentAge', () => {
  it('ages the newest entry rather than printing its date', () => {
    expect(contentAge(src({ newestEntryAt: NOW - 47 * DAY }), NOW)).toBe(
      'newest entry 47 days old',
    );
  });

  it('says a source is absent instead of implying it is empty', () => {
    expect(contentAge(src({ present: false }), NOW)).toBe('not present');
  });

  it('distinguishes a read source with nothing dated in it', () => {
    expect(contentAge(src({ newestEntryAt: null }), NOW)).toBe(
      'no dated entry to age',
    );
  });
});

describe('sourceMeta', () => {
  it('names the file and says how recently it was read', () => {
    const m = sourceMeta(src(), NOW);
    expect(m.label).toBe('loop-runs.<machine>.jsonl');
    expect(m.path).toBe('/vault/_system/usage/loop-runs.<machine>.jsonl');
    expect(m.read).toBe('read 30 sec ago');
    expect(m.age).toBe('newest entry 4 min old');
  });

  it('says "looked" not "read" when there was nothing there to read', () => {
    expect(sourceMeta(src({ present: false }), NOW).read).toBe(
      'looked 30 sec ago',
    );
  });

  it('keeps the read age and the content age separate', () => {
    // The whole point: a file opened seconds ago can hold seven-week-old
    // content, and only the second number says whether the loop is alive.
    const m = sourceMeta(
      src({ readAt: NOW - 30 * 1000, newestEntryAt: NOW - 47 * DAY }),
      NOW,
    );
    expect(m.read).toBe('read 30 sec ago');
    expect(m.age).toBe('newest entry 47 days old');
  });
});

describe('emptyReason', () => {
  it('leads with the age and keeps the date for cross-checking', () => {
    expect(
      emptyReason(
        src({ newestEntryAt: NOW - 47 * DAY, newestEntry: '2026-07-17' }),
        'Nothing running',
        NOW,
      ),
    ).toBe('Nothing running — newest entry is 47 days old (2026-07-17)');
  });

  it('never leaves the reader to subtract a bare date', () => {
    // The sentence this ticket exists to remove: `Nothing running as of
    // 2026-08-26`, which is true whether that was yesterday or seven weeks ago.
    const s = emptyReason(
      src({ newestEntryAt: NOW - 47 * DAY, newestEntry: '2026-07-17' }),
      'Nothing running',
      NOW,
    );
    expect(s).not.toMatch(/as of/);
    expect(s).toMatch(/47 days old/);
  });

  it('names the path when the source is not present at all', () => {
    expect(emptyReason(src({ present: false }), 'Nothing running', NOW)).toBe(
      'source not present — /vault/_system/usage/loop-runs.<machine>.jsonl',
    );
  });

  it('separates an undated source from an aged one', () => {
    expect(
      emptyReason(src({ newestEntryAt: null }), 'Nothing running', NOW),
    ).toBe('Nothing running — source has no dated entry');
  });
});
