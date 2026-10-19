'use client';

import { getCollection } from '@rainforest-dev/library-contract';
import { buttonVariants } from '@rainforest-dev/rainforest-react';
import { List } from 'lucide-react';

import { HallView } from '@/components/hall';
import { cn } from '@/lib';

import { GroupSwitch } from './GroupSwitch';

export interface SourceNotice {
  collection: string;
  label: string;
}

/** The room itself: how the bookcases are sorted, the hall, and any shelf that failed to load. */
export function HallRegion({ missing }: { missing: readonly SourceNotice[] }) {
  return (
    <section
      aria-label="大廳"
      data-view-region="hall"
      className="flex flex-col gap-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <GroupSwitch />
        <span className="text-muted-foreground hidden text-xs sm:inline">
          切換時書會飛到新書櫃
        </span>
        <a
          href={getCollection('books').basePath}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'ml-auto',
          )}
        >
          <List aria-hidden />
          以清單瀏覽
        </a>
      </div>
      {missing.length > 0 && (
        <p
          role="status"
          data-hall-missing
          className="text-muted-foreground text-sm"
        >
          {missing.map((m) => m.label).join('、')}
          暫時無法載入，書櫃上先不放它們。
        </p>
      )}
      <HallView />
    </section>
  );
}
