import { CalendarClock, Circle, CircleDot } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib';
import {
  type OpenTask,
  STALE_DAYS,
  type TaskSource,
  type TaskState,
} from '@/lib/notebook';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const STATES: Partial<
  Record<TaskState, { label: string; Icon: typeof Circle; className: string }>
> = {
  open: { label: 'Open', Icon: Circle, className: 'text-muted-foreground' },
  progress: { label: 'In progress', Icon: CircleDot, className: 'text-info' },
  event: { label: 'Event', Icon: CalendarClock, className: 'text-primary' },
};

const sourceHref = (source: TaskSource) =>
  `/notebooks/${source.notebookId}?page=${source.pageId}`;

const sourceLabel = (source: TaskSource) =>
  [source.notebookName, `p. ${source.number}`, source.pageDate]
    .filter(Boolean)
    .join(' · ');

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

const monthLabel = (month: string) =>
  month
    ? new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'Undated pages';

/**
 * The bullets still open across the notebooks, read from the pages' transcriptions with the
 * BuJo keys. Each links to the page it was last written on, to check against the paper.
 */
export function NotebookTasks({ tasks }: { tasks: readonly OpenTask[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No open items. Bullets marked • ^ or ○ on transcribed pages show up
        here.
      </p>
    );
  }
  const stale = tasks.filter((t) => t.stale).length;
  return (
    <section aria-labelledby="open-items" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="open-items" className="text-base font-semibold">
          {plural(tasks.length, 'open item')}
        </h2>
        <p className="text-muted-foreground text-xs">
          {stale > 0 &&
            `${stale} written over ${STALE_DAYS / 7} weeks ago and never crossed out · `}
          Read from the transcriptions, so check the page before crossing one
          out on paper.
        </p>
      </div>
      {byMonth(tasks).map(([month, items]) => (
        <section
          key={month || 'undated'}
          aria-label={monthLabel(month)}
          className="flex flex-col gap-2"
        >
          <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {monthLabel(month)}
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
                    aria-label={state?.label}
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
                        <span className="bg-warning/15 text-warning ml-2 rounded-full px-2 text-xs">
                          {STALE_DAYS / 7}+ weeks
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                      <Link
                        href={sourceHref(task.source)}
                        prefetch={false}
                        className="hover:text-foreground underline underline-offset-2"
                      >
                        {sourceLabel(task.source)}
                      </Link>
                      {task.firstSeen && (
                        <span>
                          first written{' '}
                          <Link
                            href={sourceHref(task.firstSeen)}
                            prefetch={false}
                            className="hover:text-foreground underline underline-offset-2"
                          >
                            {task.firstSeen.notebookId ===
                            task.source.notebookId
                              ? [
                                  `p. ${task.firstSeen.number}`,
                                  task.firstSeen.pageDate,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')
                              : sourceLabel(task.firstSeen)}
                          </Link>
                        </span>
                      )}
                    </p>
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
