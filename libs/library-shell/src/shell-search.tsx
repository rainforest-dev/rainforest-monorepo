'use client';

import {
  COLLECTION_OF_KIND,
  getCollection,
  LIBRARY_SEARCH_ENDPOINT,
  type MergedSearchResponse,
  mergedSearchResponseSchema,
} from '@rainforest-dev/library-contract';
import { cn } from '@rainforest-dev/rainforest-react';
import { Search } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useState } from 'react';

import { COLLECTION_ICONS } from './collection-nav';

const DEBOUNCE_MS = 200;

type State =
  | { status: 'idle' }
  | { status: 'loading' }
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
    setState({ status: 'loading' });
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

/**
 * The library-wide search box: one query across books, notebook pages, the rack and the
 * knowledge base, merged by the hall. Hits are plain links, since each opens another app.
 */
export function ShellSearch({
  className,
  endpoint = LIBRARY_SEARCH_ENDPOINT,
}: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const state = useLibrarySearch(q, endpoint);
  const listId = useId();
  const results = state.status === 'done' ? state.response.results : [];
  const missing =
    state.status === 'done'
      ? state.response.sources
          .filter((s) => !s.ok)
          .map((s) => getCollection(s.collection).label)
      : [];
  const shown = open && q.trim() !== '';

  useEffect(() => setActive(-1), [state]);

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
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      const hit = results[active];
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
        搜尋整座圖書館
      </label>
      <Search
        className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        placeholder="搜尋書、筆記本、文章、知識庫"
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
          <ul id={listId} role="listbox" aria-label="搜尋結果">
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
                      aria-label={getCollection(collection).label}
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
              ? '搜尋中…'
              : state.status === 'error'
                ? '搜尋暫時無法使用'
                : state.status === 'done' && results.length === 0
                  ? '找不到符合的項目'
                  : ''}
            {missing.length > 0 && ` ${missing.join('、')}暫時沒有回應`}
          </p>
        </div>
      )}
    </div>
  );
}
