'use client';

import type { NavItem } from '@rainforest-dev/rainforest-ui/interaction';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useReducedMotion, useRovingNav } from '@/hooks';
import {
  type Bookcase,
  buildStudyModel,
  cn,
  type HallBook,
  isThreeRenderer,
  type ThreeRenderer,
} from '@/lib';
import { useHall } from '@/providers';

import { canStartRenderer } from './capabilities';
import { CssStudy } from './css/CssStudy';
import { InspectDialog } from './InspectDialog';
import { StudyCard } from './StudyCard';
import { StudyListbox, type StudyRendererProps } from './StudyListbox';
import { type StudyOptionState, useStudyOptionProps } from './StudyOption';
import { StudySkeleton } from './StudySkeleton';
import { LoadThreeStudy } from './three/loadThreeStudy';
import { ThreeStudyBoundary } from './three/ThreeStudyBoundary';
import { useStudyInspect } from './useStudyInspect';
import { useStudyPull } from './useStudyPull';

export interface StudyViewProps {
  bookcase: Bookcase;
  /** Every item on the bookcase, in shelf order; the Study shows one page of them. */
  books: readonly HallBook[];
  page: number;
  nextPageCovers: readonly string[];
}

interface ThreeHostProps extends StudyRendererProps {
  renderer: ThreeRenderer;
  onNavItems: (items: readonly NavItem[]) => void;
  nextPageCovers: readonly string[];
}

function ThreeHost({
  renderer,
  onNavItems,
  nextPageCovers,
  ...props
}: ThreeHostProps) {
  const { fallBackToCss, setBackend } = useHall();
  const [capable, setCapable] = useState(false);
  const optionProps = useStudyOptionProps(props.nav, props.pull);

  useEffect(() => {
    if (canStartRenderer(renderer)) setCapable(true);
    else fallBackToCss();
  }, [renderer, fallBackToCss]);
  useEffect(() => () => setBackend(null), [renderer, setBackend]);

  return (
    <>
      <StudyListbox
        model={props.model}
        options={props.options}
        nav={props.nav}
        visibleHeadings={false}
        className="sr-only"
        renderOption={(state) => (
          <div key={state.book.navKey} {...optionProps(state)} />
        )}
      />
      <ThreeStudyBoundary onUseCss={fallBackToCss}>
        {capable ? (
          <LoadThreeStudy
            key={renderer}
            {...props}
            renderer={renderer}
            onNavItems={onNavItems}
            nextPageCovers={nextPageCovers}
            onBackend={setBackend}
            onStartFailed={fallBackToCss}
          />
        ) : (
          <StudySkeleton />
        )}
      </ThreeStudyBoundary>
    </>
  );
}

export function StudyView({
  bookcase,
  books: caseBooks,
  page,
  nextPageCovers,
}: StudyViewProps) {
  const { selected, focusId, renderer, backend, noteOpened } = useHall();
  const three = isThreeRenderer(renderer);
  const model = useMemo(
    () => buildStudyModel(bookcase, caseBooks, page),
    [bookcase, caseBooks, page],
  );
  const key = model.key;
  const navKeys = useMemo(
    () => model.shelves.flatMap((shelf) => shelf.books.map((b) => b.navKey)),
    [model],
  );
  const layoutItems = useRef<readonly NavItem[]>([]);
  const readLayoutItems = useCallback(() => layoutItems.current, []);
  const onNavItems = useCallback((items: readonly NavItem[]) => {
    layoutItems.current = items;
  }, []);
  const nav = useRovingNav<HTMLDivElement>({
    navKeys,
    mode: 'grid',
    page,
    contentKey: key,
    items: three ? readLayoutItems : undefined,
    scrollOnFocus: !three,
  });
  // The hall has no detail pane: opening a book leaves for its collection.
  const openId: number | null = null;
  const reducedMotion = useReducedMotion();
  const pull = useStudyPull({
    navKeys,
    containerRef: nav.containerRef,
    scrollOnStep: !three,
  });
  const inspect = useStudyInspect(pull.pulledId);
  const books = model.shelves.flatMap((shelf) => shelf.books);
  const pulledIndex = books.findIndex((book) => book.id === pull.pulledId);
  const pulledBook = books[pulledIndex] ?? null;
  const root = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const { containerRef } = nav;
  const pulledId = pull.pulledId;
  const surface = useCallback(
    () =>
      three
        ? (root.current?.querySelector<HTMLElement>('[data-study-canvas]') ??
          null)
        : containerRef.current,
    [three, containerRef],
  );
  const slotRect = useCallback(() => {
    const spine = containerRef.current?.querySelector(
      `[role="option"][data-book-id="${pulledId}"] [data-spine]`,
    );
    if (!spine) return null;
    const { left, top, width, height } = spine.getBoundingClientRect();
    return { left, top, width, height };
  }, [containerRef, pulledId]);
  const wasInspecting = useRef(false);
  useEffect(() => {
    if (wasInspecting.current && !inspect.open) {
      thumbRef.current?.focus({ preventScroll: true });
    }
    wasInspecting.current = inspect.open;
  }, [inspect.open]);
  const options = model.shelves.flatMap((shelf) =>
    shelf.books.map((book): StudyOptionState => ({
      book,
      shelfKey: shelf.key,
      selected: selected.has(book.id),
      open: openId === book.id,
      pulled: pull.pulledId === book.id,
      tabIndex: book.navKey === nav.stopKey ? 0 : -1,
    })),
  );
  const rendererProps: StudyRendererProps = {
    model,
    page,
    options,
    focusId,
    reducedMotion,
    nav,
    pull,
    inspect,
  };

  return (
    <div
      ref={root}
      data-study-ready={!three || backend !== null || undefined}
      data-renderer={renderer}
      data-backend={three ? undefined : 'css'}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && openId === null) pull.dismiss();
      }}
      // iOS Safari opens its callout and selects text on a long press, which would hijack the scrub.
      className={cn(
        'select-none [-webkit-touch-callout:none]',
        three && 'relative',
      )}
    >
      {three ? (
        <ThreeHost
          renderer={renderer}
          onNavItems={onNavItems}
          nextPageCovers={nextPageCovers}
          {...rendererProps}
        />
      ) : (
        <CssStudy {...rendererProps} />
      )}
      <StudyCard
        book={pulledBook}
        hasPrevious={pulledIndex > 0}
        hasNext={pulledIndex >= 0 && pulledIndex < books.length - 1}
        scrubbing={pull.scrubbing}
        inspecting={inspect.open}
        thumbRef={thumbRef}
        onInspect={inspect.show}
        onStep={pull.step}
        onOpen={noteOpened}
      />
      {inspect.open && pulledBook && (
        <InspectDialog
          key={pulledBook.id}
          book={pulledBook}
          three={three}
          reducedMotion={reducedMotion}
          stage={inspect.stage}
          surface={surface}
          slotRect={slotRect}
          onClose={inspect.close}
        />
      )}
    </div>
  );
}
