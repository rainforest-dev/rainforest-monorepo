import { CommandGroup, CommandItem } from '@rainforest-dev/rainforest-react';

import { dayHeading } from '@/lib';
import type { SearchResult } from '@/lib/server';

type Props = {
  results: SearchResult[];
  degraded: boolean;
  onGo: (date: string) => void;
};

export function ContentResults({ results, degraded, onGo }: Props) {
  if (results.length === 0) return null;
  return (
    <>
      {degraded && (
        <p className="text-muted-foreground px-3 pt-2 text-xs">
          語意搜尋暫時無法使用，只顯示字面相符的結果
        </p>
      )}
      <CommandGroup heading="內容">
        {results.map(({ date, snippet }) => (
          <CommandItem
            key={date}
            value={`content:${date}`}
            onSelect={() => onGo(date)}
            className="flex flex-col items-start gap-0.5"
          >
            <span>{dayHeading(date)}</span>
            <span className="text-muted-foreground line-clamp-1 text-xs">
              {snippet}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
