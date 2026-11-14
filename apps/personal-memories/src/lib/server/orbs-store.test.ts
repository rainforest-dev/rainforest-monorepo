import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createOrbsStore, orbPair, viewerId } from './orbs-store.ts';
import { parsePeople, withIdentities } from './people-store.ts';

const fixedNow = () => new Date('2026-11-14T00:00:00.000Z');

describe('createOrbsStore', () => {
  it('starts empty, writes orbs.json and reads it back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbs-'));
    const store = createOrbsStore(dir, fixedNow);
    expect(store.writable).toBe(true);
    expect(store.read()).toEqual({ version: 1, orbs: {} });
    store.update('day:2026-02-03', 'a', { emotion: 'anger' });
    const saved = JSON.parse(readFileSync(join(dir, 'orbs.json'), 'utf8'));
    expect(saved.orbs['day:2026-02-03'].a).toEqual({
      emotion: 'anger',
      at: '2026-11-14T00:00:00.000Z',
    });
    expect(createOrbsStore(dir).read()).toEqual(saved);
  });

  it('rejects an invalid key and a malformed file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbs-'));
    const store = createOrbsStore(dir);
    expect(() => store.update('nope', 'a', { core: true })).toThrow();
    writeFileSync(
      join(dir, 'orbs.json'),
      JSON.stringify({ version: 1, orbs: { 'day:x': {} } }),
    );
    expect(() => store.read()).toThrow();
  });

  it('reports a read-only directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbs-'));
    chmodSync(dir, 0o500);
    expect(createOrbsStore(dir).writable).toBe(false);
    chmodSync(dir, 0o700);
  });
});

const PEOPLE = parsePeople({
  owner: 'b',
  people: [
    { id: 'a', name: 'Alice' },
    { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Carol' },
  ],
});

describe('orbPair', () => {
  it('puts the owner first and takes two people', () => {
    expect(orbPair(PEOPLE, ['#1', '#2'])).toEqual([
      { id: 'b', name: 'Bob', color: '#1' },
      { id: 'a', name: 'Alice', color: '#2' },
    ]);
  });
});

describe('withIdentities and viewerId', () => {
  it('maps an Access email to a person id', () => {
    const config = withIdentities(
      PEOPLE,
      'Alice@Example.com=a, bob@example.com=b,bad,x@y.z=',
    );
    const headers = (email: string) =>
      new Headers({ 'cf-access-authenticated-user-email': email });
    expect(viewerId(headers('alice@example.com'), config)).toBe('a');
    expect(viewerId(headers('BOB@example.com'), config)).toBe('b');
    expect(viewerId(headers('eve@example.com'), config)).toBeUndefined();
    expect(viewerId(new Headers(), config)).toBeUndefined();
  });

  it('never moves an email another person already claims', () => {
    const claimed = parsePeople({
      people: [
        { id: 'a', name: 'Alice', emails: ['shared@example.com'] },
        { id: 'b', name: 'Bob' },
      ],
    });
    const config = withIdentities(claimed, 'shared@example.com=b');
    expect(config.people.find((p) => p.id === 'b')?.emails).toEqual([]);
  });
});
