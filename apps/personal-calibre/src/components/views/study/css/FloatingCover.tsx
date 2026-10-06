'use client';

import { type RefObject, useLayoutEffect, useRef } from 'react';

import {
  floatCentre,
  floatHeightPx,
  type ScreenPoint,
  type StudyBook,
} from '@/lib';

import { CssBook, cssBookSize } from './CssBook';

export interface FloatingCoverProps {
  book: StudyBook;
  pointer: RefObject<ScreenPoint>;
  placeRef: RefObject<(() => void) | null>;
}

export function FloatingCover({ book, pointer, placeRef }: FloatingCoverProps) {
  const element = useRef<HTMLDivElement>(null);
  const height = floatHeightPx({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const { width } = cssBookSize(book, height);

  useLayoutEffect(() => {
    const place = () => {
      const target = element.current;
      if (!target) return;
      const centre = floatCentre(
        pointer.current,
        { width, height },
        { width: window.innerWidth, height: window.innerHeight },
      );
      target.style.transform = `translate(${centre.x - width / 2}px, ${centre.y - height / 2}px)`;
    };
    place();
    placeRef.current = place;
    return () => {
      placeRef.current = null;
    };
  }, [pointer, placeRef, width, height]);

  return (
    <div
      ref={element}
      aria-hidden="true"
      data-floating-cover
      data-book-id={book.id}
      className="bk-float"
    >
      <CssBook key={book.id} book={book} height={height} className="bk-out" />
    </div>
  );
}
