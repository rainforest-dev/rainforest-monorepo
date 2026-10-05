import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cachedFile } from './file-cache.ts';

const root = mkdtempSync(join(tmpdir(), 'memories-file-cache-'));
const path = join(root, 'data.json');
let version = 0;

const write = (contents: string) => {
  writeFileSync(path, contents);
  version += 1;
  const at = new Date(Date.UTC(2025, 10, 1) + version * 1000);
  utimesSync(path, at, at);
};

const parse = (contents: string | undefined) =>
  contents === undefined
    ? { missing: true }
    : (JSON.parse(contents) as { n: number });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.UTC(2026, 0, 1));
  rmSync(path, { force: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe('cachedFile', () => {
  it('re-reads the file when its mtime changes', async () => {
    write('{"n":1}');
    const file = cachedFile(path, parse, { checkEveryMs: 5000 });
    const first = await file.get();
    expect(first).toEqual({ n: 1 });

    later(5000);
    expect(await file.get()).toBe(first);

    write('{"n":2}');
    later(5000);
    expect(await file.get()).toEqual({ n: 2 });
  });

  it('checks the file at most once per interval', async () => {
    write('{"n":1}');
    const load = vi.fn(parse);
    const file = cachedFile(path, load, { checkEveryMs: 5000 });
    await file.get();

    write('{"n":2}');
    later(4999);
    expect(await file.get()).toEqual({ n: 1 });
    later(1);
    expect(await file.get()).toEqual({ n: 2 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one read between concurrent callers', async () => {
    write('{"n":1}');
    const load = vi.fn(parse);
    const file = cachedFile(path, load);
    const [a, b] = await Promise.all([file.get(), file.get()]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous value and logs once when the new file fails to load', async () => {
    write('{"n":1}');
    const log = vi.fn();
    const file = cachedFile(path, parse, { checkEveryMs: 5000, log });
    await file.get();

    write('{"n":');
    later(5000);
    expect(await file.get()).toEqual({ n: 1 });
    later(5000);
    expect(await file.get()).toEqual({ n: 1 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain('keeping the previous copy');

    write('{"n":3}');
    later(5000);
    expect(await file.get()).toEqual({ n: 3 });
  });

  it('throws when the first load fails, and recovers once the file is fixed', async () => {
    write('not json');
    const file = cachedFile(path, parse, { checkEveryMs: 5000, log: vi.fn() });
    await expect(file.get()).rejects.toThrow(SyntaxError);
    await expect(file.get()).rejects.toThrow(SyntaxError);

    write('{"n":4}');
    later(5000);
    expect(await file.get()).toEqual({ n: 4 });
  });

  it('passes undefined while the file is absent and picks it up once it appears', async () => {
    const file = cachedFile(path, parse, { checkEveryMs: 5000 });
    expect(await file.get()).toEqual({ missing: true });

    write('{"n":5}');
    later(5000);
    expect(await file.get()).toEqual({ n: 5 });
  });

  it('never touches the disk without a path', async () => {
    const load = vi.fn(parse);
    const file = cachedFile(undefined, load);
    expect(await file.get()).toEqual({ missing: true });
    expect(load).toHaveBeenCalledWith(undefined);
  });
});
