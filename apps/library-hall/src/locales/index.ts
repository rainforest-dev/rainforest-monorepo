import type { LibraryLocale } from '@rainforest-dev/library-contract';

import { en } from './en';
import { zh } from './zh';

export const HALL_NAMESPACE = 'hall';

/** The hall's dictionaries, as `LibraryI18nProvider` and `libraryT` take them. */
export const HALL_RESOURCES = {
  zh: { [HALL_NAMESPACE]: zh },
  en: { [HALL_NAMESPACE]: en },
};

/** The hall's strings in `locale`, for code that builds labels outside React. */
export function hallMessages(locale: LibraryLocale): typeof zh {
  return locale === 'en' ? en : zh;
}
