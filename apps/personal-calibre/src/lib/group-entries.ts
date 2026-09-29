import type { GroupBy } from '@/lib/library-params';
import type { LibraryEntry } from '@/types/calibre';

export interface EntryGroup {
  key: string;
  label: string;
  total: number;
  continued: boolean;
  filter: { param: GroupBy; id: number } | null;
  entries: LibraryEntry[];
}

export function groupEntries(
  entries: readonly LibraryEntry[],
  groupBy: GroupBy,
): EntryGroup[] {
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    const ref = entry.group;
    const key = ref?.key ?? `${groupBy}:none`;
    const last = groups.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
      continue;
    }
    groups.push({
      key,
      label: ref?.label ?? '',
      total: ref?.total ?? 1,
      continued: (ref?.offset ?? 0) > 0,
      filter: ref?.id != null ? { param: groupBy, id: ref.id } : null,
      entries: [entry],
    });
  }
  const isFallback = (g: EntryGroup) => g.key.endsWith(':none');
  return [
    ...groups.filter((g) => !isFallback(g)),
    ...groups.filter(isFallback),
  ];
}

export function groupTitle(group: EntryGroup): string {
  return group.continued ? `${group.label} (continued)` : group.label;
}

export function navKey(entry: LibraryEntry): string {
  return `${entry.group?.key ?? 'all'}:${entry.book.id}`;
}

export function bookIdOfNavKey(key: string): number {
  return Number(key.slice(key.lastIndexOf(':') + 1));
}

export function contentKey(entries: readonly LibraryEntry[]): string {
  return entries
    .map((e) =>
      [
        e.group?.key ?? '',
        e.book.id,
        e.book.title,
        e.book.series ?? '',
        e.book.deliveredTo.join('+'),
      ].join('|'),
    )
    .join('\n');
}

export function booksLabel(n: number): string {
  return `${n} book${n === 1 ? '' : 's'}`;
}
