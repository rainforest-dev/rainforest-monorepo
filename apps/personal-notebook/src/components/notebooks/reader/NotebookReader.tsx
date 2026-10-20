'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@rainforest-dev/rainforest-react';
import { ChevronLeft, ChevronRight, FileText, ListTree } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useIsWide, useReducedMotion } from '@/hooks';
import {
  notebookBacklinks,
  notebookIndex,
  notebookOutline,
  pageNumberOf,
  pageOfSpread,
  spreadOfPage,
  spreadsOf,
} from '@/lib';
import { NOTEBOOK_NAMESPACE } from '@/locales';
import type { NotebookPage } from '@/types';

import { FlipBook, type FlipBookHandle } from './FlipBook';
import { NotebookOutline } from './NotebookOutline';
import { PageTranscript } from './PageTranscript';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The notebook as a book to page through, with its outline beside it and the open pages' text and
 * links underneath. The open page is kept in `?page=` so a link can land on it.
 */
export function NotebookReader({
  pages,
  initialPageId,
  onOpenPage,
}: {
  pages: readonly NotebookPage[];
  initialPageId: number | null;
  onOpenPage: (pageId: number) => void;
}) {
  const wide = useIsWide();
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  const reducedMotion = useReducedMotion();
  const mode = wide ? 'spread' : 'single';
  const spreads = useMemo(() => spreadsOf(pages.length, mode), [pages, mode]);
  const outline = useMemo(() => notebookOutline(pages), [pages]);
  const index = useMemo(() => notebookIndex(pages), [pages]);
  const backlinks = useMemo(() => notebookBacklinks(pages), [pages]);
  const book = useRef<FlipBookHandle>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const [pageIndex, setPageIndex] = useState(() =>
    Math.max(
      0,
      pages.findIndex((page) => page.id === initialPageId),
    ),
  );
  const spreadIndex = Math.min(
    spreads.length - 1,
    spreadOfPage(pageIndex, mode),
  );
  const spread = spreads[spreadIndex];
  const openPages = spread
    ? [spread.left, spread.right].flatMap((i) =>
        i === null || !pages[i] ? [] : [pages[i]],
      )
    : [];
  const openIds = new Set(openPages.map((page) => page.id));
  const shown = pages[pageIndex];

  useEffect(() => {
    if (!shown) return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(shown.id));
    window.history.replaceState(window.history.state, '', url);
  }, [shown]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        book.current?.turn(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        book.current?.turn(-1);
      } else if (event.key === 'Home') {
        setPageIndex(0);
      } else if (event.key === 'End') {
        setPageIndex(pages.length - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length]);

  const goToPage = (pageId: number) => {
    const next = pages.findIndex((page) => page.id === pageId);
    if (next >= 0) setPageIndex(next);
  };

  if (!spread) return null;
  const pageLabel = openPages.map((page) => pageNumberOf(page)).join('–');

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_20rem]">
      <nav aria-label={t('reader.outline')} className="hidden lg:block">
        <h2 className="px-2 pb-3 text-sm font-semibold">
          {t('reader.outline')}
        </h2>
        <NotebookOutline
          sections={outline}
          currentIds={openIds}
          onGoTo={goToPage}
        />
      </nav>
      {/* Below `lg` the outline is a sheet, so it can be opened from beside the book. */}
      <Sheet side="bottom" open={outlineOpen} onOpenChange={setOutlineOpen}>
        <SheetContent
          closeLabel={t('reader.closeOutline')}
          className="max-h-[75dvh]"
        >
          <SheetHeader>
            <SheetTitle>{t('reader.outline')}</SheetTitle>
          </SheetHeader>
          <SheetBody className="px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <NotebookOutline
              sections={outline}
              currentIds={openIds}
              onGoTo={(pageId) => {
                goToPage(pageId);
                setOutlineOpen(false);
              }}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col items-center gap-4">
        <div className="flex w-full items-center gap-3 px-4">
          <FlipBook
            ref={book}
            pages={pages}
            spreads={spreads}
            spreadIndex={spreadIndex}
            mode={mode}
            reducedMotion={reducedMotion}
            onChange={(next) => {
              const target = spreads[next];
              if (target) setPageIndex(pageOfSpread(target));
            }}
          />
        </div>
        <div className="flex w-full max-w-xl items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label={t('reader.previous')}
            disabled={spreadIndex === 0}
            onClick={() => book.current?.turn(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <input
            type="range"
            aria-label={t('reader.page')}
            min={0}
            max={spreads.length - 1}
            value={spreadIndex}
            onChange={(event) => {
              const target = spreads[Number(event.target.value)];
              if (target) setPageIndex(pageOfSpread(target));
            }}
            className="accent-primary min-w-0 flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={t('reader.next')}
            disabled={spreadIndex === spreads.length - 1}
            onClick={() => book.current?.turn(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="lg:hidden"
            aria-haspopup="dialog"
            onClick={() => setOutlineOpen(true)}
          >
            <ListTree aria-hidden />
            {t('reader.outline')}
          </Button>
        </div>
        <p
          className="text-muted-foreground text-xs tabular-nums"
          aria-live="polite"
        >
          {pageLabel
            ? t('reader.position', { pages: pageLabel, total: pages.length })
            : null}
          <span className="hidden sm:inline">{t('reader.hint')}</span>
        </p>
      </div>

      <aside aria-label={t('reader.pageText')} className="flex flex-col gap-6">
        {openPages.map((page) => (
          <div key={page.id} className="flex flex-col gap-2">
            <PageTranscript
              page={page}
              index={index}
              backlinks={backlinks.get(page.id) ?? []}
              onGoTo={goToPage}
            />
            <Button
              variant="outline"
              size="sm"
              className="self-start max-sm:h-10"
              onClick={() => onOpenPage(page.id)}
            >
              <FileText aria-hidden />
              {t('reader.details')}
            </Button>
          </div>
        ))}
      </aside>
    </div>
  );
}
