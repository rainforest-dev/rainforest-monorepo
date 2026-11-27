import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  AGY_ISOLATION_PREAMBLE,
  type AssistantId,
  type AssistantRecord,
  guardRecord,
  type JsonRpcResponse,
  listedToolNames,
  NEUTRAL_SYSTEM_PROMPT,
  parseAgyJson,
  parseClaudeJson,
  parseMcpResponse,
  parseOllamaChat,
  QUESTION,
  renderChecklist,
  saveRun,
  selfTrafficUrl,
  type SiteSnapshot,
  taipeiDate,
} from './ai-profile-benchmark.ts';

const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(
  /\/$/,
  '',
);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:12b-mlx';
const AGY_MODEL = process.env.AGY_MODEL ?? '';
const EXTRA_MARKERS = (process.env.AI_BENCH_PRIVATE_MARKERS ?? '')
  .split(',')
  .filter(Boolean);
const TIMEOUT_MS = 10 * 60 * 1000;

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    only: { type: 'string' },
    'no-site': { type: 'boolean', default: false },
  },
});

const now = new Date();
const date = taipeiDate(now);
const outDir =
  values.out ??
  join(import.meta.dirname, '../../../docs/ai-profile-benchmark', date);

const run = (
  command: string,
  args: string[],
): Promise<{ stdout: string; durationMs: number }> => {
  const cwd = mkdtempSync(join(tmpdir(), 'ai-profile-benchmark-'));
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { cwd, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        rmSync(cwd, { recursive: true, force: true });
        if (error && !stdout) {
          reject(new Error(`${command} failed: ${stderr || error.message}`));
          return;
        }
        resolve({ stdout, durationMs: Date.now() - started });
      },
    );
    child.stdin?.end();
  });
};

const mcpCall = async (
  id: number,
  method: string,
  params?: unknown,
): Promise<JsonRpcResponse> => {
  const response = await fetch(selfTrafficUrl('/mcp'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  if (!response.ok) throw new Error(`/mcp ${method}: HTTP ${response.status}`);
  return parseMcpResponse(await response.text());
};

const snapshotSite = async (): Promise<SiteSnapshot> => {
  const llms = await fetch(selfTrafficUrl('/llms.txt'));
  if (!llms.ok) throw new Error(`llms.txt: HTTP ${llms.status}`);
  const toolsList = await mcpCall(1, 'tools/list');
  const names = listedToolNames(toolsList);
  const calls: Record<string, JsonRpcResponse> = {};
  let id = 2;
  for (const tool of [
    'get_profile_summary',
    'get_work_experience',
    'get_education',
    'get_projects',
  ]) {
    if (!names.includes(tool)) continue;
    calls[tool] = await mcpCall(id++, 'tools/call', {
      name: tool,
      arguments: { lang: 'en' },
    });
  }
  return {
    fetchedAt: new Date().toISOString(),
    llmsTxt: await llms.text(),
    toolsList,
    calls,
  };
};

const claudeArgs = (extra: string[]) => [
  '-p',
  QUESTION,
  '--output-format',
  'json',
  '--no-session-persistence',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--system-prompt',
  NEUTRAL_SYSTEM_PROMPT,
  '--setting-sources',
  'project',
  '--settings',
  JSON.stringify({
    disableAllHooks: true,
    autoMemoryEnabled: false,
    claudeMdExcludes: ['**/CLAUDE.md', '**/*.md'],
  }),
  '--max-budget-usd',
  '2',
  ...extra,
];

type Runner = {
  label: string;
  tools: string;
  ask: () => Promise<Omit<AssistantRecord, 'id' | 'label' | 'tools'>>;
};

const askClaude = async (extra: string[]) => {
  const askedAt = new Date().toISOString();
  const { stdout } = await run('claude', claudeArgs(extra));
  const parsed = parseClaudeJson(stdout);
  return {
    question: QUESTION,
    askedAt,
    model: parsed.model,
    status: parsed.isError ? ('error' as const) : ('ok' as const),
    answer: parsed.answer,
    durationMs: parsed.durationMs,
    costUsd: parsed.costUsd,
  };
};

const SITE_MCP_CONFIG = JSON.stringify({
  mcpServers: {
    'rainforest-site': { type: 'http', url: selfTrafficUrl('/mcp') },
  },
});

const RUNNERS: Record<AssistantId, Runner> = {
  'claude-offline': {
    label: 'Claude (no tools, training knowledge only)',
    tools: 'none',
    ask: () => askClaude(['--tools', '']),
  },
  'claude-web': {
    label: 'Claude (web search)',
    tools: 'WebSearch, WebFetch',
    ask: () =>
      askClaude([
        '--tools',
        'WebSearch,WebFetch',
        '--allowedTools',
        'WebSearch,WebFetch',
      ]),
  },
  'gemini-agy-web': {
    label: 'Gemini via Antigravity CLI (web search)',
    tools: 'agy default tools; isolation preamble in the prompt',
    ask: async () => {
      const askedAt = new Date().toISOString();
      const args = [
        '--output-format',
        'json',
        '--disable-slash-commands',
        ...(AGY_MODEL ? ['--model', AGY_MODEL] : []),
        '--print',
        `${AGY_ISOLATION_PREAMBLE}${QUESTION}`,
      ];
      const { stdout } = await run('agy', args);
      const parsed = parseAgyJson(stdout);
      return {
        question: QUESTION,
        askedAt,
        model: AGY_MODEL || 'agy default',
        status: parsed.isError ? 'error' : 'ok',
        answer: parsed.answer,
        durationMs: parsed.durationMs,
        note: 'agy loads its user-level instructions; the prompt tells it to ignore them, and the private-data guard checks the answer.',
      };
    },
  },
  'gemma-local': {
    label: 'Gemma via local Ollama (no tools)',
    tools: 'none',
    ask: async () => {
      const askedAt = new Date().toISOString();
      const started = Date.now();
      const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          messages: [
            { role: 'system', content: NEUTRAL_SYSTEM_PROMPT },
            { role: 'user', content: QUESTION },
          ],
        }),
      });
      if (!response.ok) throw new Error(`ollama: HTTP ${response.status}`);
      return {
        question: QUESTION,
        askedAt,
        model: OLLAMA_MODEL,
        status: 'ok',
        answer: parseOllamaChat(await response.text()),
        durationMs: Date.now() - started,
      };
    },
  },
  'claude-site-mcp': {
    label: 'Claude with only the site MCP connected',
    tools: 'rainforest.tools /mcp',
    ask: () =>
      askClaude([
        '--tools',
        '',
        '--mcp-config',
        SITE_MCP_CONFIG,
        '--allowedTools',
        'mcp__rainforest-site',
      ]),
  },
};

const selected = (
  values.only ? values.only.split(',') : Object.keys(RUNNERS)
) as AssistantId[];

const site = values['no-site'] ? undefined : await snapshotSite();
const records: AssistantRecord[] = [];
for (const id of selected) {
  const runner = RUNNERS[id];
  if (!runner) throw new Error(`unknown assistant: ${id}`);
  console.error(`asking ${id}...`);
  try {
    const result = await runner.ask();
    records.push(
      guardRecord(
        { id, label: runner.label, tools: runner.tools, ...result },
        EXTRA_MARKERS,
      ),
    );
  } catch (error) {
    records.push({
      id,
      label: runner.label,
      tools: runner.tools,
      question: QUESTION,
      askedAt: new Date().toISOString(),
      model: 'unknown',
      status: 'error',
      answer: '',
      note: error instanceof Error ? error.message : String(error),
    });
  }
}

const written = saveRun(outDir, site, records);
writeFileSync(join(outDir, 'MANUAL.md'), renderChecklist(date));
console.log(`Wrote ${written.length} files to ${outDir}`);
for (const record of records) console.log(`  ${record.id}: ${record.status}`);
console.log('');
console.log(renderChecklist(date));
