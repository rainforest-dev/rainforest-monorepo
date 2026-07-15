import { describe, expect, it } from 'vitest';

import { DEFAULT_STATUSES, effectiveStatus, loopStageLabel } from './taskStatus.js';

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
    expect(effectiveStatus('Not started', 'Merged', STATUSES)).toBe('Done');
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
