import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseLineChat } from '../lib/ingest/line.ts';
import { parsePhotoIndex } from '../lib/ingest/photos.ts';
import { parseSlackExport } from '../lib/ingest/slack.ts';
import {
  mergeTimelines,
  type Timeline,
  type TimelineEvent,
  toTaipeiIso,
} from '../lib/timeline.ts';

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
    const { events, skippedNoMedia, skippedInvalid } = parsePhotoIndex(
      JSON.parse(readFileSync(photoIndex, 'utf8')),
    );
    log(
      `photos: ${events.length} events, ${skippedNoMedia} without local media, ` +
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

if (import.meta.main) {
  const root = process.env['MEMORIES_DATA_DIR'];
  if (!root) {
    console.error(
      'MEMORIES_DATA_DIR is not set; point it at the data root outside the repository.',
    );
    process.exit(2);
  }
  ingest(root);
}
