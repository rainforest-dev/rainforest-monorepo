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

/** Who wrote a wiki page: the wiki is the owner's own synthesis. */
export const WIKI_AUTHOR = 'Rainforest';

const authorGroup = (doc: KbDoc): string[] => {
  const author = doc.source === 'wiki' ? WIKI_AUTHOR : doc.author?.trim();
  return author ? [`author:${author}`] : [];
};

/**
 * The knowledge base's shelf for the hall: every visible page, linked to itself. A Readwise
 * document's author is its writer's; the month is when the page was last updated.
 */
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
      ...authorGroup(doc),
      ...(/^\d{4}-\d{2}/.test(doc.updated ?? '')
        ? [`month:${doc.updated?.slice(0, 7)}`]
        : []),
    ],
    href: doc.href,
  }));
}
