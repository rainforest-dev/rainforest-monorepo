'use client';

import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FilterOptions } from '@/types/calibre';
import type { DeliveryPlatform } from '@/types/delivery';

interface SearchResult { id: number; title: string; author: string; series: string | null }
interface Props { filters: FilterOptions; platforms: DeliveryPlatform[] }

function FilterCombobox({ label, options, paramKey }: {
  label: string;
  options: Array<{ id: number; name: string | null; sort?: string | null }>;
  paramKey: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const value = searchParams.get(paramKey);
  const selectedLabel = value ? (options.find((o) => String(o.id) === value)?.name ?? value) : null;

  function handleSelect(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set(paramKey, id); else params.delete(paramKey);
    params.delete('page');
    router.replace(`/?${params.toString()}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-full items-center justify-between rounded-md border px-3 py-1 text-sm shadow-xs sm:w-40"
      >
        <span className="truncate text-sm font-normal">{selectedLabel ?? `All ${label}s`}</span>
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
          <CommandList>
            <CommandItem value="__all__" onSelect={() => handleSelect(null)}>
              <Check className={cn('mr-2 h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
              All {label}s
            </CommandItem>
            {options.map((o) => (
              <CommandItem key={o.id} value={String(o.id)} onSelect={() => handleSelect(String(o.id))}>
                <Check className={cn('mr-2 h-4 w-4', String(o.id) === value ? 'opacity-100' : 'opacity-0')} />
                {o.name ?? o.sort ?? String(o.id)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FilterBarInner({ filters, platforms }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [localQ, setLocalQ] = useState(urlQ);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => { setLocalQ(urlQ); }, [urlQ]);

  const updateParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete('page');
    router.replace(`/?${params.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!localQ.trim()) { setSuggestions([]); return; }
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(localQ)}`);
        setSuggestions(((await res.json()) as { results: SearchResult[] }).results ?? []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(id);
  }, [localQ]);

  const activePlatform = searchParams.get('platform');
  const activeDelivered = searchParams.get('delivered');
  const activeGroupBy = searchParams.get('groupBy');
  const activeSortBy = searchParams.get('sortBy');
  const activeSortDir = searchParams.get('sortDir') ?? 'asc';
  const activeAuthor = searchParams.get('author');
  const activeTag = searchParams.get('tag');
  const activeSeries = searchParams.get('series');
  const hasActiveFilters = !!(urlQ || activeAuthor || activeTag || activeSeries || activePlatform);

  const authorLabel = activeAuthor ? (filters.authors.find((a) => String(a.id) === activeAuthor)?.name ?? activeAuthor) : null;
  const tagLabel = activeTag ? (filters.tags.find((t) => String(t.id) === activeTag)?.name ?? activeTag) : null;
  const seriesLabel = activeSeries ? (filters.series.find((s) => String(s.id) === activeSeries)?.name ?? activeSeries) : null;
  const platformLabel = activePlatform ? (platforms.find((p) => p.key === activePlatform)?.name ?? activePlatform) : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Search row */}
      <div className="relative">
        <Input
          placeholder="Search books..."
          value={localQ}
          className="w-full pr-8 sm:w-64"
          onChange={(e) => setLocalQ(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { updateParam('q', localQ); setShowSuggestions(false); }
            if (e.key === 'Escape') setShowSuggestions(false);
          }}
        />
        {localQ && (
          <button type="button" aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => { setLocalQ(''); updateParam('q', null); }}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="bg-background absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-lg">
            {suggestions.map((s) => (
              <div key={s.id} role="button" tabIndex={0}
                className="hover:bg-muted flex cursor-pointer flex-col px-3 py-2 text-sm"
                onClick={() => router.push(`/books/${s.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/books/${s.id}`); }}>
                <span className="truncate font-medium">{s.title}</span>
                <span className="text-muted-foreground truncate text-xs">{s.author}{s.series ? ` • ${s.series}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter + view controls row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FilterCombobox label="Author" options={filters.authors} paramKey="author" />
        <FilterCombobox label="Tag" options={filters.tags} paramKey="tag" />
        <FilterCombobox label="Series" options={filters.series} paramKey="series" />

        <Select value={activePlatform ?? 'all'} onValueChange={(v) => {
          updateParam('platform', v === 'all' ? null : v);
          if (v === 'all') updateParam('delivered', null);
        }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by platform">
            <span className="text-muted-foreground mr-1 shrink-0 text-xs">Platform</span>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {activePlatform && (
          <Select value={activeDelivered ?? 'all'} onValueChange={(v) => updateParam('delivered', v === 'all' ? null : v)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by delivery status">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Delivered</SelectItem>
              <SelectItem value="false">Not delivered</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="sm:ml-auto flex items-center gap-2">
          <Select value={activeGroupBy ?? 'none'} onValueChange={(v) => { updateParam('groupBy', v === 'none' ? null : v); updateParam('page', null); }}>
            <SelectTrigger className="w-36" aria-label="Group by">
              <span className="text-muted-foreground mr-1 shrink-0 text-xs">Group</span>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="series">Series</SelectItem>
              <SelectItem value="tag">Tag</SelectItem>
              <SelectItem value="author">Author</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activeSortBy ?? 'title'} onValueChange={(v) => updateParam('sortBy', v === 'title' ? null : v)}>
            <SelectTrigger className="w-36" aria-label="Sort by">
              <span className="text-muted-foreground mr-1 shrink-0 text-xs">Sort</span>
              <SelectValue placeholder="Title" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="author">Author</SelectItem>
              <SelectItem value="added">Date added</SelectItem>
              <SelectItem value="pubdate">Published</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
            </SelectContent>
          </Select>

          <button type="button"
            aria-label={`Sort direction: ${activeSortDir === 'desc' ? 'descending' : 'ascending'}`}
            onClick={() => updateParam('sortDir', activeSortDir === 'desc' ? null : 'desc')}
            className="border-input hover:bg-accent rounded-md border px-2 py-1.5 text-xs">
            {activeSortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {urlQ && <FilterChip label={`"${urlQ}"`} onRemove={() => { setLocalQ(''); updateParam('q', null); }} />}
          {authorLabel && <FilterChip label={`Author: ${authorLabel}`} onRemove={() => updateParam('author', null)} />}
          {tagLabel && <FilterChip label={`Tag: ${tagLabel}`} onRemove={() => updateParam('tag', null)} />}
          {seriesLabel && <FilterChip label={`Series: ${seriesLabel}`} onRemove={() => updateParam('series', null)} />}
          {platformLabel && (
            <FilterChip
              label={`Platform: ${platformLabel}${activeDelivered === 'false' ? ' (undelivered)' : activeDelivered === 'true' ? ' (delivered)' : ''}`}
              onRemove={() => { updateParam('platform', null); updateParam('delivered', null); }}
            />
          )}
          <button type="button" onClick={() => { setLocalQ(''); router.replace('/'); }}
            className="text-muted-foreground hover:text-foreground ml-1 text-xs underline underline-offset-2">
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
      <button type="button" onClick={onRemove} aria-label={`Remove filter ${label}`} className="hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function FilterBar(props: Props) {
  return (
    <Suspense fallback={<div className="bg-muted h-10 w-full animate-pulse rounded-md" />}>
      <FilterBarInner {...props} />
    </Suspense>
  );
}
