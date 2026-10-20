'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { Button } from '@rainforest-dev/rainforest-react';

import { cn, type EntryGroup, groupTitle, type ParamPatch } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

export function GroupHeading({
  group,
  shown,
}: {
  group: EntryGroup;
  shown: number;
}) {
  const { replaceParams } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const filter = group.filter;
  return (
    <div className="flex items-baseline gap-3">
      <h2
        className={cn(
          'text-heading font-semibold',
          group.continued && 'text-muted-foreground',
        )}
      >
        {groupTitle(group, t)}
      </h2>
      <span className="text-muted-foreground text-sm">
        {t('books', { count: group.total })}
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
          {t('group.seeAll', { count: group.total })}
        </Button>
      )}
    </div>
  );
}
