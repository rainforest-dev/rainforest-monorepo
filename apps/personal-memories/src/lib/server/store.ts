import { existsSync, readFileSync, type Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, isAbsolute, join } from 'node:path';

import { type CachedFile, cachedFile } from './file-cache.ts';
import type { Timeline, TimelineEvent } from './timeline.ts';

export type TimelineState =
  | { status: 'ready'; timeline: Timeline; byId: Map<string, TimelineEvent> }
  | { status: 'missing'; path: string | undefined };

export function dataDir(): string | undefined {
  return process.env['MEMORIES_DATA_DIR'] || undefined;
}

const timelinePath = (root: string | undefined) =>
  root && join(root, 'timeline.json');

export function parseTimeline(
  path: string | undefined,
  contents: string | undefined,
): TimelineState {
  if (contents === undefined) return { status: 'missing', path };
  const timeline = JSON.parse(contents) as Timeline;
  if (
    typeof timeline !== 'object' ||
    timeline === null ||
    !Array.isArray(timeline.events) ||
    !timeline.events.every((e) => typeof e?.id === 'string')
  )
    throw new Error('timeline.json has no events list');
  return {
    status: 'ready',
    timeline,
    byId: new Map(timeline.events.map((event) => [event.id, event])),
  };
}

export function loadTimeline(root: string | undefined): TimelineState {
  const path = timelinePath(root);
  return parseTimeline(
    path,
    path && existsSync(path) ? readFileSync(path, 'utf8') : undefined,
  );
}

let timelineFile: CachedFile<TimelineState> | undefined;

export function getTimeline(): Promise<TimelineState> {
  const path = timelinePath(dataDir());
  timelineFile ??= cachedFile(path, (contents) =>
    parseTimeline(path, contents),
  );
  return timelineFile.get();
}

const CONTENT_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
};

export function contentType(path: string): string {
  return (
    CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream'
  );
}

export const isVideo = (path: string) => contentType(path).startsWith('video/');

export async function localFile(path: string): Promise<Stats | undefined> {
  try {
    const stats = await stat(path);
    return stats.isFile() && stats.size > 0 ? stats : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the file behind an event's `index`th media entry. Photo paths are
 * absolute (the Photos library, read in place); Slack paths are relative to
 * the export under `<root>/slack`.
 */
export function mediaFile(
  state: TimelineState,
  root: string | undefined,
  id: string,
  index = 0,
): string | undefined {
  if (state.status !== 'ready' || !root) return undefined;
  const path = state.byId.get(id)?.media?.[index]?.path;
  if (!path) return undefined;
  return isAbsolute(path) ? path : join(root, 'slack', path);
}
