'use client';

import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@rainforest-dev/rainforest-react';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useLibrary } from './LibraryProvider';

interface Suggestion {
  id: number;
  title: string;
  author: string;
  series: string | null;
}

export function SearchField({ initialQuery }: { initialQuery: string }) {
  const { replaceParams, openBook } = useLibrary();
  const [text, setText] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const trimmed = text.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/books/search?q=${encodeURIComponent(trimmed)}`,
          {
            signal: controller.signal,
          },
        );
        const body = (await res.json()) as { results?: Suggestion[] };
        setSuggestions(body.results?.slice(0, 8) ?? []);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const commit = () => {
    setOpen(false);
    replaceParams({ q: trimmed || null });
  };

  return (
    <Command
      data-library-search
      shouldFilter={false}
      label="Search books"
      className="relative size-auto w-full overflow-visible bg-transparent p-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <CommandInput
        placeholder="Search books"
        aria-label="Search books"
        value={text}
        onValueChange={(value) => {
          setText(value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setText('');
            replaceParams({ q: null });
          }}
          className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      <CommandList
        hidden={!(open && trimmed.length > 0)}
        onMouseDown={(event) => event.preventDefault()}
        className="bg-popover text-popover-foreground ring-foreground/10 absolute inset-x-0 top-full z-50 mt-1 rounded-lg p-1 shadow-md ring-1"
      >
        <CommandItem value="__search__" onSelect={commit}>
          <Search aria-hidden />
          Search for &quot;{trimmed}&quot;
        </CommandItem>
        {suggestions.map((s) => (
          <CommandItem
            key={s.id}
            value={`book-${s.id}`}
            onSelect={() => {
              setOpen(false);
              openBook(s.id);
            }}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{s.title}</span>
              <span className="text-muted-foreground truncate text-xs">
                {s.author}
                {s.series ? ` · ${s.series}` : ''}
              </span>
            </span>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}
