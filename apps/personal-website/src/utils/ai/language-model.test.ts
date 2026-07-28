import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectCapability, enableModel, __resetForTests } from './language-model';

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

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
    expect(await detectCapability()).toEqual({ kind: 'downloading', progress: 0 });

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
          const event = new Event('downloadprogress') as Event & { loaded: number; total: number };
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

    await expect(enableModel()).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});
