import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import {
  buildSearchDocs,
  parseLineChat,
  parsePhotoIndex,
  parseSlackExport,
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

export function ingest(
  root: string,
  log: (line: string) => void = console.log,
): Timeline {
  const lists: TimelineEvent[][] = [];

  const lineDir = join(root, 'line');
  if (existsSync(lineDir)) {
    for (const file of readdirSync(lineDir)
      .filter((f) => f.endsWith('.txt'))
      .sort()) {
      const { events } = parseLineChat(
        readFileSync(join(lineDir, file), 'utf8'),
      );
      log(`line: ${events.length} events from ${file}`);
      const chat = file.replace(/\.txt$/, '');
      lists.push(events.map((event) => ({ ...event, chat })));
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
  writeFileSync(
    join(root, 'timeline.json'),
    `${JSON.stringify(timeline, null, 2)}\n`,
  );
  log(
    `timeline: ${timeline.events.length} events → ${join(root, 'timeline.json')}`,
  );
  return timeline;
}

const EMBED_BATCH = 64;

function readPeople(root: string, log: (line: string) => void): Person[] {
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
  log: (line: string) => void = console.log,
): Promise<void> {
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
      `search: embeddings skipped (${error.reason}); lexical search still works`,
    );
    return;
  }
  await writeSearchFiles(root, header, vectors);
  log(
    `search: ${docs.length} docs, ${missing.length} embedded → ${searchDir(root)}`,
  );
}

if (import.meta.main) {
  const root = process.env['MEMORIES_DATA_DIR'];
  if (!root) {
    console.error(
      'MEMORIES_DATA_DIR is not set; point it at the data root outside the repository.',
    );
    process.exit(2);
  }
  await buildIndex(root, ingest(root), embedderFromEnv());
}
