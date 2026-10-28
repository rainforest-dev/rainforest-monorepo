import {
  SHELL_IDS,
  SIDEBAR_GRID,
  useLibraryT,
} from '@rainforest-dev/library-shell';
import {
  Badge,
  Button,
  Checkbox,
  cn,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  KeyHints,
  ScrollArea,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@rainforest-dev/rainforest-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Source } from '@/lib';
import {
  activeChips,
  applicableNames,
  clampPage,
  deskHints,
  type DeskParams,
  type DeskPatch,
  facetCount,
  facetOptions,
  filterSources,
  type HistoryMode,
  notApplicableNote,
  pageCheckState,
  type SourceAction,
  SOURCES_PAGE_SIZE,
  toggleValue,
  type ViewCommand,
} from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

import { BulkToolbar } from './BulkToolbar';
import { WIDE_ONLY } from './deskRow';
import { FilterChips } from './FilterChips';
import { FilterPanel } from './FilterPanel';
import { FilterSheet } from './FilterSheet';
import { Pager } from './Pager';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { SearchField } from './SearchField';
import { READER_FEEDS_URL } from './SourceActions';
import {
  SOURCE_DETAIL_ID,
  SourceDetail,
  SourceDetailSheet,
} from './SourceDetail';
import { sourceItemButton, SourceList } from './SourceList';
import { SourceRow } from './SourceRow';
import { useDeskLayout } from './useDeskLayout';
import type { ViewKeysRef } from './useDeskShortcuts';
import type { SourceActionsState } from './useRegistryActions';
import { useRovingRows } from './useRovingRows';
import type { RowSelection } from './useRowSelection';

const BULK_ACTIONS: readonly SourceAction[] = ['activate', 'retire'];

export interface SourcesViewProps {
  sources: Source[];
  params: DeskParams;
  navigate: (patch: DeskPatch, mode?: HistoryMode) => void;
  actions: SourceActionsState;
  selection: RowSelection;
  onClearFilters: () => void;
  onValidate: () => void;
  keys?: ViewKeysRef;
}

export function SourcesView({
  sources,
  params,
  navigate,
  actions,
  selection,
  onClearFilters,
  onValidate,
  keys,
}: SourcesViewProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { isDesktop, showTable, showList } = useDeskLayout();
  const t = useLibraryT(ROOM_NAMESPACE);

  const facets = facetOptions(sources, params, t);
  const filtered = filterSources(sources, params);
  const page = clampPage(params.page, filtered.length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / SOURCES_PAGE_SIZE));
  const rows = filtered.slice(
    (page - 1) * SOURCES_PAGE_SIZE,
    page * SOURCES_PAGE_SIZE,
  );
  const pageNames = rows.map((s) => s.name);
  const pageCheck = pageCheckState(selection.selected, pageNames);
  const { selectMode } = selection;
  const bulk = selectMode && selection.selected.size > 0;
  const inlineBulk = bulk && isDesktop;
  const chips = activeChips(params, t);
  const openName = params.source;
  const open = openName ? sources.find((s) => s.name === openName) : undefined;
  const paneOpen = openName !== null;
  const roving = useRovingRows(pageNames, { page, data: sources });

  useEffect(() => {
    if (page !== params.page) navigate({ page }, 'replace');
  }, [page, params.page, navigate]);

  const lastOpen = useRef(openName);
  useEffect(() => {
    const closed = lastOpen.current;
    lastOpen.current = openName;
    if (!closed || openName) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (isDesktop) roving.focusNow({ name: closed });
    else sourceItemButton(closed)?.focus();
  });

  const goToPage = (next: number, focusFirstRow = false) => {
    navigate({ page: next });
    window.scrollTo({ top: 0 });
    if (focusFirstRow) roving.focus({ index: 0, page: next });
  };

  const runKey = (
    command: ViewCommand,
    name: string | null,
    target: Element | null,
  ) => {
    const source = name ? rows.find((s) => s.name === name) : undefined;
    const fromToolbar = target?.closest('[role="toolbar"]') != null;
    switch (command.type) {
      case 'move':
        roving.move(command.key);
        break;
      case 'page':
        goToPage(command.page, true);
        break;
      case 'open':
        if (name && name !== openName) navigate({ source: name });
        break;
      case 'toggle':
        if (!name) break;
        if (!selectMode) selection.start();
        selection.toggle(name);
        break;
      case 'activate':
      case 'retire':
        if (!name) break;
        void actions.run([name], command.type, 'row', () =>
          roving.focus({
            name,
            index: pageNames.indexOf(name),
            replacing: sources,
            ifIdle: true,
          }),
        );
        break;
      case 'resubscribe':
        if (!source) break;
        actions.resubscribe(source.name, source.url);
        window.open(READER_FEEDS_URL, '_blank', 'noopener,noreferrer');
        break;
      case 'close-pane':
        navigate({ source: null });
        roving.focus({
          name: openName,
          index: target?.closest(`#${SOURCE_DETAIL_ID}`)
            ? Math.max(0, pageNames.indexOf(roving.stop ?? ''))
            : undefined,
        });
        break;
      case 'clear-selection':
        selection.clear();
        if (fromToolbar) roving.focus({ name: roving.stop, index: 0 });
        break;
      case 'leave-select-mode':
        selection.done();
        break;
    }
  };

  useLayoutEffect(() => {
    if (!keys) return;
    keys.current = {
      state: {
        paneOpen,
        hasSelection: selection.selected.size > 0,
        selectMode,
        page,
        pageCount,
        writable: actions.writable,
      },
      rowAt: (target) => {
        const name = roving.rowAt(target);
        const source = name ? rows.find((s) => s.name === name) : undefined;
        return source
          ? {
              name: source.name,
              source,
              pending: actions.pending.has(source.name),
            }
          : null;
      },
      run: runKey,
    };
    return () => {
      keys.current = null;
    };
  });

  const closePane = () => navigate({ source: null });
  const bulkOptions = BULK_ACTIONS.map((action) => ({
    action,
    names: applicableNames(sources, selection.selected, action),
    emptyNote: notApplicableNote(action, t),
  }));

  const filterCount = facetCount(params);
  const total = sources.length;

  return (
    <div
      className={cn('flex flex-col', SIDEBAR_GRID[paneOpen ? 'pane' : 'main'])}
    >
      <aside
        id={SHELL_IDS.sidebar}
        aria-label={t('desk.filters.title')}
        className="bg-sidebar text-sidebar-foreground lg:top-(--library-top) lg:sidebar-closed:hidden max-lg:hidden lg:sticky lg:h-[calc(100dvh-var(--library-top))] lg:border-r"
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
        className={cn(
          'flex min-w-0 flex-col px-4 pb-6 lg:px-6',
          bulk && 'max-lg:pb-36',
        )}
      >
        <div className="bg-background lg:top-(--library-top) z-[5] flex flex-col gap-2 py-4 lg:sticky">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2
              id="sources-heading"
              className="text-lg font-semibold max-lg:sr-only"
            >
              {t('desk.tab.sources')}
            </h2>
            {inlineBulk ? (
              <BulkToolbar
                options={bulkOptions}
                shownNames={pageNames}
                shownScope="page"
                selection={selection}
                actions={actions}
              />
            ) : (
              <>
                <p
                  aria-live="polite"
                  className="text-muted-foreground text-sm max-lg:order-2"
                >
                  {filtered.length === total
                    ? t('desk.sources.count', { total })
                    : t('desk.sources.countOf', {
                        shown: filtered.length,
                        total,
                      })}
                </p>
                <div className="flex w-full items-center gap-2 max-lg:contents lg:ml-auto lg:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="max-lg:order-1 lg:hidden"
                    aria-haspopup="dialog"
                    onClick={() => setFiltersOpen(true)}
                  >
                    {t('desk.filters.title')}{' '}
                    {filterCount > 0 && (
                      <Badge className="tabular-nums">
                        {filterCount}
                        <span className="sr-only">
                          {t('desk.filters.applied')}
                        </span>
                      </Badge>
                    )}
                  </Button>
                  <SearchField
                    value={params.q}
                    label={t('desk.search.sources')}
                    tab="sources"
                    className="w-full max-lg:order-first lg:w-72"
                    onChange={(q) => {
                      if (q !== params.q) navigate({ q });
                    }}
                  />
                  {total > 0 && !bulk && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="max-lg:order-3 max-lg:ml-auto"
                      onClick={selectMode ? selection.done : selection.start}
                    >
                      {selectMode ? t('desk.bulk.done') : t('desk.select')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
          <FilterChips
            chips={chips}
            onRemove={(patch) => navigate(patch)}
            onClear={onClearFilters}
          />
        </div>

        {!actions.writable && (
          <div className="pb-4">
            <ReadOnlyBanner />
          </div>
        )}

        {total === 0 ? (
          <Empty className="border py-12">
            <EmptyHeader>
              <EmptyTitle>{t('desk.sources.none')}</EmptyTitle>
              <EmptyDescription>{t('desk.sources.noneHint')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onValidate}>
                {t('desk.sources.validate')}
              </Button>
            </EmptyContent>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty className="border py-12">
            <EmptyHeader>
              <EmptyTitle>{t('desk.sources.noMatch')}</EmptyTitle>
              <EmptyDescription>
                {t('desk.sources.noMatchHint', { count: chips.length })}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                {t('desk.sources.clearFilters')}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {showTable && (
              <Table
                ref={roving.ref}
                role="grid"
                aria-labelledby="sources-heading"
                aria-multiselectable={selectMode || undefined}
                className="table-fixed max-lg:hidden md:table-auto"
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {selectMode && (
                      <TableHead className="w-10">
                        <Checkbox
                          aria-label={t('desk.selectAllPage')}
                          checked={pageCheck === 'all'}
                          indeterminate={pageCheck === 'some'}
                          onCheckedChange={() =>
                            pageCheck === 'all'
                              ? selection.removeMany(pageNames)
                              : selection.addMany(pageNames)
                          }
                        />
                      </TableHead>
                    )}
                    <TableHead>{t('desk.col.source')}</TableHead>
                    {!paneOpen && (
                      <>
                        <TableHead className={WIDE_ONLY}>
                          {t('desk.col.category')}
                        </TableHead>
                        <TableHead className={WIDE_ONLY}>
                          {t('desk.col.tags')}
                        </TableHead>
                      </>
                    )}
                    <TableHead>{t('desk.col.status')}</TableHead>
                    {!paneOpen && (
                      <TableHead className={WIDE_ONLY}>
                        {t('desk.col.proposed')}
                      </TableHead>
                    )}
                    <TableHead className="w-40">
                      <span className="sr-only">{t('desk.col.actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((source) => (
                    <SourceRow
                      key={source.name}
                      source={source}
                      open={source.name === openName}
                      tabIndex={source.name === roving.stop ? 0 : -1}
                      compact={paneOpen}
                      actions={actions}
                      selectMode={selectMode}
                      selected={selection.selected.has(source.name)}
                      onToggle={() => selection.toggle(source.name)}
                      onOpen={() => {
                        if (source.name !== openName)
                          navigate({ source: source.name });
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
            {showList && (
              <SourceList
                sources={rows}
                labelledBy="sources-heading"
                openName={openName}
                pending={actions.pending}
                selection={selection}
                onOpen={(name) => {
                  if (name !== openName) navigate({ source: name });
                }}
              />
            )}
            <Pager
              page={page}
              pageSize={SOURCES_PAGE_SIZE}
              total={filtered.length}
              onPage={(next) => goToPage(next)}
            />
          </>
        )}
        <KeyHints
          hints={deskHints('sources', pageCount > 1, t)}
          className="bg-background sticky bottom-0 z-[5] mt-auto hidden border-t py-2 lg:flex"
        />
      </section>

      {openName !== null && isDesktop && (
        <aside
          id={SOURCE_DETAIL_ID}
          aria-label={t('desk.sources.details')}
          className="bg-card text-card-foreground lg:top-(--library-top) max-lg:hidden lg:sticky lg:h-[calc(100dvh-var(--library-top))] lg:overflow-y-auto lg:border-l"
        >
          <SourceDetail
            name={openName}
            source={open}
            actions={actions}
            onClose={closePane}
          />
        </aside>
      )}

      {!isDesktop && (
        <>
          <FilterSheet
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            filters={params}
            facets={facets}
            shown={filtered.length}
            onToggle={(key, value) =>
              navigate({ [key]: toggleValue(params[key], value) })
            }
            onClear={onClearFilters}
          />
          <SourceDetailSheet
            name={openName}
            sources={sources}
            actions={actions}
            onClose={closePane}
            returnFocus={sourceItemButton}
          />
          {bulk && (
            <BulkToolbar
              floating
              options={bulkOptions}
              shownNames={pageNames}
              shownScope="page"
              selection={selection}
              actions={actions}
            />
          )}
        </>
      )}
    </div>
  );
}
