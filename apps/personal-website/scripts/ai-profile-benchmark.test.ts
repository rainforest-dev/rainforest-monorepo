import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  type AssistantRecord,
  findPrivateMarkers,
  guardRecord,
  listedToolNames,
  parseAgyJson,
  parseClaudeJson,
  parseMcpResponse,
  parseOllamaChat,
  QUESTION,
  renderChecklist,
  saveRun,
  selfTrafficUrl,
  taipeiDate,
} from './ai-profile-benchmark.ts';

const record = (answer: string): AssistantRecord => ({
  id: 'claude-web',
  label: 'Claude (web search)',
  question: QUESTION,
  askedAt: '2026-11-27T03:00:00.000Z',
  model: 'test-model',
  tools: 'WebSearch',
  status: 'ok',
  answer,
});

describe('selfTrafficUrl', () => {
  it('tags the request as own traffic', () => {
    expect(selfTrafficUrl('/mcp')).toBe(
      'https://rainforest.tools/mcp?src=self',
    );
  });
});

describe('parseMcpResponse', () => {
  it('reads a plain JSON body', () => {
    const body = '{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"a"}]}}';
    expect(listedToolNames(parseMcpResponse(body))).toEqual(['a']);
  });

  it('reads the last data line of an SSE body', () => {
    const body =
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n';
    expect(parseMcpResponse(body).result).toEqual({ ok: true });
  });

  it('throws on a JSON-RPC error', () => {
    const body =
      '{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"nope"}}';
    expect(() => parseMcpResponse(body)).toThrow('MCP error -32601: nope');
  });

  it('throws when there is no message', () => {
    expect(() => parseMcpResponse('event: ping\n')).toThrow(/no JSON-RPC/);
  });

  it('rejects a tools/list without tools', () => {
    expect(() =>
      listedToolNames({ jsonrpc: '2.0', id: 1, result: {} }),
    ).toThrow(/no tools/);
  });
});

describe('parseClaudeJson', () => {
  it('takes the answer, models and cost', () => {
    const run = parseClaudeJson(
      JSON.stringify({
        result: ' Hello \n',
        is_error: false,
        total_cost_usd: 0.02,
        duration_ms: 900,
        modelUsage: { 'model-a': {}, 'model-b': {} },
      }),
    );
    expect(run).toEqual({
      answer: 'Hello',
      model: 'model-a, model-b',
      isError: false,
      costUsd: 0.02,
      durationMs: 900,
    });
  });

  it('treats a budget stop as an error', () => {
    const run = parseClaudeJson(
      JSON.stringify({ is_error: true, subtype: 'error_max_budget_usd' }),
    );
    expect(run.isError).toBe(true);
    expect(run.model).toBe('unknown');
  });
});

describe('parseAgyJson', () => {
  it('reads the final JSON line', () => {
    const stdout =
      'warning: something\n{"status":"SUCCESS","response":"Answer","duration_seconds":1.5}\n';
    expect(parseAgyJson(stdout)).toEqual({
      answer: 'Answer',
      isError: false,
      durationMs: 1500,
    });
  });

  it('flags a failed or empty run', () => {
    expect(parseAgyJson('').isError).toBe(true);
    expect(parseAgyJson('{"status":"ERROR"}').isError).toBe(true);
  });
});

describe('parseOllamaChat', () => {
  it('drops thinking blocks', () => {
    const body = JSON.stringify({
      message: { content: '<think>hmm</think>\nNo idea.' },
    });
    expect(parseOllamaChat(body)).toBe('No idea.');
  });
});

describe('findPrivateMarkers', () => {
  it('passes a public answer with dates and links', () => {
    expect(
      findPrivateMarkers(
        'Studied 2015 - 2019. See https://rainforest.tools and github.com/rainforest-dev.',
      ),
    ).toEqual([]);
  });

  it('flags contact details and local paths', () => {
    expect(
      findPrivateMarkers(
        'Mail a@b.example or call +886 912 345 678. Source: file:///Users/x/notes.md',
      ),
    ).toEqual(['email address', 'phone number', 'local file link']);
  });

  it('flags runtime markers without naming them', () => {
    expect(
      findPrivateMarkers('Reports to Somebody Else', ['somebody']),
    ).toEqual(['private marker']);
  });
});

describe('guardRecord', () => {
  it('keeps a clean answer', () => {
    expect(guardRecord(record('A frontend engineer.'))).toEqual(
      record('A frontend engineer.'),
    );
  });

  it('withholds an answer that read local context', () => {
    const guarded = guardRecord(record('From /Users/me/vault/Profile.md'));
    expect(guarded.status).toBe('withheld');
    expect(guarded.answer).toBe('');
    expect(guarded.privateMarkers).toEqual(['local file link']);
  });
});

describe('taipeiDate', () => {
  it('uses Taiwan time', () => {
    expect(taipeiDate(new Date('2026-11-27T17:00:00Z'))).toBe('2026-11-28');
  });
});

describe('renderChecklist', () => {
  it('asks the fixed question and lists the manual assistants', () => {
    const text = renderChecklist('2026-11-27');
    expect(text).toContain(`"${QUESTION}"`);
    expect(text).toContain('- [ ] Grok');
  });
});

describe('saveRun', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('writes site responses and each answer as JSON and markdown', () => {
    dir = mkdtempSync(join(tmpdir(), 'ai-profile-benchmark-test-'));
    const written = saveRun(
      dir,
      {
        fetchedAt: '2026-11-27T03:00:00.000Z',
        llmsTxt: '# Site',
        toolsList: { jsonrpc: '2.0', id: 1, result: { tools: [] } },
        calls: {
          get_profile_summary: { jsonrpc: '2.0', id: 2, result: { n: 1 } },
        },
      },
      [record('A frontend engineer.')],
    );
    expect(written).toEqual([
      'site/llms.txt',
      'site/mcp-tools-list.json',
      'site/mcp-get_profile_summary.json',
      'answers/claude-web.json',
      'answers/claude-web.md',
    ]);
    expect(readFileSync(join(dir, 'site/llms.txt'), 'utf8')).toBe('# Site\n');
    const saved = JSON.parse(
      readFileSync(join(dir, 'answers/claude-web.json'), 'utf8'),
    ) as AssistantRecord;
    expect(saved.answer).toBe('A frontend engineer.');
    expect(readFileSync(join(dir, 'answers/claude-web.md'), 'utf8')).toContain(
      '- Model: test-model',
    );
  });
});
