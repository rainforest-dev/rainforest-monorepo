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
    more: 'Search {{name}}',
    moreLabel: 'Search one collection',
    read: 'Read as {{terms}}',
    literal: 'Search the words as typed',
  },
  locale: {
    label: 'Language',
    switchTo: 'Switch to Chinese',
  },
  list: {
    separator: ', ',
  },
  breadcrumb: 'You are here',
  sidebar: {
    hide: 'Hide sidebar',
    show: 'Show sidebar',
  },
  notFound: {
    title: 'This page is not in the library',
    body: 'The link may be out of date or mistyped. Try the search above, or go back from here.',
    toCollection: 'Back to {{name}}',
    toHall: 'Back to the hall',
  },
};
