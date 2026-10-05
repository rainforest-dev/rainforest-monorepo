import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type Embedder,
  EmbedError,
  fakeEmbedder,
} from '../lib/server/embed.ts';
import { readSearchFiles } from '../lib/server/search-files.ts';
import type { Timeline } from '../lib/server/timeline.ts';
import { writeFixtureDataDir } from './fixture.ts';
import { buildIndex, ingest, main, runIngest } from './ingest.ts';

let root: string | undefined;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

const spied = (inner: Embedder = fakeEmbedder()) => {
  const embed = vi.fn(inner.embed);
  return { embedder: { ...inner, embed }, embed };
};

describe('ingest', () => {
  it('replaces timeline.json through a rename instead of rewriting it in place', () => {
    root = mkdtempSync(join(tmpdir(), 'memories-ingest-'));
    const dataRoot = join(root, 'data');
    writeFixtureDataDir(dataRoot);
    const path = join(dataRoot, 'timeline.json');
    const before = statSync(path).ino;

    const timeline = ingest(dataRoot, () => undefined);

    expect(statSync(path).ino).not.toBe(before);
    expect(readdirSync(dataRoot)).not.toContain('timeline.json.tmp');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(timeline);
  });
});

describe('buildIndex', () => {
  it('writes the search files and re-embeds nothing when nothing changed', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-index-'));
    const timeline = writeFixtureDataDir(join(root, 'data'));
    const dataRoot = join(root, 'data');
    const first = spied();
    await buildIndex(dataRoot, timeline, first.embedder, () => undefined);
    const files = await readSearchFiles(dataRoot);
    expect(files?.header.model).toBe('fake');
    expect(files?.header.docs.length).toBeGreaterThan(0);
    expect(first.embed).toHaveBeenCalled();

    const second = spied();
    await buildIndex(dataRoot, timeline, second.embedder, () => undefined);
    expect(second.embed).not.toHaveBeenCalled();
  });

  it('warns when no photo has labels', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-index-'));
    const timeline: Timeline = {
      generatedAt: '2025-11-02T00:00:00+08:00',
      events: [
        {
          id: 'P',
          source: 'photo',
          at: '2025-11-01T09:00:00+08:00',
          author: 'photo',
          photo: {
            favorite: false,
            people: 0,
            screenshot: false,
            movie: false,
            burstPick: true,
          },
        },
      ],
    };
    const log = vi.fn();
    await buildIndex(root, timeline, fakeEmbedder(), log);
    expect(log).toHaveBeenCalledWith(
      'photos: no labels in 1 photos — re-export with osxphotos 0.77.2',
    );
  });

  it('keeps the previous files and says so when embedding fails', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-index-'));
    const timeline = writeFixtureDataDir(join(root, 'data'));
    const dataRoot = join(root, 'data');
    const log = vi.fn();
    const failing: Embedder = {
      ...fakeEmbedder(),
      embed: async () => {
        throw new EmbedError('ollama-unreachable', 'down');
      },
    };
    await buildIndex(dataRoot, timeline, failing, log);
    expect(await readSearchFiles(dataRoot)).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'search: embeddings skipped (ollama-unreachable: down); lexical search still works',
    );
  });
});

const quiet = () => undefined;
const withoutGeneratedAt = ({ events }: Timeline) => events;

describe('runIngest', () => {
  it('migrates the fixture to per-chat folders with an identical timeline', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-run-'));
    const dataRoot = join(root, 'data');
    const before = writeFixtureDataDir(dataRoot);
    expect(before.events.some((e) => e.id.endsWith('-2'))).toBe(true);

    await runIngest(dataRoot, { embedder: fakeEmbedder(), log: quiet });

    expect(readdirSync(join(dataRoot, 'line')).sort()).toEqual([
      'busy-day',
      'chat',
      'manifest.json',
      'second-week',
    ]);
    const after = JSON.parse(
      readFileSync(join(dataRoot, 'timeline.json'), 'utf8'),
    ) as Timeline;
    expect(withoutGeneratedAt(after)).toEqual(withoutGeneratedAt(before));
    expect(after.events.map((e) => `${e.id} ${e.chat ?? ''}`)).toEqual(
      before.events.map((e) => `${e.id} ${e.chat ?? ''}`),
    );
  });

  it('skips when no input changed and rebuilds on a change or --force', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-run-'));
    const dataRoot = join(root, 'data');
    writeFixtureDataDir(dataRoot);
    const run = (force = false) =>
      runIngest(dataRoot, { embedder: fakeEmbedder(), log: quiet, force });

    expect((await run()).status).toBe('ingested');
    expect((await run()).status).toBe('skipped');
    expect((await run(true)).status).toBe('ingested');

    const people = join(dataRoot, 'people.json');
    writeFileSync(
      people,
      readFileSync(people, 'utf8').replace('"Bob"', '"Bobby"'),
    );
    expect((await run()).status).toBe('ingested');
    expect((await run()).status).toBe('skipped');
  });

  it('changes nothing on a dry run', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-run-'));
    const dataRoot = join(root, 'data');
    writeFixtureDataDir(dataRoot);
    const listing = () => readdirSync(dataRoot, { recursive: true }).sort();
    const before = listing();
    const log = vi.fn();

    const result = await runIngest(dataRoot, {
      embedder: fakeEmbedder(),
      log,
      dryRun: true,
    });

    expect(result.status).toBe('dry-run');
    expect(listing()).toEqual(before);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /^line: would move 3 legacy exports into 3 per-chat folders \(\d+ events\)$/,
      ),
    );
  });
});

describe('ingest CLI', () => {
  const cli = async (dataRoot: string, ...args: string[]) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const status = await main(
      args,
      { MEMORIES_DATA_DIR: dataRoot, MEMORIES_EMBED: 'fake' },
      {
        out: (line) => stdout.push(`${line}\n`),
        err: (line) => stderr.push(`${line}\n`),
      },
    );
    return { status, stdout: stdout.join(''), stderr: stderr.join('') };
  };

  it('migrates, skips an unchanged rerun, archives --add exports and refuses a held lock', async () => {
    root = mkdtempSync(join(tmpdir(), 'memories-cli-'));
    const dataRoot = join(root, 'data');
    writeFixtureDataDir(dataRoot);

    const first = await cli(dataRoot);
    expect(first.stderr).toBe('');
    expect(first.status).toBe(0);
    expect(first.stdout).toContain(
      'line: moved 3 legacy exports into 3 per-chat folders',
    );
    expect(first.stdout).toContain(
      'line: 1 chat headers appear in more than one legacy export',
    );
    expect(existsSync(join(dataRoot, '.ingest.lock'))).toBe(false);

    expect((await cli(dataRoot)).stdout).toContain('ingest: no input changed');

    const newer = join(root, 'export.txt');
    writeFileSync(
      newer,
      '[LINE] Chat history with Alice 🌷\nSaved on: 11/20/2025, 10:00\n\n' +
        'Sun, 11/02/2025\n8:45PM\tAlice 🌷\t[Voice message]\n\n' +
        'Wed, 11/19/2025\n9:00AM\tBob\tStill here\n',
    );
    const added = await cli(dataRoot, '--add', newer);
    expect(added.status).toBe(0);
    expect(added.stdout).toMatch(
      /archived 2 events as chat\/2025-11-20-[0-9a-f]{8}\.txt/,
    );
    expect(added.stdout).toMatch(/superseded by newer exports/);
    const timeline = JSON.parse(
      readFileSync(join(dataRoot, 'timeline.json'), 'utf8'),
    ) as Timeline;
    expect(timeline.events.some((e) => e.text === 'Still here')).toBe(true);
    expect(timeline.events.some((e) => e.text === 'Still awake?')).toBe(true);

    expect((await cli(dataRoot, '--add', newer)).stdout).toContain(
      'already archived',
    );

    const ambiguous = join(root, 'ambiguous.txt');
    writeFileSync(
      ambiguous,
      '[LINE] Chat history with Alice\n\nSun, 11/30/2025\n9:00AM\tAlice\thi\n',
    );
    const rejected = await cli(dataRoot, '--add', ambiguous);
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toContain(
      'line: rejected ambiguous.txt: header matches 2 chats',
    );

    writeFileSync(
      join(dataRoot, '.ingest.lock'),
      JSON.stringify({ pid: process.pid, startedAt: '2025-11-01T00:00:00Z' }),
    );
    const held = await cli(dataRoot, '--force');
    expect(held.status).toBe(75);
    expect(held.stderr).toContain(
      `ingest: another ingest is running (pid ${process.pid}`,
    );
  });
});
