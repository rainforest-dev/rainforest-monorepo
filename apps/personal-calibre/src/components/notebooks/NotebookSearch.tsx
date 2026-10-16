import { Search } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib';
import type { PageSearch, PageSearchOptions } from '@/lib/server';

import { pageImageUrl } from './api';

const field =
  'bg-background focus-visible:outline-ring h-9 rounded-md border px-2 text-sm outline-offset-1 focus-visible:outline-2';

/** Searches the text of every notebook's pages; a plain GET form, so a search is a link. */
export function NotebookSearchForm({
  q = '',
  options = {},
}: {
  q?: string;
  options?: PageSearchOptions;
}) {
  const filtered = Boolean(options.from || options.to || options.exact);
  return (
    <form
      role="search"
      action="/notebooks"
      className="flex flex-wrap items-end gap-2"
    >
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
        <span className="sr-only">Search notebook pages</span>
        <span className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search notebook pages"
            className={cn(field, 'w-full pl-8')}
          />
        </span>
      </label>
      <details className="group" open={filtered}>
        <summary className="text-muted-foreground hover:text-foreground flex h-9 cursor-pointer items-center rounded-md px-2 text-sm">
          Filters
        </summary>
        <div className="flex flex-wrap items-end gap-2 pt-2">
          <label className="flex flex-col gap-1 text-xs">
            Dated from
            <input
              type="date"
              name="from"
              defaultValue={options.from}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            to
            <input
              type="date"
              name="to"
              defaultValue={options.to}
              className={field}
            />
          </label>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="exact"
              value="1"
              defaultChecked={options.exact}
              className="accent-primary size-4"
            />
            Exact words only
          </label>
        </div>
      </details>
      <button
        type="submit"
        className="bg-primary text-primary-foreground focus-visible:outline-ring h-9 rounded-md px-4 text-sm font-medium outline-offset-2 focus-visible:outline-2"
      >
        Search
      </button>
    </form>
  );
}

export function NotebookSearchResults({
  q,
  search,
}: {
  q: string;
  search: PageSearch;
}) {
  const { hits } = search;
  return (
    <section aria-labelledby="page-results" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="page-results" className="text-base font-semibold">
          {hits.length === 0
            ? 'No pages match'
            : `${hits.length} page${hits.length === 1 ? '' : 's'}`}
        </h2>
        <p className="text-muted-foreground text-xs">
          {search.semantic === 'on'
            ? 'Matched by words and by meaning'
            : 'Matched by words'}
          {' · '}
          <Link
            href={`/?q=${encodeURIComponent(q)}`}
            prefetch={false}
            className="hover:text-foreground underline underline-offset-2"
          >
            Search books for “{q}”
          </Link>
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {hits.map((hit) => (
          <li key={hit.id}>
            <Link
              href={`/notebooks/${hit.notebookId}?page=${hit.id}`}
              prefetch={false}
              className="bg-card hover:bg-muted/50 focus-visible:outline-ring flex gap-3 rounded-lg border p-3 outline-offset-2 focus-visible:outline-2"
            >
              <img
                src={pageImageUrl(hit.id)}
                alt=""
                loading="lazy"
                className="aspect-[3/4] w-14 flex-none rounded-sm border object-cover"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">
                    {hit.heading ?? 'Untitled page'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {[
                      hit.notebookName,
                      `p. ${hit.pageNumber ?? hit.position}`,
                      hit.pageDate,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span
                    className={cn(
                      'ml-auto rounded-full px-2 text-xs',
                      hit.match === 'words'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-info/15 text-info',
                    )}
                  >
                    {hit.match === 'words' ? 'Words' : 'Meaning'}
                  </span>
                </span>
                <span className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                  {hit.snippet.map((part, i) =>
                    part.match ? (
                      <mark
                        key={i}
                        className="bg-warning/25 text-foreground rounded-sm"
                      >
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
