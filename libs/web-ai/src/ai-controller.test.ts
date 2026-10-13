import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiController } from './ai-controller';
import { __resetForTests } from './language-model';

type Availability =
  'unavailable' | 'downloadable' | 'downloading' | 'available';

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

describe('createAiController', () => {
  it('reports capability and notifies subscribers', async () => {
    stubLanguageModel('available');
    const ai = createAiController();
    const seen: string[] = [];
    ai.subscribe(() => seen.push(ai.getState().kind));
    expect(ai.getState()).toEqual({ kind: 'unsupported' });
    await ai.refresh();
    expect(ai.getState()).toEqual({ kind: 'ready' });
    expect(seen).toEqual(['ready']);
  });

  it('reports download progress during enable, then ready', async () => {
    stubLanguageModel('downloadable');
    const create = vi.fn(async (opts: { monitor(m: EventTarget): void }) => {
      const target = new EventTarget();
      opts.monitor(target);
      target.dispatchEvent(
        Object.assign(new Event('downloadprogress'), { loaded: 1, total: 2 }),
      );
      return { prompt: vi.fn(), destroy: vi.fn() };
    });
    (
      globalThis as unknown as { LanguageModel: { create: unknown } }
    ).LanguageModel.create = create;
    const ai = createAiController();
    const seen: unknown[] = [];
    ai.subscribe(() => seen.push(ai.getState()));
    await ai.enable();
    expect(seen).toEqual([
      { kind: 'downloading', progress: 0 },
      { kind: 'downloading', progress: 0.5 },
      { kind: 'ready' },
    ]);
  });

  it('keeps download progress when a refresh started earlier resolves late', async () => {
    stubLanguageModel('downloadable');
    const lm = (
      globalThis as unknown as {
        LanguageModel: { availability: unknown; create: unknown };
      }
    ).LanguageModel;
    let answer: (value: string) => void = () => undefined;
    lm.availability = vi.fn(
      () => new Promise<string>((resolve) => (answer = resolve)),
    );
    let progress: (loaded: number) => void = () => undefined;
    let created: (session: unknown) => void = () => undefined;
    lm.create = vi.fn((opts: { monitor(m: EventTarget): void }) => {
      const target = new EventTarget();
      opts.monitor(target);
      progress = (loaded) =>
        target.dispatchEvent(
          Object.assign(new Event('downloadprogress'), { loaded, total: 4 }),
        );
      return new Promise((resolve) => (created = resolve));
    });
    const ai = createAiController();
    const refreshing = ai.refresh();
    const enabling = ai.enable();
    progress(1);
    answer('downloadable');
    await refreshing;
    expect(ai.getState()).toEqual({ kind: 'downloading', progress: 0.25 });
    created({ prompt: vi.fn(), destroy: vi.fn() });
    await enabling;
    expect(ai.getState()).toEqual({ kind: 'ready' });
  });

  it('skips the refresh when the caller aborted the run', async () => {
    stubLanguageModel('available');
    const ai = createAiController();
    const refresh = vi.spyOn(ai, 'refresh');
    const outer = new AbortController();
    outer.abort();
    await expect(
      ai.run('p', {}, { signal: outer.signal }),
    ).rejects.toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes state and rethrows when a run fails', async () => {
    stubLanguageModel('available');
    const ai = createAiController();
    const refresh = vi.spyOn(ai, 'refresh');
    await expect(ai.run('p', {})).rejects.toBeDefined();
    expect(refresh).toHaveBeenCalled();
  });

  it('retains the shared session until released', () => {
    const ai = createAiController();
    const release = ai.retain();
    expect(typeof release).toBe('function');
    release();
    release();
  });
});
