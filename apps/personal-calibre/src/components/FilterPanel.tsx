'use client';

import { X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilterOptions } from '@/types/calibre';

interface Props {
  filters: FilterOptions;
}

interface SearchResult {
  id: number;
  title: string;
  author: string;
  series: string | null;
}

function FilterPanelInner({ filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.replace(`/?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!searchQuery.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/books/search?q=${encodeURIComponent(searchQuery)}`,
        );
        const data = (await res.json()) as { results: SearchResult[] };
        setSuggestions(data.results ?? []);
      } catch {
        setSuggestions([]);
      }
    };

    const id = setTimeout(() => void fetchSuggestions(), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const activeAuthor = searchParams.get('author');
  const activeTag = searchParams.get('tag');
  const activeSeries = searchParams.get('series');
  const activeQ = searchParams.get('q');
  const hasActiveFilters = !!(activeAuthor || activeTag || activeSeries || activeQ);

  const authorLabel = activeAuthor
    ? (filters.authors.find((a) => String(a.id) === activeAuthor)?.name ?? activeAuthor)
    : null;
  const tagLabel = activeTag
    ? (filters.tags.find((t) => String(t.id) === activeTag)?.name ?? activeTag)
    : null;
  const seriesLabel = activeSeries
    ? (filters.series.find((s) => String(s.id) === activeSeries)?.name ?? activeSeries)
    : null;

  const clearAll = useCallback(() => {
    setSearchQuery('');
    router.replace('/');
  }, [router]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {/* Search input with × clear button */}
        <div className="relative">
          <Input
            placeholder="Search books..."
            value={searchQuery}
            className="w-full pr-8 sm:w-64"
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateParam('q', searchQuery);
                setShowSuggestions(false);
              }
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => {
                setSearchQuery('');
                updateParam('q', null);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="bg-background absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-lg">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  className="hover:bg-muted flex cursor-pointer flex-col px-3 py-2 text-sm"
                  onClick={() => router.push(`/books/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') router.push(`/books/${s.id}`);
                  }}
                >
                  <span className="truncate font-medium">{s.title}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {s.author}
                    {s.series ? ` • ${s.series}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Author */}
        <Select
          value={searchParams.get('author') ?? 'all'}
          onValueChange={(v) => updateParam('author', v)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by author">
            <span className="text-muted-foreground mr-1 shrink-0 text-xs">Author</span>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All authors</SelectItem>
            {filters.authors.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name ?? a.sort}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tag */}
        <Select
          value={searchParams.get('tag') ?? 'all'}
          onValueChange={(v) => updateParam('tag', v)}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by tag">
            <span className="text-muted-foreground mr-1 shrink-0 text-xs">Tag</span>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {filters.tags.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Series */}
        <Select
          value={searchParams.get('series') ?? 'all'}
          onValueChange={(v) => updateParam('series', v)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by series">
            <span className="text-muted-foreground mr-1 shrink-0 text-xs">Series</span>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All series</SelectItem>
            {filters.series.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active-filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeQ && (
            <FilterChip
              label={`"${activeQ}"`}
              onRemove={() => {
                setSearchQuery('');
                updateParam('q', null);
              }}
            />
          )}
          {authorLabel && (
            <FilterChip
              label={`Author: ${authorLabel}`}
              onRemove={() => updateParam('author', null)}
            />
          )}
          {tagLabel && (
            <FilterChip
              label={`Tag: ${tagLabel}`}
              onRemove={() => updateParam('tag', null)}
            />
          )}
          {seriesLabel && (
            <FilterChip
              label={`Series: ${seriesLabel}`}
              onRemove={() => updateParam('series', null)}
            />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground ml-1 text-xs underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function FilterPanel(props: Props) {
  return (
    <Suspense fallback={<div className="bg-muted h-10 w-full animate-pulse rounded-md" />}>
      <FilterPanelInner {...props} />
    </Suspense>
  );
}
