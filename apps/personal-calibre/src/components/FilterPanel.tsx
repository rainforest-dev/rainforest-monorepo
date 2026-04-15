'use client';

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

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <Input
          placeholder="Search books..."
          value={searchQuery}
          className="w-64"
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParam('q', searchQuery);
              setShowSuggestions(false);
            }
          }}
        />
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

      <Select
        value={searchParams.get('author') ?? 'all'}
        onValueChange={(v) => updateParam('author', v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Author" />
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

      <Select
        value={searchParams.get('tag') ?? 'all'}
        onValueChange={(v) => updateParam('tag', v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Tag" />
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

      <Select
        value={searchParams.get('series') ?? 'all'}
        onValueChange={(v) => updateParam('series', v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Series" />
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
  );
}

export function FilterPanel(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="bg-muted h-10 w-full animate-pulse rounded-md" />
      }
    >
      <FilterPanelInner {...props} />
    </Suspense>
  );
}
