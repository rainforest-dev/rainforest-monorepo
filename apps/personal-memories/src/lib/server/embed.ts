import { readFile } from 'node:fs/promises';

export type EmbedKind = 'query' | 'document';

export type EmbedInput = string | { text: string; image: string };

export const DEFAULT_EMBED_MODEL = 'embeddinggemma-2:440m-bf16-text-vision';

const MODELS: Record<string, { minScore: number; images: boolean }> = {
  [DEFAULT_EMBED_MODEL]: { minScore: 0.705, images: true },
  embeddinggemma: { minScore: 0.25, images: false },
};

export type Embedder = {
  model: string;
  dims: number;
  minScore: number;
  images: boolean;
  embed(
    texts: readonly EmbedInput[],
    kind: EmbedKind,
    signal?: AbortSignal,
  ): Promise<Float32Array[]>;
};

export type EmbedFailure =
  'ollama-unreachable' | 'timeout' | 'model-mismatch' | 'image-unreadable';

export class EmbedError extends Error {
  readonly reason: EmbedFailure;

  constructor(reason: EmbedFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

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
  url = process.env['MEMORIES_OLLAMA_URL'] ?? 'http://localhost:11434',
  model = DEFAULT_EMBED_MODEL,
  dims = 768,
  minScore = MODELS[model]?.minScore ?? 0.25,
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
    images: MODELS[model]?.images ?? false,
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

export function fakeEmbedder(): Embedder {
  return {
    model: 'fake',
    dims: CONCEPTS.length,
    minScore: 0.01,
    images: true,
    async embed(texts) {
      return texts.map((item) => {
        const text = typeof item === 'string' ? item : item.text;
        const folded = text.normalize('NFKC').toLowerCase();
        return Float32Array.from(
          CONCEPTS.map((words) =>
            words.some((w) => folded.includes(w)) ? 1 : 0,
          ),
        );
      });
    },
  };
}

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

export function withQueryPriority(embedder: Embedder): {
  foreground: Embedder;
  background: Embedder;
} {
  let queries = 0;
  let waiters: (() => void)[] = [];
  const idle = () => new Promise<void>((resolve) => waiters.push(resolve));
  return {
    foreground: {
      ...embedder,
      async embed(texts, kind, signal) {
        queries += 1;
        try {
          return await embedder.embed(texts, kind, signal);
        } finally {
          queries -= 1;
          if (queries === 0) {
            const ready = waiters;
            waiters = [];
            ready.forEach((resolve) => resolve());
          }
        }
      },
    },
    background: {
      ...embedder,
      async embed(texts, kind, signal) {
        while (queries > 0) await idle();
        return embedder.embed(texts, kind, signal);
      },
    },
  };
}

let shared: ReturnType<typeof withQueryPriority> | undefined;

export const sharedEmbedders = () =>
  (shared ??= withQueryPriority(embedderFromEnv()));
