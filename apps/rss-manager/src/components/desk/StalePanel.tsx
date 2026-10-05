import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '@rainforest-dev/rainforest-react';
import { Fragment } from 'react';

import type { StaleItem } from '@/lib';
import { groupStale } from '@/lib/desk';

import { DecayBadge } from './QueueRow';

export function StalePanel({ stale }: { stale: readonly StaleItem[] }) {
  return (
    <section
      aria-labelledby="stale-heading"
      className="mt-8 flex flex-col gap-4"
    >
      <div>
        <h3 id="stale-heading" className="text-base font-semibold">
          Stale ({stale.length})
        </h3>
        <p className="text-muted-foreground text-sm">
          Read-only. Archive these in Readwise yourself; this app never writes
          to Reader.
        </p>
      </div>
      {groupStale(stale).map(({ reason, label, items }) => (
        <div key={reason} className="flex flex-col gap-2">
          <h4
            id={`stale-${reason}`}
            className="text-muted-foreground text-sm font-medium"
          >
            {label} <span className="tabular-nums">({items.length})</span>
          </h4>
          <ItemGroup
            aria-labelledby={`stale-${reason}`}
            className="gap-0 rounded-lg border"
          >
            {items.map((item) => (
              <Fragment key={item.id}>
                <ItemSeparator />
                <Item role="listitem" size="sm" className="rounded-none">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="max-w-full">
                      <a
                        href={item.readerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline"
                      >
                        {item.title}
                      </a>
                    </ItemTitle>
                    <ItemDescription className="line-clamp-1" title={item.why}>
                      {item.why}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <DecayBadge decay={item.decay} />
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.savedAt}
                    </span>
                  </ItemActions>
                </Item>
              </Fragment>
            ))}
          </ItemGroup>
        </div>
      ))}
    </section>
  );
}
