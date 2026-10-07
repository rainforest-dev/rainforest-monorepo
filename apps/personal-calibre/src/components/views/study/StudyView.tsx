'use client';

import type { NavItem } from '@rainforest-dev/rainforest-ui/interaction';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useReducedMotion, useRovingNav } from '@/hooks';
import {
  buildStudyModel,
  cn,
  contentKey,
  isThreeRenderer,
  parseLibraryParams,
  type StudyGroupBy,
  type ThreeRenderer,
} from '@/lib';
import { useLibrary } from '@/providers';
import type { LibraryEntry } from '@/types';

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
  entries: LibraryEntry[];
  groupBy: StudyGroupBy;
  page: number;
  nextPageCoverIds: readonly number[];
}

interface ThreeHostProps extends StudyRendererProps {
  renderer: ThreeRenderer;
  onNavItems: (items: readonly NavItem[]) => void;
  nextPageCoverIds: readonly number[];
}

function ThreeHost({
  renderer,
  onNavItems,
  nextPageCoverIds,
  ...props
}: ThreeHostProps) {
  const { fallBackToCss, setBackend } = useLibrary();
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
            nextPageCoverIds={nextPageCoverIds}
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
  entries,
  groupBy,
  page,
  nextPageCoverIds,
}: StudyViewProps) {
  const { selected, focusId, renderer, backend, openBook } = useLibrary();
  const three = isThreeRenderer(renderer);
  const key = contentKey(entries);
  const model = useMemo(
    () => buildStudyModel(entries, groupBy),
    [key, groupBy],
  );
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
  const openId = parseLibraryParams(useSearchParams()).book;
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
          nextPageCoverIds={nextPageCoverIds}
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
        onOpen={openBook}
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
