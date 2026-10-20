'use client';

import { toast } from '@rainforest-dev/rainforest-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';

import { useIsFinePointerDesktop } from '@/hooks/useIsDesktop';
import {
  addIds,
  buildLibraryHref,
  clearFiltersHref,
  isStudyGroupBy,
  type ParamPatch,
  parseLibraryParams,
  pickRenderer,
  type Prefs,
  removeIds,
  type Renderer,
  resolveView,
  serializePrefs,
  type StudyBackend,
  toggleId,
  type View,
} from '@/lib';

export type PendingFocus =
  | { kind: 'first'; page: number }
  | { kind: 'book'; id: number; orFirst?: true };

export interface PageInfo {
  page: number;
  pageCount: number;
}

interface LibraryContextValue {
  view: View;
  setView: (view: View) => void;
  renderer: Renderer;
  setRenderer: (renderer: Renderer) => void;
  studyFallback: boolean;
  fallBackToCss: () => void;
  backend: StudyBackend | null;
  setBackend: (backend: StudyBackend | null) => void;
  panelOpen: boolean;
  togglePanel: () => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  selected: ReadonlySet<number>;
  toggle: (id: number) => void;
  addMany: (ids: readonly number[]) => void;
  removeMany: (ids: readonly number[]) => void;
  clear: () => void;
  selectMode: boolean;
  setSelectMode: (on: boolean) => void;
  bulkPlatform: string;
  setBulkPlatform: (key: string) => void;
  zipFormat: string;
  setZipFormat: (format: string) => void;
  focusId: number | null;
  setFocusId: (id: number | null) => void;
  pendingFocus: PendingFocus | null;
  requestFocus: (focus: PendingFocus | null) => void;
  pageInfo: PageInfo;
  setPageInfo: (info: PageInfo) => void;
  isPending: boolean;
  replaceParams: (patch: ParamPatch) => void;
  clearFilters: () => void;
  goToPage: (page: number) => void;
  openBook: (id: number) => void;
  closeBook: () => void;
  focusAfterToolbar: () => void;
}

function isBookOnPage(id: number): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.querySelector(`[data-view-region] [data-book-id="${id}"]`) !== null
  );
}

const STUDY_FALLBACK_KEY = 'calibre-study-fallback';
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

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary needs a LibraryProvider');
  return value;
}

export function LibraryProvider({
  initialPrefs,
  children,
}: {
  initialPrefs: Prefs;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [view, setViewState] = useState<View>(() =>
    resolveView(initialPrefs.view, searchParams.get('view')),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [selectMode, setSelectMode] = useState(false);
  const [bulkPlatform, setBulkPlatform] = useState('');
  const [zipFormat, setZipFormat] = useState('EPUB');
  const [focusId, setFocusId] = useState<number | null>(null);
  const [pendingFocus, requestFocus] = useState<PendingFocus | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    page: 1,
    pageCount: 1,
  });
  const [isPending, startTransition] = useTransition();
  const studyFallback = useSyncExternalStore(
    subscribeStudyFallback,
    readStudyFallback,
    () => false,
  );
  const [backend, setBackend] = useState<StudyBackend | null>(null);
  const desktop = useIsFinePointerDesktop();
  const renderer = pickRenderer({
    param: searchParams.get('renderer'),
    pref: prefs.renderer,
    sessionFallback: studyFallback,
    desktop,
  });

  const savePrefs = useCallback(
    (patch: Partial<Prefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      document.cookie = serializePrefs(next);
    },
    [prefs],
  );

  const replaceParams = useCallback(
    (patch: ParamPatch) => {
      requestFocus(null);
      const href = buildLibraryHref(searchParams, patch);
      startTransition(() => router.replace(href, { scroll: false }));
    },
    [router, searchParams],
  );

  const setView = useCallback(
    (next: View) => {
      setViewState(next);
      savePrefs({ view: next });
      const staleView = searchParams.get('view') !== null;
      if (
        next === 'study' &&
        !isStudyGroupBy(parseLibraryParams(searchParams).groupBy)
      ) {
        replaceParams(
          staleView ? { groupBy: 'series', view: null } : { groupBy: 'series' },
        );
        if (
          focusId !== null &&
          document.activeElement?.closest('[data-view-region]')
        ) {
          requestFocus({ kind: 'book', id: focusId, orFirst: true });
        }
        return;
      }
      if (staleView) {
        router.replace(buildLibraryHref(searchParams, { view: null }), {
          scroll: false,
        });
      }
    },
    [focusId, replaceParams, router, savePrefs, searchParams],
  );

  const setRenderer = useCallback(
    (next: Renderer) => {
      savePrefs({ renderer: next });
      if (searchParams.get('renderer') !== null) {
        router.replace(buildLibraryHref(searchParams, { renderer: null }), {
          scroll: false,
        });
      }
    },
    [router, savePrefs, searchParams],
  );

  const fallBackToCss = useCallback(() => {
    if (readStudyFallback()) return;
    writeStudyFallback();
    toast("3D isn't available here, showing the CSS study");
  }, []);

  const togglePanel = useCallback(
    () => savePrefs({ panel: !prefs.panel }),
    [prefs.panel, savePrefs],
  );
  const toggle = useCallback(
    (id: number) => setSelected((s) => toggleId(s, id)),
    [],
  );
  const addMany = useCallback(
    (ids: readonly number[]) => setSelected((s) => addIds(s, ids)),
    [],
  );
  const removeMany = useCallback(
    (ids: readonly number[]) => setSelected((s) => removeIds(s, ids)),
    [],
  );
  const clear = useCallback(() => setSelected(new Set()), []);

  const clearFilters = useCallback(() => {
    requestFocus(null);
    const href = clearFiltersHref(searchParams);
    startTransition(() => router.replace(href, { scroll: false }));
  }, [router, searchParams]);

  const goToPage = useCallback(
    (page: number) => {
      requestFocus({ kind: 'first', page });
      const href = buildLibraryHref(searchParams, { page });
      startTransition(() => router.push(href, { scroll: false }));
    },
    [router, searchParams],
  );

  const openBook = useCallback(
    (id: number) => {
      setFocusId(id);
      router.push(buildLibraryHref(searchParams, { book: id }), {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const closeBook = useCallback(() => {
    const id = parseLibraryParams(searchParams).book;
    if (id === null) return;
    router.replace(buildLibraryHref(searchParams, { book: null }), {
      scroll: false,
    });
    requestFocus(isBookOnPage(id) ? { kind: 'book', id } : null);
  }, [router, searchParams]);

  const focusAfterToolbar = useCallback(() => {
    requestFocus(
      focusId !== null && isBookOnPage(focusId)
        ? { kind: 'book', id: focusId }
        : { kind: 'first', page: pageInfo.page },
    );
  }, [focusId, pageInfo.page]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      view,
      setView,
      renderer,
      setRenderer,
      studyFallback,
      fallBackToCss,
      backend,
      setBackend,
      panelOpen: prefs.panel,
      togglePanel,
      filtersOpen,
      setFiltersOpen,
      selected,
      toggle,
      addMany,
      removeMany,
      clear,
      selectMode,
      setSelectMode,
      bulkPlatform,
      setBulkPlatform,
      zipFormat,
      setZipFormat,
      focusId,
      setFocusId,
      pendingFocus,
      requestFocus,
      pageInfo,
      setPageInfo,
      isPending,
      replaceParams,
      clearFilters,
      goToPage,
      openBook,
      closeBook,
      focusAfterToolbar,
    }),
    [
      view,
      setView,
      renderer,
      setRenderer,
      studyFallback,
      fallBackToCss,
      backend,
      prefs.panel,
      togglePanel,
      filtersOpen,
      selected,
      toggle,
      addMany,
      removeMany,
      clear,
      selectMode,
      bulkPlatform,
      zipFormat,
      focusId,
      pendingFocus,
      pageInfo,
      isPending,
      replaceParams,
      clearFilters,
      goToPage,
      openBook,
      closeBook,
      focusAfterToolbar,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}
