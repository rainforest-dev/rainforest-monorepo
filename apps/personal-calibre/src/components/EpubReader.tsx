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

    let book: ReturnType<typeof ePub> | null = null;
    let cleanupKeydown: (() => void) | null = null;
    let cancelled = false;
    const container = viewerRef.current;

    fetch(`/api/books/${bookId}/download/epub`)
      .then((res) => {
        if (!res.ok) throw new Error(`epub fetch failed: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;

        book = ePub(buffer);
        setBook(book);

        const rendition = book.renderTo(container, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
        });

        setRendition(rendition);

        const saved = localStorage.getItem(`epub-location-${bookId}`);
        rendition.display(saved ?? undefined);

        rendition.on('relocated', (location: Location) => {
          localStorage.setItem(`epub-location-${bookId}`, location.start.cfi);
        });

        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'ArrowLeft') rendition.prev();
          else if (e.key === 'ArrowRight') rendition.next();
        };
        document.addEventListener('keydown', onKeyDown);
        cleanupKeydown = () => document.removeEventListener('keydown', onKeyDown);
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      cleanupKeydown?.();
      book?.destroy();
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
