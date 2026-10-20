import type { LibraryT } from '@rainforest-dev/library-shell';

import { KB_PATH } from '@/lib/paths';

/** The two read-only shelves the knowledge base reads from the vault. */
export const KB_SOURCES = ['wiki', 'readwise'] as const;
export type KbSource = (typeof KB_SOURCES)[number];

/** A source's name, as the knowledge base's switcher and badges show it. */
export const kbSourceLabel = (source: KbSource, t: LibraryT): string =>
  t(`kb.source.${source}`);

/** One page of the knowledge base, without its body. */
export interface KbDoc {
  /** `wiki:<path>` or `readwise:<path>`, unique across both shelves. */
  id: string;
  source: KbSource;
  /** Path under its shelf's root, `/`-separated, without `.md`. */
  path: string;
  title: string;
  href: string;
  /** The wiki page's `wiki_tag`, or a Readwise document's `tags`. */
  tags: string[];
  /** The shelf it stands on inside its source, a key of {@link shelfLabel}. */
  shelf: string;
  /** `wiki_status` for wiki pages. */
  status?: string;
  /** `wiki_updated`, or a Readwise document's `updated`. */
  updated?: string;
  author?: string;
  /** The original article or book, for a Readwise document. */
  url?: string;
}

/** The wiki's shelves, in the order the knowledge base lists them. */
const WIKI_SHELF_ORDER = ['tech', 'domain', 'project', 'topic', 'query'];
const READWISE_SHELVES = [
  'articles',
  'books',
  'tweets',
  'podcasts',
  'supplementals',
];

/** A shelf's name; a shelf the knowledge base has no name for shows its id. */
export function shelfLabel(
  source: KbSource,
  shelf: string,
  t: LibraryT,
): string {
  const known = source === 'wiki' ? WIKI_SHELF_ORDER : READWISE_SHELVES;
  return known.includes(shelf) ? t(`kb.shelf.${shelf}`) : shelf;
}

/** Where a wiki page sits: its tag's namespace, `topic` for a bare tag, `query` for a `q-` page. */
export function wikiShelf(path: string, tag: string | undefined): string {
  if (path.startsWith('q-')) return 'query';
  const namespace = tag?.includes('/') ? tag.split('/')[0] : undefined;
  return namespace &&
    WIKI_SHELF_ORDER.includes(namespace) &&
    namespace !== 'topic'
    ? namespace
    : 'topic';
}

/** A Readwise document stands on its category folder's shelf. */
export function readwiseShelf(path: string): string {
  return path.includes('/') ? path.split('/')[0] : 'other';
}

const encodePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

export const KB_PAGES_PATH = `${KB_PATH}/pages`;
export const KB_READWISE_PATH = `${KB_PATH}/readwise`;

export function kbDocHref(source: KbSource, path: string): string {
  return `${source === 'wiki' ? KB_PAGES_PATH : KB_READWISE_PATH}/${encodePath(path)}`;
}

export const kbDocId = (source: KbSource, path: string): string =>
  `${source}:${path}`;

export interface KbShelf {
  id: string;
  label: string;
  docs: KbDoc[];
}

/** One source's documents as shelves: wiki in namespace order, Readwise by category. */
export function kbShelves(
  docs: readonly KbDoc[],
  source: KbSource,
  t: LibraryT,
): KbShelf[] {
  const byShelf = new Map<string, KbDoc[]>();
  for (const doc of docs) {
    if (doc.source !== source) continue;
    const shelf = byShelf.get(doc.shelf) ?? [];
    shelf.push(doc);
    byShelf.set(doc.shelf, shelf);
  }
  const rank = (id: string) => {
    const i = WIKI_SHELF_ORDER.indexOf(id);
    return i === -1 ? WIKI_SHELF_ORDER.length : i;
  };
  return [...byShelf.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([id, shelfDocs]) => ({
      id,
      label: shelfLabel(source, id, t),
      docs: [...shelfDocs].sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

export function kbCounts(docs: readonly KbDoc[]): Record<KbSource, number> {
  const counts: Record<KbSource, number> = { wiki: 0, readwise: 0 };
  for (const doc of docs) counts[doc.source]++;
  return counts;
}

export function parseKbSource(value: string | null): KbSource {
  return value === 'readwise' ? 'readwise' : 'wiki';
}
