import { dirname, join } from 'node:path';

import type { Embedder } from '@rainforest-dev/search';
import { conceptEmbedder, ollamaEmbedder } from '@rainforest-dev/search/node';

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
  if (env['CALIBRE_EMBED'] === 'fake') return conceptEmbedder(FAKE_CONCEPTS);
  const url = env['CALIBRE_OLLAMA_URL'];
  if (!url) return undefined;
  const model = env['CALIBRE_EMBED_MODEL'];
  return ollamaEmbedder({ url, ...(model ? { model } : {}) });
}

export function searchDirFromEnv(env: Env = process.env): string | undefined {
  const appDb =
    env['CALIBRE_APP_DB_PATH'] ??
    (env['CALIBRE_LIBRARY_PATH']
      ? join(env['CALIBRE_LIBRARY_PATH'], 'personal-calibre-app.db')
      : undefined);
  return appDb ? join(dirname(appDb), 'search') : undefined;
}
