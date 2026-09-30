import { describe, expect, it } from 'vitest';

import type { ResolvedAnnotation } from './attach.ts';
import { bySuffix, notePreviews } from './preview.ts';

const a = (over: Partial<ResolvedAnnotation>): ResolvedAnnotation => ({
  eventId: 'e1',
  at: '2025-11-01T09:05:00+08:00',
  source: 'line',
  author: 'Alice',
  excerpt: 'Lunch plan',
  body: 'b',
  status: 'exact',
  ...over,
});

describe('notePreviews', () => {
  it('maps an attached 眉批 to its message with trimmed body and author', () => {
    expect(notePreviews([a({ body: '  那天\n下雨  ', by: 'Bob' })])).toEqual(
      new Map([['e1', { body: '那天\n下雨', by: 'Bob' }]]),
    );
  });

  it('shows 眉批 for an empty body and leaves out a missing author', () => {
    expect(notePreviews([a({ body: '   ' })]).get('e1')).toEqual({
      body: '眉批',
    });
  });

  it('skips unattached ones and ones without a message, and keeps the first per message', () => {
    const previews = notePreviews([
      a({ status: 'unattached', eventId: 'e9' }),
      a({ body: 'first' }),
      a({ body: 'second' }),
      a({ eventId: '', status: 'recovered' }),
    ]);
    expect([...previews]).toEqual([['e1', { body: 'first' }]]);
  });

  it('follows a recovered 眉批 to the message it re-attached to', () => {
    expect(
      notePreviews([a({ eventId: 'e2', status: 'recovered' })]).has('e2'),
    ).toBe(true);
  });
});

describe('bySuffix', () => {
  it('prefixes a name with a middle dot and is empty without one', () => {
    expect(bySuffix('Bob')).toBe(' · Bob');
    expect(bySuffix(undefined)).toBe('');
    expect(bySuffix('')).toBe('');
  });
});
