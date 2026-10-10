import { statSync } from 'node:fs';

// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import {
  makeEvent,
  type PhotoMeta,
  type PhotoSignals,
  type TimelineEvent,
  type TimelineMedia,
  toTaipeiIso,
} from '../server/timeline.ts';

/** The subset of an `osxphotos query --json` item this parser reads. */
type OsxPhoto = {
  uuid?: string;
  date?: string;
  path?: string | null;
  path_edited?: string | null;
  path_derivatives?: string[] | null;
  ismissing?: boolean | null;
  albums?: string[] | null;
  width?: number | null;
  height?: number | null;
  favorite?: boolean | null;
  score?: { overall?: number | null } | null;
  persons?: string[] | null;
  screenshot?: boolean | null;
  ismovie?: boolean | null;
  burst?: boolean | null;
  burst_selected?: boolean | null;
  exif_info?: { camera_model?: string | null } | null;
  place?: { name?: string | null } | null;
  search_info?: {
    labels?: string[] | null;
    detected_text?: string[] | null;
    venues?: string[] | null;
  } | null;
};

const UNKNOWN_PERSON = '_UNKNOWN_';

const nonEmpty = (list: string[] | null | undefined) => {
  const kept = (list ?? []).filter((s) => typeof s === 'string' && s.trim());
  return kept.length ? kept : undefined;
};

function photoMeta(item: OsxPhoto): PhotoMeta | undefined {
  const meta: PhotoMeta = {};
  const labels = nonEmpty(item.search_info?.labels);
  const text = nonEmpty(item.search_info?.detected_text);
  const venues = nonEmpty(item.search_info?.venues);
  const persons = nonEmpty(
    item.persons?.filter((name) => name !== UNKNOWN_PERSON),
  );
  const place = item.place?.name?.trim();
  if (labels) meta.labels = labels;
  if (text) meta.text = text;
  if (venues) meta.venues = venues;
  if (place) meta.place = place;
  if (persons) meta.persons = persons;
  return Object.keys(meta).length ? meta : undefined;
}

export type LocalSize = (path: string) => number | undefined;

export const diskSize: LocalSize = (path) => {
  try {
    const stat = statSync(path);
    return stat.isFile() && stat.size > 0 ? stat.size : undefined;
  } catch {
    return undefined;
  }
};

export type LocalMedia = {
  path: string;
  from: 'derivative' | 'original';
  poster?: string;
};

// iCloud "Optimize Mac Storage" leaves originals cloud-only while Photos keeps JPEG derivatives on disk.
export function resolvePhotoMedia(
  item: OsxPhoto,
  size: LocalSize = diskSize,
): LocalMedia | undefined {
  const derivative = (item.path_derivatives ?? [])
    .map((path) => ({ path, bytes: size(path) }))
    .filter((d): d is { path: string; bytes: number } => d.bytes !== undefined)
    .sort((a, b) => b.bytes - a.bytes)[0]?.path;
  const originals = [item.path_edited, item.path].filter(
    (p): p is string => !!p,
  );
  const original =
    item.ismissing === true
      ? undefined
      : originals.find((p) => size(p) !== undefined);

  if (item.ismovie === true && original)
    return derivative
      ? { path: original, from: 'original', poster: derivative }
      : { path: original, from: 'original' };
  if (derivative) return { path: derivative, from: 'derivative' };
  if (original) return { path: original, from: 'original' };
  return undefined;
}

export type PhotoIndex = {
  events: TimelineEvent[];
  fromOriginal: number;
  fromDerivative: number;
  /** Items with no local original, edit or derivative. */
  skippedNoMedia: number;
  /** Items without a uuid or a parseable date. */
  skippedInvalid: number;
};

/**
 * Converts osxphotos metadata into photo events. Paths point into the Photos
 * library in place; nothing is copied or downloaded.
 */
export function parsePhotoIndex(
  items: unknown,
  size: LocalSize = diskSize,
): PhotoIndex {
  const result: PhotoIndex = {
    events: [],
    fromOriginal: 0,
    fromDerivative: 0,
    skippedNoMedia: 0,
    skippedInvalid: 0,
  };
  if (!Array.isArray(items)) return result;

  for (const item of items as OsxPhoto[]) {
    const time = item.date ? Date.parse(item.date) : NaN;
    if (!item.uuid || Number.isNaN(time)) {
      result.skippedInvalid++;
      continue;
    }

    const local = resolvePhotoMedia(item, size);
    if (!local) {
      result.skippedNoMedia++;
      continue;
    }
    if (local.from === 'original') result.fromOriginal++;
    else result.fromDerivative++;

    const media: TimelineMedia = { path: local.path };
    if (local.poster) media.poster = local.poster;
    if (item.width && item.height) {
      media.width = item.width;
      media.height = item.height;
    }
    const photo: PhotoSignals = {
      favorite: item.favorite === true,
      people: item.persons?.length ?? 0,
      screenshot: item.screenshot === true,
      movie: item.ismovie === true,
      burstPick: item.burst !== true || item.burst_selected === true,
    };
    const camera = item.exif_info?.camera_model?.replace(/\s+/g, ' ').trim();
    if (camera) photo.camera = camera;
    if (typeof item.score?.overall === 'number')
      photo.score = item.score.overall;
    const meta = photoMeta(item);
    if (meta) photo.meta = meta;

    result.events.push(
      makeEvent({
        id: item.uuid,
        source: 'photo',
        at: toTaipeiIso(time),
        author: 'photo',
        text: item.albums?.length ? item.albums.join(', ') : undefined,
        media: [media],
        photo,
      }),
    );
  }

  return result;
}
