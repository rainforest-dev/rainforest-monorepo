'use client';

import { getCollection } from '@rainforest-dev/library-contract';
import { useLibraryT } from '@rainforest-dev/library-shell';
import { buttonVariants } from '@rainforest-dev/rainforest-react';
import { List } from 'lucide-react';

import { HallView } from '@/components/hall';
import { cn } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';

import { GroupSwitch } from './GroupSwitch';

export interface SourceNotice {
  collection: string;
  label: string;
}

/** The room itself: how the bookcases are sorted, the hall, and any shelf that failed to load. */
export function HallRegion({ missing }: { missing: readonly SourceNotice[] }) {
  const t = useLibraryT(HALL_NAMESPACE);
  return (
    <section
      aria-label={t('hall.region')}
      data-view-region="hall"
      className="flex flex-col gap-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <GroupSwitch />
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {t('groupBy.hint')}
        </span>
        <a
          href={getCollection('books').basePath}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'ml-auto',
          )}
        >
          <List aria-hidden />
          {t('hall.browseList')}
        </a>
      </div>
      {missing.length > 0 && (
        <p
          role="status"
          data-hall-missing
          className="text-muted-foreground text-sm"
        >
          {t('hall.missing', {
            names: missing.map((m) => m.label).join(t('shell:list.separator')),
          })}
        </p>
      )}
      <HallView />
    </section>
  );
}
