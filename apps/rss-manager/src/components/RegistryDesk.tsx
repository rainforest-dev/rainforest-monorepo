import { Tabs, TabsContent, Toaster } from '@rainforest-dev/rainforest-react';
import { type ReactNode, useState } from 'react';

import {
  DeskHeader,
  LoadError,
  ReadOnlyBanner,
  SourcesView,
  TabSkeleton,
  useDeskData,
  useDeskParams,
  useSourceActions,
  useSourceSelection,
  ValidatePopover,
} from '@/components/desk';
import {
  clearSourceFilters,
  DESK_TABS,
  type DeskData,
  type DeskFile,
  type DeskParams,
  type DeskTab,
  type FileLoad,
} from '@/lib/desk';

import { ReadingQueue } from './ReadingQueue';
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
  const sourceActions = useSourceActions({
    writable: sources.ok && sources.data.writable,
    registryFile,
    onSourcesChange: desk.updateSources,
    onReadOnly: () => desk.markReadOnly('sources'),
  });
  const selection = useSourceSelection();

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

  const padded = 'flex flex-col gap-4 px-4 py-6 lg:px-6';

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
      <main className="w-full">
        <TabsContent
          value="sources"
          className={sources.ok ? undefined : padded}
        >
          {!sources.ok && <h2 className="text-lg font-semibold">Sources</h2>}
          {body('sources', sources, (data) => (
            <SourcesView
              sources={data.sources}
              params={params}
              navigate={navigate}
              actions={sourceActions}
              selection={selection}
              onClearFilters={() => navigate(clearSourceFilters(params))}
              onValidate={() => setValidateOpen(true)}
            />
          ))}
        </TabsContent>
        <TabsContent value="topics" className={padded}>
          <h2 className="text-lg font-semibold">Topics</h2>
          {body('topics', topics, (data) => (
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
        </TabsContent>
        <TabsContent value="queue" className={padded}>
          <h2 className="text-lg font-semibold">Reading queue</h2>
          {body('queue', queue, (data) => (
            <ReadingQueue data={data} />
          ))}
        </TabsContent>
      </main>
      <Toaster />
    </Tabs>
  );
}
