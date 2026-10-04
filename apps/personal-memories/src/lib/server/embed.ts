export type EmbedKind = 'query' | 'document';

export type Embedder = {
  model: string;
  dims: number;
  embed(
    texts: string[],
    kind: EmbedKind,
    signal?: AbortSignal,
  ): Promise<Float32Array[]>;
};

export type EmbedFailure = 'ollama-unreachable' | 'timeout' | 'model-mismatch';

export class EmbedError extends Error {
  constructor(
    readonly reason: EmbedFailure,
    message: string,
  ) {
    super(message);
  }
}

const PREFIX: Record<EmbedKind, string> = {
  query: 'task: search result | query: ',
  document: 'title: none | text: ',
};

const isAbort = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === 'AbortError' || error.name === 'TimeoutError');

export function ollamaEmbedder({
  url = process.env['MEMORIES_OLLAMA_URL'] ?? 'http://localhost:11434',
  model = 'embeddinggemma',
  dims = 768,
  fetch: fetchImpl = fetch,
}: {
  url?: string;
  model?: string;
  dims?: number;
  fetch?: typeof fetch;
} = {}): Embedder {
  return {
    model,
    dims,
    async embed(texts, kind, signal) {
      let response: Response;
      try {
        response = await fetchImpl(`${url}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            input: texts.map((t) => PREFIX[kind] + t),
          }),
          ...(signal ? { signal } : {}),
        });
      } catch (error) {
        if (isAbort(error) || signal?.aborted)
          throw new EmbedError('timeout', 'embedding timed out');
        throw new EmbedError('ollama-unreachable', String(error));
      }
      if (!response.ok)
        throw new EmbedError(
          'ollama-unreachable',
          `Ollama answered ${response.status}`,
        );
      let body: { embeddings?: unknown };
      try {
        body = (await response.json()) as { embeddings?: unknown };
      } catch {
        throw new EmbedError('ollama-unreachable', 'Ollama sent no JSON');
      }
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
    async embed(texts) {
      return texts.map((text) => {
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
    : ollamaEmbedder(
        env['MEMORIES_OLLAMA_URL'] ? { url: env['MEMORIES_OLLAMA_URL'] } : {},
      );
