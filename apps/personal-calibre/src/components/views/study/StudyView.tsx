'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useReducedMotion, useRovingNav } from '@/hooks';
import {
  buildStudyModel,
  contentKey,
  isThreeRenderer,
  parseLibraryParams,
  type StudyGroupBy,
  type ThreeRenderer,
} from '@/lib';
import { useLibrary } from '@/providers';
import type { LibraryEntry } from '@/types';

import { canStartThree } from './capabilities';
import { CssStudy } from './css/CssStudy';
import { StudyListbox, type StudyRendererProps } from './StudyListbox';
import { type StudyOptionState, useStudyOptionProps } from './StudyOption';
import { StudySkeleton } from './StudySkeleton';
import { LoadThreeStudy } from './three/loadThreeStudy';
import { ThreeStudyBoundary } from './three/ThreeStudyBoundary';

export interface StudyViewProps {
  entries: LibraryEntry[];
  groupBy: StudyGroupBy;
  page: number;
}

function ThreeHost({
  renderer,
  ...props
}: StudyRendererProps & { renderer: ThreeRenderer }) {
  const { fallBackToCss, setBackend } = useLibrary();
  const [capable, setCapable] = useState(false);
  const optionProps = useStudyOptionProps(props.nav);

  useEffect(() => {
    if (canStartThree()) setCapable(true);
    else fallBackToCss();
  }, [fallBackToCss]);
  useEffect(() => () => setBackend(null), [renderer, setBackend]);

  return (
    <>
      <StudyListbox
        model={props.model}
        options={props.options}
        nav={props.nav}
        visibleHeadings={false}
        className="sr-only"
        renderOption={(state) => (
          <div key={state.book.navKey} {...optionProps(state)} />
        )}
      />
      <ThreeStudyBoundary onUseCss={fallBackToCss}>
        {capable ? (
          <LoadThreeStudy
            {...props}
            renderer={renderer}
            onBackend={setBackend}
            onStartFailed={fallBackToCss}
          />
        ) : (
          <StudySkeleton />
        )}
      </ThreeStudyBoundary>
    </>
  );
}

export function StudyView({ entries, groupBy, page }: StudyViewProps) {
  const { selected, focusId, renderer, backend } = useLibrary();
  const three = isThreeRenderer(renderer);
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
    scrollOnFocus: !three,
  });
  const openId = parseLibraryParams(useSearchParams()).book;
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
  const rendererProps: StudyRendererProps = {
    model,
    page,
    options,
    focusId,
    reducedMotion,
    nav,
  };

  return (
    <div
      data-study-ready={!three || backend !== null || undefined}
      data-renderer={renderer}
      data-backend={three ? undefined : 'css'}
      className={three ? 'relative' : undefined}
    >
      {three ? (
        <ThreeHost renderer={renderer} {...rendererProps} />
      ) : (
        <CssStudy {...rendererProps} />
      )}
    </div>
  );
}
