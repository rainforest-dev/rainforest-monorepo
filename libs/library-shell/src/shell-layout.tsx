'use client';

import {
  cn,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@rainforest-dev/rainforest-react';
import { type ComponentProps, type ReactNode } from 'react';

import { SHELL_IDS } from './ids';

const COLUMNS = {
  both: 'lg:grid-cols-[248px_minmax(0,1fr)_420px]',
  filters: 'lg:grid-cols-[248px_minmax(0,1fr)]',
  pane: 'lg:grid-cols-[minmax(0,1fr)_420px]',
  none: 'lg:grid-cols-1',
} as const;

const SIDE_COLUMN =
  'hidden lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto';

export interface ShellLabels {
  filters: string;
  closeFilters: string;
  pane: string;
}

const DEFAULT_LABELS: ShellLabels = {
  filters: 'Filters',
  closeFilters: 'Close filters',
  pane: 'Details',
};

export interface ShellLayoutProps extends Omit<
  ComponentProps<'div'>,
  'children'
> {
  header: ReactNode;
  children: ReactNode;
  /**
   * `browse` lays out filters | content | detail pane; `page` is a single padded column for
   * pages without a list (a reader, a settings page).
   */
  mode?: 'browse' | 'page';
  filters?: ReactNode;
  pane?: ReactNode;
  /** At `lg` and up the filters and pane are columns; below it they are sheets. */
  isDesktop: boolean;
  /** Desktop: whether the filter column shows. */
  filtersVisible?: boolean;
  /** Whether something is selected for the pane, on every width. */
  paneOpen?: boolean;
  /** Below `lg`: whether the filter sheet is open. */
  filtersSheetOpen?: boolean;
  onFiltersSheetOpenChange?: (open: boolean) => void;
  /** Below `lg`: the pane sheet was dismissed. */
  onPaneClose?: () => void;
  labels?: Partial<ShellLabels>;
}

/**
 * The library's page frame: the shared header, then filters, content and a detail pane as
 * columns on desktop and sheets on phones and tablets. State stays with the app; the frame
 * only lays it out.
 */
export function ShellLayout({
  header,
  children,
  mode = 'browse',
  filters,
  pane,
  isDesktop,
  filtersVisible = false,
  paneOpen = false,
  filtersSheetOpen = false,
  onFiltersSheetOpenChange,
  onPaneClose,
  labels: labelOverrides,
  className,
  ...props
}: ShellLayoutProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const browse = mode === 'browse';
  const hasFilters = filters !== undefined;
  const hasPane = pane !== undefined;
  const columns =
    hasFilters && filtersVisible
      ? hasPane && paneOpen
        ? 'both'
        : 'filters'
      : hasPane && paneOpen
        ? 'pane'
        : 'none';

  return (
    <div
      // Floating bars read --library-tab-bar to sit above the phone tab bar.
      className={cn(
        'min-h-dvh [--library-tab-bar:4rem] sm:[--library-tab-bar:0px]',
        className,
      )}
      {...props}
    >
      {header}
      {browse ? (
        <div className={cn('lg:grid', COLUMNS[columns])}>
          {isDesktop && hasFilters && (
            <aside
              id={SHELL_IDS.filters}
              aria-label={labels.filters}
              hidden={!filtersVisible}
              className={cn(
                'bg-sidebar text-sidebar-foreground border-r',
                SIDE_COLUMN,
              )}
            >
              {filters}
            </aside>
          )}
          <main
            id={SHELL_IDS.main}
            className="min-w-0 px-3 pb-24 lg:px-6 lg:pb-0"
          >
            {children}
          </main>
          {isDesktop && hasPane && paneOpen && (
            <aside
              aria-label={labels.pane}
              className={cn('bg-card border-l', SIDE_COLUMN)}
            >
              {pane}
            </aside>
          )}
        </div>
      ) : (
        // Bottom room below `sm` for the phone tab bar.
        <main id={SHELL_IDS.main} className="px-3 pb-24 pt-6 sm:pb-6 lg:px-6">
          {children}
        </main>
      )}
      {browse && !isDesktop && (
        <>
          {hasFilters && (
            <Sheet
              side="left"
              open={filtersSheetOpen}
              onOpenChange={(open) => onFiltersSheetOpenChange?.(open)}
            >
              <SheetContent
                closeLabel={labels.closeFilters}
                className="bg-sidebar"
              >
                <SheetHeader>
                  <SheetTitle>{labels.filters}</SheetTitle>
                </SheetHeader>
                <SheetBody className="px-0">{filters}</SheetBody>
              </SheetContent>
            </Sheet>
          )}
          {hasPane && (
            <Sheet
              side="bottom"
              open={paneOpen}
              onOpenChange={(open) => {
                if (!open) onPaneClose?.();
              }}
            >
              <SheetContent showCloseButton={false} className="h-[92dvh]">
                <SheetTitle className="sr-only" render={<span />}>
                  {labels.pane}
                </SheetTitle>
                <SheetBody className="px-0">{pane}</SheetBody>
              </SheetContent>
            </Sheet>
          )}
        </>
      )}
    </div>
  );
}
