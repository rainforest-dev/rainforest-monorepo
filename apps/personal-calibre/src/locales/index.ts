import {
  isLibraryLocale,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import { type LibraryT, libraryT } from '@rainforest-dev/library-shell';
import { notFound } from 'next/navigation';

import { en } from './en';
import { zh } from './zh';

export const CALIBRE_NAMESPACE = 'calibre';

/** Calibre's dictionaries, as `LibraryI18nProvider` and `libraryT` take them. */
export const CALIBRE_RESOURCES = {
  zh: { [CALIBRE_NAMESPACE]: zh },
  en: { [CALIBRE_NAMESPACE]: en },
};

/** A translator for server components, which cannot use `useLibraryT`. */
export function calibreT(locale: LibraryLocale): LibraryT {
  return libraryT(locale, CALIBRE_RESOURCES, CALIBRE_NAMESPACE);
}

/** The locale of a page under `app/[lang]`; any other segment is a 404. */
export async function pageLocale(
  params: Promise<{ lang: string }>,
): Promise<LibraryLocale> {
  const { lang } = await params;
  if (!isLibraryLocale(lang)) notFound();
  return lang;
}
