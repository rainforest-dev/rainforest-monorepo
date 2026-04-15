'use client';

import ePub, { type Book, type Location, type Rendition } from 'epubjs';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

interface Props {
  bookId: number;
  title: string;
}

export function EpubReader({ bookId, title }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);

  useEffect(() => {
    if (!viewerRef.current) return;

    const epubUrl = `/api/books/${bookId}/download/epub`;
    const newBook = ePub(epubUrl);
    setBook(newBook);

    const newRendition = newBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      manager: 'continuous',
      flow: 'paginated',
    });

    setRendition(newRendition);

    const savedLocation = localStorage.getItem(`epub-location-${bookId}`);
    if (savedLocation) {
      newRendition.display(savedLocation);
    } else {
      newRendition.display();
    }

    newRendition.on('relocated', (location: Location) => {
      localStorage.setItem(`epub-location-${bookId}`, location.start.cfi);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') newRendition.prev();
      else if (e.key === 'ArrowRight') newRendition.next();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      newBook.destroy();
    };
  }, [bookId]);

  return (
    <div className="relative flex h-full flex-col">
      <div className="bg-background/80 absolute top-4 left-4 z-10 flex items-center gap-4 rounded-md p-2 text-sm shadow backdrop-blur">
        <span className="font-semibold">{title}</span>
      </div>

      <div ref={viewerRef} className="h-full w-full flex-grow overflow-hidden" />

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => rendition?.prev()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => rendition?.next()}>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
