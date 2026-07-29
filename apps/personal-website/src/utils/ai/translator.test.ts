import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetForTests,
  destroyTranslator,
  detectTranslatorCapability,
  TRANSLATE_TIMEOUT_MS,
  translateChunks,
  TranslateError,
} from './translator';

const EN_ZH = { sourceLanguage: 'en', targetLanguage: 'zh-Hant' };

function stubTranslator(
  availability:
    | 'unavailable'
    | 'downloadable'
    | 'downloading'
    | 'available'
    | null,
  translateImpl?: (input: string, opts?: unknown) => Promise<string>,
  destroy = vi.fn(),
) {
  if (availability === null) {
    Reflect.deleteProperty(globalThis, 'Translator');
    return { destroy };
  }
  Object.defineProperty(globalThis, 'Translator', {
    configurable: true,
    writable: true,
    value: {
      availability: vi.fn(async () => availability),
      create: vi.fn(async () => ({
        translate: translateImpl ?? (async (input: string) => `[zh]${input}`),
        destroy,
      })),
    },
  });
  return { destroy };
}

afterEach(() => {
  stubTranslator(null);
  __resetForTests();
  vi.useRealTimers();
});

describe('detectTranslatorCapability', () => {
  it('reports unsupported when the global is absent', async () => {
    stubTranslator(null);
    expect(await detectTranslatorCapability(EN_ZH)).toEqual({
      kind: 'unsupported',
    });
  });

  it('maps availability() onto the shared state union', async () => {
    stubTranslator('downloadable');
    expect(await detectTranslatorCapability(EN_ZH)).toEqual({
      kind: 'downloadable',
    });
    stubTranslator('available');
    expect(await detectTranslatorCapability(EN_ZH)).toEqual({ kind: 'ready' });
  });

  it('asks about the specific pair — models are per pair, not global', async () => {
    stubTranslator('available');
    await detectTranslatorCapability(EN_ZH);
    expect(
      (
        globalThis as unknown as {
          Translator: { availability: ReturnType<typeof vi.fn> };
        }
      ).Translator.availability,
    ).toHaveBeenCalledWith(EN_ZH);
  });
});

describe('translateChunks', () => {
  it('returns one result per chunk, in order', async () => {
    stubTranslator('available');
    expect(await translateChunks(['one', 'two', 'three'], EN_ZH)).toEqual([
      '[zh]one',
      '[zh]two',
      '[zh]three',
    ]);
  });

  // The caller puts each result back where it came from, so a dropped or reordered chunk would
  // silently scramble the page.
  it('preserves count even when a chunk translates to the same text', async () => {
    stubTranslator('available', async (input) => input);
    const chunks = ['a', 'b', 'c', 'd'];
    expect(await translateChunks(chunks, EN_ZH)).toHaveLength(chunks.length);
  });

  it('emits each chunk as it lands, so the page can update progressively', async () => {
    stubTranslator('available');
    const seen: Array<[number, string]> = [];
    await translateChunks(['one', 'two'], EN_ZH, {
      onChunk: (i, text) => seen.push([i, text]),
    });
    expect(seen).toEqual([
      [0, '[zh]one'],
      [1, '[zh]two'],
    ]);
  });

  it('reuses one session for the pair rather than one per chunk', async () => {
    stubTranslator('available');
    await translateChunks(['a', 'b', 'c'], EN_ZH);
    expect(
      (
        globalThis as unknown as {
          Translator: { create: ReturnType<typeof vi.fn> };
        }
      ).Translator.create,
    ).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the session when the pair changes', async () => {
    const { destroy } = stubTranslator('available');
    const { Translator } = globalThis as unknown as {
      Translator: { create: ReturnType<typeof vi.fn> };
    };
    await translateChunks(['a'], EN_ZH);
    await translateChunks(['b'], {
      sourceLanguage: 'zh-Hant',
      targetLanguage: 'en',
    });
    expect(Translator.create).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('classifies a missing user gesture as needs-gesture', async () => {
    Object.defineProperty(globalThis, 'Translator', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(async () => {
          throw new DOMException('needs a gesture', 'NotAllowedError');
        }),
      },
    });
    await expect(translateChunks(['a'], EN_ZH)).rejects.toMatchObject({
      reason: 'needs-gesture',
    });
  });

  it('classifies anything unrecognised as failed', async () => {
    stubTranslator('available', async () => {
      throw new Error('kErrorUnknown');
    });
    await expect(translateChunks(['a'], EN_ZH)).rejects.toBeInstanceOf(
      TranslateError,
    );
    await expect(translateChunks(['a'], EN_ZH)).rejects.toMatchObject({
      reason: 'failed',
    });
  });

  it('stops partway through when the caller aborts, rather than finishing the batch', async () => {
    const controller = new AbortController();
    let calls = 0;
    stubTranslator('available', async (input) => {
      calls += 1;
      if (calls === 2) controller.abort();
      return `[zh]${input}`;
    });
    await expect(
      translateChunks(['a', 'b', 'c', 'd'], EN_ZH, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ reason: 'timeout' });
    // Aborted after the second chunk resolved; the third and fourth were never attempted.
    expect(calls).toBe(2);
  });

  it('aborts a hung batch at TRANSLATE_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    stubTranslator(
      'available',
      (_input, opts) =>
        new Promise<string>((_resolve, reject) => {
          (opts as { signal: AbortSignal }).signal.addEventListener(
            'abort',
            () => reject(new DOMException('timed out', 'AbortError')),
          );
        }),
    );
    const pending = translateChunks(['a'], EN_ZH);
    const assertion = expect(pending).rejects.toMatchObject({
      reason: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(TRANSLATE_TIMEOUT_MS);
    await assertion;
  });
});

describe('destroyTranslator', () => {
  it('releases the session', async () => {
    const { destroy } = stubTranslator('available');
    await translateChunks(['a'], EN_ZH);
    destroyTranslator();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
