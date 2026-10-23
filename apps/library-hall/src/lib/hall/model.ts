import {
  COLLECTION_OF_KIND,
  type CollectionId,
  HALL_ITEM_KINDS,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';

import { type HallBook, type HallGroupBy, kindLabel } from '@/lib/items';
import { hallMessages } from '@/locales';

export type BookcaseKind = 'group' | 'none' | 'other' | 'all';

/** A collection's wing, or the one wing every collection shares when sorted by topic. */
export type WingId = CollectionId | 'topics';

export interface Bookcase {
  key: string;
  label: string;
  kind: BookcaseKind;
  /** The wing of the hall the case stands in. */
  wing: WingId;
  bookIds: number[];
}

/**
 * One row of the hall. By creator, month or collection there is one wing per collection, so
 * no collection can crowd another off the floor; by topic one wing holds them all, so a
 * topic's books, notes and articles stand on the same case.
 */
export interface Wing {
  id: WingId;
  label: string;
  cases: Bookcase[];
  /** Items with no answer for this grouping, shelved on the wing's unsorted case. */
  unsorted: number;
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

function groupCases(
  books: readonly HallBook[],
  wing: WingId,
  groupBy: Exclude<HallGroupBy, 'collection'>,
  locale: LibraryLocale,
  max: number,
): Bookcase[] {
  const { bookcase: labels } = hallMessages(locale);
  const byGroup = new Map<string | null, number[]>();
  for (const book of books) {
    const value = book.groups[groupBy];
    const list = byGroup.get(value);
    if (list) list.push(book.id);
    else byGroup.set(value, [book.id]);
  }
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
  // The unsorted case stays its own, so the count under the wing's sign matches a case.
  const none = cases.at(-1)?.kind === 'none' ? cases.pop() : undefined;
  const room = Math.max(1, max - (none ? 1 : 0));
  if (cases.length > room) {
    const rest = cases.splice(room - 1);
    cases.push({
      key: `${wing}-other`,
      label: labels.other,
      kind: 'other',
      wing,
      bookIds: rest.flatMap((c) => c.bookIds),
    });
  }
  return none ? [...cases, none] : cases;
}

function unsortedOf(cases: readonly Bookcase[]): number {
  return cases.find((c) => c.kind === 'none')?.bookIds.length ?? 0;
}

/**
 * Sorts the items into wings and each wing's items onto bookcases for one grouping. By topic
 * every collection shares one wing; otherwise each collection, in shelf order, has its own,
 * and sorting by collection gives each wing a single case.
 */
export function buildWings(
  books: readonly HallBook[],
  groupBy: HallGroupBy,
  locale: LibraryLocale,
  max = CASES_PER_WING,
): Wing[] {
  const kinds = HALL_ITEM_KINDS.filter((kind) =>
    books.some((b) => b.kind === kind),
  );
  if (groupBy === 'topic') {
    if (books.length === 0) return [];
    // Shelf order within a case: books, then notebooks, articles and pages.
    const ordered = kinds.flatMap((kind) =>
      books.filter((b) => b.kind === kind),
    );
    const cases = groupCases(
      ordered,
      'topics',
      groupBy,
      locale,
      max * kinds.length,
    );
    return [
      {
        id: 'topics',
        label: hallMessages(locale).wing.topics,
        cases,
        unsorted: unsortedOf(cases),
      },
    ];
  }
  return kinds.map((kind) => {
    const own = books.filter((b) => b.kind === kind);
    const id = COLLECTION_OF_KIND[kind];
    const label = kindLabel(kind, locale);
    const cases =
      groupBy === 'collection'
        ? [
            {
              key: `${id}-all`,
              label,
              kind: 'all' as const,
              wing: id,
              bookIds: own.map((b) => b.id),
            },
          ]
        : groupCases(own, id, groupBy, locale, max);
    return { id, label, cases, unsorted: unsortedOf(cases) };
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
