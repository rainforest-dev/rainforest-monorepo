import {
  KeyHints,
  Tabs,
  TabsContent,
  Toaster,
} from '@rainforest-dev/rainforest-react';
import { type ReactNode, useRef, useState } from 'react';

import {
  DeskHeader,
  LoadError,
  QueueView,
  SourcesView,
  TabSkeleton,
  TopicsView,
  useDeskData,
  useDeskParams,
  useDeskShortcuts,
  useRowSelection,
  useSourceActions,
  useTopicActions,
  ValidatePopover,
  type ViewKeys,
} from '@/components/desk';
import {
  clearSourceFilters,
  DESK_TABS,
  type DeskData,
  type DeskFile,
  deskHints,
  type DeskParams,
  type DeskTab,
  type FileLoad,
} from '@/lib/desk';

export interface RegistryDeskProps {
  initialParams: DeskParams;
  data: DeskData;
  files: Record<DeskFile, string>;
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
  files,
}: RegistryDeskProps) {
  const { params, navigate } = useDeskParams(initialParams);
  const desk = useDeskData(initialData);
  const [validateOpen, setValidateOpen] = useState(initialParams.validate);
  const { sources, topics, queue } = desk.data;
  const sourceActions = useSourceActions({
    writable: sources.ok && sources.data.writable,
    registryFile: files.sources,
    onItemsChange: desk.updateSources,
    onReadOnly: () => desk.markReadOnly('sources'),
  });
  const topicActions = useTopicActions({
    writable: topics.ok && topics.data.writable,
    registryFile: files.topics,
    onItemsChange: desk.updateTopics,
    onReadOnly: () => desk.markReadOnly('topics'),
  });
  const selection = useRowSelection();
  const topicSelection = useRowSelection();
  const sourcesKeys = useRef<ViewKeys | null>(null);
  const topicsKeys = useRef<ViewKeys | null>(null);
  const queueKeys = useRef<ViewKeys | null>(null);
  useDeskShortcuts({
    tab: params.tab,
    onTab: (tab) => navigate({ tab }),
    views: { sources: sourcesKeys, topics: topicsKeys, queue: queueKeys },
  });

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
  const hints = (tab: DeskTab) => (
    <KeyHints
      hints={deskHints(tab, false)}
      className="bg-background sticky bottom-0 z-[5] mt-auto hidden border-t py-2 lg:flex"
    />
  );

  return (
    <Tabs
      value={params.tab}
      onValueChange={(value) => {
        if (isDeskTab(value) && value !== params.tab) navigate({ tab: value });
      }}
      className="min-h-screen gap-0"
    >
      <DeskHeader
        file={files[params.tab]}
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
              keys={sourcesKeys}
            />
          ))}
        </TabsContent>
        <TabsContent value="topics" className={topics.ok ? undefined : padded}>
          {!topics.ok && <h2 className="text-lg font-semibold">Topics</h2>}
          {body('topics', topics, (data) => (
            <TopicsView
              topics={data.topics}
              params={params}
              navigate={navigate}
              actions={topicActions}
              selection={topicSelection}
              keys={topicsKeys}
            />
          ))}
          {!topics.ok && hints('topics')}
        </TabsContent>
        <TabsContent value="queue" className={queue.ok ? undefined : padded}>
          {!queue.ok && (
            <h2 className="text-lg font-semibold">Reading queue</h2>
          )}
          {body('queue', queue, (data) => (
            <QueueView
              data={data}
              params={params}
              navigate={navigate}
              keys={queueKeys}
            />
          ))}
          {!queue.ok && hints('queue')}
        </TabsContent>
      </main>
      <Toaster />
    </Tabs>
  );
}
