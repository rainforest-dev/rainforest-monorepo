import type { Embedder } from '@rainforest-dev/search';
import { conceptEmbedder, ollamaEmbedder } from '@rainforest-dev/search/node';

import { searchDir } from '@/db';

type Env = Record<string, string | undefined>;

export const FAKE_CONCEPTS = [
  ['harbour', 'harbor', 'port', '港'],
  ['sea', 'ocean', 'tide', 'brine', 'water', '海'],
  ['book', 'archive', 'library', 'ledger', 'letters', '書'],
  ['wind', 'weather', 'storm', '風'],
  ['lamp', 'lantern', 'light', '燈'],
  ['fog', 'mist', '霧'],
  ['clock', 'year', 'hours', 'time', '時'],
];

export function embedderFromEnv(env: Env = process.env): Embedder | undefined {
  if (env['NOTEBOOK_EMBED'] === 'fake') return conceptEmbedder(FAKE_CONCEPTS);
  const url = env['NOTEBOOK_OLLAMA_URL'];
  if (!url) return undefined;
  const model = env['NOTEBOOK_EMBED_MODEL'];
  return ollamaEmbedder({ url, ...(model ? { model } : {}) });
}

export function searchDirFromEnv(env: Env = process.env): string | undefined {
  const dir = env['NOTEBOOK_DATA_DIR'];
  return dir ? searchDir(dir) : undefined;
}
