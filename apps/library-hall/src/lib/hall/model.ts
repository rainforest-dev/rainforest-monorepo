import {
  COLLECTION_OF_KIND,
  type CollectionId,
  HALL_ITEM_KINDS,
  type HallItemKind,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';

import { type HallBook, type HallGroupBy, kindLabel } from '@/lib/items';
import { hallMessages } from '@/locales';

export type BookcaseKind = 'group' | 'none' | 'other' | 'all';

export interface Bookcase {
  key: string;
  label: string;
  kind: BookcaseKind;
  /** The collection whose wing of the hall the case stands in. */
  wing: CollectionId;
  bookIds: number[];
}

/** One row of the hall per collection, so no collection can crowd another off the floor. */
export interface Wing {
  id: CollectionId;
  kind: HallItemKind;
  label: string;
  cases: Bookcase[];
}

/** A wing holds one row of cases; past this the smallest groups in it share one "other" case. */
export const CASES_PER_WING = 4;

function compare(a: Bookcase, b: Bookcase, groupBy: HallGroupBy): number {
  if (a.kind === 'none') return 1;
  if (b.kind === 'none') return -1;
  // Months read as a timeline, newest first; everything else biggest first.
  if (groupBy === 'month') return b.label.localeCompare(a.label);
  return b.bookIds.length - a.bookIds.length || a.label.localeCompare(b.label);
}

function wingCases(
  books: readonly HallBook[],
  kind: HallItemKind,
  groupBy: HallGroupBy,
  locale: LibraryLocale,
  max: number,
): Bookcase[] {
  const wing = COLLECTION_OF_KIND[kind];
  const { bookcase: labels } = hallMessages(locale);
  const all = (): Bookcase[] => [
    {
      key: `${wing}-all`,
      label: kindLabel(kind, locale),
      kind: 'all',
      wing,
      bookIds: books.map((b) => b.id),
    },
  ];
  if (groupBy === 'collection') return all();
  const byGroup = new Map<string | null, number[]>();
  for (const book of books) {
    const value = book.groups[groupBy];
    const list = byGroup.get(value);
    if (list) list.push(book.id);
    else byGroup.set(value, [book.id]);
  }
  // A collection that knows nothing of this grouping (notebooks have no author) stays whole.
  if (byGroup.size === 1 && byGroup.has(null)) return all();
  const cases = [...byGroup].map(([value, bookIds]): Bookcase =>
    value === null
      ? {
          key: `${wing}-none`,
          label: labels.none[groupBy],
          kind: 'none',
          wing,
          bookIds,
        }
      : {
          key: `${wing}-${groupBy}-${value}`,
          label: value,
          kind: 'group',
          wing,
          bookIds,
        },
  );
  cases.sort((a, b) => compare(a, b, groupBy));
  if (cases.length <= max) return cases;
  const kept = cases.slice(0, Math.max(0, max - 1));
  const rest = cases.slice(kept.length);
  return [
    ...kept,
    {
      key: `${wing}-other`,
      label: labels.other,
      kind: 'other',
      wing,
      bookIds: rest.flatMap((c) => c.bookIds),
    },
  ];
}

/**
 * Sorts the items into wings, one per collection in shelf order, and each wing's items onto
 * bookcases for one grouping. Sorting by collection gives each wing a single case.
 */
export function buildWings(
  books: readonly HallBook[],
  groupBy: HallGroupBy,
  locale: LibraryLocale,
  max = CASES_PER_WING,
): Wing[] {
  return HALL_ITEM_KINDS.flatMap((kind) => {
    const own = books.filter((b) => b.kind === kind);
    if (own.length === 0) return [];
    return [
      {
        id: COLLECTION_OF_KIND[kind],
        kind,
        label: kindLabel(kind, locale),
        cases: wingCases(own, kind, groupBy, locale, max),
      },
    ];
  });
}

/** Every bookcase in the hall, wing by wing. */
export function buildHall(
  books: readonly HallBook[],
  groupBy: HallGroupBy,
  locale: LibraryLocale,
  max = CASES_PER_WING,
): Bookcase[] {
  return buildWings(books, groupBy, locale, max).flatMap((w) => w.cases);
}
