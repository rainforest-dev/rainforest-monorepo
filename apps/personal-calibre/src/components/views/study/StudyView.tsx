'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useReducedMotion, useRovingNav } from '@/hooks';
import {
  buildStudyModel,
  contentKey,
  parseLibraryParams,
  type StudyGroupBy,
} from '@/lib';
import { useLibrary } from '@/providers';
import type { LibraryEntry } from '@/types';

import { CssStudy } from './css/CssStudy';
import type { StudyOptionState } from './StudyOption';

export interface StudyViewProps {
  entries: LibraryEntry[];
  groupBy: StudyGroupBy;
  page: number;
}

export function StudyView({ entries, groupBy, page }: StudyViewProps) {
  const key = contentKey(entries);
  const model = useMemo(
    () => buildStudyModel(entries, groupBy),
    [key, groupBy],
  );
  const navKeys = useMemo(
    () => model.shelves.flatMap((shelf) => shelf.books.map((b) => b.navKey)),
    [model],
  );
  const nav = useRovingNav<HTMLDivElement>({
    navKeys,
    mode: 'grid',
    page,
    contentKey: key,
  });
  const openId = parseLibraryParams(useSearchParams()).book;
  const { selected, focusId } = useLibrary();
  const reducedMotion = useReducedMotion();
  const options = model.shelves.flatMap((shelf) =>
    shelf.books.map((book): StudyOptionState => ({
      book,
      shelfKey: shelf.key,
      selected: selected.has(book.id),
      open: openId === book.id,
      tabIndex: book.navKey === nav.stopKey ? 0 : -1,
    })),
  );

  return (
    <div data-study-ready data-renderer="css" data-backend="css">
      <CssStudy
        model={model}
        page={page}
        options={options}
        focusId={focusId}
        reducedMotion={reducedMotion}
        nav={nav}
      />
    </div>
  );
}
