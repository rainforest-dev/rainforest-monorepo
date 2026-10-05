'use client';

import type { ReactNode } from 'react';

import {
  StudyListbox,
  type StudyRendererProps,
} from '@/components/views/study/StudyListbox';
import { useStudyOptionProps } from '@/components/views/study/StudyOption';

import { Spine } from './Spine';

export function CssStudy({
  model,
  options,
  reducedMotion,
  nav,
}: StudyRendererProps): ReactNode {
  const optionProps = useStudyOptionProps(nav);
  return (
    <StudyListbox
      model={model}
      options={options}
      nav={nav}
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
          reducedMotion={reducedMotion}
          optionProps={optionProps(state)}
        />
      )}
    />
  );
}
