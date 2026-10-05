import { Badge, TabsList, TabsTrigger } from '@rainforest-dev/rainforest-react';
import { RssIcon } from 'lucide-react';
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

export function DeskHeader({ counts, file, actions }: DeskHeaderProps) {
  return (
    <header className="bg-background sticky top-0 z-10 border-b">
      <div className="flex flex-wrap items-center gap-x-6 px-4 lg:h-14 lg:flex-nowrap lg:px-6">
        <h1 className="h-13 flex items-center gap-2 text-base font-semibold lg:h-auto">
          <RssIcon aria-hidden="true" className="text-primary size-4" />
          RSS Manager
        </h1>
        <TabsList
          variant="line"
          aria-label="Registry"
          className="order-last -mx-1 h-10 w-full justify-start lg:order-none lg:h-full lg:w-auto"
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
        <div className="flex flex-1 items-center justify-end gap-4">
          <span className="text-muted-foreground font-mono text-xs max-lg:hidden">
            {file}
          </span>
          {actions}
        </div>
      </div>
    </header>
  );
}
