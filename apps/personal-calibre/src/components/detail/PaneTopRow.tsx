'use client';

import { Button, buttonVariants, Kbd } from '@rainforest-dev/rainforest-react';
import { ExternalLink, X } from 'lucide-react';
import Link from 'next/link';

import { useLibrary } from '@/components/library/LibraryProvider';
import { cn } from '@/lib/utils';

export function PaneTopRow({ bookId }: { bookId: number }) {
  const { closeBook } = useLibrary();
  return (
    <div className="flex items-center gap-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Details
      </p>
      <span className="text-muted-foreground ml-auto hidden items-center gap-1 pr-1 text-xs lg:inline-flex">
        <Kbd>Esc</Kbd> close
      </span>
      <Link
        href={`/books/${bookId}`}
        aria-label="Open full page"
        title="Open full page"
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'ml-auto lg:ml-0',
        )}
      >
        <ExternalLink aria-hidden />
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close details"
        onClick={closeBook}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
