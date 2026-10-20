import type { LibraryLocale } from './locale';

/** The hostname every collection is served under, one path zone per app. */
export const LIBRARY_HOST = 'library.rainforest.tools';
export const LIBRARY_ORIGIN = `https://${LIBRARY_HOST}`;

export const COLLECTION_IDS = [
  'hall',
  'books',
  'notebooks',
  'rack',
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
  colorToken: 'primary' | 'chart-2' | 'chart-3' | 'chart-4' | null;
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
