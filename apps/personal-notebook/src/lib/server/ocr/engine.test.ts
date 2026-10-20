import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { pagePng } from '@/test';

import {
  fakeOcr,
  fitPage,
  MAX_EDGE_PX,
  OCR_CONTEXT,
  ocrEngineFromEnv,
  ollamaOcr,
} from './engine';
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
    const page = await pagePng(40);
    const answer = await engine.read(page, AbortSignal.timeout(1000));
    expect(answer).toBe('TEXT:\n• a');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama:11434/api/chat');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'qwen3-vl:8b-instruct',
      stream: false,
      think: false,
      options: { temperature: 0, num_ctx: OCR_CONTEXT },
      messages: [
        {
          role: 'user',
          content: OCR_PROMPT,
          images: [Buffer.from(page).toString('base64')],
        },
      ],
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

describe('fitPage', () => {
  it('shrinks a large page to the edge limit and leaves a small one alone', async () => {
    const small = await pagePng(10);
    expect(await fitPage(small)).toBe(small);
    const big = await pagePng(10, { width: 3024, height: 4032 });
    const meta = await sharp(await fitPage(big)).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(MAX_EDGE_PX);
    expect(meta.width).toBe(1536);
  });

  it('applies the camera orientation before shrinking', async () => {
    // Stored landscape with EXIF "rotate 90° clockwise", as a phone writes a portrait page.
    const sideways = await sharp({
      create: { width: 4032, height: 3024, channels: 3, background: '#fff' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const meta = await sharp(await fitPage(sideways)).metadata();
    expect([meta.width, meta.height]).toEqual([1536, MAX_EDGE_PX]);
    expect(meta.orientation ?? 1).toBe(1);
  });
});

describe('ocrEngineFromEnv', () => {
  it('needs both a URL and a model, or the fake', () => {
    expect(ocrEngineFromEnv({})).toBeUndefined();
    expect(
      ocrEngineFromEnv({ NOTEBOOK_OLLAMA_URL: 'http://o' }),
    ).toBeUndefined();
    expect(
      ocrEngineFromEnv({
        NOTEBOOK_OLLAMA_URL: 'http://o',
        NOTEBOOK_OCR_MODEL: 'm',
      })?.name,
    ).toBe('m');
    expect(ocrEngineFromEnv({ NOTEBOOK_OCR: 'fake' })).toBe(fakeOcr);
  });
});
