import { contentKey, groupEntries, navKey } from '@/lib/group-entries';
import type { GroupBy } from '@/lib/library-params';
import type { LibraryEntry } from '@/types';

export type Tone = 1 | 2 | 3 | 4 | 5;
export type StudyGroupBy = Extract<GroupBy, 'series' | 'author'>;
export const STUDY_GROUP_BYS: readonly StudyGroupBy[] = ['series', 'author'];

export interface SpineDims {
  width: number;
  height: number;
  depth: number;
}

export interface StudyBook {
  id: number;
  navKey: string;
  title: string;
  authors: string[];
  series: string | null;
  seriesIndex: number | null;
  hasCover: boolean;
  tone: Tone;
  cjk: boolean;
  dims: SpineDims;
}

export interface StudyShelf {
  key: string;
  label: string;
  count: number;
  continued: boolean;
  books: StudyBook[];
}

export interface StudyModel {
  shelves: StudyShelf[];
  key: string;
}

const TONES: readonly Tone[] = [1, 2, 3, 4, 5];
const CJK = /[\u3000-\u9fff\uff00-\uffef]/;

export function isStudyGroupBy(value: GroupBy | null): value is StudyGroupBy {
  return STUDY_GROUP_BYS.some((groupBy) => groupBy === value);
}

export function spineDims(id: number): SpineDims {
  const height = 172 + ((id * 13) % 38);
  return {
    width: 26 + ((id * 7) % 16),
    height,
    depth: Math.round(height * 0.66),
  };
}

export function spineTone(id: number): Tone {
  return TONES[id % TONES.length] ?? 1;
}

export function isCjk(title: string): boolean {
  return CJK.test(title);
}

export function buildStudyModel(
  entries: readonly LibraryEntry[],
  groupBy: StudyGroupBy,
): StudyModel {
  const shelves = groupEntries(entries, groupBy).map((group): StudyShelf => ({
    key: group.key,
    label: group.label,
    count: group.total,
    continued: group.continued,
    books: group.entries.map((entry): StudyBook => ({
      id: entry.book.id,
      navKey: navKey(entry),
      title: entry.book.title,
      authors: entry.book.authors,
      series: entry.book.series,
      seriesIndex: entry.book.seriesIndex,
      hasCover: entry.book.hasCover ?? false,
      tone: spineTone(entry.book.id),
      cjk: isCjk(entry.book.title),
      dims: spineDims(entry.book.id),
    })),
  }));
  return { shelves, key: contentKey(entries) };
}
