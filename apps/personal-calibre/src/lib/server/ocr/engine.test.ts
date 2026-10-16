import { describe, expect, it, vi } from 'vitest';

import { fakeOcr, ocrEngineFromEnv, ollamaOcr } from './engine';
import { OCR_PROMPT } from './prompt';

describe('ollamaOcr', () => {
  it('sends the prompt with the page as a base64 image, deterministically', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ message: { content: 'TEXT:\n• a' } }),
    );
    const engine = ollamaOcr({
      url: 'http://ollama:11434',
      model: 'qwen3-vl:8b-instruct',
      fetch,
    });
    const answer = await engine.read(
      new Uint8Array([1, 2, 3]),
      AbortSignal.timeout(1000),
    );
    expect(answer).toBe('TEXT:\n• a');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama:11434/api/chat');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'qwen3-vl:8b-instruct',
      stream: false,
      think: false,
      options: { temperature: 0 },
      messages: [{ role: 'user', content: OCR_PROMPT, images: ['AQID'] }],
    });
  });

  it('is ready only when the model is pulled', async () => {
    const tags = (names: string[]) =>
      vi.fn(async () =>
        Response.json({ models: names.map((name) => ({ name })) }),
      );
    const model = 'qwen3-vl:8b-instruct';
    await expect(
      ollamaOcr({ url: 'http://o', model, fetch: tags([model]) }).ready(),
    ).resolves.toBeUndefined();
    await expect(
      ollamaOcr({ url: 'http://o', model, fetch: tags(['gemma4:8b']) }).ready(),
    ).rejects.toThrow(/not available/);
  });
});

describe('ocrEngineFromEnv', () => {
  it('needs both a URL and a model, or the fake', () => {
    expect(ocrEngineFromEnv({})).toBeUndefined();
    expect(
      ocrEngineFromEnv({ CALIBRE_OLLAMA_URL: 'http://o' }),
    ).toBeUndefined();
    expect(
      ocrEngineFromEnv({
        CALIBRE_OLLAMA_URL: 'http://o',
        CALIBRE_OCR_MODEL: 'm',
      })?.name,
    ).toBe('m');
    expect(ocrEngineFromEnv({ CALIBRE_OCR: 'fake' })).toBe(fakeOcr);
  });
});
