import { makeEvent, type TimelineEvent, toTaipeiIso } from '../timeline.ts';

/** The subset of an `osxphotos query --json` item this parser reads. */
type OsxPhoto = {
  uuid?: string;
  date?: string;
  path?: string | null;
  path_edited?: string | null;
  path_derivatives?: string[] | null;
  albums?: string[] | null;
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

    result.events.push(
      makeEvent({
        id: item.uuid,
        source: 'photo',
        at: toTaipeiIso(time),
        author: 'photo',
        text: item.albums?.length ? item.albums.join(', ') : undefined,
        media: [{ path }],
      }),
    );
  }

  return result;
}
