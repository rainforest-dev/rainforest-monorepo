import { describe, expect, it } from 'vitest';

import { aggregate, parseLedger } from './ledger.js';

const FIXTURE = [
  JSON.stringify({
    notion_task_id: 'TASK-1',
    provisional_key: null,
    notion_ref: 'https://notion.so/task-1',
    machine: 'mac',
    tool: 'claude-code',
    model: 'claude-opus-4-8',
    session_id: 's1',
    ts: '2026-06-09T04:34:28.363Z',
    tokens_in: 100,
    tokens_out: 20,
    cache: 0,
    cost_est_usd: 1.5,
    source: 'turn-parse',
  }),
  JSON.stringify({
    notion_task_id: null,
    provisional_key: 'claude/branch-x',
    notion_ref: null,
    machine: 'mac',
    tool: 'codex',
    model: 'gpt-5.5',
    session_id: 's2',
    ts: '2026-06-09T09:00:00.000Z',
    tokens_in: 50,
    tokens_out: 10,
    cache: 5,
    cost_est_usd: 0.25,
    source: 'trace',
  }),
  '{ this is not valid json',
  '',
  '   ',
  JSON.stringify({
    notion_task_id: 'TASK-1',
    provisional_key: null,
    notion_ref: null,
    machine: 'mac',
    tool: 'claude-code',
    model: 'claude-sonnet-5',
    session_id: 's1',
    ts: '2026-06-10T01:00:00.000Z',
    tokens_in: 200,
    tokens_out: 40,
    cache: 0,
    cost_est_usd: 0.75,
    source: 'turn-parse',
  }),
].join('\n');

describe('parseLedger', () => {
  it('skips malformed and blank lines', () => {
    const records = parseLedger(FIXTURE);
    expect(records).toHaveLength(3);
  });

  it('normalizes fields correctly', () => {
    const [first] = parseLedger(FIXTURE);
    expect(first.notion_task_id).toBe('TASK-1');
    expect(first.provisional_key).toBeNull();
    expect(first.notion_ref).toBe('https://notion.so/task-1');
    expect(first.tokens_in).toBe(100);
    expect(first.cost_est_usd).toBe(1.5);
  });

  it('coerces missing or wrong-typed numerics to 0', () => {
    const records = parseLedger(
      JSON.stringify({ ts: '2026-06-09T00:00:00.000Z', tokens_in: 'oops' }),
    );
    expect(records).toHaveLength(1);
    expect(records[0].tokens_in).toBe(0);
    expect(records[0].cost_est_usd).toBe(0);
  });

  it('drops records without a usable timestamp', () => {
    const records = parseLedger(JSON.stringify({ tool: 'claude-code' }));
    expect(records).toHaveLength(0);
  });
});

describe('aggregate', () => {
  const agg = aggregate(parseLedger(FIXTURE));

  it('computes totals', () => {
    expect(agg.totals.cost_est_usd).toBe(2.5);
    expect(agg.totals.tokens_in).toBe(350);
    expect(agg.totals.tokens_out).toBe(70);
    expect(agg.totals.cache).toBe(5);
    expect(agg.totals.record_count).toBe(3);
    expect(agg.totals.session_count).toBe(2);
  });

  it('groups the daily series by date, ascending', () => {
    expect(agg.dailySeries).toHaveLength(2);
    expect(agg.dailySeries[0].date).toBe('2026-06-09');
    expect(agg.dailySeries[0].cost).toBe(1.75);
    expect(agg.dailySeries[1].date).toBe('2026-06-10');
    expect(agg.dailySeries[1].cost).toBe(0.75);
  });

  it('breaks down by tool sorted by cost desc', () => {
    expect(agg.byTool.map((b) => b.key)).toEqual(['claude-code', 'codex']);
    expect(agg.byTool[0].cost).toBe(2.25);
    expect(agg.byTool[0].tokens).toBe(360);
    expect(agg.byTool[0].count).toBe(2);
  });

  it('breaks down by model and machine', () => {
    expect(agg.byModel.map((b) => b.key).sort()).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-5',
      'gpt-5.5',
    ]);
    expect(agg.byMachine).toHaveLength(1);
    expect(agg.byMachine[0].key).toBe('mac');
    // last_ts is the most recent record's timestamp for that machine.
    expect(agg.byMachine[0].last_ts).toBe('2026-06-10T01:00:00.000Z');
  });

  it('groups by task (notion_task_id or provisional_key), cost desc, with tools', () => {
    expect(agg.byTask).toHaveLength(2);
    const [top] = agg.byTask;
    expect(top.task).toBe('TASK-1');
    expect(top.cost).toBe(2.25);
    expect(top.count).toBe(2);
    expect(top.notion_ref).toBe('https://notion.so/task-1');
    expect(top.tools).toEqual(['claude-code']);

    const provisional = agg.byTask[1];
    expect(provisional.task).toBe('claude/branch-x');
    expect(provisional.notion_ref).toBeNull();
  });
});
