import { describe, expect, it } from 'vitest';

import { daysLeftInTrash, TRASH_DAYS, trashCutoff } from './trash';

describe('trash dates', () => {
  it('counts whole days left, never below zero', () => {
    const now = Date.parse('2026-10-16T12:00:00Z');
    expect(daysLeftInTrash('2026-10-16 11:00:00', now)).toBe(TRASH_DAYS);
    expect(daysLeftInTrash('2026-10-15 11:00:00', now)).toBe(TRASH_DAYS - 1);
    expect(daysLeftInTrash('2026-09-01 00:00:00', now)).toBe(0);
  });

  it('names the trashedAt that is due in SQLite’s format', () => {
    expect(trashCutoff(new Date('2026-10-31T08:09:10.500Z'))).toBe(
      '2026-10-01 08:09:10',
    );
  });
});
