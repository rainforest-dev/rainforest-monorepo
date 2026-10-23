import type { Translation } from '../translation';
import type { zh } from './zh';

export const en: Translation<typeof zh> = {
  brand: 'Rainforest Library',
  collections: 'Collections',
  search: {
    label: 'Search the whole library',
    placeholder: 'Search the library',
    results: 'Search results',
    loading: 'Searching…',
    error: 'Search is unavailable right now',
    empty: 'Nothing matches',
    missing: '{{names}} did not answer',
  },
  locale: {
    label: 'Language',
    switchTo: 'Switch to Chinese',
  },
  list: {
    separator: ', ',
  },
};
