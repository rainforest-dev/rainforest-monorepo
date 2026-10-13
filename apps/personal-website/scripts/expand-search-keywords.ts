import { readFileSync, writeFileSync } from 'node:fs';

import {
  assertModel,
  ollamaChat,
  OllamaHttpError,
  OllamaSetupError,
} from '@rainforest-dev/search/node';

import type { Searchable } from '../src/utils/search.ts';
import {
  type ExpansionFile,
  hashRecord,
  MAX_TERM_LENGTH,
  MAX_TERMS,
  normalizeTerms,
  planExpansion,
  serializeExpansions,
} from '../src/utils/search-expansions.ts';
import { EXPANSIONS_PATH, loadPaletteRecords } from './palette-sources.ts';

const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(
  /\/$/,
  '',
);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;

const fail = (message: string): never => {
  console.error(`expand-search-keywords: ${message}`);
  process.exit(1);
};

async function assertReachable(): Promise<void> {
  try {
    await assertModel(OLLAMA_URL, OLLAMA_MODEL);
  } catch (error) {
    if (!(error instanceof OllamaSetupError)) throw error;
    const available = error.models.join(', ');
    if (error.reason === 'unreachable')
      fail(
        `cannot reach Ollama at ${OLLAMA_URL} (${error.message}). Set OLLAMA_URL.`,
      );
    if (error.reason === 'no-model')
      fail(`set OLLAMA_MODEL. Available at ${OLLAMA_URL}: ${available}`);
    fail(`model ${OLLAMA_MODEL} is not on ${OLLAMA_URL}: ${available}`);
  }
}

async function askForTerms(record: Searchable): Promise<string[]> {
  let content: string;
  try {
    content = await ollamaChat({
      url: OLLAMA_URL,
      model: OLLAMA_MODEL as string,
      format: {
        type: 'object',
        properties: {
          terms: { type: 'array', items: { type: 'string' } },
        },
        required: ['terms'],
      },
      messages: [
        {
          role: 'user',
          content: [
            `A visitor is searching a software engineer's portfolio website and types a word that the record below does not literally contain. List up to ${MAX_TERMS} such words.`,
            'Rules:',
            `- About half English, half 繁體中文. Each term is one word or a short phrase, at most ${MAX_TERM_LENGTH} characters.`,
            '- Use broader categories, synonyms and the visitor vocabulary for the field (for a PostgreSQL record: database, 資料庫, relational, SQL).',
            `- Stay specific to this record's own technologies and topic. Never repeat the title or keywords, and never add generic filler such as "software engineer", "專案" or "開發".`,
            `Kind: ${record.kind}`,
            `Title: ${record.title}`,
            `Keywords: ${record.keywords.join(', ') || '(none)'}`,
            'Reply as JSON: {"terms": [...]}',
          ].join('\n'),
        },
      ],
    });
  } catch (error) {
    if (!(error instanceof OllamaHttpError)) throw error;
    return fail(`Ollama returned HTTP ${error.status} for ${record.id}`);
  }
  const parsed = JSON.parse(content) as { terms?: unknown };
  return Array.isArray(parsed.terms) ? parsed.terms.map(String) : [];
}

function readExisting(): ExpansionFile['records'] {
  try {
    return (JSON.parse(readFileSync(EXPANSIONS_PATH, 'utf8')) as ExpansionFile)
      .records;
  } catch {
    return {};
  }
}

await assertReachable();
const records = await loadPaletteRecords();
const { keep, pending } = planExpansion(records, readExisting());
console.log(
  `${records.length} records, ${pending.length} to expand, ${records.length - pending.length} unchanged`,
);

const next = { ...keep };
for (const record of pending) {
  const terms = normalizeTerms(await askForTerms(record), record);
  next[record.id] = { hash: hashRecord(record), terms };
  console.log(`${record.id}: ${terms.join(' | ')}`);
}

writeFileSync(
  EXPANSIONS_PATH,
  serializeExpansions({ model: OLLAMA_MODEL as string, records: next }),
);
