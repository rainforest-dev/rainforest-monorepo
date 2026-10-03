import { Tabs, TabsContent, Toaster } from '@rainforest-dev/rainforest-react';
import { type ReactNode, useState } from 'react';

import {
  DeskHeader,
  LoadError,
  ReadOnlyBanner,
  TabSkeleton,
  useDeskData,
  useDeskParams,
  ValidatePopover,
} from '@/components/desk';
import {
  DESK_TABS,
  type DeskData,
  type DeskFile,
  type DeskParams,
  type DeskTab,
  type FileLoad,
} from '@/lib/desk';

import { ReadingQueue } from './ReadingQueue';
import { SourceTable } from './SourceTable';
import { TopicList } from './TopicList';

export interface RegistryDeskProps {
  initialParams: DeskParams;
  data: DeskData;
  registryFile: string;
}

const FILE_LABEL: Record<DeskFile, string> = {
  sources: 'source registry',
  topics: 'topic registry',
  queue: 'reading queue',
};

const TAB_TITLE: Record<DeskTab, string> = {
  sources: 'Sources',
  topics: 'Topics',
  queue: 'Reading queue',
};

const isDeskTab = (value: unknown): value is DeskTab =>
  (DESK_TABS as readonly unknown[]).includes(value);

export function RegistryDesk({
  initialParams,
  data: initialData,
  registryFile,
}: RegistryDeskProps) {
  const { params, navigate } = useDeskParams(initialParams);
  const desk = useDeskData(initialData);
  const [validateOpen, setValidateOpen] = useState(initialParams.validate);
  const { sources, topics, queue } = desk.data;

  function body<T>(
    file: DeskFile,
    load: FileLoad<T>,
    render: (data: T) => ReactNode,
  ) {
    if (load.ok) return render(load.data);
    const retrying = desk.retrying.has(file);
    return (
      <>
        <LoadError
          what={FILE_LABEL[file]}
          error={load.error}
          retrying={retrying}
          onRetry={() => void desk.retry(file)}
        />
        {retrying && <TabSkeleton tab={file} />}
      </>
    );
  }

  return (
    <Tabs
      value={params.tab}
      onValueChange={(value) => {
        if (isDeskTab(value) && value !== params.tab) navigate({ tab: value });
      }}
      className="min-h-screen gap-0"
    >
      <DeskHeader
        registryFile={registryFile}
        counts={{
          sources: sources.ok ? sources.data.sources.length : null,
          queue: queue.ok ? (queue.data?.queue.length ?? 0) : null,
          proposedTopics: topics.ok
            ? topics.data.topics.filter((t) => t.status === 'proposed').length
            : 0,
        }}
        actions={
          <ValidatePopover open={validateOpen} onOpenChange={setValidateOpen} />
        }
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {DESK_TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{TAB_TITLE[tab]}</h2>
            {tab === 'sources' &&
              body('sources', sources, (data) => (
                <>
                  {!data.writable && <ReadOnlyBanner />}
                  <SourceTable
                    sources={data.sources}
                    writable={data.writable}
                    onSourcesChange={desk.updateSources}
                    onReadOnly={() => desk.markReadOnly('sources')}
                  />
                </>
              ))}
            {tab === 'topics' &&
              body('topics', topics, (data) => (
                <>
                  {!data.writable && <ReadOnlyBanner />}
                  <TopicList
                    topics={data.topics}
                    writable={data.writable}
                    onTopicsChange={desk.updateTopics}
                    onReadOnly={() => desk.markReadOnly('topics')}
                  />
                </>
              ))}
            {tab === 'queue' &&
              body('queue', queue, (data) => <ReadingQueue data={data} />)}
          </TabsContent>
        ))}
      </main>
      <Toaster />
    </Tabs>
  );
}
