import {
  makeEvent,
  type PhotoSignals,
  type TimelineEvent,
  type TimelineMedia,
  toTaipeiIso,
} from '../timeline.ts';

/** The subset of an `osxphotos query --json` item this parser reads. */
type OsxPhoto = {
  uuid?: string;
  date?: string;
  path?: string | null;
  path_edited?: string | null;
  path_derivatives?: string[] | null;
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
};

export type PhotoIndex = {
  events: TimelineEvent[];
  /** Items with no local original, edit or derivative. */
  skippedNoMedia: number;
  /** Items without a uuid or a parseable date. */
  skippedInvalid: number;
};

/**
 * Converts osxphotos metadata into photo events. Paths point into the Photos
 * library in place; nothing is copied or downloaded.
 */
export function parsePhotoIndex(items: unknown): PhotoIndex {
  const result: PhotoIndex = {
    events: [],
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

    const path = item.path_edited ?? item.path ?? item.path_derivatives?.[0];
    if (!path) {
      result.skippedNoMedia++;
      continue;
    }

    const media: TimelineMedia = { path };
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
    if (typeof item.score?.overall === 'number')
      photo.score = item.score.overall;

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
