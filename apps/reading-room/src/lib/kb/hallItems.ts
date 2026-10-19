import { type HallItem } from '@rainforest-dev/library-contract';

import { type KbDoc } from './model';

/**
 * Spine colours for the hall, which needs hex: shades around the knowledge base's `chart-3`,
 * the wiki darker than Readwise.
 */
const SOURCE_COLORS: Record<KbDoc['source'], string> = {
  wiki: '#8b4a70',
  readwise: '#b97a9c',
};

/** The knowledge base's shelf for the hall: every visible page, linked to itself. */
export function kbHallItems(docs: readonly KbDoc[]): HallItem[] {
  return docs.map((doc) => ({
    kind: 'kb',
    id: doc.id,
    title: doc.title,
    color: SOURCE_COLORS[doc.source],
    groups: [
      `source:${doc.source}`,
      `shelf:${doc.shelf}`,
      ...(doc.status ? [`status:${doc.status}`] : []),
      ...doc.tags.map((tag) => `tag:${tag}`),
    ],
    href: doc.href,
  }));
}
