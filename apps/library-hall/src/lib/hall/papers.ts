import { type HallBook } from '@/lib/items';

import { PAPERS_PER_ROW, PAPERS_ROWS } from './layout';

/** A paper on the stand: an article from the reading queue, under its site's name. */
export interface HallPaper {
  key: string;
  headline: string;
  masthead: string | null;
  /** The article's picture, same-origin, printed under the headline. */
  image?: string;
}

/** What the hall's newspaper stand shows: how many articles wait, and the first few. */
export interface HallPapers {
  total: number;
  papers: HallPaper[];
}

/** The stand for these books: the articles, in the order the rack gave them. */
export function papersOf(books: readonly HallBook[]): HallPapers {
  const articles = books.filter((book) => book.kind === 'article');
  return {
    total: articles.length,
    papers: articles.slice(0, PAPERS_ROWS * PAPERS_PER_ROW).map((book) => ({
      key: book.key,
      headline: book.title,
      masthead: book.groups.creator ?? book.subtitle,
      ...(book.cover ? { image: book.cover } : {}),
    })),
  };
}
