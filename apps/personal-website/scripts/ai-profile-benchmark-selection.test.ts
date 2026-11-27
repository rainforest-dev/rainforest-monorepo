import { describe, expect, it } from 'vitest';

import { selectAssistants } from './ai-profile-benchmark';

const AVAILABLE = ['claude-site', 'gemini-agy-web', 'codex-site'];

describe('selectAssistants', () => {
  it('leaves the agy web run out unless it is named', () => {
    expect(selectAssistants(AVAILABLE)).toEqual(['claude-site', 'codex-site']);
  });

  it('runs the agy web run when --only names it', () => {
    expect(selectAssistants(AVAILABLE, 'gemini-agy-web')).toEqual([
      'gemini-agy-web',
    ]);
  });

  it('keeps the order given in --only', () => {
    expect(selectAssistants(AVAILABLE, 'codex-site,gemini-agy-web')).toEqual([
      'codex-site',
      'gemini-agy-web',
    ]);
  });
});
