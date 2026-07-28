import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetForTests,
  destroy,
  detectCapability,
  enableModel,
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

  it('throws when called before enableModel', async () => {
    stubLanguageModel('available');
    await expect(selectTool('q', SCHEMA)).rejects.toThrow(/enableModel/);
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
