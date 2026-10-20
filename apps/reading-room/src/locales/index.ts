import { type LibraryLocale } from '@rainforest-dev/library-contract';
import { type LibraryT, libraryT } from '@rainforest-dev/library-shell';

import { en } from './en.js';
import { zh } from './zh.js';

export const ROOM_NAMESPACE = 'room';

/** The reading room's dictionaries, as `LibraryI18nProvider` and `libraryT` take them. */
export const ROOM_RESOURCES = {
  zh: { [ROOM_NAMESPACE]: zh },
  en: { [ROOM_NAMESPACE]: en },
};

/** A translator for Astro pages and plain functions, which cannot use `useLibraryT`. */
export function roomT(locale: LibraryLocale): LibraryT {
  return libraryT(locale, ROOM_RESOURCES, ROOM_NAMESPACE);
}
