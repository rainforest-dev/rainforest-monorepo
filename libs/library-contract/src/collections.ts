import type { LibraryLocale } from './locale';

/** The hostname every collection is served under, one path zone per app. */
export const LIBRARY_HOST = 'library.rainforest.tools';
export const LIBRARY_ORIGIN = `https://${LIBRARY_HOST}`;

export const COLLECTION_IDS = [
  'hall',
  'books',
  'notebooks',
  'rack',
  'magazines',
  'kb',
] as const;
export type CollectionId = (typeof COLLECTION_IDS)[number];

export interface Collection {
  id: CollectionId;
  /** Shown in the shell's collection switcher, in each locale. */
  labels: Record<LibraryLocale, string>;
  /** Where the collection is mounted. The hall owns the root. */
  basePath: string;
  /** Extra paths the same app answers under the shared hostname. */
  aliases: readonly string[];
  /** The app that serves the collection. */
  app: string;
  /** Seed-theme token for spines, badges and legends; `null` for the hall. */
  colorToken: 'primary' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5' | null;
  /** Second key of the `G` then key shortcut. */
  shortcut: string;
}

export const COLLECTIONS: readonly Collection[] = [
  {
    id: 'hall',
    labels: { zh: '大廳', en: 'Hall' },
    basePath: '/',
    aliases: ['/hall-next'],
    app: 'library-hall',
    colorToken: null,
    shortcut: 'h',
  },
  {
    id: 'books',
    labels: { zh: '書', en: 'Books' },
    basePath: '/books',
    aliases: ['/opds'],
    app: 'personal-calibre',
    colorToken: 'primary',
    shortcut: 'b',
  },
  {
    id: 'notebooks',
    labels: { zh: '筆記本', en: 'Notebooks' },
    basePath: '/notebooks',
    aliases: [],
    app: 'personal-notebook',
    colorToken: 'chart-4',
    shortcut: 'n',
  },
  {
    id: 'rack',
    labels: { zh: '報架', en: 'Rack' },
    basePath: '/rack',
    aliases: [],
    app: 'reading-room',
    colorToken: 'chart-2',
    shortcut: 'r',
  },
  {
    // The rack's events, kept on their own shelf: the reading room serves both.
    id: 'magazines',
    labels: { zh: '雜誌架', en: 'Magazines' },
    basePath: '/rack/events',
    aliases: [],
    app: 'reading-room',
    colorToken: 'chart-5',
    shortcut: 'm',
  },
  {
    id: 'kb',
    labels: { zh: '知識庫', en: 'Knowledge' },
    basePath: '/kb',
    aliases: [],
    app: 'reading-room',
    colorToken: 'chart-3',
    shortcut: 'k',
  },
];

export function getCollection(id: CollectionId): Collection {
  const found = COLLECTIONS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown collection: ${id}`);
  return found;
}

/** A collection's name in `locale`. */
export function collectionLabel(
  collection: Collection | CollectionId,
  locale: LibraryLocale,
): string {
  const found =
    typeof collection === 'string' ? getCollection(collection) : collection;
  return found.labels[locale];
}

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * The collection a pathname belongs to, by the longest matching mount. Every path that no
 * other collection claims falls to the hall, which owns `/`.
 */
export function collectionForPath(pathname: string): Collection {
  let best: Collection = getCollection('hall');
  let bestLength = 0;
  for (const collection of COLLECTIONS) {
    for (const prefix of [collection.basePath, ...collection.aliases]) {
      if (prefix === '/') continue;
      if (underPrefix(pathname, prefix) && prefix.length > bestLength) {
        best = collection;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

/** Whether a link between two collections stays inside one app and may use client routing. */
export function isSameApp(from: CollectionId, to: CollectionId): boolean {
  return getCollection(from).app === getCollection(to).app;
}

/** The library's own name, in each locale. Every page title ends with it. */
export const LIBRARY_NAMES: Record<LibraryLocale, string> = {
  zh: 'Rainforest 圖書館',
  en: 'Rainforest Library',
};

const TITLE_SEPARATOR = ' · ';

/**
 * A page's document title, from the narrowest name to the widest: the page, its collection,
 * then the library. A collection's front page passes no `page`, and the hall has no collection
 * part, so its title is the library's name alone.
 */
export function pageTitle(
  locale: LibraryLocale,
  collection: CollectionId,
  page?: string,
): string {
  return [
    page,
    collection === 'hall' ? undefined : collectionLabel(collection, locale),
    LIBRARY_NAMES[locale],
  ]
    .filter((part): part is string => Boolean(part))
    .join(TITLE_SEPARATOR);
}

/**
 * The same titles as a Next.js title template, for a collection's root layout: its front page
 * gets `default`, and a page that sets its own title gets that title in front of it.
 */
export function pageTitleTemplate(
  locale: LibraryLocale,
  collection: CollectionId,
): { default: string; template: string } {
  const own = pageTitle(locale, collection);
  return { default: own, template: `%s${TITLE_SEPARATOR}${own}` };
}
