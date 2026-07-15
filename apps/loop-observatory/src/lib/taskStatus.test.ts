import { describe, expect, it } from 'vitest';

import { DEFAULT_STATUSES, effectiveStatus, isLoopOnlyStatus } from './taskStatus.js';

const STATUSES = [...DEFAULT_STATUSES];

describe('effectiveStatus', () => {
  it('overrides Notion status when the loop reports a real board status', () => {
    // #22: Notion "Not started", loop "In progress / PR" → moves column.
    expect(effectiveStatus('Not started', 'In progress / PR', STATUSES)).toBe(
      'In progress / PR',
    );
  });

  it('keeps the Notion status for a loop-only label', () => {
    // #68: Notion "Not started", loop "Needs tuning" (not a column) → stays put.
    expect(effectiveStatus('Not started', 'Needs tuning', STATUSES)).toBe('Not started');
  });

  it('falls back to Notion status when there is no loop status', () => {
    expect(effectiveStatus('In QA', null, STATUSES)).toBe('In QA');
    expect(effectiveStatus('In QA', undefined, STATUSES)).toBe('In QA');
  });
});

describe('isLoopOnlyStatus', () => {
  it('is true only for a set label that is not a real board status', () => {
    expect(isLoopOnlyStatus('Needs tuning', STATUSES)).toBe(true);
    expect(isLoopOnlyStatus('In progress / PR', STATUSES)).toBe(false);
    expect(isLoopOnlyStatus(null, STATUSES)).toBe(false);
    expect(isLoopOnlyStatus(undefined, STATUSES)).toBe(false);
  });
});
