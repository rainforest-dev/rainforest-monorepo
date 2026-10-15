import type { GroupBy, ParamPatch } from '@/lib/library-params';
import type { FilterOptions } from '@/types';

/** One book as the hall needs it: where it belongs under each grouping, and nothing heavier. */
export interface HallBook {
  id: number;
  title: string;
  series: number | null;
  author: number | null;
  tag: number | null;
}

export type BookcaseKind = 'group' | 'none' | 'other';

export interface Bookcase {
  key: string;
  label: string;
  kind: BookcaseKind;
  groupId: number | null;
  bookIds: number[];
}

/** More bookcases than this and the hall stops reading as a room; the smallest ones merge. */
export const MAX_BOOKCASES = 12;

const NONE_LABELS: Record<GroupBy, string> = {
  series: 'No series',
  author: 'No author',
  tag: 'No tag',
};
const OTHER_LABEL = 'Everything else';

function namesOf(
  filters: FilterOptions,
  groupBy: GroupBy,
): ReadonlyMap<number, string> {
  const options =
    groupBy === 'series'
      ? filters.series
      : groupBy === 'author'
        ? filters.authors
        : filters.tags;
  return new Map(options.map((o) => [o.id, o.name ?? `#${o.id}`]));
}

/**
 * Sorts the library onto bookcases for one grouping. Biggest bookcases first; past `max`, the
 * smallest groups share one "Everything else" case so the hall keeps a fixed size.
 */
export function buildHall(
  books: readonly HallBook[],
  filters: FilterOptions,
  groupBy: GroupBy,
  max = MAX_BOOKCASES,
): Bookcase[] {
  const names = namesOf(filters, groupBy);
  const byGroup = new Map<number | null, number[]>();
  for (const book of books) {
    const id = book[groupBy];
    const list = byGroup.get(id);
    if (list) list.push(book.id);
    else byGroup.set(id, [book.id]);
  }
  const cases = [...byGroup].map(([id, bookIds]): Bookcase =>
    id === null
      ? {
          key: 'none',
          label: NONE_LABELS[groupBy],
          kind: 'none',
          groupId: null,
          bookIds,
        }
      : {
          key: `${groupBy}-${id}`,
          label: names.get(id) ?? `#${id}`,
          kind: 'group',
          groupId: id,
          bookIds,
        },
  );
  cases.sort(
    (a, b) =>
      b.bookIds.length - a.bookIds.length || a.label.localeCompare(b.label),
  );
  if (cases.length <= max) return cases;
  const kept = cases.slice(0, Math.max(0, max - 1));
  const rest = cases.slice(kept.length);
  return [
    ...kept,
    {
      key: 'other',
      label: OTHER_LABEL,
      kind: 'other',
      groupId: null,
      bookIds: rest.flatMap((c) => c.bookIds),
    },
  ];
}

/** The library params that show one bookcase in the Study. */
export function bookcasePatch(
  bookcase: Bookcase,
  groupBy: GroupBy,
): ParamPatch {
  // Study only groups by series or author; a bookcase's books read best as series shelves.
  const patch: ParamPatch = { groupBy: 'series' };
  if (bookcase.kind === 'group') patch[groupBy] = bookcase.groupId;
  return patch;
}
