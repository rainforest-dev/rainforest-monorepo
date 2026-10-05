'use client';

import { Check } from 'lucide-react';
import { type CSSProperties, useState } from 'react';

import type {
  StudyOptionAttributes,
  StudyOptionState,
} from '@/components/views/study/StudyOption';

export interface SpineProps {
  state: StudyOptionState;
  reducedMotion: boolean;
  optionProps: StudyOptionAttributes;
}

const lastName = (author: string | undefined) =>
  author?.split(' ').at(-1) ?? '';

export function Spine({ state, reducedMotion, optionProps }: SpineProps) {
  const { book, selected } = state;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const showCover = (hovered || focused) && !reducedMotion;
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
      onFocus={() => {
        setFocused(true);
        optionProps.onFocus();
      }}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="st-book">
        <div data-spine className="st-spine">
          <span data-spine-title className="st-title">
            {book.title}
          </span>
          <span className="st-author">{lastName(book.authors[0])}</span>
        </div>
        {showCover && (
          <div data-cover-face className="st-cover" aria-hidden="true">
            {book.hasCover ? (
              <img
                src={`/api/books/${book.id}/cover`}
                alt=""
                className="size-full rounded-[inherit] object-cover"
              />
            ) : (
              <span className="st-cover-title">{book.title}</span>
            )}
          </div>
        )}
      </div>
      {selected && (
        <span data-select-mark className="st-sel" aria-hidden="true">
          <Check />
        </span>
      )}
    </div>
  );
}
