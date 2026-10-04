import { describe, expect, it, vi } from 'vitest';

import {
  embedderFromEnv,
  EmbedError,
  fakeEmbedder,
  ollamaEmbedder,
} from './embed.ts';

const vec = (n: number, v = 0.5) => Array.from({ length: n }, () => v);

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi.fn(async () =>
    typeof body === 'string'
      ? new Response(body, init)
      : Response.json(body, init),
  ) as unknown as typeof fetch;

const reason = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'resolved';
  } catch (error) {
    return error instanceof EmbedError ? error.reason : String(error);
  }
};

describe('ollamaEmbedder', () => {
  it('sends the model and prefixed input, and returns vectors', async () => {
    const fetch = respond({ embeddings: [vec(4), vec(4, 1)] });
    const embedder = ollamaEmbedder({ url: 'http://o:1', dims: 4, fetch });
    const out = await embedder.embed(['拉麵', '湯'], 'document');
    expect(out.map((v) => Array.from(v))).toEqual([vec(4), vec(4, 1)]);
    expect(fetch).toHaveBeenCalledWith(
      'http://o:1/api/embed',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'embeddinggemma',
          input: ['title: none | text: 拉麵', 'title: none | text: 湯'],
        }),
      }),
    );
    await ollamaEmbedder({
      url: 'http://o:1',
      dims: 4,
      fetch: respond({ embeddings: [vec(4)] }),
    }).embed(['麵'], 'query');
  });

  it('prefixes queries for search', async () => {
    const fetch = respond({ embeddings: [vec(4)] });
    await ollamaEmbedder({ url: 'http://o:1', dims: 4, fetch }).embed(
      ['麵'],
      'query',
    );
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).input).toEqual([
      'task: search result | query: 麵',
    ]);
  });

  it('reports an unreachable service for network errors, bad statuses and non-JSON bodies', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    for (const fetch of [
      down,
      respond({ error: 'x' }, { status: 502 }),
      respond('<html>Bad Gateway</html>'),
      respond('null'),
    ])
      expect(
        await reason(
          ollamaEmbedder({ url: 'http://o:1', dims: 4, fetch }).embed(
            ['a'],
            'query',
          ),
        ),
      ).toBe('ollama-unreachable');
  });

  it('reports a model mismatch for the wrong length or a non-finite number', async () => {
    for (const body of [
      { embeddings: [vec(3)] },
      { embeddings: [[0.1, null, 0.2, 0.3]] },
      { embeddings: [] },
    ])
      expect(
        await reason(
          ollamaEmbedder({
            url: 'http://o:1',
            dims: 4,
            fetch: respond(body),
          }).embed(['a'], 'query'),
        ),
      ).toBe('model-mismatch');
  });

  it('reports a timeout when the signal aborts', async () => {
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('timed out', 'TimeoutError')),
          ),
        ),
    ) as unknown as typeof fetch;
    const embedder = ollamaEmbedder({
      url: 'http://o:1',
      dims: 4,
      fetch: hang,
    });
    expect(
      await reason(embedder.embed(['a'], 'query', AbortSignal.timeout(10))),
    ).toBe('timeout');
  });
});

describe('error messages', () => {
  it('says what Ollama answered, so a missing model is not mistaken for a network failure', async () => {
    const fetch = respond(
      { error: 'model "embeddinggemma" not found' },
      { status: 404 },
    );
    const error = await ollamaEmbedder({ url: 'http://o:1', dims: 4, fetch })
      .embed(['a'], 'query')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmbedError);
    expect((error as EmbedError).message).toContain('404');
    expect((error as EmbedError).message).toContain('not found');
  });
});

describe('fakeEmbedder', () => {
  it('puts 吃麵 and a Ramen label on the same concept', async () => {
    const [a, b, c] = await fakeEmbedder().embed(
      ['吃麵', 'labels: Ramen', '下雨天'],
      'query',
    );
    const shared = Array.from(a ?? []).findIndex(
      (v, i) => v > 0 && (b?.[i] ?? 0) > 0,
    );
    expect(shared).toBeGreaterThanOrEqual(0);
    expect(c?.[shared]).toBe(0);
  });
});

describe('embedderFromEnv', () => {
  it('uses the fake embedder when asked, and Ollama otherwise', () => {
    expect(embedderFromEnv({ MEMORIES_EMBED: 'fake' }).model).toBe('fake');
    const real = embedderFromEnv({});
    expect(real).toMatchObject({ model: 'embeddinggemma', dims: 768 });
  });
});
