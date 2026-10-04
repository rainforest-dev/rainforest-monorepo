import { mkdtempSync, writeFileSync } from 'node:fs';
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
  it('reads the data directory once per process, including when people.json is absent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'memories-people-cache-'));
    vi.stubEnv('MEMORIES_DATA_DIR', root);
    vi.stubEnv('MEMORIES_OWNER', 'Bob');
    vi.resetModules();
    const { getPeople } = await import('./people-store.ts');
    const first = getPeople();
    expect(first.owners).toEqual(new Set(['Bob']));
    writeFileSync(join(root, 'people.json'), JSON.stringify(FILE));
    expect(getPeople()).toBe(first);
    vi.unstubAllEnvs();
  });
});
