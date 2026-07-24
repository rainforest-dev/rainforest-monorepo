import { describe, expect, it } from 'vitest';

import { parseTasks, parseTasksProgress } from './tasks.js';

// A trimmed snapshot mirroring the real tasks.json: one fully-populated task
// (epic + parent + points + component), one epic-only task (no parent, null
// component/points), one bare task (no epic, no parent) — plus an out-of-order
// `order` to prove sorting.
const SAMPLE = JSON.stringify({
  synced_at: '2026-07-14T02:00:00Z',
  source: 'notion',
  board: 'Work Items (new)',
  board_url: 'https://app.notion.com/p/board',
  sprint: { id: 1, name: 'Sprint 1', status: 'Next', start: '2026-07-13', url: 'https://n/s' },
  assignee: 'Rainforest',
  statuses: ['Backlog', 'Not started', 'In progress / PR', 'In QA', 'Done'],
  tasks: [
    {
      id: 22, order: 3, name: 'bare task', task_ref: 'https://n/22', task_source: 'obsidian',
      scope: 'personal',
      status: 'Not started', work_type: 'Task', priority: 'P2', points: null,
      component: null, platform: [], epic: null, parent: null,
    },
    {
      id: 105, order: 1, name: 'sub-task under story', task_ref: 'https://n/105', task_source: 'notion',
      scope: 'work',
      status: 'Not started', work_type: 'Sub-task', priority: 'P1', points: 5,
      component: 'cloud-backend', platform: ['Cloud'],
      epic: { id: 3, name: 'SLA epic', url: 'https://n/e3' },
      parent: { id: 33, name: 'SLA story', url: 'https://n/p33' },
    },
    {
      // scope intentionally omitted → must default to 'work'
      id: 59, order: 2, name: 'epic-only task', task_ref: 'https://n/59', task_source: 'notion',
      status: 'Not started', work_type: 'Task', priority: 'P1', points: 2,
      component: null, platform: [],
      epic: { id: 20, name: 'Dashboard epic', url: 'https://n/e20' }, parent: null,
    },
  ],
});

describe('parseTasks', () => {
  it('parses metadata and sorts tasks by order', () => {
    const data = parseTasks(SAMPLE)!;
    expect(data.sprint?.name).toBe('Sprint 1');
    expect(data.statuses).toHaveLength(5);
    expect(data.tasks.map((t) => t.id)).toEqual([105, 59, 22]);
  });

  it('preserves nullable fields and links', () => {
    const data = parseTasks(SAMPLE)!;
    const bare = data.tasks.find((t) => t.id === 22)!;
    expect(bare.points).toBeNull();
    expect(bare.component).toBeNull();
    expect(bare.epic).toBeNull();
    expect(bare.parent).toBeNull();

    const sub = data.tasks.find((t) => t.id === 105)!;
    expect(sub.points).toBe(5);
    expect(sub.epic?.name).toBe('SLA epic');
    expect(sub.parent?.id).toBe(33);
  });

  it('parses scope and defaults it to work when missing', () => {
    const data = parseTasks(SAMPLE)!;
    expect(data.tasks.find((t) => t.id === 22)!.scope).toBe('personal');
    expect(data.tasks.find((t) => t.id === 105)!.scope).toBe('work');
    // id 59 omits `scope` entirely → defaults to 'work' for older snapshots.
    expect(data.tasks.find((t) => t.id === 59)!.scope).toBe('work');
    // An unrecognized scope value also degrades to 'work'.
    const weird = parseTasks(
      JSON.stringify({ tasks: [{ id: 7, name: 'x', order: 0, scope: 'nope' }] }),
    )!;
    expect(weird.tasks[0].scope).toBe('work');
  });

  it('falls back to canonical statuses when omitted', () => {
    const data = parseTasks(JSON.stringify({ tasks: [] }))!;
    expect(data.statuses).toContain('Not started');
    expect(data.statuses).toContain('Blocked');
    expect(data.tasks).toEqual([]);
  });

  it('skips malformed tasks rather than failing the file', () => {
    const data = parseTasks(
      JSON.stringify({ tasks: [{ id: 1 }, 'nope', null, { id: 2, name: 'ok', order: 0 }] }),
    )!;
    expect(data.tasks.map((t) => t.name)).toEqual(['ok']);
  });

  it('returns null for non-object / malformed JSON', () => {
    expect(parseTasks('not json')).toBeNull();
    expect(parseTasks('[]')).toBeNull();
    expect(parseTasks('42')).toBeNull();
  });
});

describe('parseTasksProgress', () => {
  const OVERLAY = JSON.stringify({
    updated_at: '2026-07-14T05:00:00Z',
    source: 'loop',
    tasks: {
      '22': { loop_status: 'In progress / PR', pr: 'https://gh/pull/2404', note: 'opened PR' },
      '31': { loop_status: 'In progress / PR', pr: null, note: null },
      '68': { loop_status: 'Needs tuning', pr: null, note: 'flaky' },
    },
  });

  it('parses the id → progress map with pr/note nullable', () => {
    const map = parseTasksProgress(OVERLAY)!;
    expect(Object.keys(map)).toEqual(['22', '31', '68']);
    expect(map['22']).toEqual({
      loop_status: 'In progress / PR',
      pr: 'https://gh/pull/2404',
      note: 'opened PR',
    });
    expect(map['31'].pr).toBeNull();
    expect(map['68'].loop_status).toBe('Needs tuning');
  });

  it('skips malformed entries and returns null for a bad shape', () => {
    const map = parseTasksProgress(
      JSON.stringify({ tasks: { '1': { loop_status: 'Done' }, '2': 'nope', '3': null } }),
    )!;
    expect(Object.keys(map)).toEqual(['1']);
    expect(map['1']).toEqual({ loop_status: 'Done', pr: null, note: null });

    expect(parseTasksProgress('not json')).toBeNull();
    expect(parseTasksProgress(JSON.stringify({ no_tasks: true }))).toBeNull();
    expect(parseTasksProgress('[]')).toBeNull();
  });
});
