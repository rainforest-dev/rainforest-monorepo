import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectCapability, __resetForTests } from './language-model';

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
