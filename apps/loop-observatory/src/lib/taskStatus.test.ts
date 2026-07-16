import { describe, expect, it } from 'vitest';

import { DEFAULT_STATUSES, effectiveStatus, loopStageLabel } from './taskStatus.js';
import {
  BOARD_COLUMNS,
  boardColumn,
  boardColumnColor,
  columnOwner,
  ownerMeta,
  taskOwner,
} from './taskStatus.js';

const STATUSES = [...DEFAULT_STATUSES];

describe('effectiveStatus', () => {
  it('overrides Notion status when the loop reports a real board column', () => {
    // Loop set a canonical column directly → moves the card there.
    expect(effectiveStatus('Not started', 'In progress / PR', STATUSES)).toBe(
      'In progress / PR',
    );
    expect(effectiveStatus('Not started', 'Blocked', STATUSES)).toBe('Blocked');
  });

  it('maps a finer loop sub-state onto its board column', () => {
    // #22: Notion "Not started", loop "PR ready" → lives in the "In progress / PR" lane.
    expect(effectiveStatus('Not started', 'PR ready', STATUSES)).toBe('In progress / PR');
    expect(effectiveStatus('Not started', 'In progress', STATUSES)).toBe('In progress / PR');
    expect(effectiveStatus('Not started', 'Queued', STATUSES)).toBe('Not started');
    // Draft states hold in the "Not started" lane.
    expect(effectiveStatus('Not started', 'Spec drafted', STATUSES)).toBe('Not started');
    expect(effectiveStatus('Not started', 'Split drafted', STATUSES)).toBe('Not started');
    // Pipeline tail: a merged PR sits in QA (not Done); prod deploy = Released.
    expect(effectiveStatus('Not started', 'Merged', STATUSES)).toBe('In QA');
    expect(effectiveStatus('In QA', 'Released', STATUSES)).toBe('Released');
  });

  it('keeps the Notion status for an unknown loop-only label', () => {
    expect(effectiveStatus('Not started', 'Something odd', STATUSES)).toBe('Not started');
  });

  it('falls back to Notion status when there is no loop status', () => {
    expect(effectiveStatus('In QA', null, STATUSES)).toBe('In QA');
    expect(effectiveStatus('In QA', undefined, STATUSES)).toBe('In QA');
  });
});

describe('loopStageLabel', () => {
  it('surfaces a finer sub-state as a pill (it differs from its column)', () => {
    expect(loopStageLabel('PR ready', STATUSES)).toBe('PR ready');
    expect(loopStageLabel('Queued', STATUSES)).toBe('Queued');
    expect(loopStageLabel('In progress', STATUSES)).toBe('In progress');
  });

  it('surfaces a label that does not move the card', () => {
    expect(loopStageLabel('Needs tuning', STATUSES)).toBe('Needs tuning');
  });

  it('hides the pill when the loop label IS its column (the ◆ marker suffices)', () => {
    expect(loopStageLabel('In progress / PR', STATUSES)).toBeNull();
    expect(loopStageLabel('Blocked', STATUSES)).toBeNull();
    expect(loopStageLabel(null, STATUSES)).toBeNull();
    expect(loopStageLabel(undefined, STATUSES)).toBeNull();
  });
});

describe('taskOwner', () => {
  it('loop sub-state decides the owner, over the Notion status', () => {
    expect(taskOwner('Not started', 'In progress')).toBe('ai');
    expect(taskOwner('Not started', 'PR ready')).toBe('you');
    expect(taskOwner('Not started', 'Spec drafted')).toBe('you');
    expect(taskOwner('Not started', 'Queued')).toBe('ai');
  });

  it('falls back to the Notion status with no loop overlay', () => {
    expect(taskOwner('Blocked', null)).toBe('you');
    expect(taskOwner('Done', undefined)).toBe('done');
    expect(taskOwner('Not started', null)).toBe('parked');
    expect(taskOwner('In progress / PR', null)).toBe('ai');
  });

  it('treats unknown states as parked', () => {
    expect(taskOwner('Something odd', null)).toBe('parked');
  });
});

describe('boardColumn', () => {
  it('splits In progress / PR into two owner-distinct columns', () => {
    expect(boardColumn('Not started', 'In progress')).toBe('In progress');
    expect(boardColumn('Not started', 'PR ready')).toBe('In review');
  });

  it('maps the rest of the loop tail and holds drafts in Not started', () => {
    expect(boardColumn('Not started', 'Merged')).toBe('In QA');
    expect(boardColumn('In QA', 'Released')).toBe('Released');
    expect(boardColumn('Not started', 'Spec drafted')).toBe('Not started');
    expect(boardColumn('Not started', 'Queued')).toBe('Not started');
  });

  it('defaults a no-overlay In progress / PR to the In progress column', () => {
    expect(boardColumn('In progress / PR', null)).toBe('In progress');
    expect(boardColumn('Done', null)).toBe('Done');
  });
});

describe('columnOwner + boardColumnColor', () => {
  it('assigns each board column an owner', () => {
    expect(columnOwner('In progress')).toBe('ai');
    expect(columnOwner('In review')).toBe('you');
    expect(columnOwner('Not started')).toBe('parked');
    expect(columnOwner('Done')).toBe('done');
  });

  it('tints by owner but keeps Blocked critical-red', () => {
    expect(boardColumnColor('In progress')).toBe('var(--chart-1)');
    expect(boardColumnColor('In review')).toBe('var(--status-warning)');
    expect(boardColumnColor('Blocked')).toBe('var(--status-critical)');
  });
});

describe('ownerMeta', () => {
  it('gives each owner a label + themed color', () => {
    expect(ownerMeta('you').label).toBe('You');
    expect(ownerMeta('ai').color).toBe('var(--chart-1)');
  });
});

describe('boardColumn invariant', () => {
  const LOOP_VOCAB = [
    'Queued', 'Needs tuning', 'Spec drafted', 'Split drafted',
    'In progress', 'PR ready', 'Merged', 'Released', 'Blocked',
  ];

  it('every Notion status resolves into a real board column', () => {
    for (const s of DEFAULT_STATUSES) {
      expect(BOARD_COLUMNS).toContain(boardColumn(s, null));
    }
  });

  it('every loop vocab value resolves into a real board column', () => {
    for (const v of LOOP_VOCAB) {
      expect(BOARD_COLUMNS).toContain(boardColumn('Not started', v));
    }
  });
});
