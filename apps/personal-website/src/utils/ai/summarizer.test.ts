import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetForTests,
  destroySummarizer,
  detectSummarizerCapability,
  summarize,
  SUMMARIZE_TIMEOUT_MS,
  SummarizeError,
} from './summarizer';

type Availability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

/** Install a stub `Summarizer` global. Pass `null` to remove it entirely. */
function stubSummarizer(
  availability: Availability | null,
  summarizeImpl?: (input: string, opts?: unknown) => Promise<string>,
  destroy = vi.fn(),
) {
  if (availability === null) {
    Reflect.deleteProperty(globalThis, 'Summarizer');
    return { destroy };
  }
  Object.defineProperty(globalThis, 'Summarizer', {
    configurable: true,
    writable: true,
    value: {
      availability: vi.fn(async () => availability),
      create: vi.fn(async () => ({
        summarize: summarizeImpl ?? (async () => 'a summary'),
        destroy,
      })),
    },
  });
  return { destroy };
}

afterEach(() => {
  stubSummarizer(null);
  __resetForTests();
  vi.useRealTimers();
});

describe('detectSummarizerCapability', () => {
  it('reports unsupported when the global is absent', async () => {
    stubSummarizer(null);
    expect(await detectSummarizerCapability()).toEqual({ kind: 'unsupported' });
  });

  it('maps availability() onto the shared state union', async () => {
    stubSummarizer('unavailable');
    expect(await detectSummarizerCapability()).toEqual({ kind: 'unavailable' });
    stubSummarizer('downloadable');
    expect(await detectSummarizerCapability()).toEqual({
      kind: 'downloadable',
    });
    stubSummarizer('downloading');
    expect(await detectSummarizerCapability()).toEqual({
      kind: 'downloading',
      progress: 0,
    });
    stubSummarizer('available');
    expect(await detectSummarizerCapability()).toEqual({ kind: 'ready' });
  });

  // The platform answers per configuration, so a caller that probes bare and then runs with
  // options could be told "ready" about a config it never asked about.
  it('passes the caller options through to availability()', async () => {
    stubSummarizer('available');
    const opts = {
      type: 'key-points',
      format: 'markdown',
      length: 'short',
    } as const;
    await detectSummarizerCapability(opts);
    expect(
      (
        globalThis as unknown as {
          Summarizer: { availability: ReturnType<typeof vi.fn> };
        }
      ).Summarizer.availability,
    ).toHaveBeenCalledWith(opts);
  });
});

describe('summarize', () => {
  it('returns the summary text', async () => {
    stubSummarizer('available', async () => 'key points here');
    expect(await summarize('a long article')).toBe('key points here');
  });

  it('opens a session on demand, with no separate enable step', async () => {
    stubSummarizer('available');
    await summarize('text');
    const { Summarizer } = globalThis as unknown as {
      Summarizer: { create: ReturnType<typeof vi.fn> };
    };
    expect(Summarizer.create).toHaveBeenCalledTimes(1);
  });

  // Sessions are configuration-bound: reusing one across configs would silently answer in the
  // previous shape (ask for a headline, receive key-points).
  it('reuses the session for one config and rebuilds it for another', async () => {
    const { destroy } = stubSummarizer('available');
    const { Summarizer } = globalThis as unknown as {
      Summarizer: { create: ReturnType<typeof vi.fn> };
    };

    await summarize('a', { type: 'key-points' });
    await summarize('b', { type: 'key-points' });
    expect(Summarizer.create).toHaveBeenCalledTimes(1);

    await summarize('c', { type: 'headline' });
    expect(Summarizer.create).toHaveBeenCalledTimes(2);
    // The superseded session is released rather than stranded holding the model.
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('classifies an oversized input as too-long, not a generic failure', async () => {
    stubSummarizer('available', async () => {
      throw new DOMException('input too large', 'QuotaExceededError');
    });
    await expect(summarize('war and peace')).rejects.toMatchObject({
      name: 'SummarizeError',
      reason: 'too-long',
    });
  });

  // The platform refuses to start a model download outside a user gesture. Distinct from a
  // generic failure because it is the one case a reader can act on by clicking again.
  it('classifies a missing user gesture as needs-gesture', async () => {
    Object.defineProperty(globalThis, 'Summarizer', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(async () => {
          throw new DOMException(
            'Requires a user gesture when availability is "downloadable".',
            'NotAllowedError',
          );
        }),
      },
    });
    await expect(summarize('text')).rejects.toMatchObject({
      reason: 'needs-gesture',
    });
  });

  it('classifies anything else as failed', async () => {
    stubSummarizer('available', async () => {
      throw new Error('kErrorUnknown');
    });
    await expect(summarize('text')).rejects.toMatchObject({
      reason: 'failed',
    });
  });

  it('classifies a caller abort as timeout', async () => {
    stubSummarizer(
      'available',
      (_input, opts) =>
        new Promise<string>((_resolve, reject) => {
          const { signal } = opts as { signal: AbortSignal };
          if (signal.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const controller = new AbortController();
    const pending = summarize('text', {}, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('aborts a hung run at SUMMARIZE_TIMEOUT_MS rather than hanging forever', async () => {
    vi.useFakeTimers();
    stubSummarizer(
      'available',
      (_input, opts) =>
        new Promise<string>((_resolve, reject) => {
          (opts as { signal: AbortSignal }).signal.addEventListener(
            'abort',
            () => reject(new DOMException('timed out', 'AbortError')),
          );
        }),
    );
    const pending = summarize('text');
    const assertion = expect(pending).rejects.toMatchObject({
      reason: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(SUMMARIZE_TIMEOUT_MS);
    await assertion;
  });

  it('reports download progress while the model is fetched', async () => {
    const events: number[] = [];
    Object.defineProperty(globalThis, 'Summarizer', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(async (opts: { monitor: (m: EventTarget) => void }) => {
          const monitor = new EventTarget();
          opts.monitor(monitor);
          const event = new Event('downloadprogress') as Event & {
            loaded: number;
            total: number;
          };
          event.loaded = 5;
          event.total = 10;
          monitor.dispatchEvent(event);
          return { summarize: async () => 'done', destroy: vi.fn() };
        }),
      },
    });

    await summarize('text', {}, { onProgress: (p) => events.push(p) });

    expect(events).toEqual([0.5]);
  });

  it('throws SummarizeError, so callers can switch on reason without instanceof gymnastics', async () => {
    stubSummarizer('available', async () => {
      throw new Error('boom');
    });
    await expect(summarize('text')).rejects.toBeInstanceOf(SummarizeError);
  });
});

describe('destroySummarizer', () => {
  it('releases the session so the next call opens a fresh one', async () => {
    const { destroy } = stubSummarizer('available');
    const { Summarizer } = globalThis as unknown as {
      Summarizer: { create: ReturnType<typeof vi.fn> };
    };

    await summarize('a');
    destroySummarizer();
    expect(destroy).toHaveBeenCalledTimes(1);

    await summarize('b');
    expect(Summarizer.create).toHaveBeenCalledTimes(2);
  });
});
