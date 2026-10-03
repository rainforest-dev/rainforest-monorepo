import {
  Button,
  cn,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  ScrollArea,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@rainforest-dev/rainforest-react';
import { useEffect, useRef, useState } from 'react';

import type { Source } from '@/lib';
import {
  activeChips,
  clampPage,
  type DeskParams,
  type DeskPatch,
  facetCount,
  facetOptions,
  filterSources,
  type HistoryMode,
  SOURCES_PAGE_SIZE,
  toggleValue,
} from '@/lib/desk';

import { FilterChips } from './FilterChips';
import { FilterPanel } from './FilterPanel';
import { Pager } from './Pager';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { SearchField } from './SearchField';
import { SOURCE_DETAIL_ID, SourceDetail } from './SourceDetail';
import { SourceRow, WIDE_ONLY } from './SourceRow';
import { useSourceActions } from './useSourceActions';

export interface SourcesViewProps {
  sources: Source[];
  writable: boolean;
  params: DeskParams;
  navigate: (patch: DeskPatch, mode?: HistoryMode) => void;
  onClearFilters: () => void;
  onSourcesChange: (update: (prev: Source[]) => Source[]) => void;
  onReadOnly: () => void;
  onValidate: () => void;
}

const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"]';
const TYPING = 'input, textarea, select, [contenteditable="true"]';

function focusRow(name: string) {
  const row = [
    ...document.querySelectorAll<HTMLElement>('tr[data-source]'),
  ].find((r) => r.dataset['source'] === name);
  row?.querySelector<HTMLElement>('[data-source-open]')?.focus();
}

export function SourcesView({
  sources,
  writable,
  params,
  navigate,
  onClearFilters,
  onSourcesChange,
  onReadOnly,
  onValidate,
}: SourcesViewProps) {
  const actions = useSourceActions({ writable, onSourcesChange, onReadOnly });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const facets = facetOptions(sources, params);
  const filtered = filterSources(sources, params);
  const page = clampPage(params.page, filtered.length);
  const rows = filtered.slice(
    (page - 1) * SOURCES_PAGE_SIZE,
    page * SOURCES_PAGE_SIZE,
  );
  const chips = activeChips(params);
  const openName = params.source;
  const open = openName ? sources.find((s) => s.name === openName) : undefined;
  const paneOpen = openName !== null;

  useEffect(() => {
    if (page !== params.page) navigate({ page }, 'replace');
  }, [page, params.page, navigate]);

  const lastOpen = useRef(openName);
  useEffect(() => {
    const closed = lastOpen.current;
    lastOpen.current = openName;
    if (!closed || openName) return;
    const active = document.activeElement;
    if (!active || active === document.body) focusRow(closed);
  }, [openName]);

  useEffect(() => {
    if (!paneOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest(OVERLAY) || target.closest(TYPING))
      )
        return;
      navigate({ source: null });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paneOpen, navigate]);

  const closePane = () => navigate({ source: null });

  const filterCount = facetCount(params);
  const total = sources.length;

  return (
    <div
      className={cn(
        'flex flex-col lg:grid lg:grid-cols-[248px_minmax(0,1fr)]',
        paneOpen && 'lg:grid-cols-[248px_minmax(0,1fr)_400px]',
      )}
    >
      <aside
        aria-label="Filters"
        className={cn(
          'bg-sidebar text-sidebar-foreground border-b lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:border-b-0 lg:border-r',
          !filtersOpen && 'max-lg:hidden',
        )}
      >
        <ScrollArea className="h-full">
          <FilterPanel
            filters={params}
            facets={facets}
            onToggle={(key, value) =>
              navigate({ [key]: toggleValue(params[key], value) })
            }
            onClear={onClearFilters}
          />
        </ScrollArea>
      </aside>

      <section
        aria-labelledby="sources-heading"
        className="flex min-w-0 flex-col px-4 pb-6 lg:px-6"
      >
        <div className="bg-background z-[5] flex flex-col gap-2 py-4 lg:sticky lg:top-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="sources-heading" className="text-lg font-semibold">
              Sources
            </h2>
            <p aria-live="polite" className="text-muted-foreground text-sm">
              {filtered.length === total
                ? `${total} sources`
                : `${filtered.length} of ${total} sources`}
            </p>
            <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                {filterCount > 0 ? `Filters · ${filterCount}` : 'Filters'}
              </Button>
              <SearchField
                value={params.q}
                label="Search sources"
                onChange={(q) => {
                  if (q !== params.q) navigate({ q });
                }}
              />
            </div>
          </div>
          <FilterChips
            chips={chips}
            onRemove={(patch) => navigate(patch)}
            onClear={onClearFilters}
          />
        </div>

        {!writable && (
          <div className="pb-4">
            <ReadOnlyBanner />
          </div>
        )}
        {actions.error && !paneOpen && (
          <p role="alert" className="text-destructive pb-4 text-sm">
            {actions.error}
          </p>
        )}

        {total === 0 ? (
          <Empty className="border py-12">
            <EmptyHeader>
              <EmptyTitle>No sources yet</EmptyTitle>
              <EmptyDescription>
                Sources show up here once rss-discover proposes them.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onValidate}>
                Validate a feed URL
              </Button>
            </EmptyContent>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty className="border py-12">
            <EmptyHeader>
              <EmptyTitle>No sources match</EmptyTitle>
              <EmptyDescription>
                {chips.length === 1
                  ? '1 filter applied. Remove it or clear them all.'
                  : `${chips.length} filters applied. Remove one or clear them all.`}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <Table
              aria-labelledby="sources-heading"
              className="table-fixed md:table-auto"
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Source</TableHead>
                  {!paneOpen && (
                    <>
                      <TableHead className={WIDE_ONLY}>Category</TableHead>
                      <TableHead className={WIDE_ONLY}>Tags</TableHead>
                    </>
                  )}
                  <TableHead>Status</TableHead>
                  {!paneOpen && (
                    <TableHead className={WIDE_ONLY}>Proposed</TableHead>
                  )}
                  <TableHead className="w-28">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((source) => (
                  <SourceRow
                    key={source.name}
                    source={source}
                    open={source.name === openName}
                    compact={paneOpen}
                    actions={actions}
                    onOpen={() => {
                      if (source.name !== openName)
                        navigate({ source: source.name });
                    }}
                  />
                ))}
              </TableBody>
            </Table>
            <Pager
              page={page}
              pageSize={SOURCES_PAGE_SIZE}
              total={filtered.length}
              onPage={(next) => {
                navigate({ page: next });
                window.scrollTo({ top: 0 });
              }}
            />
          </>
        )}
      </section>

      {openName !== null && (
        <aside
          id={SOURCE_DETAIL_ID}
          aria-label="Source details"
          className="bg-card text-card-foreground border-b max-lg:order-first lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-l"
        >
          <SourceDetail
            name={openName}
            source={open}
            actions={actions}
            onClose={closePane}
          />
        </aside>
      )}
    </div>
  );
}
