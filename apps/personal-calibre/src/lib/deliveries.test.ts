import { describe, expect, it } from 'vitest';

import type { BookDeliveryEvent } from '@/types';

import {
  formatDeliveryDate,
  formatDeliveryTime,
  latestByPlatform,
} from './deliveries';

const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

describe('formatDeliveryTime', () => {
  it('shows an ISO time as local YYYY-MM-DD HH:mm', () => {
    const iso = '2026-09-01T08:30:00.000Z';
    expect(formatDeliveryTime(iso)).toBe(local(new Date(iso)));
  });

  it('reads the SQLite datetime format as UTC', () => {
    expect(formatDeliveryTime('2026-09-01 08:30:00')).toBe(
      local(new Date('2026-09-01T08:30:00Z')),
    );
  });

  it('returns anything unparseable as it came', () => {
    expect(formatDeliveryTime('yesterday')).toBe('yesterday');
  });
});

describe('formatDeliveryDate', () => {
  it('shows the local date only', () => {
    const iso = '2026-09-01T08:30:00.000Z';
    expect(formatDeliveryDate(iso)).toBe(local(new Date(iso)).slice(0, 10));
  });
});

describe('latestByPlatform', () => {
  const event = (id: number, platformKey: string): BookDeliveryEvent => ({
    id,
    bookId: 1,
    platformKey,
    platformName: platformKey,
    addedAt: '2026-09-01T08:30:00.000Z',
    note: null,
    externalRef: null,
  });

  it('keeps the newest event per platform from a newest-first list', () => {
    const latest = latestByPlatform([
      event(9, 'kobo'),
      event(7, 'notebooklm'),
      event(3, 'kobo'),
    ]);
    expect(latest.get('kobo')?.id).toBe(9);
    expect(latest.get('notebooklm')?.id).toBe(7);
    expect(latest.has('readwise-reader')).toBe(false);
  });
});
