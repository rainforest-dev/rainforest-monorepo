import { describe, expect, it } from 'vitest';

import { SORT_COMPARATORS } from './taskSort.js';
import type { SprintTask } from './tasks.js';

/** Minimal-but-complete SprintTask; each test only overrides what it checks. */
function task(overrides: Partial<SprintTask> & { order: number }): SprintTask {
  return {
    id: null,
    name: `task ${overrides.order}`,
    task_ref: null,
    task_source: 'notion',
    scope: 'work',
    status: 'Not started',
    work_type: null,
    priority: null,
    points: null,
    component: null,
    platform: [],
    epic: null,
    parent: null,
    ...overrides,
  };
}

describe('board mode', () => {
  it('sorts by order ascending — today\'s behaviour', () => {
    const tasks = [task({ order: 3 }), task({ order: 1 }), task({ order: 2 })];
    const sorted = tasks.slice().sort(SORT_COMPARATORS.board);
    expect(sorted.map((t) => t.order)).toEqual([1, 2, 3]);
  });
});

describe('priority mode', () => {
  it('ranks P0 before P1 before P2 before P3', () => {
    const p3 = task({ order: 1, priority: 'P3' });
    const p1 = task({ order: 2, priority: 'P1' });
    const p0 = task({ order: 3, priority: 'P0' });
    const p2 = task({ order: 4, priority: 'P2' });
    const sorted = [p3, p1, p0, p2].sort(SORT_COMPARATORS.priority);
    expect(sorted.map((t) => t.priority)).toEqual(['P0', 'P1', 'P2', 'P3']);
  });

  it('sorts no-priority tasks last', () => {
    const none = task({ order: 1, priority: null });
    const p3 = task({ order: 2, priority: 'P3' });
    const sorted = [none, p3].sort(SORT_COMPARATORS.priority);
    expect(sorted.map((t) => t.priority)).toEqual(['P3', null]);
  });

  it('breaks ties on order when priority is equal', () => {
    const later = task({ order: 5, priority: 'P1' });
    const earlier = task({ order: 2, priority: 'P1' });
    const sorted = [later, earlier].sort(SORT_COMPARATORS.priority);
    expect(sorted.map((t) => t.order)).toEqual([2, 5]);
  });
});

describe('points mode', () => {
  it('ranks smallest points first', () => {
    const eight = task({ order: 1, points: 8 });
    const one = task({ order: 2, points: 1 });
    const three = task({ order: 3, points: 3 });
    const sorted = [eight, one, three].sort(SORT_COMPARATORS.points);
    expect(sorted.map((t) => t.points)).toEqual([1, 3, 8]);
  });

  it('sorts unpointed tasks last', () => {
    const unpointed = task({ order: 1, points: null });
    const pointed = task({ order: 2, points: 5 });
    const sorted = [unpointed, pointed].sort(SORT_COMPARATORS.points);
    expect(sorted.map((t) => t.points)).toEqual([5, null]);
  });

  it('breaks ties on order when points are equal', () => {
    const later = task({ order: 9, points: 2 });
    const earlier = task({ order: 4, points: 2 });
    const sorted = [later, earlier].sort(SORT_COMPARATORS.points);
    expect(sorted.map((t) => t.order)).toEqual([4, 9]);
  });
});

describe('relay mode', () => {
  it('ranks applied/duplicate, then pending, then failed, then none last', () => {
    const none = task({ order: 1, outboxState: 'none' });
    const failed = task({ order: 2, outboxState: 'failed' });
    const pending = task({ order: 3, outboxState: 'pending' });
    const applied = task({ order: 4, outboxState: 'applied' });
    const duplicate = task({ order: 5, outboxState: 'duplicate' });
    const sorted = [none, failed, pending, applied, duplicate].sort(SORT_COMPARATORS.relay);
    expect(sorted.map((t) => t.outboxState)).toEqual([
      'applied',
      'duplicate',
      'pending',
      'failed',
      'none',
    ]);
  });

  it('treats null and undefined the same as "none" — last', () => {
    const nullState = task({ order: 1, outboxState: null });
    const undefinedState = task({ order: 2, outboxState: undefined });
    const pending = task({ order: 3, outboxState: 'pending' });
    const sorted = [nullState, undefinedState, pending].sort(SORT_COMPARATORS.relay);
    expect(sorted.map((t) => t.order)).toEqual([3, 1, 2]);
  });

  it('breaks ties on order when relay state is equal', () => {
    const later = task({ order: 7, outboxState: 'pending' });
    const earlier = task({ order: 3, outboxState: 'pending' });
    const sorted = [later, earlier].sort(SORT_COMPARATORS.relay);
    expect(sorted.map((t) => t.order)).toEqual([3, 7]);
  });
});
