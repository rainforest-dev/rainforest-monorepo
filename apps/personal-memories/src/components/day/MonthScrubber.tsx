import {
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { useEffect, useRef } from 'react';

import { monthOf, type ScrubberMonth } from '../../lib/months.ts';
import { useActiveDay } from '../useActiveDay.ts';

type Props = { months: ScrubberMonth[]; date: string };

export function MonthScrubber({ months, date }: Props) {
  const active = monthOf(useActiveDay(date) ?? date);
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <TooltipProvider>
      <nav aria-label="月份" className="h-full">
        <ScrollArea className="h-full">
          <ol className="flex flex-col py-2">
            {months.map((m, i) => {
              const year = m.month.slice(0, 4);
              const newYear =
                i === 0 || months[i - 1]?.month.slice(0, 4) !== year;
              const isActive = m.month === active;
              return (
                <li key={m.month}>
                  {newYear && (
                    <span className="text-muted-foreground block px-2 pt-2 text-xs tabular-nums">
                      {year}
                    </span>
                  )}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          ref={isActive ? current : undefined}
                          href={`/day/${m.first}`}
                          data-month={m.month}
                          aria-current={isActive ? 'date' : undefined}
                          className={`focus-visible:ring-ring text-meta flex h-9 items-center gap-2 rounded-md px-2 tabular-nums outline-none focus-visible:ring-2 ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        />
                      }
                    >
                      <span
                        aria-hidden
                        className={`size-1 rounded-full ${isActive ? 'bg-primary' : 'bg-border'}`}
                      />
                      {Number(m.month.slice(5))} 月
                    </TooltipTrigger>
                    <TooltipContent side="right">{m.total} 則</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      </nav>
    </TooltipProvider>
  );
}
