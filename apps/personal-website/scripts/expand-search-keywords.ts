import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getProjects,
  getSkills,
  getWorkExperience,
} from '@rainforest-dev/personal-data';
import fg from 'fast-glob';
import matter from 'gray-matter';

import { buildPaletteRecords } from '../src/utils/palette-records.ts';
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

const OLLAMA_URL = (
  process.env.OLLAMA_URL ?? 'http://rainforest-mini.local:11434'
).replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
const OUTPUT = resolve(
  import.meta.dirname,
  '../src/data/search-expansions.json',
);
const BLOG_DIR = resolve(import.meta.dirname, '../src/data/blog');

const fail = (message: string): never => {
  console.error(`expand-search-keywords: ${message}`);
  process.exit(1);
};

async function assertReachable(): Promise<void> {
  let models: string[];
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    models = ((await res.json()) as { models: { name: string }[] }).models.map(
      (m) => m.name,
    );
  } catch (error) {
    return fail(
      `cannot reach Ollama at ${OLLAMA_URL} (${error instanceof Error ? error.message : error}). Set OLLAMA_URL.`,
    );
  }
  if (!OLLAMA_MODEL)
    fail(`set OLLAMA_MODEL. Available at ${OLLAMA_URL}: ${models.join(', ')}`);
  else if (!models.includes(OLLAMA_MODEL))
    fail(`model ${OLLAMA_MODEL} is not on ${OLLAMA_URL}: ${models.join(', ')}`);
}

const LANGS = ['en', 'zh'] as const;

async function loadRecords(): Promise<Searchable[]> {
  const posts = fg
    .sync('**/*.{md,mdx}', { cwd: BLOG_DIR })
    .sort()
    .map((file) => {
      const { data } = matter(readFileSync(resolve(BLOG_DIR, file), 'utf8'));
      return {
        id: file.replace(/\.mdx?$/, ''),
        data: {
          title: String(data.title),
          tags: (data.tags ?? []) as string[],
        },
      };
    });
  const byId = new Map<string, Searchable>();
  for (const lang of LANGS) {
    const [experiences, projects, skills] = await Promise.all([
      getWorkExperience({ lang }),
      getProjects({ lang }),
      getSkills({ lang }),
    ]);
    for (const record of buildPaletteRecords({
      experiences,
      projects,
      skills,
      posts,
    }))
      byId.set(record.id, record);
  }
  return [...byId.values()];
}

async function askForTerms(record: Searchable): Promise<string[]> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      options: { temperature: 0 },
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
    }),
  });
  if (!res.ok)
    return fail(`Ollama returned HTTP ${res.status} for ${record.id}`);
  const { message } = (await res.json()) as { message: { content: string } };
  const parsed = JSON.parse(message.content) as { terms?: unknown };
  return Array.isArray(parsed.terms) ? parsed.terms.map(String) : [];
}

function readExisting(): ExpansionFile['records'] {
  try {
    return (JSON.parse(readFileSync(OUTPUT, 'utf8')) as ExpansionFile).records;
  } catch {
    return {};
  }
}

await assertReachable();
const records = await loadRecords();
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
  OUTPUT,
  serializeExpansions({ model: OLLAMA_MODEL as string, records: next }),
);
