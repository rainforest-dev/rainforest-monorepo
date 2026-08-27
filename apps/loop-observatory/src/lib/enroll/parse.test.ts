import { describe, expect, it } from 'vitest';

import { parseFactsBody } from './parse.js';

const BODY = {
  host: 'Angibles-MacBook-Air',
  facts: {
    tccICloud: 'denied',
    executors: ['claude', 'codex'],
    brewPrefix: '/opt/homebrew',
    otlpListening: true,
    vaultPath: null,
    accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-angible' },
    probedAt: '2026-08-27T06:00:00.000Z',
  },
};

describe('parseFactsBody', () => {
  it('accepts a well-formed report', () => {
    expect(parseFactsBody(BODY)?.host).toBe('Angibles-MacBook-Air');
  });

  it('rejects a host name that is not a plain hostname', () => {
    // The host name reaches a filesystem key. Anything that could traverse or
    // collide is refused rather than sanitised.
    for (const host of ['../etc', 'a/b', '', 'x'.repeat(200), 'a b']) {
      expect(parseFactsBody({ ...BODY, host })).toBeNull();
    }
  });

  it('rejects an unknown tcc value rather than coercing it', () => {
    expect(
      parseFactsBody({ ...BODY, facts: { ...BODY.facts, tccICloud: 'maybe' } }),
    ).toBeNull();
  });

  it('drops fields it does not know', () => {
    // The endpoint accepts facts, not decisions. A body carrying `roles` must
    // not be able to declare anything.
    const parsed = parseFactsBody({
      ...BODY,
      roles: ['ralph'],
      facts: BODY.facts,
    });
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed ?? {})).toEqual(['host', 'facts']);
  });

  it('rejects a non-object body', () => {
    for (const raw of [null, 'x', 42, []])
      expect(parseFactsBody(raw)).toBeNull();
  });
});
