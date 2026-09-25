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
import { useMemo, useState } from 'react';

import { groupByMonth, jumpTarget, matchDates } from '../../lib/jump.ts';
import { monthLabel } from '../../lib/months.ts';
import { dayHeading } from '../../lib/weeks.ts';
import type { DayCount } from './useChrome.ts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DayCount[] | 'error' | undefined;
  onGo: (date: string, nearest: boolean) => void;
};

export function DateJump({ open, onOpenChange, days, onGo }: Props) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => (Array.isArray(days) ? days : []), [days]);
  const dates = useMemo(() => list.map((d) => d.date), [list]);
  const totals = useMemo(
    () => new Map(list.map((d) => [d.date, d.total])),
    [list],
  );
  const groups = useMemo(
    () => groupByMonth(matchDates(dates, query)),
    [dates, query],
  );
  const target = groups.length === 0 ? jumpTarget(dates, query) : undefined;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
      }}
      title="跳至日期"
      description="YYYY-MM-DD"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="YYYY-MM-DD"
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !target) return;
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
                ? `沒有這一天，按 Enter 跳到最近的 ${target.date}`
                : '沒有這一天'}
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
