'use client';

import {
  COLLECTION_OF_KIND,
  collectionLabel,
  getCollection,
  LIBRARY_SEARCH_ENDPOINT,
  type MergedSearchResponse,
  mergedSearchResponseSchema,
  sharedHref,
} from '@rainforest-dev/library-contract';
import { cn } from '@rainforest-dev/rainforest-react';
import { Search } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { COLLECTION_ICONS } from './collection-nav';
import { useLibraryLocale, useLibraryT } from './i18n-provider';

const DEBOUNCE_MS = 200;
const NO_RESULTS: MergedSearchResponse['results'] = [];

/** While loading, `response` is the previous answer, kept on screen until the new one lands. */
type State =
  | { status: 'idle' }
  | { status: 'loading'; response?: MergedSearchResponse }
  | { status: 'error' }
  | { status: 'done'; response: MergedSearchResponse };

/** Fetches the merged search for `q` after a short pause in typing; the latest query wins. */
function useLibrarySearch(q: string, endpoint: string): State {
  const [state, setState] = useState<State>({ status: 'idle' });
  const query = q.trim();
  useEffect(() => {
    if (!query) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({
      status: 'loading',
      response: 'response' in previous ? previous.response : undefined,
    }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${endpoint}?${new URLSearchParams({ q: query })}`,
          {
            signal: controller.signal,
            headers: { accept: 'application/json' },
          },
        );
        if (!response.ok) throw new Error(String(response.status));
        const parsed = mergedSearchResponseSchema.parse(await response.json());
        setState({ status: 'done', response: parsed });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, endpoint]);
  return state;
}

interface Props {
  className?: string;
  /** The merged search, the hall's `/api/search` unless a test points elsewhere. */
  endpoint?: string;
}

/** ⌘K or Ctrl+K, from anywhere on the page. */
const isFocusShortcut = (event: globalThis.KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  event.key.toLowerCase() === 'k';

/**
 * The library-wide search box: one query across books, notebook pages, the rack and the
 * knowledge base, merged by the hall. Hits are plain links, since each opens another app.
 * ⌘K or Ctrl+K focuses it anywhere, Enter opens the highlighted hit or else the first, and
 * under the hits each collection that matched offers its own search for the same query, with
 * the filters the merged list does not have.
 */
export function ShellSearch({
  className,
  endpoint = LIBRARY_SEARCH_ENDPOINT,
}: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const state = useLibrarySearch(q, endpoint);
  const locale = useLibraryLocale();
  const t = useLibraryT();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const response = 'response' in state ? state.response : undefined;
  const results = response?.results ?? NO_RESULTS;
  const missing = (response?.sources ?? [])
    .filter((s) => !s.ok)
    .map((s) => collectionLabel(s.collection, locale));
  const shown = open && q.trim() !== '';
  const more = (state.status === 'done' ? response?.sources : undefined)
    ?.filter((s) => s.ok && s.count > 0)
    .map(({ collection }) => getCollection(collection));

  useEffect(() => setActive(-1), [results]);

  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if (!isFocusShortcut(event)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const optionId = (i: number) => `${listId}-${i}`;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (shown) setOpen(false);
      else setQ('');
      return;
    }
    if (!results.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = results[Math.max(active, 0)];
      if (hit) window.location.assign(hit.href);
    }
  };

  return (
    <div
      className={cn('relative w-full max-w-md', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t('search.label')}
      </label>
      <Search
        className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        placeholder={t('search.placeholder')}
        autoComplete="off"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-8 pr-3 text-sm outline-none focus-visible:ring-2"
      />
      {shown && (
        <div className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-md border shadow-lg">
          <ul id={listId} role="listbox" aria-label={t('search.results')}>
            {results.map((hit, i) => {
              const collection = COLLECTION_OF_KIND[hit.kind];
              const Icon = COLLECTION_ICONS[collection];
              return (
                <li
                  key={`${hit.kind}:${hit.id}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                >
                  <a
                    href={hit.href}
                    tabIndex={-1}
                    className={cn(
                      'hover:bg-accent flex gap-3 px-3 py-2 text-sm',
                      i === active && 'bg-accent',
                    )}
                  >
                    <Icon
                      className="text-muted-foreground mt-0.5 size-4 shrink-0"
                      aria-label={collectionLabel(collection, locale)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {hit.title}
                      </span>
                      {hit.subtitle && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {hit.subtitle}
                        </span>
                      )}
                      {hit.snippet && (
                        <span className="text-muted-foreground line-clamp-2 text-xs">
                          {hit.snippet}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          <p
            className="text-muted-foreground px-3 py-2 text-xs empty:hidden"
            aria-live="polite"
          >
            {state.status === 'loading'
              ? t('search.loading')
              : state.status === 'error'
                ? t('search.error')
                : state.status === 'done' && results.length === 0
                  ? t('search.empty')
                  : ''}
            {missing.length > 0 &&
              ` ${t('search.missing', { names: missing.join(t('list.separator')) })}`}
          </p>
          {more && more.length > 0 && (
            <nav
              aria-label={t('search.moreLabel')}
              className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-xs"
            >
              {more.map((collection) => (
                <a
                  key={collection.id}
                  href={sharedHref(collection.basePath, { q: q.trim() })}
                  className="text-primary hover:underline"
                >
                  {t('search.more', {
                    name: collectionLabel(collection, locale),
                  })}
                </a>
              ))}
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
