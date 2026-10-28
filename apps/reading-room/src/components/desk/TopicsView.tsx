import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  Checkbox,
  cn,
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
  TOPIC_STATUSES,
  type TopicAction,
  topicStatusCounts,
  topicStatusLabel,
  type ViewCommand,
} from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

import { BulkToolbar } from './BulkToolbar';
import { WIDE_ONLY } from './deskRow';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { SearchField } from './SearchField';
import { TopicList } from './TopicList';
import { TopicRow } from './TopicRow';
import { useDeskLayout } from './useDeskLayout';
import type { ViewKeysRef } from './useDeskShortcuts';
import type { TopicActionsState } from './useRegistryActions';
import { useRovingRows } from './useRovingRows';
import type { RowSelection } from './useRowSelection';

const BULK_ACTIONS: readonly TopicAction[] = ['activate', 'decline'];

const STATUS_FILTERS = ['all', ...TOPIC_STATUSES] as const;

const isStatusFilter = (value: unknown): value is Topic['status'] | 'all' =>
  (STATUS_FILTERS as readonly unknown[]).includes(value);

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
  const t = useLibraryT(ROOM_NAMESPACE);
  const filtered = filterTopics(topics, params);
  const counts = topicStatusCounts(topics, params.tq);
  const names = filtered.map((t) => t.name);
  const { selectMode, selected } = selection;
  const bulk = selectMode && selected.size > 0;
  const { isDesktop, showTable, showList } = useDeskLayout();
  const shownCheck = pageCheckState(selected, names);
  const roving = useRovingRows(names, { page: 1, data: topics });
  const total = topics.length;
  const bulkOptions = BULK_ACTIONS.map((action) => ({
    action,
    names: applicableTopicNames(topics, selected, action),
    emptyNote: notApplicableNote(action, t, 'topics'),
  }));

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
      className={cn(
        'flex min-h-[calc(100dvh-var(--library-top))] min-w-0 flex-col px-4 pb-6 lg:px-6',
        bulk && 'max-lg:pb-36',
      )}
    >
      <div className="bg-background lg:top-(--library-top) z-[5] flex flex-col gap-3 py-4 lg:sticky">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            id="topics-heading"
            className="text-lg font-semibold max-lg:sr-only"
          >
            {t('desk.tab.topics')}
          </h2>
          <p className="text-muted-foreground text-sm max-lg:hidden">
            {t('desk.topics.intro')}
          </p>
          <div className="flex w-full items-center gap-2 lg:ml-auto lg:w-auto">
            <SearchField
              value={params.tq}
              label={t('desk.search.topics')}
              tab="topics"
              className="w-full lg:w-72"
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
                {selectMode ? t('desk.bulk.done') : t('desk.select')}
              </Button>
            )}
          </div>
        </div>
        {bulk && isDesktop ? (
          <BulkToolbar
            options={bulkOptions}
            shownNames={names}
            shownScope="shown"
            selection={selection}
            actions={actions}
          />
        ) : (
          <ToggleGroup
            aria-label={t('desk.topics.status')}
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
            {STATUS_FILTERS.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {value === 'all'
                  ? t('desk.topics.all')
                  : topicStatusLabel(value, t)}{' '}
                <span className="tabular-nums">{counts[value]}</span>
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
            <EmptyTitle>{t('desk.topics.none')}</EmptyTitle>
            <EmptyDescription>{t('desk.topics.noneHint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>{t('desk.topics.noMatch')}</EmptyTitle>
            <EmptyDescription>{t('desk.topics.noMatchHint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ tq: '', tstatus: null })}
            >
              {t('desk.topics.showAll')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        showTable && (
          <Table
            ref={roving.ref}
            role="grid"
            aria-labelledby="topics-heading"
            aria-multiselectable={selectMode || undefined}
            className="table-fixed max-lg:hidden md:table-auto"
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {selectMode && (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label={t('desk.selectAllShown')}
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
                <TableHead>{t('desk.col.topic')}</TableHead>
                <TableHead className={WIDE_ONLY}>
                  {t('desk.col.tags')}
                </TableHead>
                <TableHead>{t('desk.col.status')}</TableHead>
                <TableHead className={WIDE_ONLY}>
                  {t('desk.col.proposed')}
                </TableHead>
                <TableHead className="w-40">
                  <span className="sr-only">{t('desk.col.actions')}</span>
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
        )
      )}
      {showList && filtered.length > 0 && (
        <TopicList
          topics={filtered}
          labelledBy="topics-heading"
          actions={actions}
          selection={selection}
        />
      )}
      {bulk && !isDesktop && (
        <BulkToolbar
          floating
          options={bulkOptions}
          shownNames={names}
          shownScope="shown"
          selection={selection}
          actions={actions}
        />
      )}
      <KeyHints
        hints={deskHints('topics', false, t)}
        className="bg-background sticky bottom-0 z-[5] mt-auto hidden border-t py-2 lg:flex"
      />
    </section>
  );
}
