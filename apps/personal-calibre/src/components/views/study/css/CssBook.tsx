'use client';

import type { CSSProperties, Ref } from 'react';

import { cn, type StudyBook } from '@/lib';

export interface CssBookProps {
  book: StudyBook;
  height: number;
  ref?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
}

export function cssBookSize(book: StudyBook, height: number) {
  return {
    width: (height * book.dims.depth) / book.dims.height,
    height,
    thickness: (height * book.dims.width) / book.dims.height,
  };
}

export function CssBook({ book, height, ref, className, style }: CssBookProps) {
  const size = cssBookSize(book, height);
  const vars = {
    '--bk-w': `${size.width}px`,
    '--bk-h': `${size.height}px`,
    '--bk-t': `${size.thickness}px`,
    '--st-tone': `var(--chart-${book.tone})`,
    ...style,
  } as CSSProperties;
  return (
    <div
      ref={ref}
      data-css-book
      className={cn('bk-book', className)}
      style={vars}
      lang={book.cjk ? 'zh-Hant' : undefined}
    >
      <div data-face="front" className="bk-face bk-front">
        {book.hasCover ? (
          <img
            src={`/api/books/${book.id}/cover`}
            alt=""
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          <span className="bk-title">{book.title}</span>
        )}
      </div>
      <div data-face="back" className="bk-face bk-back">
        <span className="bk-title">{book.title}</span>
        <span className="bk-author">{book.authors.join(', ')}</span>
      </div>
      <div data-face="spine" className="bk-face bk-spine">
        <span className="st-title">{book.title}</span>
      </div>
      <div className="bk-face bk-edge" />
      <div className="bk-face bk-top" />
      <div className="bk-face bk-bottom" />
    </div>
  );
}
