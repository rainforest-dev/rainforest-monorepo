import { MONTH_RE } from '@rainforest-dev/journal-kit';
import { CalendarDays, LayoutGrid, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import {
  CreateNotebookForm,
  NotebookCalendar,
  NotebookGrid,
  NotebookSearchForm,
  NotebookSearchResults,
  NotebookTasks,
} from '@/components/notebooks';
import { cn } from '@/lib';
import {
  latestDatedMonth,
  listNotebooks,
  notebookCalendar,
  notebookTasks,
  pageQueryReady,
  type PageSearchOptions,
  purgeExpiredTrash,
  searchNotebookPages,
  undatedPages,
} from '@/lib/server';

type View = 'shelf' | 'calendar' | 'tasks';

interface Props {
  searchParams: Promise<{
    view?: string | string[];
    month?: string | string[];
    q?: string | string[];
    from?: string | string[];
    to?: string | string[];
    exact?: string | string[];
    shelf?: string | string[];
  }>;
}

const VIEWS: readonly {
  value: View;
  label: string;
  Icon: typeof LayoutGrid;
  href: string;
}[] = [
  { value: 'shelf', label: 'Shelf', Icon: LayoutGrid, href: '/' },
  {
    value: 'calendar',
    label: 'Calendar',
    Icon: CalendarDays,
    href: '/?view=calendar',
  },
  {
    value: 'tasks',
    label: 'To-dos',
    Icon: ListTodo,
    href: '/?view=tasks',
  },
];

export default function NotebooksPage({ searchParams }: Props) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Notebooks</h1>
        <p className="text-muted-foreground text-sm">
          Scanned pages of paper Bullet Journals, one shelf per notebook.
        </p>
      </div>
      <Suspense fallback={<NotebooksFallback />}>
        <NotebooksView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

async function NotebooksView({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const asked = first(params.view);
  const view: View =
    asked === 'calendar' || asked === 'tasks' ? asked : 'shelf';
  const typed = (first(params.q) ?? '').trim().slice(0, 200);
  const q = pageQueryReady(typed) ? typed : '';
  const options = searchOptions(params);

  return (
    <>
      <nav
        aria-label="View"
        className="bg-muted flex w-fit gap-0.5 rounded-lg p-0.5"
      >
        {VIEWS.map(({ value, label, Icon, href }) => (
          <Link
            key={value}
            href={href}
            prefetch={false}
            aria-current={!q && view === value ? 'page' : undefined}
            className={cn(
              'focus-visible:outline-ring flex h-8 items-center gap-1.5 rounded-md px-3 text-sm outline-offset-1 focus-visible:outline-2',
              !q && view === value
                ? 'bg-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <NotebookSearchForm q={typed} options={options} />
      {typed && !q && (
        <p role="status" className="text-muted-foreground text-sm">
          Type at least two letters, or one Chinese character.
        </p>
      )}
      {q ? (
        <NotebookSearchResults
          q={q}
          search={await searchNotebookPages(q, options)}
        />
      ) : view === 'calendar' ? (
        <CalendarView month={first(params.month)} />
      ) : view === 'tasks' ? (
        <NotebookTasks tasks={notebookTasks()} />
      ) : (
        <ShelfView shelf={first(params.shelf)} />
      )}
    </>
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function searchOptions(
  params: Awaited<Props['searchParams']>,
): PageSearchOptions {
  const date = (value: string | string[] | undefined) => {
    const v = first(value);
    return v && DATE.test(v) ? v : undefined;
  };
  const from = date(params.from);
  const to = date(params.to);
  return {
    ...(from && { from }),
    ...(to && { to }),
    ...(first(params.exact) === '1' && { exact: true }),
  };
}

type Shelf = 'all' | 'archived' | 'trash';

const SHELVES: readonly { value: Shelf; label: string; href: string }[] = [
  { value: 'all', label: 'All', href: '/' },
  { value: 'archived', label: 'Archived', href: '/?shelf=archived' },
  { value: 'trash', label: 'Trash', href: '/?shelf=trash' },
];

async function ShelfView({ shelf: asked }: { shelf: string | undefined }) {
  const shelf: Shelf =
    asked === 'archived' || asked === 'trash' ? asked : 'all';
  // Purging on visit is enough: a notebook nobody looks at can wait in Trash a little longer.
  await purgeExpiredTrash();
  const shown =
    shelf === 'trash'
      ? await listNotebooks({ trashed: true })
      : (await listNotebooks()).filter(
          (n) => shelf === 'all' || n.status === 'archived',
        );
  return (
    <>
      <nav aria-label="Shelf" className="flex gap-1 text-sm">
        {SHELVES.map(({ value, label, href }) => (
          <Link
            key={value}
            href={href}
            prefetch={false}
            aria-current={shelf === value ? 'page' : undefined}
            className={cn(
              'focus-visible:outline-ring rounded-full border px-3 py-1 outline-offset-1 focus-visible:outline-2',
              shelf === value
                ? 'bg-accent text-accent-foreground border-transparent font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {shelf === 'all' && <CreateNotebookForm />}
      <NotebookGrid key={shelf} notebooks={shown} trash={shelf === 'trash'} />
    </>
  );
}

function CalendarView({ month }: { month: string | undefined }) {
  // In the server's zone, so near midnight on the 1st it can still name last month.
  const thisMonth = new Date().toLocaleDateString('sv').slice(0, 7);
  const shown =
    month && MONTH_RE.test(month) ? month : (latestDatedMonth() ?? thisMonth);
  return (
    <NotebookCalendar
      calendar={notebookCalendar(shown)}
      undated={undatedPages()}
      thisMonth={thisMonth}
    />
  );
}

function NotebooksFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="bg-muted aspect-[3/4] animate-pulse rounded-md"
        />
      ))}
    </div>
  );
}
