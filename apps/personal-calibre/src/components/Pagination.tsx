'use client';

import { Button, buttonVariants } from '@rainforest-dev/rainforest-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { buildLibraryHref } from '@/lib/library-params';

export function Pagination({
  page,
  pageCount,
}: {
  page: number;
  pageCount: number;
}) {
  const searchParams = useSearchParams();
  const { goToPage } = useLibrary();
  if (pageCount <= 1) return null;

  const step = (target: number, label: ReactNode, enabled: boolean) => {
    if (!enabled) {
      return (
        <Button variant="outline" size="sm" disabled>
          {label}
        </Button>
      );
    }
    return (
      <Link
        href={buildLibraryHref(searchParams, { page: target })}
        scroll={false}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey
          )
            return;
          event.preventDefault();
          goToPage(target);
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3 py-4 text-sm"
    >
      {step(
        page - 1,
        <>
          <ArrowLeft aria-hidden />
          Prev
        </>,
        page > 1,
      )}
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {step(
        page + 1,
        <>
          Next
          <ArrowRight aria-hidden />
        </>,
        page < pageCount,
      )}
    </nav>
  );
}
