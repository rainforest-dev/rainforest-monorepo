import {
  HTML_LANG,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import type { LibraryT } from '@rainforest-dev/library-shell';
import { CalendarClock, Circle, CircleDot } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib';
import {
  type OpenTask,
  STALE_DAYS,
  type TaskSource,
  type TaskState,
} from '@/lib/notebook';
import { notebookT } from '@/locales';

const STATES: Partial<
  Record<TaskState, { key: string; Icon: typeof Circle; className: string }>
> = {
  open: {
    key: 'tasks.state.open',
    Icon: Circle,
    className: 'text-muted-foreground',
  },
  progress: {
    key: 'tasks.state.progress',
    Icon: CircleDot,
    className: 'text-info',
  },
  event: {
    key: 'tasks.state.event',
    Icon: CalendarClock,
    className: 'text-primary',
  },
};

const sourceHref = (source: TaskSource) =>
  `/${source.notebookId}?page=${source.pageId}`;

const pageLabel = (source: TaskSource, t: LibraryT) =>
  [t('page.shortNumber', { number: source.number }), source.pageDate]
    .filter(Boolean)
    .join(' · ');

/** A link to the page; a long notebook name is cut short so the page number and date stay whole. */
function SourceLink({
  source,
  withNotebook = true,
  t,
}: {
  source: TaskSource;
  withNotebook?: boolean;
  t: LibraryT;
}) {
  return (
    <Link
      href={sourceHref(source)}
      prefetch={false}
      className="hover:text-foreground inline-flex min-w-0 max-w-full underline underline-offset-2"
    >
      {withNotebook && (
        <span className="truncate">{source.notebookName}&nbsp;·&nbsp;</span>
      )}
      <span className="shrink-0 whitespace-nowrap">{pageLabel(source, t)}</span>
    </Link>
  );
}

/** Groups by the month the item was last written, newest first; undated items go last. */
function byMonth(tasks: readonly OpenTask[]) {
  const groups = new Map<string, OpenTask[]>();
  for (const task of tasks) {
    const month = task.source.pageDate?.slice(0, 7) ?? '';
    groups.set(month, [...(groups.get(month) ?? []), task]);
  }
  return [...groups].sort(([a], [b]) =>
    a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? 1 : -1,
  );
}

const monthLabel = (month: string, locale: LibraryLocale, t: LibraryT) =>
  month
    ? new Date(`${month}-01T00:00:00Z`).toLocaleDateString(HTML_LANG[locale], {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : t('tasks.undated');

/**
 * The bullets still open across the notebooks, read from the pages' transcriptions with the
 * BuJo keys. Each links to the page it was last written on, to check against the paper.
 */
export function NotebookTasks({
  tasks,
  locale,
}: {
  tasks: readonly OpenTask[];
  locale: LibraryLocale;
}) {
  const t = notebookT(locale);
  if (tasks.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {t('tasks.empty')}
      </p>
    );
  }
  const stale = tasks.filter((task) => task.stale).length;
  return (
    <section aria-labelledby="open-items" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="open-items" className="text-base font-semibold">
          {t('tasks.count', { count: tasks.length })}
        </h2>
        <p className="text-muted-foreground text-xs">
          {stale > 0 &&
            t('tasks.stale', { count: stale, weeks: STALE_DAYS / 7 })}
          {t('tasks.hint')}
        </p>
      </div>
      {byMonth(tasks).map(([month, items]) => (
        <section
          key={month || 'undated'}
          aria-label={monthLabel(month, locale, t)}
          className="flex flex-col gap-2"
        >
          <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {monthLabel(month, locale, t)}
          </h3>
          <ul className="bg-card divide-y rounded-lg border">
            {items.map((task) => {
              const state = STATES[task.state] ?? STATES.open;
              const Icon = state?.Icon ?? Circle;
              return (
                <li
                  key={`${task.source.pageId}:${task.text}`}
                  className="flex gap-3 px-3.5 py-2.5"
                >
                  <Icon
                    className={cn('mt-0.5 size-4 flex-none', state?.className)}
                    aria-label={state && t(state.key)}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-sm">
                      {task.parent && (
                        <span className="text-muted-foreground">
                          {task.parent} ›{' '}
                        </span>
                      )}
                      {task.text}
                      {task.stale && (
                        <span className="bg-warning/15 text-warning ml-2 inline-block whitespace-nowrap rounded-full px-2 text-xs">
                          {t('tasks.weeks', { weeks: STALE_DAYS / 7 })}
                        </span>
                      )}
                    </p>
                    <div className="text-muted-foreground flex min-w-0 flex-col gap-x-2 text-xs sm:flex-row sm:flex-wrap">
                      <SourceLink source={task.source} t={t} />
                      {task.firstSeen && (
                        <span className="flex min-w-0 gap-1">
                          <span className="shrink-0">
                            {t('tasks.firstWritten')}
                          </span>{' '}
                          <SourceLink
                            source={task.firstSeen}
                            withNotebook={
                              task.firstSeen.notebookId !==
                              task.source.notebookId
                            }
                            t={t}
                          />
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
