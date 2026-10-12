import { type Embedder, withQueryPriority } from '@rainforest-dev/search';
import {
  conceptEmbedder,
  ollamaEmbedder as sharedOllamaEmbedder,
} from '@rainforest-dev/search/node';

export {
  type Embedder,
  EmbedError,
  type EmbedFailure,
  type EmbedInput,
  type EmbedKind,
  withQueryPriority,
} from '@rainforest-dev/search';
export { DEFAULT_EMBED_MODEL } from '@rainforest-dev/search/node';

const DEFAULT_URL = 'http://localhost:11434';

export const ollamaEmbedder = (
  options: Parameters<typeof sharedOllamaEmbedder>[0] = {},
): Embedder =>
  sharedOllamaEmbedder({
    ...options,
    url: options.url ?? process.env['MEMORIES_OLLAMA_URL'] ?? DEFAULT_URL,
  });

const CONCEPTS = [
  ['麵', 'ramen', 'noodle'],
  ['海', 'beach', 'sea'],
  ['貓', 'cat'],
  ['咖啡', 'coffee'],
  ['生日', 'birthday', 'cake'],
  ['雨', 'rain'],
  ['車', 'car', 'train'],
  ['書', 'book'],
];

export const fakeEmbedder = (): Embedder => conceptEmbedder(CONCEPTS);

export const embedderFromEnv = (
  env: Record<string, string | undefined> = process.env,
): Embedder =>
  env['MEMORIES_EMBED'] === 'fake'
    ? fakeEmbedder()
    : ollamaEmbedder({
        ...(env['MEMORIES_OLLAMA_URL']
          ? { url: env['MEMORIES_OLLAMA_URL'] }
          : {}),
        ...(env['MEMORIES_EMBED_MODEL']
          ? { model: env['MEMORIES_EMBED_MODEL'] }
          : {}),
      });

let shared: ReturnType<typeof withQueryPriority> | undefined;

export const sharedEmbedders = () =>
  (shared ??= withQueryPriority(embedderFromEnv()));
