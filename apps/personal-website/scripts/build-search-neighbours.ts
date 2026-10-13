import { readFileSync, writeFileSync } from 'node:fs';

import { type IndexHeader, planReuse } from '@rainforest-dev/search';
import {
  assertModel,
  DEFAULT_EMBED_MODEL,
  type IndexFileNames,
  ollamaEmbedder,
  OllamaSetupError,
  readIndexFiles,
  writeIndexFiles,
} from '@rainforest-dev/search/node';

import type { ExpansionFile } from '../src/utils/search-expansions.ts';
import { EXPANSIONS_PATH, loadPaletteRecords } from './palette-sources.ts';
import {
  buildVocabulary,
  documentText,
  hashText,
  hashVocabulary,
  NEIGHBOUR_FLOOR,
  NEIGHBOURS_PATH,
  recordHashes,
  selectNeighbours,
  serializeNeighbours,
  VECTOR_CACHE_DIR,
} from './search-neighbours-build.ts';

const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(
  /\/$/,
  '',
);
const MODEL = process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_EMBED_MODEL;
const DIMS = 768;
const BATCH = 32;

const fail = (message: string): never => {
  console.error(`build-search-neighbours: ${message}`);
  process.exit(1);
};

try {
  await assertModel(OLLAMA_URL, MODEL);
} catch (error) {
  if (!(error instanceof OllamaSetupError)) throw error;
  if (error.reason === 'unreachable')
    fail(
      `cannot reach Ollama at ${OLLAMA_URL} (${error.message}). Set OLLAMA_URL.`,
    );
  fail(
    `${error.message} Model ${MODEL}, available at ${OLLAMA_URL}: ${error.models.join(', ') || '(none)'}. Set OLLAMA_EMBED_MODEL or pull the model.`,
  );
}

const embedder = ollamaEmbedder({ url: OLLAMA_URL, model: MODEL, dims: DIMS });

async function embedCached(
  names: IndexFileNames,
  items: { id: string; text: string }[],
  kind: 'query' | 'document',
): Promise<Float32Array> {
  const docs = items.map(({ id, text }) => ({
    id,
    contentHash: hashText(text),
  }));
  const previous = await readIndexFiles(VECTOR_CACHE_DIR, names);
  const compatible =
    previous?.header.model === MODEL && previous.header.dims === DIMS;
  const { reuse, missing } = planReuse(
    compatible
      ? previous.header.docs.map((d) => ({ id: d.id, hash: d.contentHash }))
      : [],
    docs.map((d) => ({ id: d.id, hash: d.contentHash })),
  );
  const vectors = new Float32Array(items.length * DIMS);
  for (const [current, row] of reuse)
    vectors.set(
      previous!.vectors.subarray(row * DIMS, (row + 1) * DIMS),
      current * DIMS,
    );
  for (let start = 0; start < missing.length; start += BATCH) {
    const batch = missing.slice(start, start + BATCH);
    const rows = await embedder.embed(
      batch.map((i) => items[i].text),
      kind,
    );
    rows.forEach((row, j) => vectors.set(row, batch[j] * DIMS));
  }
  const header: IndexHeader = { model: MODEL, dims: DIMS, docs };
  await writeIndexFiles(VECTOR_CACHE_DIR, header, vectors, names);
  console.log(
    `${names.header}: ${items.length} rows, ${missing.length} embedded`,
  );
  return vectors;
}

const records = await loadPaletteRecords();
const expansions = (
  JSON.parse(readFileSync(EXPANSIONS_PATH, 'utf8')) as ExpansionFile
).records;
const vocabulary = buildVocabulary(records, expansions);

const recordVectors = await embedCached(
  { header: 'records.json', vectors: 'records.bin' },
  records.map((r) => ({ id: r.id, text: documentText(r, expansions, r.id) })),
  'document',
);
const termVectors = await embedCached(
  { header: 'terms.json', vectors: 'terms.bin' },
  vocabulary.map((term) => ({ id: term, text: term })),
  'query',
);

const terms = selectNeighbours({
  recordIds: records.map((r) => r.id),
  recordVectors,
  vocabulary,
  termVectors,
  dims: DIMS,
  floor: NEIGHBOUR_FLOOR,
});

writeFileSync(
  NEIGHBOURS_PATH,
  serializeNeighbours({
    model: MODEL,
    floor: NEIGHBOUR_FLOOR,
    records: recordHashes(records, expansions),
    vocabularyHash: hashVocabulary(vocabulary),
    terms,
  }),
);
console.log(
  `${Object.keys(terms).length}/${vocabulary.length} terms have neighbours`,
);
