'use client';

import { DEFAULT_LIBRARY_PREFS } from '@rainforest-dev/library-contract';
import { COLLECTION_OF_KIND } from '@rainforest-dev/library-contract';
import {
  pushRecent,
  useLibraryLocale,
  useLibraryT,
} from '@rainforest-dev/library-shell';
import { toast } from '@rainforest-dev/rainforest-react';
import { useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { useIsFinePointerDesktop } from '@/hooks/useIsDesktop';
import {
  type Bookcase,
  buildHall,
  DEFAULT_GROUP_BY,
  type HallBook,
  type HallGroupBy,
  isHallGroupBy,
  pageCount,
  pickRenderer,
  readLibraryPrefs,
  type Renderer,
  rendererPref,
  type StudyBackend,
  writeLibraryPrefs,
} from '@/lib';
import { HALL_NAMESPACE } from '@/locales';

export type PendingFocus =
  | { kind: 'first'; page: number }
  | { kind: 'book'; id: number; orFirst?: true };

export interface HallReturn {
  key: string;
  label: string;
}

interface HallContextValue {
  books: readonly HallBook[];
  bookById: ReadonlyMap<number, HallBook>;
  groupBy: HallGroupBy;
  setGroupBy: (groupBy: HallGroupBy) => void;
  cases: readonly Bookcase[];
  /** The bookcase open in the Study, or `null` in the hall. */
  bookcase: Bookcase | null;
  page: number;
  pageCount: number;
  goToPage: (page: number) => void;
  renderer: Renderer;
  setRenderer: (renderer: Renderer) => void;
  studyFallback: boolean;
  fallBackToCss: () => void;
  backend: StudyBackend | null;
  setBackend: (backend: StudyBackend | null) => void;
  /** The hall never selects; the Study's selection hooks see an empty set. */
  selected: ReadonlySet<number>;
  selectMode: false;
  toggle: (id: number) => void;
  focusId: number | null;
  setFocusId: (id: number | null) => void;
  pendingFocus: PendingFocus | null;
  requestFocus: (focus: PendingFocus | null) => void;
  /** Records an item as opened, for the shell's recent list. */
  noteOpened: (id: number) => void;
  openBook: (id: number) => void;
  hallReturn: HallReturn | null;
  enterBookcase: (bookcase: Bookcase) => void;
  returnToHall: () => void;
}

const STUDY_FALLBACK_KEY = 'library-hall-study-fallback';
const fallbackListeners = new Set<() => void>();
let fallbackInMemory = false;

function readStudyFallback(): boolean {
  if (fallbackInMemory) return true;
  try {
    return sessionStorage.getItem(STUDY_FALLBACK_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStudyFallback(): void {
  fallbackInMemory = true;
  try {
    sessionStorage.setItem(STUDY_FALLBACK_KEY, '1');
  } catch {
    // sessionStorage throws when the browser blocks site data.
  }
  for (const listener of fallbackListeners) listener();
}

function subscribeStudyFallback(listener: () => void): () => void {
  fallbackListeners.add(listener);
  return () => fallbackListeners.delete(listener);
}

const NO_SELECTION: ReadonlySet<number> = new Set();
const noop = () => undefined;

/**
 * Moves within the hall without a server round trip. Next keeps `useSearchParams` in step with
 * `history.pushState`, and the scene stays mounted because the page never re-renders on the
 * server.
 */
function navigate(params: URLSearchParams, mode: 'push' | 'replace'): void {
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

const HallContext = createContext<HallContextValue | null>(null);

export function useHall(): HallContextValue {
  const value = useContext(HallContext);
  if (!value) throw new Error('useHall needs a HallProvider');
  return value;
}

export function HallProvider({
  books,
  children,
}: {
  books: readonly HallBook[];
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const [rendererChoice, setRendererChoice] = useState<Renderer | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [pendingFocus, requestFocus] = useState<PendingFocus | null>(null);
  const [backend, setBackend] = useState<StudyBackend | null>(null);
  const [hallReturn, setHallReturn] = useState<HallReturn | null>(null);
  const studyFallback = useSyncExternalStore(
    subscribeStudyFallback,
    readStudyFallback,
    () => false,
  );
  const desktop = useIsFinePointerDesktop();
  const locale = useLibraryLocale();
  const t = useLibraryT(HALL_NAMESPACE);

  const groupParam = searchParams.get('group');
  const groupBy = isHallGroupBy(groupParam) ? groupParam : DEFAULT_GROUP_BY;
  const cases = useMemo(
    () => buildHall(books, groupBy, locale),
    [books, groupBy, locale],
  );
  const bookById = useMemo(
    () => new Map(books.map((book) => [book.id, book])),
    [books],
  );
  const caseKey = searchParams.get('case');
  const bookcase = cases.find((c) => c.key === caseKey) ?? null;
  const pages = pageCount(bookcase?.bookIds.length ?? 0);
  const pageParam = Number(searchParams.get('page'));
  const page =
    Number.isInteger(pageParam) && pageParam >= 1
      ? Math.min(pageParam, pages)
      : 1;

  const renderer = pickRenderer({
    param: searchParams.get('renderer'),
    pref: rendererChoice ?? rendererPref(readLibraryPrefsSafe()),
    sessionFallback: studyFallback,
    desktop,
  });

  const patchParams = useCallback(
    (patch: Record<string, string | null>, mode: 'push' | 'replace') => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      navigate(next, mode);
    },
    [searchParams],
  );

  const setGroupBy = useCallback(
    (next: HallGroupBy) =>
      patchParams(
        {
          group: next === DEFAULT_GROUP_BY ? null : next,
          case: null,
          page: null,
        },
        'replace',
      ),
    [patchParams],
  );

  const goToPage = useCallback(
    (next: number) => {
      requestFocus({ kind: 'first', page: next });
      patchParams({ page: next > 1 ? String(next) : null }, 'replace');
    },
    [patchParams],
  );

  const setRenderer = useCallback(
    (next: Renderer) => {
      setRendererChoice(next);
      writeLibraryPrefs({ renderer: next });
      if (searchParams.get('renderer') !== null)
        patchParams({ renderer: null }, 'replace');
    },
    [patchParams, searchParams],
  );

  const fallBackToCss = useCallback(() => {
    if (readStudyFallback()) return;
    writeStudyFallback();
    toast(t('hall.no3d'));
  }, [t]);

  const noteOpened = useCallback(
    (id: number) => {
      const book = bookById.get(id);
      if (!book) return;
      pushRecent({
        collection: COLLECTION_OF_KIND[book.kind],
        id: book.itemId,
        title: book.title,
        href: book.href,
      });
    },
    [bookById],
  );

  const openBook = useCallback(
    (id: number) => {
      const book = bookById.get(id);
      if (!book) return;
      noteOpened(id);
      // A full page load into another app; the cover morphs across through its transition name.
      window.location.assign(book.href);
    },
    [bookById, noteOpened],
  );

  // A push, so the browser's Back button leaves the Study for the hall.
  const enterBookcase = useCallback(
    (next: Bookcase) => {
      setHallReturn({ key: next.key, label: next.label });
      requestFocus(null);
      setFocusId(null);
      patchParams({ case: next.key, page: null }, 'push');
    },
    [patchParams],
  );

  const returnToHall = useCallback(() => {
    requestFocus(null);
    if (hallReturn && window.history.length > 1) window.history.back();
    else patchParams({ case: null, page: null }, 'replace');
  }, [hallReturn, patchParams]);

  const value = useMemo<HallContextValue>(
    () => ({
      books,
      bookById,
      groupBy,
      setGroupBy,
      cases,
      bookcase,
      page,
      pageCount: pages,
      goToPage,
      renderer,
      setRenderer,
      studyFallback,
      fallBackToCss,
      backend,
      setBackend,
      selected: NO_SELECTION,
      selectMode: false,
      toggle: noop,
      focusId,
      setFocusId,
      pendingFocus,
      requestFocus,
      noteOpened,
      openBook,
      hallReturn,
      enterBookcase,
      returnToHall,
    }),
    [
      books,
      bookById,
      groupBy,
      setGroupBy,
      cases,
      bookcase,
      page,
      pages,
      goToPage,
      renderer,
      setRenderer,
      studyFallback,
      fallBackToCss,
      backend,
      focusId,
      pendingFocus,
      noteOpened,
      openBook,
      hallReturn,
      enterBookcase,
      returnToHall,
    ],
  );

  return <HallContext.Provider value={value}>{children}</HallContext.Provider>;
}

function readLibraryPrefsSafe() {
  return typeof document === 'undefined'
    ? DEFAULT_LIBRARY_PREFS
    : readLibraryPrefs();
}
