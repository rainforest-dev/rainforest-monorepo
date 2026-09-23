import { describe, expect, it } from 'vitest';

import type { TimelineEvent } from '../timeline.ts';
import { excerptOf, resolveAnnotations } from './attach.ts';
import type { Annotation } from './types.ts';

const event = (over: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'e1',
  source: 'line',
  at: '2025-11-01T09:05:00+08:00',
  author: 'Alice',
  text: 'Lunch plan:\n1. noodles',
  ...over,
});

const note = (over: Partial<Annotation>): Annotation => ({
  eventId: 'e1',
  at: '2025-11-01T09:05:00+08:00',
  source: 'line',
  author: 'Alice',
  excerpt: 'Lunch plan: 1. noodles',
  body: 'b',
  ...over,
});

describe('excerptOf', () => {
  it('collapses whitespace and truncates', () => {
    expect(excerptOf(event({}))).toBe('Lunch plan: 1. noodles');
    expect(excerptOf(event({ text: 'x'.repeat(50) }), 40)).toBe(
      `${'x'.repeat(40)}…`,
    );
    expect(excerptOf({ source: 'photo' })).toBe('照片');
  });
});

describe('resolveAnnotations', () => {
  it('matches by id', () => {
    const [r] = resolveAnnotations([note({})], [event({})]);
    expect(r.status).toBe('exact');
  });

  it('recovers a drifted id by time, source, author and excerpt', () => {
    const [r] = resolveAnnotations(
      [note({ eventId: 'old', excerpt: 'Lunch plan: 1. no…' })],
      [event({ id: 'new' })],
    );
    expect(r).toMatchObject({ status: 'recovered', eventId: 'new' });
  });

  it('does not recover when the text differs', () => {
    const [r] = resolveAnnotations(
      [note({ eventId: 'old' })],
      [event({ id: 'new', text: 'Something else' })],
    );
    expect(r).toMatchObject({ status: 'unattached', eventId: 'old' });
  });

  it('lists unattached first', () => {
    const out = resolveAnnotations(
      [note({}), note({ eventId: '', excerpt: '', body: 'hand' })],
      [event({})],
    );
    expect(out.map((r) => r.status)).toEqual(['unattached', 'exact']);
  });
});
