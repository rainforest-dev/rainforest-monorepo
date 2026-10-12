export type EmbedKind = 'query' | 'document';

export type EmbedInput = string | { text: string; image: string };

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

export const QUERY_EMBED_TIMEOUT_MS = 800;
export const BREAKER_MS = 30_000;

export type Breaker = {
  open(now: number): boolean;
  trip(now: number): void;
};

export function breaker(ms = BREAKER_MS): Breaker {
  let until = 0;
  return {
    open: (now) => now < until,
    trip: (now) => {
      until = now + ms;
    },
  };
}

export async function embedQuery(
  embedder: Embedder,
  text: string,
  timeoutMs = QUERY_EMBED_TIMEOUT_MS,
): Promise<Float32Array> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new EmbedError('timeout', 'query embedding timed out'));
    }, timeoutMs);
  });
  try {
    const [vector] = await Promise.race([
      embedder.embed([text], 'query', controller.signal),
      timeout,
    ]);
    if (
      !vector ||
      vector.length !== embedder.dims ||
      !vector.every((v) => Number.isFinite(v))
    )
      throw new EmbedError('model-mismatch', 'bad query vector');
    return vector;
  } finally {
    clearTimeout(timer);
  }
}

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
