import { describe, expect, it } from 'vitest';

import { sprintHeading, TRACKER_CAVEAT, trackerNotice } from './tasksHeader.js';

const NOW = new Date('2026-09-02T10:15:00Z');

describe('trackerNotice', () => {
  it('names each half when the two halves aged apart', () => {
    // The live shape on 2026-09-02: work fetched from Notion a fortnight ago,
    // personal rebuilt minutes ago. One number would be wrong about both.
    const notice = trackerNotice(
      '2026-08-19T07:59:16Z',
      '2026-09-02T10:13:52Z',
      NOW,
    );
    expect(notice).toBe(
      `work synced 14 days ago · rebuilt 1 minute ago — ${TRACKER_CAVEAT}`,
    );
  });

  it('always carries the caveat verbatim', () => {
    expect(trackerNotice('2026-08-19T07:59:16Z', null, NOW)).toContain(
      TRACKER_CAVEAT,
    );
  });

  it('falls back to the caveat alone when neither timestamp is readable', () => {
    expect(trackerNotice(null, null, NOW)).toBe(TRACKER_CAVEAT);
    expect(trackerNotice('not-a-date', undefined, NOW)).toBe(TRACKER_CAVEAT);
  });

  it('reports whichever single half it does have', () => {
    expect(trackerNotice(null, '2026-09-02T10:13:52Z', NOW)).toBe(
      `rebuilt 1 minute ago — ${TRACKER_CAVEAT}`,
    );
    expect(trackerNotice('2026-09-02T10:13:52Z', null, NOW)).toBe(
      `work synced 1 minute ago — ${TRACKER_CAVEAT}`,
    );
  });
});

describe('sprintHeading', () => {
  it('appends the sprint the board is actually scoped to', () => {
    // The canvas draws Sprint 2; the board is on Sprint 3. The name is read,
    // never hard-coded.
    expect(sprintHeading('Sprint 3')).toEqual({
      title: 'Sprint tasks',
      suffix: '· Sprint 3',
    });
  });

  it('drops the suffix when no sprint is loaded', () => {
    expect(sprintHeading(null).suffix).toBeNull();
    expect(sprintHeading('').suffix).toBeNull();
  });
});
