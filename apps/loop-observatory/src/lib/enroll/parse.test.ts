import { describe, expect, it } from 'vitest';

import { parseFactsBody } from './parse.js';

const BODY = {
  host: 'rainforest-angible',
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
    expect(parseFactsBody(BODY)?.host).toBe('rainforest-angible');
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

  it('rejects every unbounded field rather than truncating it', () => {
    // These land under a host key in `_system/usage/hosts.json`, which is
    // iCloud-synced, written by an unauthenticated endpoint. Only `host` was
    // bounded before. Rejection, never truncation: a truncated fact is not
    // what the machine reported, and storing one would make the record say
    // something no probe ever said.
    const oversize: Array<Record<string, unknown>> = [
      { executors: Array.from({ length: 17 }, (_, i) => `e${i}`) },
      { executors: ['x'.repeat(64)] },
      { executors: ['has space'] },
      { brewPrefix: '/'.repeat(2000) },
      { vaultPath: '/'.repeat(2000) },
      { probedAt: 'x'.repeat(200) },
      { probedAt: 'not a timestamp' },
      { accounts: { claudeAvailable: 'ok', ghLogin: 'x'.repeat(200) } },
      { accounts: { claudeAvailable: 'ok', ghLogin: 'has space' } },
    ];
    for (const patch of oversize) {
      expect(
        parseFactsBody({ ...BODY, facts: { ...BODY.facts, ...patch } }),
        `should have rejected ${JSON.stringify(patch).slice(0, 60)}`,
      ).toBeNull();
    }
  });

  it('still accepts real-world values at the sizes actually observed', () => {
    // A bound that rejects the truth is worse than no bound. The longest real
    // vaultPath measured is 96 characters.
    const parsed = parseFactsBody({
      ...BODY,
      facts: {
        ...BODY.facts,
        executors: ['claude', 'codex', 'agy'],
        vaultPath:
          '/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian',
        accounts: { claudeAvailable: 'ok', ghLogin: 'rainforest-angible' },
      },
    });
    expect(parsed?.facts.executors).toEqual(['claude', 'codex', 'agy']);
    expect(parsed?.facts.accounts.ghLogin).toBe('rainforest-angible');
  });

  it('reads an empty gh login as null, not as a login', () => {
    // The probe emits "" when gh is absent or logged out. drift.ts turns null
    // into `account-unverified`; a login string would be checked for a
    // mismatch it cannot have.
    const parsed = parseFactsBody({
      ...BODY,
      facts: {
        ...BODY.facts,
        accounts: { claudeAvailable: 'ok', ghLogin: '   ' },
      },
    });
    expect(parsed?.facts.accounts.ghLogin).toBeNull();
  });

  it('rejects a non-object body', () => {
    for (const raw of [null, 'x', 42, []])
      expect(parseFactsBody(raw)).toBeNull();
  });
});
