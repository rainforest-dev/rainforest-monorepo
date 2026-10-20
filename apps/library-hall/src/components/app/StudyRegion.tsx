'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { Button } from '@rainforest-dev/rainforest-react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

import { StudyView } from '@/components/study';
import { type Bookcase, type HallBook, pageOf, STUDY_PAGE_SIZE } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';
import { useHall } from '@/providers';

import { RendererSelect } from './RendererSelect';

/** One bookcase up close: the Study, with the way back to the hall and its pages. */
export function StudyRegion({ bookcase }: { bookcase: Bookcase }) {
  const { bookById, page, pageCount, goToPage, returnToHall } = useHall();
  const t = useLibraryT(HALL_NAMESPACE);
  const books = useMemo(
    () =>
      bookcase.bookIds.flatMap((id) => {
        const book = bookById.get(id);
        return book ? [book] : [];
      }),
    [bookcase, bookById],
  );
  const nextPageCovers = useMemo(
    () =>
      pageOf<HallBook>(books, page + 1).flatMap((b) =>
        b.cover ? [b.cover] : [],
      ),
    [books, page],
  );

  return (
    <section
      aria-label={t('study.region', { name: bookcase.label })}
      data-view-region="study"
      data-study-case={bookcase.key}
      className="flex flex-col gap-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" data-hall-back onClick={returnToHall}>
          <ArrowLeft aria-hidden />
          {t('study.back')}
        </Button>
        <h1 className="text-heading font-semibold">{bookcase.label}</h1>
        <span className="text-muted-foreground text-sm">
          {t('items', { count: books.length })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <RendererSelect />
        </div>
      </div>
      <StudyView
        bookcase={bookcase}
        books={books}
        page={page}
        nextPageCovers={nextPageCovers}
      />
      {pageCount > 1 && (
        <nav
          aria-label={t('study.pages')}
          className="flex items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('study.previousPage')}
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-muted-foreground text-sm" aria-live="polite">
            {t('study.pageOf', { page, pageCount, size: STUDY_PAGE_SIZE })}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('study.nextPage')}
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      )}
    </section>
  );
}
