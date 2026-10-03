import {
  Button,
  Checkbox,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  KeyHints,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
} from '@rainforest-dev/rainforest-react';
import { useLayoutEffect } from 'react';

import type { Topic } from '@/lib';
import {
  applicableTopicNames,
  deskHints,
  type DeskParams,
  type DeskPatch,
  filterTopics,
  notApplicableNote,
  pageCheckState,
  TOPIC_STATUS_LABEL,
  TOPIC_STATUSES,
  type TopicAction,
  topicStatusCounts,
  type ViewCommand,
} from '@/lib/desk';

import { BulkToolbar } from './BulkToolbar';
import { WIDE_ONLY } from './deskRow';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { SearchField } from './SearchField';
import { TopicRow } from './TopicRow';
import type { ViewKeysRef } from './useDeskShortcuts';
import type { TopicActionsState } from './useRegistryActions';
import { useRovingRows } from './useRovingRows';
import type { RowSelection } from './useRowSelection';

const BULK_ACTIONS: readonly TopicAction[] = ['activate', 'decline'];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  ...TOPIC_STATUSES.map((status) => ({
    value: status,
    label: TOPIC_STATUS_LABEL[status],
  })),
] as const;

const isStatusFilter = (value: unknown): value is Topic['status'] | 'all' =>
  STATUS_FILTERS.some((option) => option.value === value);

export interface TopicsViewProps {
  topics: Topic[];
  params: DeskParams;
  navigate: (patch: DeskPatch) => void;
  actions: TopicActionsState;
  selection: RowSelection;
  keys?: ViewKeysRef;
}

export function TopicsView({
  topics,
  params,
  navigate,
  actions,
  selection,
  keys,
}: TopicsViewProps) {
  const filtered = filterTopics(topics, params);
  const counts = topicStatusCounts(topics, params.tq);
  const names = filtered.map((t) => t.name);
  const { selectMode, selected } = selection;
  const bulk = selectMode && selected.size > 0;
  const shownCheck = pageCheckState(selected, names);
  const roving = useRovingRows(names, { page: 1, data: topics });
  const total = topics.length;

  const runKey = (
    command: ViewCommand,
    name: string | null,
    target: Element | null,
  ) => {
    switch (command.type) {
      case 'move':
        roving.move(command.key);
        break;
      case 'toggle':
        if (!name) break;
        if (!selectMode) selection.start();
        selection.toggle(name);
        break;
      case 'activate':
      case 'decline':
        if (!name) break;
        void actions.run([name], command.type, 'row', () =>
          roving.focus({
            name,
            index: names.indexOf(name),
            replacing: topics,
            ifIdle: true,
          }),
        );
        break;
      case 'clear-selection':
        selection.clear();
        if (target?.closest('[role="toolbar"]'))
          roving.focus({ name: roving.stop, index: 0 });
        break;
      case 'leave-select-mode':
        selection.done();
        break;
    }
  };

  useLayoutEffect(() => {
    if (!keys) return;
    keys.current = {
      state: {
        paneOpen: false,
        hasSelection: selected.size > 0,
        selectMode,
        page: 1,
        pageCount: 1,
        writable: actions.writable,
      },
      rowAt: (target) => {
        const name = roving.rowAt(target);
        const topic = name ? filtered.find((t) => t.name === name) : undefined;
        return topic
          ? {
              name: topic.name,
              topic,
              pending: actions.pending.has(topic.name),
            }
          : null;
      },
      run: runKey,
    };
    return () => {
      keys.current = null;
    };
  });

  return (
    <section
      aria-labelledby="topics-heading"
      className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col px-4 pb-6 lg:px-6"
    >
      <div className="bg-background z-[5] flex flex-col gap-3 py-4 lg:sticky lg:top-14">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="topics-heading" className="text-lg font-semibold">
            Topics
          </h2>
          <p className="text-muted-foreground text-sm">
            What rss-discover looks for when it proposes sources.
          </p>
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <SearchField
              value={params.tq}
              label="Search topics"
              tab="topics"
              onChange={(tq) => {
                if (tq !== params.tq) navigate({ tq });
              }}
            />
            {total > 0 && !bulk && (
              <Button
                variant="outline"
                size="sm"
                onClick={selectMode ? selection.done : selection.start}
              >
                {selectMode ? 'Done' : 'Select'}
              </Button>
            )}
          </div>
        </div>
        {bulk ? (
          <BulkToolbar
            options={BULK_ACTIONS.map((action) => ({
              action,
              names: applicableTopicNames(topics, selected, action),
              emptyNote: notApplicableNote(action, 'topics'),
            }))}
            shownNames={names}
            shownLabel="shown"
            selection={selection}
            actions={actions}
          />
        ) : (
          <ToggleGroup
            aria-label="Topic status"
            variant="outline"
            size="sm"
            className="max-w-full overflow-x-auto"
            value={[params.tstatus ?? 'all']}
            onValueChange={(values) => {
              const value = values[0];
              if (!isStatusFilter(value)) return;
              const tstatus = value === 'all' ? null : value;
              if (tstatus !== params.tstatus) navigate({ tstatus });
            }}
          >
            {STATUS_FILTERS.map(({ value, label }) => (
              <ToggleGroupItem key={value} value={value}>
                {label} <span className="tabular-nums">{counts[value]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {!actions.writable && (
        <div className="pb-4">
          <ReadOnlyBanner />
        </div>
      )}

      {total === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>No topics yet</EmptyTitle>
            <EmptyDescription>
              Topics show up here once rss-discover proposes them.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>No topics here</EmptyTitle>
            <EmptyDescription>
              No topic matches this search and status.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ tq: '', tstatus: null })}
            >
              Show all topics
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Table
          ref={roving.ref}
          role="grid"
          aria-labelledby="topics-heading"
          aria-multiselectable={selectMode || undefined}
          className="table-fixed md:table-auto"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectMode && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all shown"
                    checked={shownCheck === 'all'}
                    indeterminate={shownCheck === 'some'}
                    onCheckedChange={() =>
                      shownCheck === 'all'
                        ? selection.removeMany(names)
                        : selection.addMany(names)
                    }
                  />
                </TableHead>
              )}
              <TableHead>Topic</TableHead>
              <TableHead className={WIDE_ONLY}>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className={WIDE_ONLY}>Proposed</TableHead>
              <TableHead className="w-40">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((topic) => (
              <TopicRow
                key={topic.name}
                topic={topic}
                tabIndex={topic.name === roving.stop ? 0 : -1}
                actions={actions}
                selectMode={selectMode}
                selected={selected.has(topic.name)}
                onToggle={() => selection.toggle(topic.name)}
              />
            ))}
          </TableBody>
        </Table>
      )}
      <KeyHints
        hints={deskHints('topics', false)}
        className="bg-background sticky bottom-0 z-[5] mt-auto hidden border-t py-2 lg:flex"
      />
    </section>
  );
}
