import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  cardMeta,
  cardState,
  cautionFor,
  type DecideCard,
  type DecideHost,
  elapsedLabel,
  greenlightLabel,
  HOLD_DEFAULT_MS,
  HOLD_MAX_MS,
  HOLD_MIN_MS,
  HOLD_MIN_PX,
  holdHint,
  holdMs,
  hostState,
  PRIMARY_MIN_PX,
  quotaAccount,
  quotaRow,
  quotaValueLabel,
  resetLabel,
  staleSummary,
  stateNote,
  TOUCH_MIN_PX,
  waitingSummary,
  writeLine,
} from './decide.js';

const NOW = Date.UTC(2026, 8, 2, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

import { trackerNotice } from './tasksHeader.js';

describe('hold, not tap', () => {
  it('keeps the duration inside the range the design allows', () => {
    expect(holdMs(1500)).toBe(1500);
    expect(holdMs('1500')).toBe(1500);
    expect(holdMs(100)).toBe(HOLD_MIN_MS);
    expect(holdMs(9000)).toBe(HOLD_MAX_MS);
  });

  it('falls back to the default rather than to zero', () => {
    // A hold of 0 ms is a tap, which is the one interaction this screen refuses.
    expect(holdMs(undefined)).toBe(HOLD_DEFAULT_MS);
    expect(holdMs('not a number')).toBe(HOLD_DEFAULT_MS);
    expect(holdMs(0)).toBe(HOLD_MIN_MS);
  });

  it('says how long the press is, and that releasing cancels it', () => {
    expect(holdHint(1000, false)).toBe('press and hold 1.0s to write the id');
    expect(holdHint(2500, true)).toBe('release to cancel');
  });

  it('keeps every target at or above the thumb sizes', () => {
    expect(TOUCH_MIN_PX).toBeGreaterThanOrEqual(44);
    expect(PRIMARY_MIN_PX).toBeGreaterThanOrEqual(48);
    expect(HOLD_MIN_PX).toBeGreaterThanOrEqual(PRIMARY_MIN_PX);
  });
});

describe('the screen has no swipe', () => {
  const source = readFileSync(
    join(import.meta.dirname, '..', 'components', 'DecidePanel.vue'),
    'utf-8',
  );

  // "one deliberate press, no swipes" is a behavioural requirement, and the
  // only place it can be broken is by adding a handler. Asserting on the
  // source is blunt, but a swipe added later fails here rather than in review.
  it.each([
    'touchmove',
    'touchstart',
    'pointermove',
    '@swipe',
    'swipeleft',
    'swiperight',
    'panstart',
  ])('binds no %s handler', (gesture) => {
    expect(source.toLowerCase()).not.toContain(gesture);
  });

  it('does bind the press it is supposed to', () => {
    expect(source).toContain('@pointerdown="startHold');
    expect(source).toContain('@pointerup="cancelHold');
    expect(source).toContain('@pointercancel="cancelHold');
  });
});

describe('a window with no number is drawn as having no number', () => {
  it('renders an unreported window as unknown, not as zero', () => {
    const row = quotaRow('weekly', null, NOW);
    expect(row.state).toBe('unknown');
    expect(row.leftPct).toBeNull();
    expect(quotaValueLabel(row)).toBe('not reported');
    expect(row.note).toContain('not zero');
  });

  it('treats a window whose reset has passed as unknown too', () => {
    const row = quotaRow(
      '5-hour window',
      { label: '5-hour', used_pct: 29, resets_at: (NOW - HOUR) / 1000 },
      NOW,
    );
    expect(row.state).toBe('unknown');
    expect(row.note).toContain('unknown, not zero');
  });

  it('reports headroom, not consumption, for a live window', () => {
    const row = quotaRow(
      '5-hour window',
      { label: '5-hour', used_pct: 29, resets_at: (NOW + 2 * HOUR) / 1000 },
      NOW,
    );
    expect(row.state).toBe('known');
    expect(row.leftPct).toBe(71);
    expect(quotaValueLabel(row)).toBe('71% left');
    expect(row.status).toBe('ok');
  });

  it('names the halt line when the window is at it', () => {
    const row = quotaRow(
      '5-hour window',
      { label: '5-hour', used_pct: 95, resets_at: (NOW + HOUR) / 1000 },
      NOW,
    );
    expect(row.status).toBe('bad');
    expect(row.note).toContain('the loop stops itself here');
  });

  it('always emits both windows, including one the machine never sent', () => {
    // `quota.rainforest-mini.json` reports `weekly_all: null`, so `budget.ts`
    // emits no weekly bar at all. Mapping over `bars` would drop the row, and a
    // window that vanished reads as a window that does not exist.
    const account = quotaAccount(
      'rainforest-mini',
      'personal work only',
      {
        bars: [
          { label: '5-hour', used_pct: 29, resets_at: (NOW + HOUR) / 1000 },
        ],
      },
      NOW,
    );
    expect(account.rows.map((r) => r.label)).toEqual([
      '5-hour window',
      'weekly',
    ]);
    expect(account.rows[1]!.state).toBe('unknown');
  });

  it('emits both windows for a machine with no snapshot at all', () => {
    const account = quotaAccount('rainforest-air', 'never enrolled', null, NOW);
    expect(account.rows).toHaveLength(2);
    expect(account.rows.every((r) => r.state === 'unknown')).toBe(true);
  });
});

describe('resets are said in the units the reader is deciding in', () => {
  it('counts down rather than printing a wall-clock date', () => {
    expect(resetLabel((NOW + 41 * MIN) / 1000, NOW)).toBe('in 41 m');
    expect(resetLabel((NOW + 2 * HOUR + 41 * MIN) / 1000, NOW)).toBe(
      'in 2 h 41 m',
    );
  });

  it('does not invent a time it was not given', () => {
    expect(resetLabel(null, NOW)).toBe('at an unreported time');
    expect(resetLabel((NOW - MIN) / 1000, NOW)).toBe('now');
  });
});

describe('card state comes from the decision path, not from the screen', () => {
  const base = {
    greenlit: false,
    outboxState: 'none' as const,
    existingDecision: null,
  };

  it('is cleared when the executor has acked it', () => {
    expect(cardState({ ...base, greenlit: true })).toBe('cleared');
  });

  it('counts a queued request as cleared, but says it is only queued', () => {
    const state = cardState({ ...base, outboxState: 'pending' });
    expect(state).toBe('cleared');
    expect(stateNote(state, 'pending')).toContain('no ack from the executor');
  });

  it('distinguishes an applied write from a duplicate one', () => {
    expect(stateNote('cleared', 'applied')).toContain('applied');
    expect(stateNote('cleared', 'duplicate')).toContain('already');
  });

  it('is held when plan-first was recorded', () => {
    expect(cardState({ ...base, existingDecision: 'plan-first' })).toBe('held');
    expect(stateNote('held', 'none')).toContain('not in the greenlight list');
  });

  it('is pending when nothing has been decided', () => {
    expect(cardState(base)).toBe('pending');
    expect(cardState({ ...base, existingDecision: 'greenlight' })).toBe(
      'pending',
    );
  });
});

describe('what clearing writes is shown literally', () => {
  it('shows the allowlist path and the line appended to it', () => {
    expect(
      writeLine({
        deliveryMode: 'local',
        path: '/home/r/.claude/loop/greenlight/rainforest-monorepo.md',
        line: '- T-1 — a task · repo: rainforest-monorepo',
        executor: null,
      }),
    ).toBe(
      '/home/r/.claude/loop/greenlight/rainforest-monorepo.md\n+ - T-1 — a task · repo: rainforest-monorepo',
    );
  });

  it('names the machine that will apply a queued request', () => {
    const text = writeLine({
      deliveryMode: 'remote-queue',
      path: '/home/r/.claude/loop/greenlight-outbox/svc/AG-311.json',
      line: '"id": "AG-311"',
      executor: 'rainforest-air',
    });
    expect(text).toContain('greenlight-outbox/svc/AG-311.json');
    expect(text).toContain('+ "id": "AG-311"');
    expect(text).toContain('rainforest-air appends it');
  });

  it('refuses to describe a write that has nowhere to go', () => {
    expect(
      writeLine({
        deliveryMode: 'none',
        path: '',
        line: '',
        executor: null,
      }),
    ).toContain('no executor is configured');
  });
});

describe('caution, when clearing is worth a second look', () => {
  it('leads with a stale host, because the write still succeeds', () => {
    const text = cautionFor({
      hostStale: true,
      host: 'rainforest-air',
      points: 1,
      windowLeftPct: 90,
    });
    expect(text).toContain('rainforest-air is stale');
    expect(text).toContain('still reading the file');
  });

  it('says so when there is no figure to judge headroom against', () => {
    expect(
      cautionFor({
        hostStale: false,
        host: 'rainforest-mini',
        points: 1,
        windowLeftPct: null,
      }),
    ).toContain('has not reported a 5-hour figure');
  });

  it('hedges the points heuristic rather than predicting failure', () => {
    const text = cautionFor({
      hostStale: false,
      host: 'rainforest-air',
      points: 5,
      windowLeftPct: 34,
    });
    expect(text).toContain('likely be cut off');
  });

  it('stays quiet when the run comfortably fits', () => {
    expect(
      cautionFor({
        hostStale: false,
        host: 'rainforest-air',
        points: 3,
        windowLeftPct: 80,
      }),
    ).toBeNull();
  });
});

describe('elapsed time on an open run', () => {
  it('counts up from the start of the run', () => {
    expect(elapsedLabel(NOW - (2 * HOUR + 3 * MIN + 4000), NOW)).toBe(
      '02:03:04',
    );
  });

  it('refuses to read zero for a row with no start time', () => {
    // 00:00:00 would claim the run began this second. It has no such claim.
    expect(elapsedLabel(null, NOW)).toBe('--:--:--');
  });
});

describe('hosts and headings', () => {
  it('separates a host that has stopped from one that never spoke', () => {
    expect(hostState(MIN)).toBe('ok');
    expect(hostState(6 * HOUR)).toBe('stale');
    expect(hostState(null)).toBe('unknown');
  });

  it('counts cleared ids and refuses to guess another machine’s', () => {
    expect(greenlightLabel(0)).toBe('no ids cleared');
    expect(greenlightLabel(1)).toBe('1 id cleared');
    expect(greenlightLabel(3)).toBe('3 ids cleared');
    expect(greenlightLabel(null)).toBe('not readable from here');
  });

  it('summarises hosts without implying health it did not check', () => {
    const host = (state: DecideHost['state']): DecideHost => ({
      name: state,
      state,
      scope: 'scope not declared',
      report: 'never reported',
      reportStatus: 'warn',
      greenlight: 'not readable from here',
      note: '',
    });
    expect(staleSummary([])).toBe('no hosts reported');
    expect(staleSummary([host('ok'), host('ok')])).toBe('all hosts ok');
    expect(staleSummary([host('ok'), host('stale'), host('unknown')])).toBe(
      '2 of 3 stale',
    );
  });

  it('counts only undecided cards in the heading', () => {
    const card = (state: DecideCard['state']) =>
      ({ state }) as unknown as DecideCard;
    expect(waitingSummary([])).toBe('all decided');
    expect(waitingSummary([card('cleared'), card('held')])).toBe('all decided');
    expect(waitingSummary([card('pending'), card('cleared')])).toBe(
      '1 undecided',
    );
  });
});

describe('card meta names its gaps', () => {
  it('spells out missing metadata instead of leaving a blank', () => {
    expect(
      cardMeta({
        id: 'AG-1',
        name: 'x',
        scope: 'work',
        status: 'Backlog',
        priority: null,
        points: null,
        component: null,
      }),
    ).toBe('no priority · unpointed · no component · Backlog');
  });

  it('prefers the loop status over the board status when the loop has one', () => {
    expect(
      cardMeta({
        id: 'AG-1',
        name: 'x',
        scope: 'work',
        status: 'Backlog',
        loopStatus: 'pr-ready',
        priority: 'P1',
        points: 3,
        component: 'cloud-frontend',
      }),
    ).toBe('P1 · 3 pts · cloud-frontend · pr-ready');
  });
});

describe('the queue says how old the board behind it is', () => {
  const source = readFileSync(
    join(import.meta.dirname, '..', 'components', 'DecidePanel.vue'),
    'utf-8',
  );

  // On 2026-09-04 this screen offered 67 cards to authorise off a board synced
  // 21.8 hours earlier, several of them already merged, and said nothing. The
  // Tasks page reads the same two fields from the same file and has always
  // shown them. `synced_at` moves only when Notion is fetched, which needs an
  // MCP client and so happens from a session rather than the hourly job, while
  // `written_at` is always minutes old and says nothing about the board — so
  // the age cannot be inferred from the file's mtime and has to be carried.
  it('renders the age rather than only receiving it', () => {
    expect(source).toContain('trackerNotice');
    expect(source).toContain('boardNotice');
  });

  it('uses the Tasks page helper, not a second sentence', () => {
    // One board described two ways by two screens is worse than not describing
    // it: a reader who saw both would have to decide which to believe.
    expect(source).toMatch(/from '@\/lib\/tasksHeader'/);
  });

  it('says the age even when both timestamps are unreadable', () => {
    // An unknown age is no reason to stop saying the board is a tracker.
    const notice = trackerNotice(null, null, new Date('2026-09-04T12:00:00Z'));
    expect(notice.length).toBeGreaterThan(0);
    expect(notice).not.toContain('null');
  });

  it('names the sync separately from the rebuild', () => {
    const notice = trackerNotice(
      '2026-09-03T11:44:02Z',
      '2026-09-04T09:21:09Z',
      new Date('2026-09-04T09:31:09Z'),
    );
    expect(notice).toContain('work synced');
    expect(notice).toContain('rebuilt');
    // The failure this prevents: one label off `written_at` alone, which is
    // fresh every hour and would have called that 22-hour-old board current.
    expect(notice).not.toMatch(/^rebuilt/);
  });
});
