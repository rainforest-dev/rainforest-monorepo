import {
  HALL_ITEM_KINDS,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';

import { type HallBook, type HallGroupBy, kindLabel } from '@/lib/items';
import { hallMessages } from '@/locales';

export type BookcaseKind = 'group' | 'none' | 'other';

export interface Bookcase {
  key: string;
  label: string;
  kind: BookcaseKind;
  bookIds: number[];
}

/** More bookcases than this and the hall stops reading as a room; the smallest ones merge. */
export const MAX_BOOKCASES = 12;

function groupOf(book: HallBook, groupBy: HallGroupBy): string | null {
  return groupBy === 'collection' ? book.kind : book.groups[groupBy];
}

function labelOf(
  value: string,
  groupBy: HallGroupBy,
  locale: LibraryLocale,
): string {
  if (groupBy !== 'collection') return value;
  const kind = HALL_ITEM_KINDS.find((k) => k === value);
  return kind ? kindLabel(kind, locale) : value;
}

function compare(a: Bookcase, b: Bookcase, groupBy: HallGroupBy): number {
  if (a.kind === 'none') return 1;
  if (b.kind === 'none') return -1;
  // Months read as a timeline, newest first; everything else biggest first.
  if (groupBy === 'month') return b.label.localeCompare(a.label);
  return b.bookIds.length - a.bookIds.length || a.label.localeCompare(b.label);
}

/**
 * Sorts the items onto bookcases for one grouping. Past `max`, the smallest groups share one
 * "other" case so the hall keeps a fixed size.
 */
export function buildHall(
  books: readonly HallBook[],
  groupBy: HallGroupBy,
  locale: LibraryLocale,
  max = MAX_BOOKCASES,
): Bookcase[] {
  const { bookcase: labels } = hallMessages(locale);
  const byGroup = new Map<string | null, number[]>();
  for (const book of books) {
    const value = groupOf(book, groupBy);
    const list = byGroup.get(value);
    if (list) list.push(book.id);
    else byGroup.set(value, [book.id]);
  }
  const cases = [...byGroup].map(([value, bookIds]): Bookcase =>
    value === null
      ? { key: 'none', label: labels.none[groupBy], kind: 'none', bookIds }
      : {
          key: `${groupBy}-${value}`,
          label: labelOf(value, groupBy, locale),
          kind: 'group',
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
      key: 'other',
      label: labels.other,
      kind: 'other',
      bookIds: rest.flatMap((c) => c.bookIds),
    },
  ];
}
