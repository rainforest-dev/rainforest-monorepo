import { describe, expect, it } from 'vitest';

import { statusFor } from './parse-status';

describe('statusFor', () => {
  const base = {
    supported: true,
    on: true,
    progress: undefined,
    lang: 'en',
    parsed: undefined,
  };

  it('tells a device that cannot run the model from an unsupported language', () => {
    expect(statusFor({ ...base, capability: 'unavailable' })).toEqual({
      kind: 'unavailable',
    });
    expect(
      statusFor({ ...base, lang: 'zh', capability: 'unavailable' }),
    ).toEqual({ kind: 'unsupported-language', lang: 'zh' });
  });

  it('reports the parser that ran once the model is ready', () => {
    expect(statusFor({ ...base, capability: 'ready', parsed: 'ai' })).toEqual({
      kind: 'ai',
    });
    expect(
      statusFor({ ...base, supported: false, capability: undefined }),
    ).toEqual({ kind: 'unsupported-browser' });
  });
});
