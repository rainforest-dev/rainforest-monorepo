import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import { toTaipeiIso } from '../server/timeline.ts';

export const OSXPHOTOS = ['uvx', 'osxphotos@0.77.2'] as const;
export const GUARD_RATIO = 0.9;
export const SLOW_FULL_EXPORT_MS = 15 * 60_000;
export const RECENT_DAYS = 30;
export const FULL_EVERY_MS = 7 * 24 * 60 * 60_000;

const DAY_MS = 24 * 60 * 60_000;

export type PhotosMode = 'full' | 'recent';

export type PhotosState = {
  exportedAt: string;
  count: number;
  mode: PhotosMode;
  fullExportedAt?: string;
  fullDurationMs?: number;
};

export type ExportRequest = { library: string; fromDate: string; out: string };

export type ExportOutcome = { code: number | null; error?: string };

export type PhotosExporter = (request: ExportRequest) => Promise<ExportOutcome>;

export const osxphotosArgs = ({ library, fromDate }: ExportRequest) => [
  'query',
  '--json',
  '--library',
  library,
  '--from-date',
  fromDate,
];

export const commandExporter =
  (command: readonly string[], log: (line: string) => void): PhotosExporter =>
  (request) =>
    new Promise((resolve) => {
      const [bin, ...prefix] = command;
      if (!bin) {
        resolve({ code: null, error: 'EMPTY_COMMAND' });
        return;
      }
      const out = openSync(request.out, 'w');
      let stderr = '';
      const child = spawn(bin, [...prefix, ...osxphotosArgs(request)], {
        stdio: ['ignore', out, 'pipe'],
      });
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk: string) => {
        stderr = (stderr + chunk).slice(-2000);
      });
      const finish = (outcome: ExportOutcome) => {
        closeSync(out);
        if (stderr.trim()) log(`photos: export stderr: ${stderr.trim()}`);
        resolve(outcome);
      };
      child.on('error', (error: NodeJS.ErrnoException) =>
        finish({ code: null, error: error.code ?? 'SPAWN_FAILED' }),
      );
      child.on('close', (code) => finish({ code }));
    });

export function choosePhotosWindow(
  previous: PhotosState | undefined,
  configuredFrom: string,
  now: number,
  hasIndex = true,
): { mode: PhotosMode; fromDate: string } {
  const full = { mode: 'full' as const, fromDate: configuredFrom };
  if (
    !hasIndex ||
    !previous?.fullExportedAt ||
    previous.fullDurationMs === undefined
  )
    return full;
  if (previous.fullDurationMs <= SLOW_FULL_EXPORT_MS) return full;
  if (now - Date.parse(previous.fullExportedAt) >= FULL_EVERY_MS) return full;
  const recent = toTaipeiIso(now - RECENT_DAYS * DAY_MS).slice(0, 10);
  return {
    mode: 'recent',
    fromDate: recent > configuredFrom ? recent : configuredFrom,
  };
}

export const guardPhotoCount = (
  previous: number | undefined,
  next: number,
): string | undefined =>
  previous !== undefined && next < previous * GUARD_RATIO
    ? `export has ${next} items, below ${GUARD_RATIO * 100}% of the previous ${previous}`
    : undefined;

const uuidOf = (item: unknown) =>
  item && typeof item === 'object' && 'uuid' in item
    ? (item as { uuid?: unknown }).uuid
    : undefined;

export function mergeByUuid(
  previous: readonly unknown[],
  recent: readonly unknown[],
): unknown[] {
  const merged = [...previous];
  const at = new Map<unknown, number>();
  merged.forEach((item, i) => {
    const uuid = uuidOf(item);
    if (typeof uuid === 'string') at.set(uuid, i);
  });
  for (const item of recent) {
    const uuid = uuidOf(item);
    const i = typeof uuid === 'string' ? at.get(uuid) : undefined;
    if (i === undefined) merged.push(item);
    else merged[i] = item;
  }
  return merged;
}

export type PhotosRunOptions = {
  library: string;
  from: string;
  exporter: PhotosExporter;
  previous: PhotosState | undefined;
  now: () => number;
  dryRun: boolean;
  log: (line: string) => void;
};

export type PhotosRunResult =
  { ok: true; state: PhotosState | undefined } | { ok: false; reason: string };

const readArray = (path: string): unknown[] | undefined => {
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export async function exportPhotos(
  root: string,
  { library, from, exporter, previous, now, dryRun, log }: PhotosRunOptions,
): Promise<PhotosRunResult> {
  const dir = join(root, 'photos');
  const index = join(dir, 'index.json');
  const next = `${index}.new`;
  const { mode, fromDate } = choosePhotosWindow(
    previous,
    from,
    now(),
    existsSync(index),
  );
  if (dryRun) {
    log(`photos: would run a ${mode} export from ${fromDate}`);
    return { ok: true, state: previous };
  }
  mkdirSync(dir, { recursive: true });

  const started = now();
  log(`photos: ${mode} export from ${fromDate}`);
  const outcome = await exporter({ library, fromDate, out: next });
  const durationMs = now() - started;
  if (outcome.error)
    return {
      ok: false,
      reason: `could not start the export command (${outcome.error})`,
    };
  if (outcome.code !== 0)
    return {
      ok: false,
      reason: `export exited ${outcome.code ?? 'by signal'}`,
    };
  const exported = readArray(next);
  if (!exported) return { ok: false, reason: 'export is not a JSON array' };

  const old = existsSync(index) ? readArray(index) : undefined;
  if (mode === 'recent' && !old)
    return { ok: false, reason: 'the previous index is not a JSON array' };
  const items =
    mode === 'recent' && old ? mergeByUuid(old, exported) : exported;
  const refused = guardPhotoCount(old?.length, items.length);
  if (refused) return { ok: false, reason: refused };

  if (mode === 'recent') {
    writeFileSync(`${index}.tmp`, JSON.stringify(items));
    renameSync(`${index}.tmp`, index);
    rmSync(next, { force: true });
  } else {
    renameSync(next, index);
  }

  const at = new Date(now()).toISOString();
  log(
    `photos: ${exported.length} exported in ${Math.round(durationMs / 1000)} s, ` +
      `${items.length} in the index`,
  );
  const state: PhotosState = { exportedAt: at, count: items.length, mode };
  if (mode === 'full') {
    state.fullExportedAt = at;
    state.fullDurationMs = durationMs;
    if (durationMs > SLOW_FULL_EXPORT_MS)
      log(
        `photos: the full export took over ${SLOW_FULL_EXPORT_MS / 60_000} min; ` +
          `nightly runs export the last ${RECENT_DAYS} days until the weekly full export`,
      );
  } else if (previous) {
    if (previous.fullExportedAt) state.fullExportedAt = previous.fullExportedAt;
    if (previous.fullDurationMs !== undefined)
      state.fullDurationMs = previous.fullDurationMs;
  }
  return { ok: true, state };
}
