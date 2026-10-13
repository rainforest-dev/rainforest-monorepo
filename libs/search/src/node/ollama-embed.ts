import { readFile } from 'node:fs/promises';

import {
  type Embedder,
  EmbedError,
  type EmbedInput,
  type EmbedKind,
} from '../embed';

export const DEFAULT_EMBED_MODEL = 'embeddinggemma-2:440m-bf16-text-vision';

export const EMBED_MODELS: Record<
  string,
  { minScore: number; images: boolean }
> = {
  [DEFAULT_EMBED_MODEL]: { minScore: 0.705, images: true },
  embeddinggemma: { minScore: 0.25, images: false },
};

const PREFIX: Record<EmbedKind, string> = {
  query: 'task: search result | query: ',
  document: 'title: none | text: ',
};

async function ollamaInput(item: EmbedInput, prefix: string) {
  if (typeof item === 'string') return prefix + item;
  let image: string;
  try {
    image = (await readFile(item.image)).toString('base64');
  } catch (error) {
    throw new EmbedError('image-unreadable', String(error));
  }
  return { text: prefix + item.text, image };
}

const isAbort = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === 'AbortError' || error.name === 'TimeoutError');

export function ollamaEmbedder({
  url = 'http://localhost:11434',
  model = DEFAULT_EMBED_MODEL,
  dims = 768,
  minScore = EMBED_MODELS[model]?.minScore ?? 0.25,
  fetch: fetchImpl = fetch,
}: {
  url?: string;
  model?: string;
  dims?: number;
  minScore?: number;
  fetch?: typeof fetch;
} = {}): Embedder {
  return {
    model,
    dims,
    minScore,
    images: EMBED_MODELS[model]?.images ?? false,
    async embed(texts, kind, signal) {
      const input = await Promise.all(
        texts.map((item) => ollamaInput(item, PREFIX[kind])),
      );
      let response: Response;
      try {
        response = await fetchImpl(`${url}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            input,
            keep_alive: '24h',
          }),
          ...(signal ? { signal } : {}),
        });
      } catch (error) {
        if (isAbort(error) || signal?.aborted)
          throw new EmbedError('timeout', 'embedding timed out');
        throw new EmbedError('ollama-unreachable', String(error));
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new EmbedError(
          'ollama-unreachable',
          `Ollama answered ${response.status}: ${detail.slice(0, 200)}`,
        );
      }
      let body: { embeddings?: unknown } | null;
      try {
        body = (await response.json()) as { embeddings?: unknown } | null;
      } catch {
        throw new EmbedError('ollama-unreachable', 'Ollama sent no JSON');
      }
      if (typeof body !== 'object' || body === null)
        throw new EmbedError(
          'ollama-unreachable',
          'Ollama sent no JSON object',
        );
      const rows = Array.isArray(body.embeddings) ? body.embeddings : [];
      if (rows.length !== texts.length)
        throw new EmbedError(
          'model-mismatch',
          `expected ${texts.length} embeddings, got ${rows.length}`,
        );
      return rows.map((row) => {
        if (
          !Array.isArray(row) ||
          row.length !== dims ||
          !row.every((v) => typeof v === 'number' && Number.isFinite(v))
        )
          throw new EmbedError(
            'model-mismatch',
            `expected ${dims} finite numbers per embedding`,
          );
        return Float32Array.from(row as number[]);
      });
    },
  };
}
