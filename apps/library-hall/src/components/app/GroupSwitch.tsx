'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { cn } from '@rainforest-dev/rainforest-react';

import { availableGroupBys } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';
import { useHall } from '@/providers';

/** How the bookcases are sorted. Switching sends every book flying to its new bookcase. */
export function GroupSwitch() {
  const { books, groupBy, setGroupBy } = useHall();
  const options = availableGroupBys(books);
  const t = useLibraryT(HALL_NAMESPACE);
  return (
    <div
      role="group"
      aria-label={t('groupBy.label')}
      className="bg-card flex w-fit flex-wrap rounded-lg border p-0.5"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === groupBy}
          data-group-by={option}
          onClick={() => setGroupBy(option)}
          className={cn(
            'focus-visible:ring-ring min-h-9 rounded-md px-3 text-sm outline-none focus-visible:ring-2',
            option === groupBy
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-foreground hover:bg-muted',
          )}
        >
          {t(`groupBy.${option}`)}
        </button>
      ))}
    </div>
  );
}
