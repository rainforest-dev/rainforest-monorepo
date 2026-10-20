import {
  isLibraryLocale,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import { type LibraryT, libraryT } from '@rainforest-dev/library-shell';
import { notFound } from 'next/navigation';

import { en } from './en';
import { zh } from './zh';

export const NOTEBOOK_NAMESPACE = 'notebook';

/** The notebook app's dictionaries, as `LibraryI18nProvider` and `libraryT` take them. */
export const NOTEBOOK_RESOURCES = {
  zh: { [NOTEBOOK_NAMESPACE]: zh },
  en: { [NOTEBOOK_NAMESPACE]: en },
};

/** A translator for server components, which cannot use `useLibraryT`. */
export function notebookT(locale: LibraryLocale): LibraryT {
  return libraryT(locale, NOTEBOOK_RESOURCES, NOTEBOOK_NAMESPACE);
}

/** The locale of a page under `app/[lang]`; any other segment is a 404. */
export async function pageLocale(
  params: Promise<{ lang: string }>,
): Promise<LibraryLocale> {
  const { lang } = await params;
  if (!isLibraryLocale(lang)) notFound();
  return lang;
}
