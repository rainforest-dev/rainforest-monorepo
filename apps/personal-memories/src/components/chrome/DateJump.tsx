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
import { localParser } from '@/lib/search';

import { AiParseSwitch } from './AiParseSwitch.tsx';
import { ContentResults } from './ContentResults.tsx';
import type { DayCount } from './useChrome.ts';
import { useContentSearch, usePeople } from './useContentSearch.ts';
import { usePromptParse } from './usePromptParse.ts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DayCount[] | 'error' | undefined;
  onGo: (date: string, nearest: boolean) => void;
};

const PLACEHOLDER = '2025-11-08、上週六、中秋';
const NUMERIC_DATE = /^[\d\s\-/.年月日號]+$/u;

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
  const [composing, setComposing] = useState(false);
  const people = usePeople(open);
  const numericDate = NUMERIC_DATE.test(query.trim());
  const parsed = useMemo(
    () =>
      query.trim() && !numericDate
        ? localParser(query, today, people)
        : undefined,
    [query, today, people, numericDate],
  );
  const dateOnly =
    numericDate || !parsed || (!parsed.text && !parsed.people?.length);
  const groups = useMemo(
    () => (dateOnly ? groupByMonth(result.hits.map((hit) => hit.date)) : []),
    [result, dateOnly],
  );
  const ai = usePromptParse({ raw: query, today, people, open, composing });
  const searchQuery = numericDate ? undefined : ai.useAi ? ai.aiQuery : parsed;
  const content = useContentSearch(open ? searchQuery : undefined, composing);
  const pending = content.loading || ai.pending;
  const target =
    dateOnly && groups.length === 0 && content.results.length === 0 && !pending
      ? result.target
      : undefined;
  const missing = result.range
    ? `${query.trim()}（${rangeLabel(result.range)}）沒有紀錄`
    : '沒有這一天';

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery('');
          setComposing(false);
        }
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
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
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
          {Array.isArray(days) && !pending && (
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
          {content.error && (
            <p className="text-muted-foreground px-3 pt-2 text-xs">
              搜尋失敗，請再試一次
            </p>
          )}
          <ContentResults
            results={content.results}
            degraded={content.reason !== undefined}
            onGo={(date) => onGo(date, false)}
          />
        </CommandList>
        <AiParseSwitch
          on={ai.on}
          supported={ai.supported}
          status={ai.status}
          onToggle={(next) => void ai.toggle(next)}
        />
      </Command>
    </CommandDialog>
  );
}
