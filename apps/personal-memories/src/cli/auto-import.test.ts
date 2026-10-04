import { spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeEmbedder } from '../lib/server/embed.ts';
import type { Timeline } from '../lib/server/timeline.ts';
import {
  type AutoImportOptions,
  readAutoImportState,
  runAutoImport,
  STATE_PATH,
} from './auto-import.ts';
import { writeFixtureDataDir } from './fixture.ts';

const CHAT_NAME = 'Alice 🌷';
const NEW_EXPORT =
  `[LINE] Chat history with ${CHAT_NAME}\nSaved on: 11/20/2025, 10:00\n\n` +
  `Sun, 11/02/2025\n8:45PM\t${CHAT_NAME}\t[Voice message]\n\n` +
  'Wed, 11/19/2025\n9:00AM\tBob\tStill here\n';
const DROP_NAME = `[LINE] Chat with ${CHAT_NAME}.txt`;
const FROM = '2025-01-01';

let root: string;
let data: string;
let inbox: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'memories-auto-'));
  data = join(root, 'data');
  inbox = join(root, 'inbox');
  writeFixtureDataDir(data);
  mkdirSync(inbox);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const LONG_AGO = new Date('2025-01-01T00:00:00Z');
const settle = (path: string, at = LONG_AGO) => utimesSync(path, at, at);

const drop = (name: string, text: string) => {
  const path = join(inbox, name);
  writeFileSync(path, text);
  settle(path);
  return path;
};

const photoItems = () =>
  JSON.parse(readFileSync(join(data, 'photos', 'index.json'), 'utf8')) as {
    uuid: string;
  }[];

const sameExport = () => {
  const items = photoItems();
  return vi.fn<AutoImportOptions['photos']['exporter']>(async ({ out }) => {
    writeFileSync(out, JSON.stringify(items));
    return { code: 0 };
  });
};

const options = (
  extra: Partial<AutoImportOptions> = {},
): AutoImportOptions => ({
  dropDir: inbox,
  photos: { library: '/fixture/library', from: FROM, exporter: sameExport() },
  embedder: fakeEmbedder(),
  log: () => undefined,
  dataless: () => false,
  download: () => undefined,
  ...extra,
});

const timelineTexts = () =>
  (
    JSON.parse(readFileSync(join(data, 'timeline.json'), 'utf8')) as Timeline
  ).events.map((e) => e.text);

describe('runAutoImport', () => {
  it('archives a dropped export, re-exports photos, ingests and records the run', async () => {
    drop(DROP_NAME, NEW_EXPORT);
    const exporter = sameExport();
    const now = Date.parse('2025-11-20T19:30:00Z');

    const result = await runAutoImport(
      data,
      options({
        photos: { library: '/fixture/library', from: FROM, exporter },
        now: () => now,
      }),
    );

    expect(result).toEqual({ status: 'done', failures: [] });
    expect(readdirSync(inbox)).toEqual([]);
    expect(exporter).toHaveBeenCalledWith({
      library: '/fixture/library',
      fromDate: FROM,
      out: join(data, 'photos', 'index.json.new'),
    });
    expect(timelineTexts()).toContain('Still here');
    const manifest = JSON.parse(
      readFileSync(join(data, 'line', 'manifest.json'), 'utf8'),
    ) as { exports: Record<string, { file: string }> };
    expect(
      Object.values(manifest.exports).some((e) =>
        /^chat\/2025-11-20-[0-9a-f]{8}\.txt$/.test(e.file),
      ),
    ).toBe(true);

    const state = readAutoImportState(data);
    expect(state).toMatchObject({
      lastRunAt: '2025-11-20T19:30:00.000Z',
      lastSuccessAt: '2025-11-20T19:30:00.000Z',
      ok: true,
      line: { archived: 1, duplicates: 0, rejected: 0, pending: 0 },
      photos: { count: photoItems().length, mode: 'full' },
      failures: [],
    });
    expect(state?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(join(data, '.ingest.lock'))).toBe(false);
  });

  it('deletes a duplicate drop without archiving it twice', async () => {
    drop(DROP_NAME, NEW_EXPORT);
    await runAutoImport(data, options({ only: 'line' }));
    const manifest = readFileSync(join(data, 'line', 'manifest.json'), 'utf8');

    drop('again.txt', NEW_EXPORT);
    const result = await runAutoImport(data, options({ only: 'line' }));

    expect(result.status).toBe('done');
    expect(readdirSync(inbox)).toEqual([]);
    expect(readFileSync(join(data, 'line', 'manifest.json'), 'utf8')).toBe(
      manifest,
    );
    expect(readAutoImportState(data)?.line).toEqual({
      archived: 0,
      duplicates: 1,
      rejected: 0,
      pending: 0,
    });
  });

  it('moves rejected files to rejected/ with a reason and reports them without names or text', async () => {
    drop(DROP_NAME.replace('.txt', ' zh.txt'), `[LINE] ${CHAT_NAME}的聊天\n`);
    drop(`${CHAT_NAME}.zip`, 'PK');
    const post = vi.fn<typeof fetch>(async () => new Response(null));

    const result = await runAutoImport(
      data,
      options({ only: 'line', webhook: 'http://hook.test/ha-events', post }),
    );

    expect(result.status).toBe('failed');
    expect(readdirSync(inbox)).toEqual(['rejected']);
    expect(readdirSync(join(inbox, 'rejected')).sort()).toEqual([
      `${CHAT_NAME}.zip`,
      `${CHAT_NAME}.zip.reason.txt`,
      DROP_NAME.replace('.txt', ' zh.txt'),
      `${DROP_NAME.replace('.txt', ' zh.txt')}.reason.txt`,
    ]);
    expect(
      readFileSync(
        join(inbox, 'rejected', `${CHAT_NAME}.zip.reason.txt`),
        'utf8',
      ),
    ).toBe('not a .txt file\n');

    expect(post).toHaveBeenCalledTimes(2);
    const bodies = post.mock.calls.map(([url, init]) => {
      expect(url).toBe('http://hook.test/ha-events');
      return JSON.parse(String(init?.body)) as Record<string, string>;
    });
    expect(bodies.map((b) => b['detail']).sort()).toEqual([
      expect.stringMatching(
        /^line: rejected file [0-9a-f]{8}: no "\[LINE\] Chat history with" header$/,
      ),
      expect.stringMatching(
        /^line: rejected file [0-9a-f]{8}: not a \.txt file$/,
      ),
    ]);
    for (const body of bodies) {
      expect(body['event']).toBe('memories_import_failed');
      expect(body['ts']).toBe(readAutoImportState(data)?.lastRunAt);
      const raw = JSON.stringify(body);
      expect(raw).not.toContain('Alice');
      expect(raw).not.toContain('LINE] Chat with');
      expect(raw).not.toContain(root);
    }
    expect(readAutoImportState(data)).toMatchObject({
      ok: false,
      line: { rejected: 2 },
    });
    expect(readAutoImportState(data)?.lastSuccessAt).toBeUndefined();
  });

  it('asks iCloud for placeholders and leaves files that are still being written', async () => {
    drop('.pending.txt.icloud', '');
    const dataless = drop('dataless.txt', '');
    const writing = join(inbox, 'writing.txt');
    writeFileSync(writing, NEW_EXPORT.slice(0, 40));
    const download = vi.fn<(path: string) => undefined>();
    const now = Date.now();

    const first = await runAutoImport(
      data,
      options({
        only: 'line',
        dataless: (path) => path === dataless,
        download,
        now: () => now,
      }),
    );

    expect(first.status).toBe('done');
    expect(download.mock.calls.map(([path]) => path).sort()).toEqual([
      dataless,
      join(inbox, 'pending.txt'),
    ]);
    expect(readdirSync(inbox).sort()).toEqual([
      '.pending.txt.icloud',
      'dataless.txt',
      'writing.txt',
    ]);
    expect(readAutoImportState(data)?.line.pending).toBe(3);

    writeFileSync(writing, NEW_EXPORT);
    settle(writing, new Date(Date.now() - 11_000));
    rmSync(join(inbox, '.pending.txt.icloud'));
    rmSync(dataless);
    const second = await runAutoImport(data, options({ only: 'line' }));
    expect(second.status).toBe('done');
    expect(readdirSync(inbox)).toEqual([]);
    expect(timelineTexts()).toContain('Still here');
  });

  it('exits quietly while another ingest holds the lock', async () => {
    const dropped = drop(DROP_NAME, NEW_EXPORT);
    const lock = join(data, '.ingest.lock');
    writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: 'x' }));
    const log = vi.fn();
    const exporter = sameExport();

    const result = await runAutoImport(
      data,
      options({
        log,
        photos: { library: '/fixture/library', from: FROM, exporter },
      }),
    );

    expect(result).toEqual({ status: 'busy', failures: [] });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^busy: /));
    expect(existsSync(dropped)).toBe(true);
    expect(exporter).not.toHaveBeenCalled();
    expect(existsSync(join(data, STATE_PATH))).toBe(false);
    expect(existsSync(lock)).toBe(true);
  });

  it('keeps the old photo index when the export shrinks, and keeps lastSuccessAt', async () => {
    await runAutoImport(
      data,
      options({ now: () => Date.parse('2025-11-19T19:30:00Z') }),
    );
    const before = readFileSync(join(data, 'photos', 'index.json'), 'utf8');
    const short = vi.fn<AutoImportOptions['photos']['exporter']>(
      async ({ out }) => {
        writeFileSync(out, '[]');
        return { code: 0 };
      },
    );
    const post = vi.fn<typeof fetch>(async () => new Response(null));

    const result = await runAutoImport(
      data,
      options({
        photos: { library: '/fixture/library', from: FROM, exporter: short },
        now: () => Date.parse('2025-11-20T19:30:00Z'),
        webhook: 'http://hook.test/ha-events',
        post,
      }),
    );

    expect(result.failures).toEqual([
      `photos: export has 0 items, below 90% of the previous ${photoItems().length}; kept the previous index`,
    ]);
    expect(readFileSync(join(data, 'photos', 'index.json'), 'utf8')).toBe(
      before,
    );
    expect(readAutoImportState(data)).toMatchObject({
      lastRunAt: '2025-11-20T19:30:00.000Z',
      lastSuccessAt: '2025-11-19T19:30:00.000Z',
      ok: false,
    });
    expect(post).toHaveBeenCalledOnce();
  });

  it('reports an unset photos start date and a missing drop folder', async () => {
    rmSync(inbox, { recursive: true });
    const result = await runAutoImport(
      data,
      options({ photos: { library: '/x', exporter: sameExport() } }),
    );
    expect(result.failures).toEqual([
      'line: drop folder not found',
      'photos: MEMORIES_PHOTOS_FROM is not set',
    ]);
  });

  it('moves and writes nothing on a dry run', async () => {
    drop(DROP_NAME, NEW_EXPORT);
    drop('notes.zip', 'PK');
    const listing = () =>
      readdirSync(root, { recursive: true }).map(String).sort();
    const before = listing();
    const exporter = sameExport();
    const log = vi.fn();

    const result = await runAutoImport(
      data,
      options({
        dryRun: true,
        log,
        photos: { library: '/fixture/library', from: FROM, exporter },
      }),
    );

    expect(result.status).toBe('dry-run');
    expect(listing()).toEqual(before);
    expect(exporter).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'photos: would run a full export from 2025-01-01',
    );
    expect(log).toHaveBeenCalledWith(
      'line: would move notes.zip to rejected/ (not a .txt file)',
    );
  });
});

const CLI = join(import.meta.dirname, 'auto-import.ts');

const runCli = (env: Record<string, string>) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(process.execPath, [CLI], {
        env: { ...process.env, MEMORIES_EMBED: 'fake', ...env },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    },
  );

describe('auto-import CLI', () => {
  it('runs end to end with a fake osxphotos and posts a failure to the webhook', async () => {
    const posts: string[] = [];
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        posts.push(`${req.method} ${req.url} ${body}`);
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;

    const fullExport = join(root, 'export.json');
    writeFileSync(fullExport, JSON.stringify(photoItems()));
    const argsLog = join(root, 'args.log');
    const fake = join(root, 'fake-osxphotos');
    writeFileSync(
      fake,
      `#!${process.execPath}\n` +
        "const fs = require('node:fs');\n" +
        `fs.appendFileSync(${JSON.stringify(argsLog)}, JSON.stringify(process.argv.slice(2)) + '\\n');\n` +
        `process.stdout.write(fs.readFileSync(${JSON.stringify(fullExport)}));\n`,
    );
    chmodSync(fake, 0o755);
    drop(DROP_NAME, NEW_EXPORT);

    const env = {
      MEMORIES_DATA_DIR: data,
      MEMORIES_DROP_DIR: inbox,
      MEMORIES_PHOTOS_CMD: fake,
      MEMORIES_PHOTOS_LIBRARY: '/fixture/library',
      MEMORIES_PHOTOS_FROM: FROM,
      MEMORIES_IMPORT_WEBHOOK: `http://127.0.0.1:${port}/webhook/ha-events`,
    };
    try {
      const ok = await runCli(env);
      expect(ok.stderr).toBe('');
      expect(ok.code).toBe(0);
      expect(ok.stdout).toContain('photos: full export from 2025-01-01');
      expect(ok.stdout).toContain('auto-import: done; line 1 archived');
      expect(readdirSync(inbox)).toEqual([]);
      expect(readFileSync(argsLog, 'utf8').trim()).toBe(
        JSON.stringify([
          'query',
          '--json',
          '--library',
          '/fixture/library',
          '--from-date',
          FROM,
        ]),
      );
      expect(readAutoImportState(data)?.ok).toBe(true);
      expect(posts).toEqual([]);

      writeFileSync(fullExport, '[]');
      const shrunk = await runCli(env);
      expect(shrunk.code).toBe(1);
      expect(posts).toHaveLength(1);
      const [line] = posts;
      expect(line).toMatch(/^POST \/webhook\/ha-events /);
      const body = JSON.parse(line?.split(' ').slice(2).join(' ') ?? '');
      expect(body).toEqual({
        event: 'memories_import_failed',
        detail: expect.stringMatching(/^photos: export has 0 items, below 90%/),
        ts: readAutoImportState(data)?.lastRunAt,
      });
      expect(photoItems().length).toBeGreaterThan(0);

      writeFileSync(
        join(data, '.ingest.lock'),
        JSON.stringify({ pid: process.pid, startedAt: 'x' }),
      );
      const busy = await runCli(env);
      expect(busy.code).toBe(0);
      expect(busy.stdout).toContain('busy: another ingest is running');
    } finally {
      server.close();
    }
  });

  it('exits 2 without MEMORIES_DATA_DIR', async () => {
    const result = await runCli({ MEMORIES_DATA_DIR: '' });
    expect(result.code).toBe(2);
  });
});
