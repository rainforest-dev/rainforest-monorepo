import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  choosePhotosWindow,
  exportPhotos,
  type ExportRequest,
  FULL_EVERY_MS,
  guardPhotoCount,
  mergeByUuid,
  type PhotosExporter,
  type PhotosState,
  SLOW_FULL_EXPORT_MS,
} from './photos-export.ts';

const NOW = Date.parse('2025-11-20T10:00:00Z');
const FROM = '2024-01-01';
const items = (n: number, tag = 'v1') =>
  Array.from({ length: n }, (_, i) => ({ uuid: `U${i}`, tag }));

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'memories-photos-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const indexPath = () => join(root, 'photos', 'index.json');
const writeIndex = (value: unknown) => {
  mkdirSync(join(root, 'photos'), { recursive: true });
  writeFileSync(indexPath(), JSON.stringify(value));
};
const readIndex = () => JSON.parse(readFileSync(indexPath(), 'utf8'));

const fakeExporter = (
  output: unknown,
  { code = 0, tick }: { code?: number; tick?: () => void } = {},
) => {
  const calls: ExportRequest[] = [];
  const exporter: PhotosExporter = async (request) => {
    calls.push(request);
    writeFileSync(
      request.out,
      typeof output === 'string' ? output : JSON.stringify(output),
    );
    tick?.();
    return { code };
  };
  return { exporter, calls };
};

const run = (
  exporter: PhotosExporter,
  previous?: PhotosState,
  now: () => number = () => NOW,
) =>
  exportPhotos(root, {
    library: '/fixture/Photos Library.photoslibrary',
    from: FROM,
    exporter,
    previous,
    now,
    dryRun: false,
    log: () => undefined,
  });

describe('guardPhotoCount', () => {
  it('refuses an export below 90% of the previous count', () => {
    expect(guardPhotoCount(undefined, 0)).toBeUndefined();
    expect(guardPhotoCount(100, 90)).toBeUndefined();
    expect(guardPhotoCount(100, 89)).toBe(
      'export has 89 items, below 90% of the previous 100',
    );
  });
});

describe('mergeByUuid', () => {
  it('replaces items by uuid and appends new ones', () => {
    expect(
      mergeByUuid(items(3), [
        { uuid: 'U1', tag: 'v2' },
        { uuid: 'U9', tag: 'v2' },
      ]),
    ).toEqual([
      { uuid: 'U0', tag: 'v1' },
      { uuid: 'U1', tag: 'v2' },
      { uuid: 'U2', tag: 'v1' },
      { uuid: 'U9', tag: 'v2' },
    ]);
  });
});

describe('choosePhotosWindow', () => {
  const slow: PhotosState = {
    exportedAt: new Date(NOW - 60_000).toISOString(),
    count: 10,
    mode: 'full',
    fullExportedAt: new Date(NOW - 60_000).toISOString(),
    fullDurationMs: SLOW_FULL_EXPORT_MS + 1,
  };

  it('exports the whole window until a full export has been timed as slow', () => {
    expect(choosePhotosWindow(undefined, FROM, NOW)).toEqual({
      mode: 'full',
      fromDate: FROM,
    });
    expect(
      choosePhotosWindow(
        { ...slow, fullDurationMs: SLOW_FULL_EXPORT_MS },
        FROM,
        NOW,
      ).mode,
    ).toBe('full');
  });

  it('exports the last 30 days after a slow full export, and the whole window weekly', () => {
    expect(choosePhotosWindow(slow, FROM, NOW)).toEqual({
      mode: 'recent',
      fromDate: '2025-10-21',
    });
    expect(choosePhotosWindow(slow, '2025-11-01', NOW).fromDate).toBe(
      '2025-11-01',
    );
    expect(
      choosePhotosWindow(
        slow,
        FROM,
        Date.parse(slow.fullExportedAt as string) + FULL_EVERY_MS,
      ).mode,
    ).toBe('full');
    expect(choosePhotosWindow(slow, FROM, NOW, false).mode).toBe('full');
  });
});

describe('exportPhotos', () => {
  it('promotes a full export and records its duration', async () => {
    let clock = NOW;
    const { exporter, calls } = fakeExporter(items(5), {
      tick: () => (clock += 90_000),
    });
    const result = await run(exporter, undefined, () => clock);
    expect(calls).toEqual([
      {
        library: '/fixture/Photos Library.photoslibrary',
        fromDate: FROM,
        out: `${indexPath()}.new`,
      },
    ]);
    expect(result).toEqual({
      ok: true,
      state: {
        exportedAt: new Date(NOW + 90_000).toISOString(),
        count: 5,
        mode: 'full',
        fullExportedAt: new Date(NOW + 90_000).toISOString(),
        fullDurationMs: 90_000,
      },
    });
    expect(readIndex()).toEqual(items(5));
    expect(existsSync(`${indexPath()}.new`)).toBe(false);
  });

  it('keeps the old index when the export shrinks, fails or is not an array', async () => {
    writeIndex(items(10));
    expect(await run(fakeExporter(items(8)).exporter)).toEqual({
      ok: false,
      reason: 'export has 8 items, below 90% of the previous 10',
    });
    expect(await run(fakeExporter(items(10), { code: 1 }).exporter)).toEqual({
      ok: false,
      reason: 'export exited 1',
    });
    expect(await run(fakeExporter('{"not":"a list"}').exporter)).toEqual({
      ok: false,
      reason: 'export is not a JSON array',
    });
    expect(await run(async () => ({ code: null, error: 'ENOENT' }))).toEqual({
      ok: false,
      reason: 'could not start the export command (ENOENT)',
    });
    expect(readIndex()).toEqual(items(10));
  });

  it('after a full export over 15 minutes, merges the last 30 days by uuid', async () => {
    writeIndex(items(3));
    let clock = NOW;
    const slow = fakeExporter(items(4), {
      tick: () => (clock += SLOW_FULL_EXPORT_MS + 60_000),
    });
    const first = await run(slow.exporter, undefined, () => clock);
    if (!first.ok) throw new Error(first.reason);
    expect(first.state?.fullDurationMs).toBe(SLOW_FULL_EXPORT_MS + 60_000);

    clock += 24 * 60 * 60_000;
    const recent = fakeExporter([
      { uuid: 'U1', tag: 'v2' },
      { uuid: 'U7', tag: 'v2' },
    ]);
    const second = await run(recent.exporter, first.state, () => clock);
    expect(recent.calls[0]?.fromDate).toBe('2025-10-22');
    expect(second).toMatchObject({
      ok: true,
      state: {
        mode: 'recent',
        count: 5,
        fullExportedAt: first.state?.fullExportedAt,
      },
    });
    expect(readIndex()).toEqual([
      { uuid: 'U0', tag: 'v1' },
      { uuid: 'U1', tag: 'v2' },
      { uuid: 'U2', tag: 'v1' },
      { uuid: 'U3', tag: 'v1' },
      { uuid: 'U7', tag: 'v2' },
    ]);
    expect(existsSync(`${indexPath()}.new`)).toBe(false);

    clock += FULL_EVERY_MS;
    const weekly = fakeExporter(items(5));
    if (!second.ok) throw new Error(second.reason);
    await run(weekly.exporter, second.state, () => clock);
    expect(weekly.calls[0]?.fromDate).toBe(FROM);
  });

  it('runs nothing on a dry run', async () => {
    const { exporter, calls } = fakeExporter(items(1));
    const result = await exportPhotos(root, {
      library: '/fixture',
      from: FROM,
      exporter,
      previous: undefined,
      now: () => NOW,
      dryRun: true,
      log: () => undefined,
    });
    expect(result).toEqual({ ok: true, state: undefined });
    expect(calls).toEqual([]);
    expect(existsSync(join(root, 'photos'))).toBe(false);
  });
});
