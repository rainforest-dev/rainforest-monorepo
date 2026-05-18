# Personal Calibre — UX Fixes & Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six UX/bug issues identified via Chrome DevTools inspection of the personal-calibre Next.js app: dead pagination, unlabelled filters, lost navigation context, missing search clear, static page titles, and a LIKE search that misses author real names.

**Architecture:** All changes are server-component-first (Next.js 16 App Router with `'use cache'`). UI state lives in URL search params — no new client state. Pure utility helpers extracted where needed to stay testable. The `Pagination` component is the only new file; everything else is an edit to an existing file.

**Tech Stack:** Next.js 16 (App Router, server components, `'use cache'`), TypeScript, Drizzle ORM, Tailwind CSS v4, better-sqlite3. Dev: `pnpm nx dev personal-calibre` (port 8080). Types: `pnpm tsc --noEmit` from `apps/personal-calibre/`.

---

## Already Done (context only — do not re-implement)

- **B1 Search API 500** — fixed. `api/books/search/route.ts` now uses `appSqlite` + FTS5 trigram table built in `client.ts`.
- `client.ts` exports `appSqlite`; `syncBooksFts()` runs once at startup using the Calibre DB's `max(last_modified)` as a staleness signal.

---

## File Map

| File | Change |
|---|---|
| `apps/personal-calibre/src/components/Pagination.tsx` | **Create** — Prev/Next link nav, preserves all search params |
| `apps/personal-calibre/src/app/(library)/page.tsx` | **Modify** — invalid-page redirect, wire `<Pagination>`, pass `from` to `<BookGrid>` |
| `apps/personal-calibre/src/components/BookGrid.tsx` | **Modify** — thread `from` prop down to `<BookCard>` |
| `apps/personal-calibre/src/components/BookCard.tsx` | **Modify** — append `?from=` to book detail link href |
| `apps/personal-calibre/src/components/FilterPanel.tsx` | **Modify** — visible labels on each Select, × clear button, active-filter chips |
| `apps/personal-calibre/src/app/(library)/books/[id]/page.tsx` | **Modify** — `generateMetadata`, `loading="eager"` on hero cover, read `from` param for back link |
| `apps/personal-calibre/src/lib/queries.ts` | **Modify** — `q` LIKE condition also searches `authors.name` |

---

## Task 1: Pagination controls + invalid-page redirect

**Fixes:** U1 (no prev/next controls), B2 (page > totalPages shows contradictory empty state).

**The bug:** `/?q=rust&page=2` shows "2 books total" but "No books found." Page 2 is empty for a 2-result set and there are no navigation controls at all — "Page X of Y" is plain text only.

**Files:**
- Create: `apps/personal-calibre/src/components/Pagination.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/page.tsx`

---

- [ ] **Step 1.1 — Create `Pagination.tsx`**

```tsx
// apps/personal-calibre/src/components/Pagination.tsx
import Link from 'next/link';

interface Props {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

export function buildPageUrl(
  page: number,
  params: Record<string, string | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== 'page') p.set(k, v);
  }
  if (page > 1) p.set('page', String(page));
  const qs = p.toString();
  return qs ? `/?${qs}` : '/';
}

const linkCls =
  'rounded-md border border-input px-3 py-1 text-sm hover:bg-muted transition-colors';
const disabledCls =
  'rounded-md border border-input px-3 py-1 text-sm text-muted-foreground cursor-not-allowed opacity-50';

export function Pagination({ page, totalPages, searchParams }: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3 text-sm"
    >
      {page > 1 ? (
        <Link href={buildPageUrl(page - 1, searchParams)} className={linkCls}>
          ← Prev
        </Link>
      ) : (
        <span className={disabledCls} aria-disabled="true">
          ← Prev
        </span>
      )}

      <span className="text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={buildPageUrl(page + 1, searchParams)} className={linkCls}>
          Next →
        </Link>
      ) : (
        <span className={disabledCls} aria-disabled="true">
          Next →
        </span>
      )}
    </nav>
  );
}
```

- [ ] **Step 1.2 — Verify types compile**

```bash
cd apps/personal-calibre && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no output (no errors).

- [ ] **Step 1.3 — Replace `page.tsx`**

```tsx
// apps/personal-calibre/src/app/(library)/page.tsx
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { BookGrid } from '@/components/BookGrid';
import { FilterPanel } from '@/components/FilterPanel';
import { Pagination, buildPageUrl } from '@/components/Pagination';
import { getBookList, getFilterOptions } from '@/lib/queries';

interface Props {
  searchParams: Promise<{
    page?: string;
    q?: string;
    author?: string;
    tag?: string;
    series?: string;
  }>;
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="space-y-6" />}>
      <LibraryPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LibraryPageContent({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1') || 1);
  const authorId = params.author ? (parseInt(params.author) || undefined) : undefined;
  const tagId = params.tag ? (parseInt(params.tag) || undefined) : undefined;
  const seriesId = params.series ? (parseInt(params.series) || undefined) : undefined;

  const [{ books, total }, filters] = await Promise.all([
    getBookList({ page, q: params.q, authorId, tagId, seriesId }),
    getFilterOptions(),
  ]);

  const totalPages = Math.ceil(total / 30);

  // Redirect out-of-range pages to page 1, preserving other params.
  if (page > totalPages && totalPages > 0) {
    redirect(
      buildPageUrl(1, {
        q: params.q,
        author: params.author,
        tag: params.tag,
        series: params.series,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm">{total} books total</p>
        </div>
        <FilterPanel filters={filters} />
      </div>
      <BookGrid books={books} from={params} />
      <Pagination page={page} totalPages={totalPages} searchParams={params} />
    </div>
  );
}
```

- [ ] **Step 1.4 — Verify types compile**

```bash
cd apps/personal-calibre && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: one error about `BookGrid` not accepting `from` — resolved in Task 2.

- [ ] **Step 1.5 — Test redirect**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
  "http://localhost:8080/?q=rust&page=2"
```

Expected: `307 http://localhost:8080/?q=rust` (or similar redirect to page 1).

- [ ] **Step 1.6 — Test Prev/Next in browser**

Navigate to `http://localhost:8080/`. Scroll to bottom.
Expected: "← Prev" (muted/disabled) · "Page 1 of 5" · "Next →" (active link).
Click "Next →" → URL becomes `/?page=2`, books change, "← Prev" is now clickable.

- [ ] **Step 1.7 — Commit**

```bash
git add apps/personal-calibre/src/components/Pagination.tsx \
        apps/personal-calibre/src/app/\(library\)/page.tsx
git commit -m "feat(personal-calibre): add pagination controls and redirect out-of-range pages"
```

---

## Task 2: Thread `from` param through BookGrid → BookCard → detail page back link

**Fixes:** U3 ("← Back to library" hardcoded to `/`, loses all search/filter context).

**How it works:** `page.tsx` passes its raw `searchParams` record as `from` to `BookGrid`, which serialises it into a URL string and passes it to each `BookCard`. Each card link becomes `/books/42?from=%2F%3Fq%3Dclean`. The detail page reads `from` and uses it for the back link. No client state or JavaScript required.

**Security note:** The detail page only trusts `from` values that start with `/` to prevent open-redirect attacks.

**Files:**
- Modify: `apps/personal-calibre/src/components/BookGrid.tsx`
- Modify: `apps/personal-calibre/src/components/BookCard.tsx`
- Modify: `apps/personal-calibre/src/app/(library)/books/[id]/page.tsx`

> `page.tsx` already passes `from={params}` from Task 1 Step 1.3.

---

- [ ] **Step 2.1 — Update `BookGrid.tsx`**

```tsx
// apps/personal-calibre/src/components/BookGrid.tsx
import type { BookSummary } from '@/types/calibre';

import { BookCard } from './BookCard';

interface Props {
  books: BookSummary[];
  from?: Record<string, string | undefined>;
}

export function BookGrid({ books, from }: Props) {
  if (books.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center">
        No books found.
      </div>
    );
  }

  const fromParam = (() => {
    if (!from) return '/';
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(from)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/?${qs}` : '/';
  })();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} from={fromParam} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2.2 — Update `BookCard.tsx`**

```tsx
// apps/personal-calibre/src/components/BookCard.tsx
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { BookSummary } from '@/types/calibre';

interface Props {
  book: BookSummary;
  from?: string;
}

export function BookCard({ book, from }: Props) {
  const href = from
    ? `/books/${book.id}?from=${encodeURIComponent(from)}`
    : `/books/${book.id}`;

  return (
    <Link href={href} className="group">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="bg-muted aspect-[2/3] w-full overflow-hidden">
          {book.hasCover ? (
            <img
              src={`/api/books/${book.id}/cover`}
              alt={`Cover of ${book.title}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-4xl">
              📚
            </div>
          )}
        </div>
        <CardContent className="p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
          {book.authors.length > 0 && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
              {book.authors.join(', ')}
            </p>
          )}
          {book.series && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs italic">
              {book.series}
              {book.seriesIndex ? ` #${book.seriesIndex}` : ''}
            </p>
          )}
          {book.formats.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {book.formats.map((fmt) => (
                <Badge key={fmt} variant="outline" className="px-1 py-0 text-[10px]">
                  {fmt}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2.3 — Update `books/[id]/page.tsx`: add `searchParams`, dynamic title, eager cover, `from` back link**

Full file replacement:

```tsx
// apps/personal-calibre/src/app/(library)/books/[id]/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import sanitizeHtml from 'sanitize-html';

import { DeliveryTracker } from '@/components/DeliveryTracker';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { listBookDeliveryEvents, listDeliveryPlatforms } from '@/lib/delivery';
import { getBook } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(Number(id));
  if (!book) return { title: 'Book Not Found — Personal Calibre Library' };
  return { title: `${book.title} — Personal Calibre Library` };
}

export default function BookDetailPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl" />}>
      <BookDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BookDetailContent({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const bookId = Number(id);

  if (Number.isNaN(bookId)) notFound();

  const [book, platforms, deliveryEvents] = await Promise.all([
    getBook(bookId),
    listDeliveryPlatforms(),
    listBookDeliveryEvents(bookId),
  ]);

  if (!book) notFound();

  const safeDescription = book.description
    ? sanitizeHtml(book.description, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['class'] },
      })
    : null;

  // Guard against open-redirect: only trust local paths.
  const backHref = from && from.startsWith('/') ? from : '/';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href={backHref} className="text-muted-foreground hover:text-foreground text-sm">
        ← Back to library
      </Link>

      <div className="flex flex-col gap-8 sm:flex-row">
        {book.hasCover && (
          <div className="shrink-0">
            <img
              src={`/api/books/${book.id}/cover`}
              alt={`Cover of ${book.title}`}
              loading="eager"
              className="h-64 w-44 rounded-md object-cover shadow-md"
            />
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{book.title}</h1>
            {book.authors.length > 0 && (
              <p className="text-muted-foreground mt-1">{book.authors.join(', ')}</p>
            )}
            {book.series && (
              <p className="text-muted-foreground text-sm">
                {book.series}
                {book.seriesIndex ? ` #${book.seriesIndex}` : ''}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {book.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {book.publisher && (
              <>
                <dt className="text-muted-foreground">Publisher</dt>
                <dd>{book.publisher}</dd>
              </>
            )}
            {book.pubdate && (
              <>
                <dt className="text-muted-foreground">Published</dt>
                <dd>{book.pubdate.slice(0, 10)}</dd>
              </>
            )}
            {book.language && (
              <>
                <dt className="text-muted-foreground">Language</dt>
                <dd>{book.language}</dd>
              </>
            )}
            {book.rating != null && (
              <>
                <dt className="text-muted-foreground">Rating</dt>
                <dd>{'★'.repeat(Math.floor(book.rating / 2))}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            {book.files.map(({ format, name }) => (
              <a
                key={format}
                href={`/api/books/${book.id}/download/${format.toLowerCase()}`}
                download={`${name}.${format.toLowerCase()}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Download {format}
              </a>
            ))}
          </div>

          <DeliveryTracker
            bookId={book.id}
            platforms={platforms}
            events={deliveryEvents}
          />
        </div>
      </div>

      {safeDescription && (
        <div className="prose prose-sm max-w-none">
          <h2 className="text-base font-semibold">Description</h2>
          <div dangerouslySetInnerHTML={{ __html: safeDescription }} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2.4 — Verify types compile**

```bash
cd apps/personal-calibre && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 2.5 — Verify back link context in browser**

1. Go to `http://localhost:8080/?q=clean`.
2. Click "Clean Agile" → URL becomes `/books/3?from=%2F%3Fq%3Dclean`.
3. Browser tab title reads "Clean Agile — Personal Calibre Library".
4. Click "← Back to library" → URL returns to `/?q=clean`.

Also: navigate directly to `/books/2` (no `from`) → back link goes to `/`.

- [ ] **Step 2.6 — Commit**

```bash
git add apps/personal-calibre/src/components/BookGrid.tsx \
        apps/personal-calibre/src/components/BookCard.tsx \
        apps/personal-calibre/src/app/\(library\)/books/\[id\]/page.tsx
git commit -m "feat(personal-calibre): preserve context in back link, dynamic title, eager cover"
```

---

## Task 3: Filter labels, search × clear button, active-filter chips

**Fixes:** U2 (three unlabelled dropdowns all showing "all"), U4 (no way to clear active search without reloading), U5 (no visible indicator of which filters are on).

**Files:**
- Modify: `apps/personal-calibre/src/components/FilterPanel.tsx`

**What changes:**
1. Each `SelectTrigger` gets a small muted label prefix ("Author", "Tag", "Series").
2. An × button inside the search box appears when any text is typed; clicking it clears the input and the `?q` param.
3. A chip row renders below the filter bar when any filter is active, with per-filter × buttons and a "Clear all" link.

---

- [ ] **Step 3.1 — Check `lucide-react` is available**

```bash
grep '"lucide-react"' apps/personal-calibre/package.json
```

If the line is absent, run:

```bash
pnpm add lucide-react --filter personal-calibre
```

- [ ] **Step 3.2 — Replace `FilterPanel.tsx`**

```tsx
// apps/personal-calibre/src/components/FilterPanel.tsx
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
      <div className="flex flex-wrap gap-2">
        {/* Search input with × clear button */}
        <div className="relative">
          <Input
            placeholder="Search books..."
            value={searchQuery}
            className="w-64 pr-8"
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
          <SelectTrigger className="w-44" aria-label="Filter by author">
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
          <SelectTrigger className="w-36" aria-label="Filter by tag">
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
          <SelectTrigger className="w-44" aria-label="Filter by series">
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
    <Suspense
      fallback={<div className="bg-muted h-10 w-full animate-pulse rounded-md" />}
    >
      <FilterPanelInner {...props} />
    </Suspense>
  );
}
```

- [ ] **Step 3.3 — Verify types compile**

```bash
cd apps/personal-calibre && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3.4 — Verify in browser**

1. Go to `http://localhost:8080/`. Filter dropdowns now show "Author · All", "Tag · All", "Series · All".
2. Type "rust" in search box → suggestions appear. Press Enter → chip `"rust"` appears below.
3. The × button inside the input is visible; clicking clears the search and URL param.
4. Select an author from the dropdown → chip "Author: ..." appears.
5. Click × on the author chip → filter clears, books update.
6. Click "Clear all" → all chips and params gone, URL is `/`.

- [ ] **Step 3.5 — Commit**

```bash
git add apps/personal-calibre/src/components/FilterPanel.tsx
git commit -m "feat(personal-calibre): filter labels, search clear button, active-filter chips"
```

---

## Task 4: Fix grid LIKE search to match author real names

**Fixes:** M2 — `getBookList({ q: 'Robert Martin' })` returns nothing because the LIKE runs on `books.author_sort` ("Martin, Robert C."), not `authors.name`.

**Files:**
- Modify: `apps/personal-calibre/src/lib/queries.ts`

---

- [ ] **Step 4.1 — Update the `q` condition in `getBookList`**

In `queries.ts`, find the `if (q)` block (lines 48–52). Replace it with:

```typescript
  if (q) {
    const authorBookIds = db
      .select({ id: booksAuthorsLink.book })
      .from(booksAuthorsLink)
      .innerJoin(authors, eq(authors.id, booksAuthorsLink.author))
      .where(like(authors.name, `%${q}%`));

    conditions.push(
      or(
        like(books.title, `%${q}%`),
        like(books.authorSort, `%${q}%`),
        inArray(books.id, authorBookIds),
      ),
    );
  }
```

All imports (`inArray`, `or`, `like`, `eq`, `authors`, `booksAuthorsLink`) are already present in the file.

- [ ] **Step 4.2 — Verify types compile**

```bash
cd apps/personal-calibre && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4.3 — Verify in browser**

Navigate to `http://localhost:8080/?q=Robert+Martin`.
Expected: "Clean Agile" (author: Robert C. Martin) appears in the grid.

Navigate to `http://localhost:8080/?q=Luca`.
Expected: "Building Micro-Frontends" (author: Luca Mezzalira) appears.

- [ ] **Step 4.4 — Commit**

```bash
git add apps/personal-calibre/src/lib/queries.ts
git commit -m "fix(personal-calibre): grid search also matches author real name not just author_sort"
```

---

## Self-Review

### Spec coverage

| Issue | Task | Status |
|---|---|---|
| B2 — invalid page contradictory empty state | Task 1 | ✅ redirect to page 1 |
| U1 — no pagination controls | Task 1 | ✅ Prev/Next `<Link>` |
| U2 — filter dropdowns unlabelled | Task 3 | ✅ label prefix + `aria-label` |
| U3 — back link loses context | Task 2 | ✅ `from` param end-to-end |
| U4 — no search clear button | Task 3 | ✅ × button inside input |
| U5 — no active filter indicators | Task 3 | ✅ chips + Clear all |
| M1 — static page title | Task 2 | ✅ `generateMetadata` added |
| M2 — LIKE misses author real names | Task 4 | ✅ subquery on `authors.name` |
| M3 — cover LCP hint | Task 2 | ✅ `loading="eager"` |

### Placeholder scan

No TBDs, TODOs, or "similar to Task N" references present. All code blocks are complete and self-contained.

### Type consistency

- `buildPageUrl` exported from `Pagination.tsx`, imported by name in `page.tsx` — consistent.
- `BookGrid.from` prop: `Record<string, string | undefined>` in both `page.tsx` call site and `BookGrid.tsx` definition.
- `BookCard.from` prop: `string | undefined` at definition; `BookGrid` passes `fromParam: string` (always a string after the IIFE) — compatible since `string` satisfies `string | undefined`.
- `books/[id]/page.tsx` — `Props.searchParams` extended with `{ from?: string }`; `generateMetadata` uses `Pick<Props, 'params'>` to avoid requiring `searchParams` — correct.
- `inArray` import in `queries.ts` — already present on line 1 (`import { and, eq, inArray, like, notInArray, or, sql }`).
