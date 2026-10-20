import { MONTH_RE } from '@rainforest-dev/journal-kit';
import type { LibraryLocale } from '@rainforest-dev/library-contract';
import type { LibraryT } from '@rainforest-dev/library-shell';
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
import { notebookT, pageLocale } from '@/locales';

type View = 'shelf' | 'calendar' | 'tasks';

interface Props {
  params: Promise<{ lang: string }>;
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
  key: string;
  Icon: typeof LayoutGrid;
  href: string;
}[] = [
  { value: 'shelf', key: 'view.shelf', Icon: LayoutGrid, href: '/' },
  {
    value: 'calendar',
    key: 'view.calendar',
    Icon: CalendarDays,
    href: '/?view=calendar',
  },
  {
    value: 'tasks',
    key: 'view.tasks',
    Icon: ListTodo,
    href: '/?view=tasks',
  },
];

export default async function NotebooksPage({ params, searchParams }: Props) {
  const t = notebookT(await pageLocale(params));
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t('home.title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('home.intro')}</p>
      </div>
      <Suspense fallback={<NotebooksFallback />}>
        <NotebooksView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

async function NotebooksView({ params: lang, searchParams }: Props) {
  await connection();
  const locale = await pageLocale(lang);
  const t = notebookT(locale);
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
        aria-label={t('view.label')}
        className="bg-muted flex w-fit gap-0.5 rounded-lg p-0.5"
      >
        {VIEWS.map(({ value, key, Icon, href }) => (
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
            {t(key)}
          </Link>
        ))}
      </nav>
      <NotebookSearchForm q={typed} options={options} locale={locale} />
      {typed && !q && (
        <p role="status" className="text-muted-foreground text-sm">
          {t('search.tooShort')}
        </p>
      )}
      {q ? (
        <NotebookSearchResults
          q={q}
          search={await searchNotebookPages(q, options)}
          locale={locale}
        />
      ) : view === 'calendar' ? (
        <CalendarView month={first(params.month)} locale={locale} />
      ) : view === 'tasks' ? (
        <NotebookTasks tasks={notebookTasks()} locale={locale} />
      ) : (
        <ShelfView shelf={first(params.shelf)} t={t} />
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

const SHELVES: readonly { value: Shelf; key: string; href: string }[] = [
  { value: 'all', key: 'shelf.all', href: '/' },
  { value: 'archived', key: 'shelf.archived', href: '/?shelf=archived' },
  { value: 'trash', key: 'shelf.trash', href: '/?shelf=trash' },
];

async function ShelfView({
  shelf: asked,
  t,
}: {
  shelf: string | undefined;
  t: LibraryT;
}) {
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
      <nav aria-label={t('shelf.label')} className="flex gap-1 text-sm">
        {SHELVES.map(({ value, key, href }) => (
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
            {t(key)}
          </Link>
        ))}
      </nav>
      {shelf === 'all' && <CreateNotebookForm />}
      <NotebookGrid key={shelf} notebooks={shown} trash={shelf === 'trash'} />
    </>
  );
}

function CalendarView({
  month,
  locale,
}: {
  month: string | undefined;
  locale: LibraryLocale;
}) {
  // In the server's zone, so near midnight on the 1st it can still name last month.
  const thisMonth = new Date().toLocaleDateString('sv').slice(0, 7);
  const shown =
    month && MONTH_RE.test(month) ? month : (latestDatedMonth() ?? thisMonth);
  return (
    <NotebookCalendar
      calendar={notebookCalendar(shown)}
      undated={undatedPages()}
      thisMonth={thisMonth}
      locale={locale}
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
