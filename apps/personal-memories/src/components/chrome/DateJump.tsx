import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Skeleton,
} from '@rainforest-dev/rainforest-react';
import { isComposing } from '@rainforest-dev/rainforest-ui/interaction';
import { useMemo, useState } from 'react';

import {
  type DateRange,
  dayHeading,
  groupByMonth,
  localISODate,
  monthLabel,
  searchDates,
} from '@/lib';

import type { DayCount } from './useChrome.ts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DayCount[] | 'error' | undefined;
  onGo: (date: string, nearest: boolean) => void;
};

const PLACEHOLDER = '2025-11-08、上週六、中秋';

const rangeLabel = ({ start, end }: DateRange) =>
  start === end ? start : `${start} – ${end}`;

export function DateJump({ open, onOpenChange, days, onGo }: Props) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => (Array.isArray(days) ? days : []), [days]);
  const dates = useMemo(() => list.map((d) => d.date), [list]);
  const totals = useMemo(
    () => new Map(list.map((d) => [d.date, d.total])),
    [list],
  );
  const today = localISODate(new Date());
  const result = useMemo(
    () => searchDates(dates, query, today),
    [dates, query, today],
  );
  const groups = useMemo(
    () => groupByMonth(result.hits.map((hit) => hit.date)),
    [result],
  );
  const target = groups.length === 0 ? result.target : undefined;
  const missing = result.range
    ? `${query.trim()}（${rangeLabel(result.range)}）沒有紀錄`
    : '沒有這一天';

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
      }}
      title="跳至日期"
      description={PLACEHOLDER}
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || isComposing(e.nativeEvent) || !target)
              return;
            e.preventDefault();
            onGo(target.date, !target.exact);
          }}
        />
        <CommandList>
          {days === undefined && (
            <div className="flex flex-col gap-2 p-2" aria-label="載入中…">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          )}
          {days === 'error' && (
            <p className="text-muted-foreground text-meta p-3">
              載入失敗，請再開一次
            </p>
          )}
          {Array.isArray(days) && (
            <CommandEmpty>
              {target
                ? `${missing}，按 Enter 跳到最近的 ${target.date}`
                : missing}
            </CommandEmpty>
          )}
          {groups.map(({ month, dates: inMonth }) => (
            <CommandGroup key={month} heading={monthLabel(month)}>
              {inMonth.map((date) => (
                <CommandItem
                  key={date}
                  value={date}
                  onSelect={() => onGo(date, false)}
                >
                  {dayHeading(date)}
                  <CommandShortcut>{totals.get(date)} 則</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
