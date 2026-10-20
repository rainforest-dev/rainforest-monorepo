import { Badge, TabsList, TabsTrigger } from '@rainforest-dev/rainforest-react';
import type { ReactNode } from 'react';

export interface DeskCounts {
  sources: number | null;
  queue: number | null;
  proposedTopics: number;
}

export interface DeskHeaderProps {
  counts: DeskCounts;
  file: string;
  actions: ReactNode;
}

function Count({ value }: { value: number | null }) {
  if (value === null) return null;
  return <span className="text-muted-foreground tabular-nums">{value}</span>;
}

/**
 * The desk's tab row, under the library's shared top bar. It scrolls away with the page, so the
 * views' sticky toolbars still sit right under the 56px shell header. A named region, so it is
 * a landmark like the bar above it.
 */
export function DeskHeader({ counts, file, actions }: DeskHeaderProps) {
  return (
    <section aria-label="Registry desk" className="bg-background border-b">
      <div className="flex items-center gap-x-6 px-4 lg:h-12 lg:px-6">
        <TabsList
          variant="line"
          aria-label="Registry"
          className="-mx-1 h-12 min-w-0 flex-1 justify-start lg:h-full lg:flex-none"
        >
          <TabsTrigger value="sources" className="flex-none px-2">
            Sources <Count value={counts.sources} />
          </TabsTrigger>
          <TabsTrigger value="topics" className="flex-none px-2">
            Topics
            {counts.proposedTopics > 0 && (
              <Badge variant="info" className="tabular-nums">
                {counts.proposedTopics}
                <span className="sr-only"> proposed</span>
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex-none px-2">
            Queue <Count value={counts.queue} />
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center justify-end gap-4 lg:flex-1">
          <span className="text-muted-foreground font-mono text-xs max-lg:hidden">
            {file}
          </span>
          {actions}
        </div>
      </div>
    </section>
  );
}
