import { useLibraryT } from '@rainforest-dev/library-shell';
import { Badge, TabsList, TabsTrigger } from '@rainforest-dev/rainforest-react';
import type { ReactNode } from 'react';

import { ROOM_NAMESPACE } from '@/locales';

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
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <section
      aria-label={t('desk.header.label')}
      className="bg-background border-b"
    >
      <div className="flex items-center gap-x-6 px-4 lg:h-12 lg:px-6">
        <TabsList
          variant="line"
          aria-label={t('desk.header.tabs')}
          className="-mx-1 h-12 min-w-0 flex-1 justify-start lg:h-full lg:flex-none"
        >
          <TabsTrigger value="sources" className="flex-none px-2">
            {t('desk.tab.sources')} <Count value={counts.sources} />
          </TabsTrigger>
          <TabsTrigger value="topics" className="flex-none px-2">
            {t('desk.tab.topics')}
            {counts.proposedTopics > 0 && (
              <Badge variant="info" className="tabular-nums">
                {counts.proposedTopics}
                <span className="sr-only">{t('desk.header.proposed')}</span>
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex-none px-2">
            {t('desk.tab.queue')} <Count value={counts.queue} />
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
