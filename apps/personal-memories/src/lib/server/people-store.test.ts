import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { loadPeople, parsePeople, publicPeople } from './people-store.ts';

const FILE = {
  owner: 'bob',
  people: [
    {
      id: 'bob',
      name: 'Bob',
      emails: ['Bob@Example.com'],
      aliases: { line: ['Bobby'], slack: ['bob.w'] },
    },
    { id: 'alice', name: 'Alice', emails: ['alice@example.com'] },
  ],
};

describe('parsePeople', () => {
  it('normalises emails and fills empty aliases', () => {
    const config = parsePeople(FILE);
    expect(config.people.map((p) => p.emails)).toEqual([
      ['bob@example.com'],
      ['alice@example.com'],
    ]);
    expect(config.people[1]?.aliases).toEqual({});
    expect(config.owners).toEqual(new Set(['Bob']));
  });

  it('rejects an alias, id or email claimed twice, and an unknown owner', () => {
    const twice = {
      ...FILE,
      people: [
        FILE.people[0],
        { ...FILE.people[1], aliases: { line: ['Bobby'] } },
      ],
    };
    expect(() => parsePeople(twice)).toThrow(/Bobby/);
    expect(() =>
      parsePeople({ ...FILE, people: [FILE.people[0], FILE.people[0]] }),
    ).toThrow(/bob/);
    expect(() => parsePeople({ ...FILE, owner: 'eve' })).toThrow(/eve/);
  });

  it('keeps emails out of what the browser receives', () => {
    expect(publicPeople(parsePeople(FILE))).toEqual([
      {
        id: 'bob',
        name: 'Bob',
        aliases: { line: ['Bobby'], slack: ['bob.w'] },
      },
      { id: 'alice', name: 'Alice', aliases: {} },
    ]);
  });
});

describe('loadPeople', () => {
  it('reads people.json from the data root', () => {
    const root = mkdtempSync(join(tmpdir(), 'memories-people-'));
    writeFileSync(join(root, 'people.json'), JSON.stringify(FILE));
    expect(loadPeople(root, {}).people.map((p) => p.name)).toEqual([
      'Bob',
      'Alice',
    ]);
  });

  it('falls back to the legacy owner and author variables', () => {
    const config = loadPeople(undefined, {
      MEMORIES_OWNER: ' Bob , 我 ',
      MEMORIES_AUTHORS: 'bob@example.com=Bob,alice@example.com=Alice',
    });
    expect(config.owners).toEqual(new Set(['Bob', '我']));
    expect(config.people).toEqual([
      { id: 'Bob', name: 'Bob', emails: ['bob@example.com'], aliases: {} },
      {
        id: 'Alice',
        name: 'Alice',
        emails: ['alice@example.com'],
        aliases: {},
      },
    ]);
    expect(loadPeople(undefined, {}).people).toEqual([]);
  });
});

describe('getPeople', () => {
  it('caches between checks, picks up people.json once it appears, and keeps the last good copy', async () => {
    const root = mkdtempSync(join(tmpdir(), 'memories-people-cache-'));
    const path = join(root, 'people.json');
    const write = (body: string, second: number) => {
      writeFileSync(path, body);
      const at = new Date(Date.UTC(2025, 10, 1, 0, 0, second));
      utimesSync(path, at, at);
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      vi.stubEnv('MEMORIES_DATA_DIR', root);
      vi.stubEnv('MEMORIES_OWNER', 'Bob');
      vi.resetModules();
      const { getPeople } = await import('./people-store.ts');
      const legacy = await getPeople();
      expect(legacy.owners).toEqual(new Set(['Bob']));

      write(JSON.stringify(FILE), 1);
      expect(await getPeople()).toBe(legacy);

      vi.advanceTimersByTime(5000);
      const configured = await getPeople();
      expect(configured.people.map((p) => p.id)).toEqual(['bob', 'alice']);

      write(JSON.stringify({ ...FILE, owner: 'carol' }), 2);
      vi.advanceTimersByTime(5000);
      expect(await getPeople()).toBe(configured);
      expect(console.error).toHaveBeenCalledTimes(1);

      write(JSON.stringify({ people: [FILE.people[1]] }), 3);
      vi.advanceTimersByTime(5000);
      expect((await getPeople()).people.map((p) => p.id)).toEqual(['alice']);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });
});
