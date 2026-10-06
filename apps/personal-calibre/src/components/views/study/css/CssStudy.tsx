'use client';

import type { ReactNode } from 'react';

import {
  StudyListbox,
  type StudyRendererProps,
} from '@/components/views/study/StudyListbox';
import { useStudyOptionProps } from '@/components/views/study/StudyOption';
import { useScrub } from '@/components/views/study/useScrub';

import { Spine } from './Spine';

export function CssStudy({
  model,
  options,
  nav,
  pull,
}: StudyRendererProps): ReactNode {
  const optionProps = useStudyOptionProps(nav, pull);
  useScrub({
    surfaceRef: nav.containerRef,
    hitTest: (x, y) => {
      const option = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('[role="option"][data-book-id]');
      return option ? Number(option.dataset['bookId']) : null;
    },
    onPull: pull.pullAt,
    onScrubbing: pull.setScrubbing,
  });
  return (
    <StudyListbox
      model={model}
      options={options}
      nav={nav}
      onBackgroundClick={pull.dismiss}
      visibleHeadings
      className="st-case"
      shelfClassName="flex flex-col gap-2"
      renderShelf={(shelf, children) => (
        <div className="st-bay" data-bay={shelf.key}>
          <div className="st-row">{children}</div>
          <div className="st-board" aria-hidden="true" />
        </div>
      )}
      renderOption={(state) => (
        <Spine
          key={state.book.navKey}
          state={state}
          optionProps={optionProps(state)}
        />
      )}
    />
  );
}
