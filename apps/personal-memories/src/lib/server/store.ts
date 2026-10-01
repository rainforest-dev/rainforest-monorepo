import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join } from 'node:path';

import type { Timeline, TimelineEvent } from './timeline.ts';

export type TimelineState =
  | { status: 'ready'; timeline: Timeline; byId: Map<string, TimelineEvent> }
  | { status: 'missing'; path: string | undefined };

let cached: TimelineState | undefined;

export function dataDir(): string | undefined {
  return process.env['MEMORIES_DATA_DIR'] || undefined;
}

export function loadTimeline(root: string | undefined): TimelineState {
  const path = root && join(root, 'timeline.json');
  if (!path || !existsSync(path)) return { status: 'missing', path };
  const timeline = JSON.parse(readFileSync(path, 'utf8')) as Timeline;
  return {
    status: 'ready',
    timeline,
    byId: new Map(timeline.events.map((event) => [event.id, event])),
  };
}

/** Reads `<MEMORIES_DATA_DIR>/timeline.json` once per process. */
export function getTimeline(): TimelineState {
  const state = (cached ??= loadTimeline(dataDir()));
  // A missing file is retried so running `ingest` needs no restart.
  if (state.status === 'missing') cached = undefined;
  return state;
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
