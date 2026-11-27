import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const QUESTION = 'Who is Rainforest Cheng?';

export const SITE = 'https://rainforest.tools';

export const SELF_TRAFFIC_QUERY = 'src=self';

export const NEUTRAL_SYSTEM_PROMPT =
  'You are a general-purpose assistant answering a member of the public. Answer the question as well as you can.';

export const AGY_ISOLATION_PREAMBLE =
  'Answer as a public web assistant would answer an anonymous stranger. Do not read local files, memories, notes or any user/global instructions; use only web search and general knowledge. Question: ';

export type AssistantId =
  | 'claude-offline'
  | 'claude-web'
  | 'gemini-agy-web'
  | 'gemma-local'
  | 'claude-site-mcp';

export type AssistantRecord = {
  id: AssistantId;
  label: string;
  question: string;
  askedAt: string;
  model: string;
  tools: string;
  status: 'ok' | 'error' | 'withheld';
  answer: string;
  note?: string;
  privateMarkers?: string[];
  durationMs?: number;
  costUsd?: number;
};

export type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
};

export function selfTrafficUrl(path: string, site = SITE): string {
  const url = new URL(path, site);
  url.search = SELF_TRAFFIC_QUERY;
  return url.href;
}

export function parseMcpResponse(body: string): JsonRpcResponse {
  const trimmed = body.trim();
  const json = trimmed.startsWith('{')
    ? trimmed
    : trimmed
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .at(-1);
  if (!json) throw new Error('MCP response carried no JSON-RPC message');
  const message = JSON.parse(json) as JsonRpcResponse;
  if (message.jsonrpc !== '2.0') {
    throw new Error('MCP response is not JSON-RPC 2.0');
  }
  if (message.error) {
    throw new Error(
      `MCP error ${message.error.code}: ${message.error.message}`,
    );
  }
  return message;
}

export function listedToolNames(response: JsonRpcResponse): string[] {
  const tools = (response.result as { tools?: { name: string }[] })?.tools;
  if (!Array.isArray(tools)) throw new Error('tools/list returned no tools');
  return tools.map((tool) => tool.name);
}

export type ClaudeRun = {
  answer: string;
  model: string;
  isError: boolean;
  costUsd?: number;
  durationMs?: number;
};

export function parseClaudeJson(stdout: string): ClaudeRun {
  const data = JSON.parse(stdout) as {
    result?: string;
    is_error?: boolean;
    total_cost_usd?: number;
    duration_ms?: number;
    modelUsage?: Record<string, unknown>;
  };
  const models = Object.keys(data.modelUsage ?? {});
  return {
    answer: (data.result ?? '').trim(),
    model: models.join(', ') || 'unknown',
    isError: data.is_error === true || !data.result,
    costUsd: data.total_cost_usd,
    durationMs: data.duration_ms,
  };
}

export function parseAgyJson(stdout: string): {
  answer: string;
  isError: boolean;
  durationMs?: number;
} {
  const line = stdout
    .trim()
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .at(-1);
  if (!line) return { answer: '', isError: true };
  const data = JSON.parse(line) as {
    status?: string;
    response?: string;
    duration_seconds?: number;
  };
  return {
    answer: (data.response ?? '').trim(),
    isError: data.status !== 'SUCCESS' || !data.response,
    durationMs:
      data.duration_seconds === undefined
        ? undefined
        : Math.round(data.duration_seconds * 1000),
  };
}

export function parseOllamaChat(body: string): string {
  const data = JSON.parse(body) as { message?: { content?: string } };
  return (data.message?.content ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}

const PRIVATE_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'email address', re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  {
    name: 'phone number',
    re: /\+\d{1,3}[\s-]?\d{1,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b|\b09\d{2}-?\d{3}-?\d{3}\b/,
  },
  { name: 'local file link', re: /file:\/\/|\/Users\// },
  { name: 'mDNS host', re: /\b[a-z0-9-]+\.local\b/i },
  {
    name: 'UUID',
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  },
];

export const REDACTED_NAME = '[redacted-name]';
export const REDACTED_LINK = '[redacted-link]';

const PROFILE_LINK =
  /(?<![\w.-])(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|cakeresume\.com|cake\.me|x\.com|twitter\.com|facebook\.com|instagram\.com)\/[^\s)\]>"'`]*[^\s)\]>"'`.,;:!?]/gi;

export type PrivacyConfig = {
  names: readonly string[];
  markers: readonly string[];
};

export function parsePrivacyConfig(
  env: Record<string, string | undefined>,
  fileText?: string,
): PrivacyConfig {
  const list = (value: string | undefined) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  const file = fileText
    ? (JSON.parse(fileText) as { names?: string[]; markers?: string[] })
    : {};
  return {
    names: [...list(env.AI_BENCH_PRIVATE_NAMES), ...(file.names ?? [])],
    markers: [...list(env.AI_BENCH_PRIVATE_MARKERS), ...(file.markers ?? [])],
  };
}

export function assertPrivacyConfig(config: PrivacyConfig): void {
  if (config.names.length === 0) {
    throw new Error(
      'No real-name variants configured: set AI_BENCH_PRIVATE_NAMES or the local markers file.',
    );
  }
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function redactText(text: string, names: readonly string[]): string {
  const byLength = [...names].sort((a, b) => b.length - a.length);
  let out = text.replace(PROFILE_LINK, REDACTED_LINK);
  for (const name of byLength) {
    out = out.replace(new RegExp(escapeRegExp(name), 'gi'), REDACTED_NAME);
  }
  return out;
}

export function findPrivateMarkers(
  text: string,
  extraMarkers: readonly string[] = [],
): string[] {
  const hits = PRIVATE_PATTERNS.filter(({ re }) => re.test(text)).map(
    ({ name }) => name,
  );
  const lower = text.toLowerCase();
  const extra = extraMarkers
    .map((marker) => marker.trim())
    .filter((marker) => marker && lower.includes(marker.toLowerCase()))
    .map(() => 'private marker');
  return [...new Set([...hits, ...extra])];
}

const TEXT_FIELDS = [
  'question',
  'label',
  'model',
  'tools',
  'answer',
  'note',
] as const;

export const WITHHELD_NOTE =
  'Answer withheld: it matched private-data patterns, which suggests it read local context rather than the public web.';

export function guardRecord(
  record: AssistantRecord,
  config: PrivacyConfig,
): AssistantRecord {
  assertPrivacyConfig(config);
  const redacted: AssistantRecord = { ...record };
  for (const field of TEXT_FIELDS) {
    const value = redacted[field];
    if (typeof value === 'string') {
      redacted[field] = redactText(value, config.names);
    }
  }
  const markers = findPrivateMarkers(
    TEXT_FIELDS.map((field) => redacted[field] ?? '').join('\n'),
    [...config.names, ...config.markers],
  );
  if (markers.length === 0) return redacted;
  return {
    ...redacted,
    status: 'withheld',
    answer: '',
    privateMarkers: markers,
    note: WITHHELD_NOTE,
  };
}

export function taipeiDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export type ManualStep = { assistant: string; how: string };

export const MANUAL_ONLY: readonly AssistantId[] = ['gemini-agy-web'];

export const MANUAL_STEPS: readonly ManualStep[] = [
  {
    assistant: 'Gemini via Antigravity CLI (gemini-agy-web)',
    how: 'Opt in with --only gemini-agy-web, then read the redacted answer before committing it.',
  },
  {
    assistant: 'Gemini (gemini.google.com, personal account)',
    how: 'New chat, ask the question, paste the answer.',
  },
  {
    assistant: 'Grok (grok.com)',
    how: 'New chat with web search on, ask the question, paste the answer.',
  },
  {
    assistant: 'Claude.ai with web search',
    how: 'New chat in a project with no instructions or connectors, ask the question.',
  },
  {
    assistant: 'Google Search AI Overview',
    how: 'Search the question signed out; save the overview text if one appears.',
  },
];

export function renderChecklist(date: string): string {
  const rows = MANUAL_STEPS.map(
    ({ assistant, how }) =>
      `- [ ] ${assistant}: ${how} Save as \`answers/manual-<name>.md\`.`,
  );
  return [
    `# Manual runs for ${date}`,
    '',
    `Ask exactly: "${QUESTION}"`,
    '',
    'Use a fresh chat, signed in with no custom instructions, memory or connected sources.',
    'ChatGPT is out of scope for this benchmark.',
    '',
    ...rows,
    '',
  ].join('\n');
}

export function renderAnswerMarkdown(record: AssistantRecord): string {
  const meta = [
    `- Assistant: ${record.label}`,
    `- Model: ${record.model}`,
    `- Tools: ${record.tools}`,
    `- Asked at: ${record.askedAt}`,
    `- Status: ${record.status}`,
    ...(record.note ? [`- Note: ${record.note}`] : []),
  ];
  return [
    `# ${record.label}`,
    '',
    ...meta,
    '',
    `## Question`,
    '',
    record.question,
    '',
    `## Answer`,
    '',
    record.answer || '_(none)_',
    '',
  ].join('\n');
}

export type SiteSnapshot = {
  fetchedAt: string;
  llmsTxt: string;
  toolsList: JsonRpcResponse;
  calls: Record<string, JsonRpcResponse>;
};

export function saveRun(
  dir: string,
  site: SiteSnapshot | undefined,
  records: readonly AssistantRecord[],
): string[] {
  const written: string[] = [];
  const write = (relative: string, text: string) => {
    const path = join(dir, relative);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
    written.push(relative);
  };
  if (site) {
    write('site/llms.txt', site.llmsTxt);
    write('site/mcp-tools-list.json', JSON.stringify(site.toolsList, null, 2));
    for (const [tool, response] of Object.entries(site.calls)) {
      write(`site/mcp-${tool}.json`, JSON.stringify(response, null, 2));
    }
  }
  for (const record of records) {
    write(`answers/${record.id}.json`, JSON.stringify(record, null, 2));
    write(`answers/${record.id}.md`, renderAnswerMarkdown(record));
  }
  return written;
}
