import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import {
  commandExporter,
  downloadFromICloud,
  exportPhotos,
  hashFile,
  IngestLockHeld,
  inputFingerprint,
  isDataless,
  listInbox,
  moveToRejected,
  OSXPHOTOS,
  type PhotosExporter,
  type PhotosState,
  planInbox,
  sha256,
  withIngestLock,
} from '../lib/ingest/index.ts';
import { type Embedder, embedderFromEnv } from '../lib/server/embed.ts';
import { type AddedExport, runIngest } from './ingest.ts';

type Log = (line: string) => void;

export const STATE_PATH = join('auto-import', 'state.json');
export const FAILURE_EVENT = 'memories_import_failed';

export type LineCounts = {
  archived: number;
  duplicates: number;
  rejected: number;
  pending: number;
};

export type AutoImportState = {
  lastRunAt: string;
  lastSuccessAt?: string;
  ok: boolean;
  fingerprint: string;
  photos?: PhotosState;
  line: LineCounts;
  failures: string[];
};

export type AutoImportOptions = {
  dropDir: string;
  only?: 'line' | 'photos';
  dryRun?: boolean;
  photos: { library: string; from?: string; exporter: PhotosExporter };
  embedder: Embedder;
  webhook?: string;
  now?: () => number;
  log?: Log;
  dataless?: (path: string) => boolean;
  download?: (path: string) => string | undefined;
  post?: typeof fetch;
};

export type AutoImportResult = {
  status: 'done' | 'failed' | 'busy' | 'dry-run';
  failures: string[];
};

export function readAutoImportState(root: string): AutoImportState | undefined {
  try {
    const state = JSON.parse(
      readFileSync(join(root, STATE_PATH), 'utf8'),
    ) as AutoImportState;
    return typeof state.lastRunAt === 'string' ? state : undefined;
  } catch {
    return undefined;
  }
}

const writeState = (root: string, state: AutoImportState) => {
  const path = join(root, STATE_PATH);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(`${path}.tmp`, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
};

const errorClass = (error: unknown) => {
  if (!(error instanceof Error)) return 'unknown error';
  const code = (error as NodeJS.ErrnoException).code;
  return code ? `${error.name} (${code})` : error.name;
};

async function notify(
  url: string | undefined,
  failures: readonly string[],
  ts: string,
  post: typeof fetch,
  log: Log,
): Promise<void> {
  if (!url) {
    log(
      'notify: MEMORIES_IMPORT_WEBHOOK is not set; failures are only in this log',
    );
    return;
  }
  for (const detail of failures) {
    try {
      const response = await post(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: FAILURE_EVENT, detail, ts }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) log(`notify: webhook answered ${response.status}`);
    } catch (error) {
      log(`notify: webhook unreachable (${errorClass(error)})`);
    }
  }
}

async function run(
  root: string,
  options: AutoImportOptions,
): Promise<AutoImportResult> {
  const {
    dropDir,
    only,
    dryRun = false,
    embedder,
    now = Date.now,
    log = console.log,
    dataless = isDataless,
    download = downloadFromICloud,
  } = options;
  const lastRunAt = new Date(now()).toISOString();
  const previous = readAutoImportState(root);
  const failures: string[] = [];
  const fail = (detail: string) => {
    failures.push(detail);
    log(`failed: ${detail}`);
  };
  const line: LineCounts = {
    archived: 0,
    duplicates: 0,
    rejected: 0,
    pending: 0,
  };

  const reject = async (
    path: string,
    name: string,
    reason: string,
    hash?: string,
  ) => {
    line.rejected += 1;
    const isFile = statSync(path).isFile();
    const hash8 = (
      hash ?? (isFile ? await hashFile(path) : sha256(name))
    ).slice(0, 8);
    if (dryRun) {
      log(`line: would move ${name} to rejected/ (${reason})`);
      return;
    }
    moveToRejected(dropDir, path, name, reason, hash8);
    fail(`line: rejected ${isFile ? 'file' : 'folder'} ${hash8}: ${reason}`);
  };

  const ready: string[] = [];
  const scanInbox = async () => {
    for (const entry of planInbox(
      dropDir,
      listInbox(dropDir, dataless),
      now(),
    )) {
      if (entry.kind === 'ready') {
        ready.push(entry.path);
      } else if (entry.kind === 'placeholder') {
        line.pending += 1;
        const error = dryRun ? undefined : download(entry.download);
        const outcome = dryRun
          ? 'would request a download'
          : error
            ? `download request failed (${error})`
            : 'download requested';
        log(`line: ${entry.name} is still in iCloud; ${outcome}`);
      } else if (entry.kind === 'settling') {
        line.pending += 1;
        log(`line: ${entry.name} changed in the last few seconds; next run`);
      } else {
        await reject(entry.path, entry.name, entry.reason);
      }
    }
  };
  if (only !== 'photos') {
    if (!existsSync(dropDir)) fail('line: drop folder not found');
    else
      try {
        await scanInbox();
      } catch (error) {
        fail(`line: ${errorClass(error)} while reading the drop folder`);
      }
  }

  let photos = previous?.photos;
  if (only !== 'line') {
    const { library, from, exporter } = options.photos;
    if (!from) {
      fail('photos: MEMORIES_PHOTOS_FROM is not set');
    } else {
      try {
        const result = await exportPhotos(root, {
          library,
          from,
          exporter,
          previous: photos,
          now,
          dryRun,
          log,
        });
        if (result.ok) photos = result.state;
        else fail(`photos: ${result.reason}; kept the previous index`);
      } catch (error) {
        fail(`photos: ${errorClass(error)}; kept the previous index`);
      }
    }
  }

  let added: AddedExport[] = [];
  try {
    ({ added } = await runIngest(root, { add: ready, dryRun, embedder, log }));
  } catch (error) {
    fail(`ingest: ${errorClass(error)}`);
  }
  for (const { path, plan } of added) {
    const name = basename(path);
    if (plan.kind === 'rejected') {
      await reject(path, name, plan.reason, sha256(readFileSync(path)));
      continue;
    }
    if (plan.kind === 'archive') line.archived += 1;
    else line.duplicates += 1;
    if (!dryRun) rmSync(path, { force: true });
  }

  if (dryRun) return { status: 'dry-run', failures };

  const ok = failures.length === 0;
  const state: AutoImportState = {
    lastRunAt,
    ok,
    fingerprint: inputFingerprint(root),
    line,
    failures,
  };
  const lastSuccessAt = ok ? lastRunAt : previous?.lastSuccessAt;
  if (lastSuccessAt) state.lastSuccessAt = lastSuccessAt;
  if (photos) state.photos = photos;
  writeState(root, state);
  log(
    `auto-import: ${ok ? 'done' : `${failures.length} failures`}; ` +
      `line ${line.archived} archived, ${line.duplicates} duplicates, ` +
      `${line.rejected} rejected, ${line.pending} pending`,
  );
  if (!ok)
    await notify(
      options.webhook,
      failures,
      lastRunAt,
      options.post ?? fetch,
      log,
    );
  return { status: ok ? 'done' : 'failed', failures };
}

export async function runAutoImport(
  root: string,
  options: AutoImportOptions,
): Promise<AutoImportResult> {
  const log = options.log ?? console.log;
  if (options.dryRun) return run(root, options);
  try {
    return await withIngestLock(root, () => run(root, options));
  } catch (error) {
    if (!(error instanceof IngestLockHeld)) throw error;
    log(`busy: ${error.message}`);
    return { status: 'busy', failures: [] };
  }
}

export const DEFAULT_DROP_DIR = join(
  homedir(),
  'Library',
  'Mobile Documents',
  'com~apple~CloudDocs',
  'Memories Inbox',
);

export const DEFAULT_PHOTOS_LIBRARY = join(
  homedir(),
  'Pictures',
  'Photos Library.photoslibrary',
);

if (import.meta.main) {
  const env = process.env;
  const root = env['MEMORIES_DATA_DIR'];
  if (!root) {
    console.error(
      'MEMORIES_DATA_DIR is not set; point it at the data root outside the repository.',
    );
    process.exit(2);
  }
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean' },
      only: { type: 'string' },
    },
  });
  if (values.only !== undefined && !['line', 'photos'].includes(values.only)) {
    console.error('--only takes line or photos');
    process.exit(2);
  }
  const log: Log = (line) => console.log(`${new Date().toISOString()} ${line}`);
  const command = env['MEMORIES_PHOTOS_CMD'];
  const options: AutoImportOptions = {
    dropDir: env['MEMORIES_DROP_DIR'] || DEFAULT_DROP_DIR,
    dryRun: values['dry-run'] ?? false,
    photos: {
      library: env['MEMORIES_PHOTOS_LIBRARY'] || DEFAULT_PHOTOS_LIBRARY,
      exporter: commandExporter(command ? [command] : OSXPHOTOS, log),
    },
    embedder: embedderFromEnv(),
    log,
  };
  if (values.only) options.only = values.only as 'line' | 'photos';
  if (env['MEMORIES_PHOTOS_FROM'])
    options.photos.from = env['MEMORIES_PHOTOS_FROM'];
  if (env['MEMORIES_IMPORT_WEBHOOK'])
    options.webhook = env['MEMORIES_IMPORT_WEBHOOK'];
  const { status } = await runAutoImport(root, options);
  if (status === 'failed') process.exitCode = 1;
}
