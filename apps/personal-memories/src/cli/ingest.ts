import {
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import {
  applyLineMigration,
  archiveLineExport,
  buildSearchDocs,
  collectLineUnits,
  IngestLockHeld,
  type IngestState,
  inputFingerprint,
  newestWinsChatEvents,
  parsePhotoIndex,
  parseSlackExport,
  planLineExport,
  planLineMigration,
  readIngestState,
  readLineManifest,
  STATE_FILE,
  withIngestLock,
} from '../lib/ingest/index.ts';
import type { Person } from '../lib/people.ts';
import {
  type Embedder,
  embedderFromEnv,
  EmbedError,
} from '../lib/server/embed.ts';
import {
  readSearchFiles,
  reuseVectors,
  searchDir,
  writeSearchFiles,
} from '../lib/server/search-files.ts';
import {
  mergeTimelines,
  type Timeline,
  type TimelineEvent,
  toTaipeiIso,
} from '../lib/server/timeline.ts';

type Log = (line: string) => void;

export function ingest(root: string, log: Log = console.log): Timeline {
  const lists: TimelineEvent[][] = [];

  const lineDir = join(root, 'line');
  if (existsSync(lineDir)) {
    for (const unit of collectLineUnits(lineDir)) {
      const { events, superseded } = newestWinsChatEvents(unit);
      log(
        unit.layout === 'flat'
          ? `line: ${events.length} events from ${unit.key}`
          : `line: ${events.length} events from ${unit.chat}/ (${unit.exports.length} exports` +
              `${superseded ? `, ${superseded} superseded by newer exports` : ''})`,
      );
      lists.push(events);
    }
  } else {
    log('line: no line/ directory, skipped');
  }

  const slackDir = join(root, 'slack');
  if (existsSync(slackDir)) {
    const { events, skipped } = parseSlackExport(slackDir);
    log(`slack: ${events.length} events, ${skipped} skipped`);
    lists.push(events);
  } else {
    log('slack: no slack/ directory, skipped');
  }

  const photoIndex = join(root, 'photos', 'index.json');
  if (existsSync(photoIndex)) {
    const {
      events,
      fromDerivative,
      fromOriginal,
      skippedNoMedia,
      skippedInvalid,
    } = parsePhotoIndex(JSON.parse(readFileSync(photoIndex, 'utf8')));
    log(
      `photos: ${events.length} events (${fromDerivative} from local derivatives, ` +
        `${fromOriginal} from local originals), ${skippedNoMedia} skipped with nothing local, ` +
        `${skippedInvalid} invalid`,
    );
    lists.push(events);
  } else {
    log('photos: no photos/index.json, skipped');
  }

  const timeline: Timeline = {
    generatedAt: toTaipeiIso(Date.now()),
    events: mergeTimelines(...lists),
  };
  const path = join(root, 'timeline.json');
  writeFileSync(`${path}.tmp`, `${JSON.stringify(timeline, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
  log(`timeline: ${timeline.events.length} events → ${path}`);
  return timeline;
}

const EMBED_BATCH = 64;

function readPeople(root: string, log: Log): Person[] {
  const path = join(root, 'people.json');
  if (!existsSync(path)) return [];
  try {
    const file = JSON.parse(readFileSync(path, 'utf8')) as {
      people?: Partial<Person>[];
    };
    return (file.people ?? [])
      .filter(
        (p): p is Person =>
          typeof p.id === 'string' && typeof p.name === 'string',
      )
      .map(({ id, name, aliases }) => ({ id, name, aliases: aliases ?? {} }));
  } catch {
    log('search: people.json could not be read; names stay as exported');
    return [];
  }
}

export async function buildIndex(
  root: string,
  timeline: Timeline,
  embedder: Embedder,
  log: Log = console.log,
): Promise<boolean> {
  const photos = timeline.events.filter((e) => e.source === 'photo');
  if (photos.length && photos.every((e) => !e.photo?.meta?.labels?.length))
    log(
      `photos: no labels in ${photos.length} photos — re-export with osxphotos 0.77.2`,
    );
  const docs = buildSearchDocs(timeline.events, readPeople(root, log));
  const header = {
    model: embedder.model,
    dims: embedder.dims,
    docs: docs.map(({ id, contentHash }) => ({ id, contentHash })),
  };
  const { vectors, missing } = reuseVectors(
    await readSearchFiles(root),
    header.docs,
    embedder.model,
    embedder.dims,
  );
  try {
    for (let i = 0; i < missing.length; i += EMBED_BATCH) {
      const rows = missing.slice(i, i + EMBED_BATCH);
      const out = await embedder.embed(
        rows.map((row) => docs[row]?.text ?? ''),
        'document',
      );
      rows.forEach((row, j) => {
        const vector = out[j];
        if (vector) vectors.set(vector, row * embedder.dims);
      });
    }
  } catch (error) {
    if (!(error instanceof EmbedError)) throw error;
    log(
      `search: embeddings skipped (${error.reason}: ${error.message}); lexical search still works`,
    );
    return false;
  }
  await writeSearchFiles(root, header, vectors);
  log(
    `search: ${docs.length} docs, ${missing.length} embedded → ${searchDir(root)}`,
  );
  return true;
}

function migrateLine(lineDir: string, dryRun: boolean, log: Log): void {
  const plan = planLineMigration(lineDir);
  if (plan.keptFlat.length)
    log(
      `line: ${plan.keptFlat.length} legacy exports stay flat because a chat folder of that name exists`,
    );
  if (plan.sharedHeaders)
    log(
      `line: ${plan.sharedHeaders} chat headers appear in more than one legacy export; ` +
        'a new export of those chats will be rejected as ambiguous',
    );
  if (!plan.moves.length) return;
  const chats = new Set(plan.moves.map((move) => move.entry.chat)).size;
  const events = plan.moves.reduce((n, move) => n + move.entry.events, 0);
  if (dryRun) {
    log(
      `line: would move ${plan.moves.length} legacy exports into ${chats} per-chat folders (${events} events)`,
    );
    return;
  }
  applyLineMigration(lineDir, plan);
  log(
    `line: moved ${plan.moves.length} legacy exports into ${chats} per-chat folders (${events} events); event ids unchanged`,
  );
}

function addLineExports(
  lineDir: string,
  paths: readonly string[],
  dryRun: boolean,
  log: Log,
): number {
  let rejected = 0;
  const manifest = readLineManifest(lineDir);
  for (const path of paths) {
    const input = {
      name: basename(path),
      bytes: readFileSync(path),
      mtimeMs: statSync(path).mtimeMs,
    };
    const plan = dryRun
      ? planLineExport(input, manifest)
      : archiveLineExport(lineDir, input);
    if (plan.kind === 'rejected') {
      rejected += 1;
      log(`line: rejected ${input.name}: ${plan.reason}`);
    } else if (plan.kind === 'duplicate') {
      log(`line: ${plan.hash.slice(0, 8)} is already archived; skipped`);
    } else {
      log(
        `line: ${dryRun ? 'would archive' : 'archived'} ${plan.entry.events} events as ` +
          `${plan.entry.file}${plan.newChat ? ' (new chat)' : ''}`,
      );
      if (dryRun) manifest.exports[plan.hash] = plan.entry;
    }
  }
  return rejected;
}

export type RunOptions = {
  add?: readonly string[];
  dryRun?: boolean;
  force?: boolean;
  embedder: Embedder;
  log?: Log;
};

export type RunResult = {
  status: 'ingested' | 'skipped' | 'dry-run';
  rejected: number;
};

export async function runIngest(
  root: string,
  {
    add = [],
    dryRun = false,
    force = false,
    embedder,
    log = console.log,
  }: RunOptions,
): Promise<RunResult> {
  const lineDir = join(root, 'line');
  migrateLine(lineDir, dryRun, log);
  const rejected = addLineExports(lineDir, add, dryRun, log);

  const fingerprint = inputFingerprint(root);
  const state = readIngestState(root);
  const unchanged =
    state?.fingerprint === fingerprint &&
    existsSync(join(root, 'timeline.json'));
  if (state && unchanged && !force) {
    log(
      `ingest: no input changed since ${state.completedAt}; skipped (--force rebuilds)`,
    );
    return { status: 'skipped', rejected };
  }
  if (dryRun) {
    log(
      `ingest: would rebuild timeline.json and the search index (${unchanged ? 'forced' : 'inputs changed'})`,
    );
    return { status: 'dry-run', rejected };
  }

  if (await buildIndex(root, ingest(root, log), embedder, log)) {
    const next: IngestState = {
      fingerprint,
      completedAt: toTaipeiIso(Date.now()),
    };
    writeFileSync(join(root, STATE_FILE), `${JSON.stringify(next)}\n`);
  }
  return { status: 'ingested', rejected };
}

if (import.meta.main) {
  const root = process.env['MEMORIES_DATA_DIR'];
  if (!root) {
    console.error(
      'MEMORIES_DATA_DIR is not set; point it at the data root outside the repository.',
    );
    process.exit(2);
  }
  const { values } = parseArgs({
    options: {
      add: { type: 'string', multiple: true },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
    },
  });
  const options: RunOptions = {
    add: (values.add ?? []).map((path) => resolve(path)),
    dryRun: values['dry-run'] ?? false,
    force: values.force ?? false,
    embedder: embedderFromEnv(),
  };
  try {
    const { rejected } = options.dryRun
      ? await runIngest(root, options)
      : await withIngestLock(root, () => runIngest(root, options));
    if (rejected) process.exitCode = 1;
  } catch (error) {
    if (!(error instanceof IngestLockHeld)) throw error;
    console.error(`ingest: ${error.message}`);
    process.exit(75);
  }
}
