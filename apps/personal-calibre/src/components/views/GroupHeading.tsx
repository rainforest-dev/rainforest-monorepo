'use client';

import { Button } from '@rainforest-dev/rainforest-react';

import { useLibrary } from '@/components/library/LibraryProvider';
import { booksLabel, type EntryGroup, groupTitle } from '@/lib/group-entries';
import type { ParamPatch } from '@/lib/library-params';
import { cn } from '@/lib/utils';

export function GroupHeading({
  group,
  shown,
}: {
  group: EntryGroup;
  shown: number;
}) {
  const { replaceParams } = useLibrary();
  const filter = group.filter;
  return (
    <div className="flex items-baseline gap-3">
      <h2
        className={cn(
          'text-heading font-semibold',
          group.continued && 'text-muted-foreground',
        )}
      >
        {groupTitle(group)}
      </h2>
      <span className="text-muted-foreground text-sm">
        {booksLabel(group.total)}
      </span>
      {filter && group.total > shown && (
        <Button
          variant="link"
          size="xs"
          className="ml-auto"
          onClick={() => {
            const patch: ParamPatch = { groupBy: null };
            patch[filter.param] = filter.id;
            replaceParams(patch);
          }}
        >
          See all {group.total}
        </Button>
      )}
    </div>
  );
}
