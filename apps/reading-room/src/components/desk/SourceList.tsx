import {
  Checkbox,
  cn,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '@rainforest-dev/rainforest-react';
import { ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';

import type { Source } from '@/lib';
import { feedHost, visibleStale } from '@/lib/desk';

import { StaleBadge, StatusBadge } from './StatusBadges';
import type { RowSelection } from './useRowSelection';

export const SOURCE_ITEM_ATTR = 'data-source-item';

export const PHONE_ITEM_CLASS = cn(
  'relative rounded-none',
  'data-[pending]:opacity-60 data-[selected]:bg-primary/10',
);

export const STRETCHED_BUTTON_CLASS = cn(
  'min-w-0 truncate text-left outline-none',
  'after:absolute after:inset-0',
  'focus-visible:after:ring-ring/50 focus-visible:after:ring-[3px] focus-visible:after:ring-inset',
);

export function sourceItemButton(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[${SOURCE_ITEM_ATTR}="${CSS.escape(name)}"]`,
  );
}

export interface SourceListProps {
  sources: readonly Source[];
  labelledBy: string;
  openName: string | null;
  pending: ReadonlySet<string>;
  selection: RowSelection;
  onOpen: (name: string) => void;
}

export function SourceList({
  sources,
  labelledBy,
  openName,
  pending,
  selection,
  onOpen,
}: SourceListProps) {
  const { selectMode, selected } = selection;
  return (
    <ItemGroup
      aria-labelledby={labelledBy}
      className="gap-0 rounded-lg border lg:hidden"
    >
      {sources.map((source) => {
        const stale = visibleStale(source);
        const isSelected = selectMode && selected.has(source.name);
        return (
          <Fragment key={source.name}>
            <ItemSeparator />
            <Item
              role="listitem"
              data-pending={pending.has(source.name) || undefined}
              data-selected={isSelected || undefined}
              className={cn(
                PHONE_ITEM_CLASS,
                'flex-nowrap',
                selectMode && 'cursor-pointer',
              )}
              onClick={
                selectMode ? () => selection.toggle(source.name) : undefined
              }
            >
              {selectMode && (
                <Checkbox
                  aria-label={`Select ${source.name}`}
                  checked={isSelected}
                  onCheckedChange={() => selection.toggle(source.name)}
                  onClick={(event) => event.stopPropagation()}
                />
              )}
              <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle className="max-w-full">
                  {selectMode ? (
                    <span className="truncate">{source.name}</span>
                  ) : (
                    <button
                      type="button"
                      {...{ [SOURCE_ITEM_ATTR]: source.name }}
                      aria-haspopup="dialog"
                      aria-current={source.name === openName || undefined}
                      onClick={() => onOpen(source.name)}
                      className={STRETCHED_BUTTON_CLASS}
                    >
                      {source.name}
                    </button>
                  )}
                </ItemTitle>
                <ItemDescription className="truncate font-mono text-xs">
                  {feedHost(source.url)}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="max-w-[55%] shrink-0 gap-1">
                <div className="flex flex-wrap justify-end gap-1">
                  <StatusBadge status={source.status} />
                  {stale && <StaleBadge stale={stale} />}
                </div>
                {!selectMode && (
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                )}
              </ItemActions>
            </Item>
          </Fragment>
        );
      })}
    </ItemGroup>
  );
}
