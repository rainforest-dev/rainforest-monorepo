import {
  createQueryParser,
  optInSwitch,
  type ParserSchema,
  type ParseStatus,
} from '@rainforest-dev/web-ai';

import type { Person } from '@/lib/people.ts';
import { localParser, type SearchQuery } from '@/lib/search';
import type { TimelineSource } from '@/lib/server';

export {
  languagesFor,
  type ParseStatus,
  PROMPT_TIMEOUT_MS,
  type QueryLanguage,
  queryLanguage,
  statusFor,
} from '@rainforest-dev/web-ai';

export const PROMPT_PARSE_KEY = 'memories:prompt-parse';
const MAX_TEXT = 200;
const SOURCES = ['line', 'slack', 'photo'] as const;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function statusText(status: ParseStatus): string {
  switch (status.kind) {
    case 'unsupported-browser':
      return '這個瀏覽器沒有內建 AI 模型，使用內建解析';
    case 'unavailable':
      return '這台裝置無法使用 AI 模型，使用內建解析';
    case 'unsupported-language':
      return status.lang === 'zh'
        ? 'AI 模型還不支援中文，這次用內建解析'
        : 'AI 模型不支援這個語言，這次用內建解析';
    case 'needs-download':
      return '需要先下載 AI 模型，重新開啟開關即可下載';
    case 'downloading':
      return `下載 AI 模型 ${Math.round(status.progress * 100)}%`;
    case 'ai':
      return 'AI 解析';
    case 'ai-timeout':
      return 'AI 解析逾時，改用內建解析';
    case 'local':
      return 'AI 解析失敗，改用內建解析';
    case 'off':
      return '';
  }
}

const PROMPT_SWITCH = optInSwitch(PROMPT_PARSE_KEY);
export const readSwitch = PROMPT_SWITCH.read;
export const writeSwitch = PROMPT_SWITCH.write;

export function promptSchema(
  people: readonly Person[],
): Record<string, unknown> {
  const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
  return {
    type: 'object',
    properties: {
      text: { type: 'string' },
      range: {
        type: 'object',
        properties: { start: date, end: date },
        required: ['start', 'end'],
      },
      ...(people.length
        ? {
            people: {
              type: 'array',
              items: { type: 'string', enum: people.map((p) => p.id) },
            },
          }
        : {}),
      sources: { type: 'array', items: { type: 'string', enum: SOURCES } },
    },
    required: ['text'],
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function toSearchQuery(
  output: unknown,
  people: readonly Person[],
): SearchQuery | undefined {
  if (!isRecord(output) || typeof output['text'] !== 'string') return undefined;
  const query: SearchQuery = {
    text: Array.from(output['text'].trim()).slice(0, MAX_TEXT).join(''),
  };
  const range = output['range'];
  if (range !== undefined) {
    if (
      !isRecord(range) ||
      typeof range['start'] !== 'string' ||
      typeof range['end'] !== 'string' ||
      !DATE.test(range['start']) ||
      !DATE.test(range['end']) ||
      range['start'] > range['end']
    )
      return undefined;
    query.range = { start: range['start'], end: range['end'] };
  }
  const ids = new Set(people.map((p) => p.id));
  const picked = Array.isArray(output['people'])
    ? output['people'].filter(
        (id): id is string => typeof id === 'string' && ids.has(id),
      )
    : [];
  if (picked.length) query.people = picked;
  const sources = Array.isArray(output['sources'])
    ? output['sources'].filter((s): s is TimelineSource =>
        (SOURCES as readonly unknown[]).includes(s),
      )
    : [];
  if (sources.length) query.sources = sources;
  return query;
}

export function buildPrompt(
  raw: string,
  today: string,
  people: readonly Person[],
): string {
  const roster = people
    .map((p) => {
      const aliases = Object.values(p.aliases).flat().filter(Boolean);
      return `- ${p.id}: ${[p.name, ...aliases].join(', ')}`;
    })
    .join('\n');
  return [
    `Today is ${today}. Turn the search below into JSON.`,
    'range: the dates it refers to, as YYYY-MM-DD start and end; leave it out if it names no date.',
    'people: ids of the people it names, from this list only:',
    roster || '- (none)',
    'sources: line, slack or photo, only if it names one.',
    'text: the words that are left once the dates and people are taken out.',
    `Search: ${raw}`,
  ].join('\n');
}

export type ParseResult = {
  query: SearchQuery;
  status: 'ai' | 'ai-timeout' | 'local';
};

export const aiParseKey = (
  text: string,
  today: string,
  people: readonly Person[],
) => ['ai-parse', text, today, people.map((p) => p.id).join(',')] as const;

export const parseStaleTime = (
  data: Pick<ParseResult, 'status'> | undefined,
) => (data?.status === 'ai' ? Infinity : 0);

export type AiParse = (raw: string, signal: AbortSignal) => Promise<unknown>;

const handWritten = (people: readonly Person[]): ParserSchema<SearchQuery> => ({
  '~standard': {
    validate: (value) => {
      const query = toSearchQuery(value, people);
      return query ? { value: query } : { issues: [{ message: 'invalid' }] };
    },
    jsonSchema: { input: () => promptSchema(people) },
  },
});

const parser = createQueryParser<
  SearchQuery,
  { today: string; people: readonly Person[] }
>({
  schema: ({ people }) => handWritten(people),
  local: (raw, { today, people }) => localParser(raw, today, people),
});

export async function parseWithFallback(
  raw: string,
  today: string,
  people: readonly Person[],
  ai: AiParse | undefined,
  signal?: AbortSignal,
): Promise<ParseResult> {
  const { value, status } = await parser.parse(
    raw,
    { today, people },
    ai ? (_schema, inner) => ai(raw, inner) : undefined,
    signal,
  );
  return { query: value, status };
}
