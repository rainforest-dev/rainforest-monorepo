'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from 'react';

import {
  buildLibraryHref,
  clearFiltersHref,
  type ParamPatch,
  parseLibraryParams,
} from '@/lib/library-params';
import {
  type Prefs,
  resolveView,
  serializePrefs,
  type View,
} from '@/lib/prefs';
import { addIds, removeIds, toggleId } from '@/lib/selection';

export type PendingFocus =
  { kind: 'first'; page: number } | { kind: 'book'; id: number };

export interface PageInfo {
  page: number;
  pageCount: number;
}

interface LibraryContextValue {
  view: View;
  setView: (view: View) => void;
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
      if (searchParams.get('view')) replaceParams({ view: null });
    },
    [replaceParams, savePrefs, searchParams],
  );

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
