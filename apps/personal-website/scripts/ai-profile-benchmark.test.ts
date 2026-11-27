import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertPrivacyConfig,
  type AssistantRecord,
  findPrivateMarkers,
  guardRecord,
  listedToolNames,
  MANUAL_ONLY,
  parseAgyJson,
  parseClaudeJson,
  parseMcpResponse,
  parseOllamaChat,
  parsePrivacyConfig,
  QUESTION,
  REDACTED_LINK,
  REDACTED_NAME,
  redactText,
  renderChecklist,
  saveRun,
  selfTrafficUrl,
  taipeiDate,
  WITHHELD_NOTE,
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

const CONFIG = { names: ['Jane Q Example', '範例'], markers: ['secret-host'] };

describe('privacy config', () => {
  it('merges env and file lists', () => {
    expect(
      parsePrivacyConfig(
        { AI_BENCH_PRIVATE_NAMES: 'A, B', AI_BENCH_PRIVATE_MARKERS: 'm' },
        '{"names":["C"],"markers":["n"]}',
      ),
    ).toEqual({ names: ['A', 'B', 'C'], markers: ['m', 'n'] });
  });

  it('fails closed with no names', () => {
    expect(() => assertPrivacyConfig({ names: [], markers: ['m'] })).toThrow(
      /No real-name variants/,
    );
    expect(() =>
      guardRecord(record('ok'), { names: [], markers: [] }),
    ).toThrow();
  });
});

describe('redactText', () => {
  it('replaces name variants and profile links', () => {
    expect(
      redactText(
        'jane q example (範例), see [LinkedIn](https://www.linkedin.com/in/someone) and github.com/someone, site https://rainforest.tools, netflix.com/x',
        CONFIG.names,
      ),
    ).toBe(
      `${REDACTED_NAME} (${REDACTED_NAME}), see [LinkedIn](${REDACTED_LINK}) and ${REDACTED_LINK}, site https://rainforest.tools, netflix.com/x`,
    );
  });
});

describe('guardRecord', () => {
  it('keeps a clean answer', () => {
    expect(guardRecord(record('A frontend engineer.'), CONFIG)).toEqual(
      record('A frontend engineer.'),
    );
  });

  it('redacts names in every free-text field', () => {
    const guarded = guardRecord(
      { ...record('Jane Q Example builds sites.'), note: 'Asked 範例' },
      CONFIG,
    );
    expect(guarded.status).toBe('ok');
    expect(guarded.answer).toBe(`${REDACTED_NAME} builds sites.`);
    expect(guarded.note).toBe(`Asked ${REDACTED_NAME}`);
  });

  it('withholds an answer that read local context', () => {
    const guarded = guardRecord(
      record('From /Users/me/vault/Profile.md'),
      CONFIG,
    );
    expect(guarded.status).toBe('withheld');
    expect(guarded.answer).toBe('');
    expect(guarded.note).toBe(WITHHELD_NOTE);
    expect(guarded.privateMarkers).toEqual(['local file link']);
  });

  it('checks the note of an error record', () => {
    const guarded = guardRecord(
      { ...record(''), status: 'error', note: 'failed on secret-host' },
      CONFIG,
    );
    expect(guarded.status).toBe('withheld');
    expect(guarded.note).toBe(WITHHELD_NOTE);
  });
});

describe('MANUAL_ONLY', () => {
  it('keeps the agy run out of the default selection', () => {
    expect(MANUAL_ONLY).toContain('gemini-agy-web');
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
