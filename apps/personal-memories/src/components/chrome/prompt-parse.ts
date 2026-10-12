import {
  createQueryParser,
  jsonSchemaOf,
  optInSwitch,
  type ParseStatus,
} from '@rainforest-dev/web-ai';

import type { Person } from '@/lib/people.ts';
import { localParser, type SearchQuery } from '@/lib/search';

import { promptQuerySchema, sanitizeAnswer, toQuery } from './prompt-schema.ts';

export {
  languagesFor,
  type ParseStatus,
  PROMPT_TIMEOUT_MS,
  type QueryLanguage,
  queryLanguage,
  statusFor,
} from '@rainforest-dev/web-ai';

export const PROMPT_PARSE_KEY = 'memories:prompt-parse';

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

export const promptSchema = (
  people: readonly Person[],
): Record<string, unknown> => jsonSchemaOf(promptQuerySchema(people));

export const toSearchQuery = toQuery;

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

const parser = createQueryParser<
  SearchQuery,
  { today: string; people: readonly Person[] }
>({
  schema: ({ people }) => promptQuerySchema(people),
  sanitize: (out, { people }) => sanitizeAnswer(out, people),
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
