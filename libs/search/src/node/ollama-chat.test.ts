import { describe, expect, it, vi } from 'vitest';

import {
  assertModel,
  ollamaChat,
  OllamaHttpError,
  OllamaSetupError,
} from './ollama-chat';

const URL = 'http://ollama.test';
const tags = (names: string[]) =>
  vi.fn(async () =>
    Response.json({ models: names.map((name) => ({ name })) }),
  ) as unknown as typeof fetch;

describe('assertModel', () => {
  it('passes when the model is listed', async () => {
    await expect(
      assertModel(URL, 'qwen3:8b', tags(['qwen3:8b'])),
    ).resolves.toBeUndefined();
  });

  it('names what is available when the model is missing or not given', async () => {
    await expect(assertModel(URL, 'x', tags(['a', 'b']))).rejects.toMatchObject(
      { reason: 'missing-model', models: ['a', 'b'] },
    );
    await expect(
      assertModel(URL, undefined, tags(['a'])),
    ).rejects.toMatchObject({ reason: 'no-model', models: ['a'] });
  });

  it('reports an unreachable server', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(assertModel(URL, 'x', down)).rejects.toBeInstanceOf(
      OllamaSetupError,
    );
    await expect(assertModel(URL, 'x', down)).rejects.toMatchObject({
      reason: 'unreachable',
    });
  });
});

describe('ollamaChat', () => {
  it('sends a non-streaming request and returns the message content', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ message: { content: '{"terms":[]}' } }),
    ) as unknown as typeof globalThis.fetch;
    const format = { type: 'object' };
    const out = await ollamaChat({
      url: URL,
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      format,
      fetch,
    });
    expect(out).toBe('{"terms":[]}');
    const [target, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(target).toBe(`${URL}/api/chat`);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      model: 'm',
      stream: false,
      think: false,
      options: { temperature: 0 },
      format,
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('throws the HTTP status on a failed response', async () => {
    const fetch = vi.fn(
      async () => new Response('no', { status: 500 }),
    ) as unknown as typeof globalThis.fetch;
    await expect(
      ollamaChat({ url: URL, model: 'm', messages: [], fetch }),
    ).rejects.toEqual(new OllamaHttpError(500));
  });
});
