'use client';

import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';

import type {
  StudyOptionAttributes,
  StudyOptionState,
} from '@/components/views/study/StudyOption';

export interface SpineProps {
  state: StudyOptionState;
  optionProps: StudyOptionAttributes;
}

const lastName = (author: string | undefined) =>
  author?.split(' ').at(-1) ?? '';

export function Spine({ state, optionProps }: SpineProps) {
  const { book, selected, pulled } = state;
  const style = {
    '--st-w': `${book.dims.width}px`,
    '--st-h': `${book.dims.height}px`,
    '--st-tone': `var(--chart-${book.tone})`,
  } as CSSProperties;

  return (
    <div
      {...optionProps}
      className="st-slot"
      style={style}
      data-pulled={pulled || undefined}
    >
      <div className="st-book">
        <div data-spine className="st-spine">
          <span data-spine-title className="st-title">
            {book.title}
          </span>
          <span className="st-author">{lastName(book.authors[0])}</span>
        </div>
      </div>
      {selected && (
        <span data-select-mark className="st-sel" aria-hidden="true">
          <Check />
        </span>
      )}
    </div>
  );
}
