import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetForTests,
  acquire,
  destroy,
  detectCapability,
  enableModel,
  RUN_TIMEOUT_MS,
  selectTool,
} from './language-model';

type Availability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

/** Install a stub `LanguageModel` global. Pass `null` to remove it entirely. */
function stubLanguageModel(availability: Availability | null) {
  if (availability === null) {
    Reflect.deleteProperty(globalThis, 'LanguageModel');
    return;
  }
  Object.defineProperty(globalThis, 'LanguageModel', {
    configurable: true,
    writable: true,
    value: { availability: vi.fn(async () => availability), create: vi.fn() },
  });
}

afterEach(() => {
  stubLanguageModel(null);
  sessionStorage.clear();
  __resetForTests();
});

describe('detectCapability', () => {
  it('reports unsupported when the global is absent', async () => {
    stubLanguageModel(null);
    expect(await detectCapability()).toEqual({ kind: 'unsupported' });
  });

  it('maps availability() onto the state machine', async () => {
    stubLanguageModel('unavailable');
    expect(await detectCapability()).toEqual({ kind: 'unavailable' });

    stubLanguageModel('downloadable');
    expect(await detectCapability()).toEqual({ kind: 'downloadable' });

    stubLanguageModel('downloading');
    expect(await detectCapability()).toEqual({
      kind: 'downloading',
      progress: 0,
    });

    stubLanguageModel('available');
    expect(await detectCapability()).toEqual({ kind: 'ready' });
  });
});

describe('enableModel', () => {
  it('throws a clear error when the API is absent', async () => {
    stubLanguageModel(null);
    await expect(enableModel()).rejects.toThrow(/not available/i);
  });

  it('creates a session and reports download progress', async () => {
    const events: number[] = [];
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(async (opts: { monitor?: (m: EventTarget) => void }) => {
          const monitor = new EventTarget();
          opts.monitor?.(monitor);
          const event = new Event('downloadprogress') as Event & {
            loaded: number;
            total: number;
          };
          event.loaded = 5;
          event.total = 10;
          monitor.dispatchEvent(event);
          return { prompt: vi.fn(), destroy: vi.fn() };
        }),
      },
    });

    await enableModel((p) => events.push(p));
    expect(events).toEqual([0.5]);
  });

  it('surfaces NotAllowedError rather than hanging when called outside a user gesture', async () => {
    // The platform throws this when create() runs outside a click handler. It must reject, not
    // hang — a hung enable leaves the UI stuck on "downloading" forever.
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(async () => {
          throw new DOMException('requires a user gesture', 'NotAllowedError');
        }),
      },
    });

    await expect(enableModel()).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
  });
});

function stubSession(prompt: (q: string, o?: unknown) => Promise<string>) {
  Object.defineProperty(globalThis, 'LanguageModel', {
    configurable: true,
    writable: true,
    value: {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ prompt, destroy: vi.fn() })),
    },
  });
}

const SCHEMA = { type: 'object', properties: { tool: { type: 'string' } } };

describe('selectTool', () => {
  it('returns parsed schema-valid JSON', async () => {
    stubSession(async () => '{"tool":"get_skills"}');
    await enableModel();
    expect(await selectTool('what can he do', SCHEMA)).toEqual({
      tool: 'get_skills',
    });
  });

  it('passes the schema as responseConstraint', async () => {
    // Explicit generic: an argumentless vi.fn(async () => ...) infers a zero-arg mock type, so
    // mock.calls[0][1] is out of bounds under astro check's strict pass even though it runs fine.
    const prompt = vi.fn<(q: string, o?: unknown) => Promise<string>>(
      async () => '{"tool":"x"}',
    );
    stubSession(prompt);
    await enableModel();
    await selectTool('q', SCHEMA);
    expect(prompt.mock.calls[0][1]).toMatchObject({
      responseConstraint: SCHEMA,
    });
  });

  it('degrades ready -> unsupported when the first constrained call fails', async () => {
    stubSession(async () => {
      throw new DOMException('nope', 'NotSupportedError');
    });
    await enableModel();
    expect(await detectCapability()).toEqual({ kind: 'ready' });

    await expect(selectTool('q', SCHEMA)).rejects.toThrow();

    // The transition the spec warns about: it reported ready, then the probe failed.
    expect(await detectCapability()).toEqual({ kind: 'unsupported' });
    expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBe('failed');
  });

  it('degrades on the first call when the response is not parseable JSON', async () => {
    // responseConstraint is supposed to guarantee schema-valid JSON. If it resolves with
    // something else on the first call, that is the constraint silently not constraining —
    // exactly the capability failure the probe exists to catch.
    stubSession(async () => 'not json');
    await enableModel();

    await expect(selectTool('q', SCHEMA)).rejects.toThrow();

    expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBe('failed');
  });

  it('does not blame the browser for a later failure after one success', async () => {
    let calls = 0;
    stubSession(async () => {
      calls += 1;
      if (calls === 1) return '{"tool":"ok"}';
      throw new Error('transient');
    });
    await enableModel();
    await selectTool('q', SCHEMA);
    await expect(selectTool('q', SCHEMA)).rejects.toThrow('transient');

    // One success proves the browser can do this — a later error is not a capability verdict.
    expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBeNull();
  });

  // Replaces a test that asserted the opposite ("throws when called before enableModel"). That
  // contract was the defect, not a guarantee: `ready` is reached whenever the weights are already
  // on disk, but the Enable control — enableModel()'s only caller — renders solely for
  // `downloadable`. So every visitor who already had the model got an Ask row that threw here,
  // was swallowed by the caller's catch, and left the answer strip blank with no error anywhere.
  it('opens a session on demand when none exists', async () => {
    stubSession(async () => '{"tool":"get_skills"}');
    expect(await selectTool('q', SCHEMA)).toEqual({ tool: 'get_skills' });
  });

  it('does not degrade when the caller aborts mid-flight', async () => {
    // A hung `session.prompt()` that only settles once its `signal` fires — this is how the
    // platform is expected to behave when asked to abort.
    stubSession(
      (_query, opts) =>
        new Promise<string>((_resolve, reject) => {
          (
            opts as { signal?: AbortSignal } | undefined
          )?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    await enableModel();

    const controller = new AbortController();
    const pending = selectTool('q', SCHEMA, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow();

    // An abort is never a capability verdict.
    expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBeNull();
  });

  it('does not degrade when the run times out', async () => {
    vi.useFakeTimers();
    try {
      stubSession(
        (_query, opts) =>
          new Promise<string>((_resolve, reject) => {
            (
              opts as { signal?: AbortSignal } | undefined
            )?.signal?.addEventListener('abort', () =>
              reject(new DOMException('timed out', 'AbortError')),
            );
          }),
      );
      await enableModel();

      const pending = selectTool('q', SCHEMA);
      const assertion = expect(pending).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS);
      await assertion;

      // A timeout says nothing about support either.
      expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('acquire', () => {
  function stubWithDestroy(destroySpy: () => void) {
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'available'),
        create: vi.fn(async () => ({ prompt: vi.fn(), destroy: destroySpy })),
      },
    });
  }

  it('keeps the session alive until the last consumer releases', async () => {
    const destroySpy = vi.fn();
    stubWithDestroy(destroySpy);

    const releaseFirst = acquire();
    const releaseSecond = acquire();
    await enableModel();

    releaseFirst();
    // The palette must survive an embedded demo unmounting.
    expect(destroySpy).not.toHaveBeenCalled();

    releaseSecond();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('ignores a repeated release so the count cannot go negative', async () => {
    const destroySpy = vi.fn();
    stubWithDestroy(destroySpy);

    const releaseFirst = acquire();
    const releaseSecond = acquire();
    await enableModel();

    releaseFirst();
    releaseFirst(); // double unmount must not free a session others still hold
    expect(destroySpy).not.toHaveBeenCalled();

    releaseSecond();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});

describe('enableModel re-entrancy', () => {
  it('releases the previous session instead of leaking it', async () => {
    const firstDestroy = vi.fn();
    const sessions = [
      { prompt: vi.fn(), destroy: firstDestroy },
      { prompt: vi.fn(), destroy: vi.fn() },
    ];
    let created = 0;
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'available'),
        create: vi.fn(async () => sessions[created++]),
      },
    });

    await enableModel();
    await enableModel();

    // Without the release, the first session would be overwritten and never freed.
    expect(firstDestroy).toHaveBeenCalledTimes(1);
  });
});

describe('selectTool with an already-aborted signal', () => {
  it('aborts immediately rather than waiting out the timeout', async () => {
    let promptStarted = false;
    stubSession((_q, o) => {
      promptStarted = true;
      const { signal } = o as { signal: AbortSignal };
      return new Promise((_resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });
    await enableModel();

    const controller = new AbortController();
    controller.abort(); // already aborted BEFORE the call

    await expect(
      selectTool('q', SCHEMA, { signal: controller.signal }),
    ).rejects.toThrow();

    // Subscribing alone would miss this: the abort event already fired.
    expect(promptStarted).toBe(true);
    expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBeNull();
  });
});

describe('destroy', () => {
  it('releases the session and is safe to call twice', async () => {
    const destroySpy = vi.fn();
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'available'),
        create: vi.fn(async () => ({ prompt: vi.fn(), destroy: destroySpy })),
      },
    });

    await enableModel();
    destroy();
    destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
