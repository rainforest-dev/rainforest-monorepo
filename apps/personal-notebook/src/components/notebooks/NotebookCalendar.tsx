import {
  monthLabel as zhMonthLabel,
  shiftMonth,
} from '@rainforest-dev/journal-kit';
import {
  HTML_LANG,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import type { LibraryT } from '@rainforest-dev/library-shell';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib';
import { calendarDays, notebookSlots } from '@/lib/notebook';
import type { NotebookCalendar as Calendar, UndatedPages } from '@/lib/server';
import { notebookT } from '@/locales';

import { pageImageUrl } from './api';

const SLOT_BG = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];
const MAX_THUMBS = 3;

/** Sunday to Saturday, short, in the page's language. */
const weekdays = (locale: LibraryLocale) =>
  Array.from({ length: 7 }, (_, i) =>
    // 2023-01-01 was a Sunday.
    new Date(Date.UTC(2023, 0, 1 + i)).toLocaleDateString(HTML_LANG[locale], {
      weekday: 'short',
      timeZone: 'UTC',
    }),
  );

const monthName = (month: string, locale: LibraryLocale) =>
  locale === 'zh'
    ? zhMonthLabel(month)
    : new Date(`${month}-01T00:00:00Z`).toLocaleDateString(HTML_LANG[locale], {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });

const monthHref = (month: string) => `/?view=calendar&month=${month}`;
const pageHref = (notebookId: number, pageId: number) =>
  `/${notebookId}?page=${pageId}`;

/** Every notebook's pages laid out by the date written on them, one month at a time. */
export function NotebookCalendar({
  calendar,
  undated,
  thisMonth,
  locale,
}: {
  calendar: Calendar;
  undated: UndatedPages;
  thisMonth: string;
  locale: LibraryLocale;
}) {
  const t = notebookT(locale);
  const monthLabel = (m: string) => monthName(m, locale);
  const { month, pages } = calendar;
  const weeks = calendarDays(month, pages);
  const slots = notebookSlots(pages, SLOT_BG.length);
  const legend = [...slots.keys()].map((id) => ({
    id,
    slot: slots.get(id) ?? 0,
    name: pages.find((page) => page.notebookId === id)?.notebookName ?? '',
  }));
  const nav =
    'focus-visible:outline-ring flex size-8 items-center justify-center rounded-md border outline-offset-1 focus-visible:outline-2';

  return (
    <section aria-labelledby="calendar-month" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="calendar-month"
          className="min-w-28 text-base font-semibold tracking-tight"
        >
          {monthLabel(month)}
        </h2>
        <Link
          href={monthHref(shiftMonth(month, -1))}
          prefetch={false}
          aria-label={t('calendar.prev')}
          className={nav}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <Link
          href={monthHref(shiftMonth(month, 1))}
          prefetch={false}
          aria-label={t('calendar.next')}
          className={nav}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        {month !== thisMonth && (
          <Link
            href={monthHref(thisMonth)}
            prefetch={false}
            className="focus-visible:outline-ring flex h-8 items-center rounded-md border px-3 text-sm outline-offset-1 focus-visible:outline-2"
          >
            {t('calendar.thisMonth')}
          </Link>
        )}
        <p className="text-muted-foreground ml-auto text-xs">
          {t('calendar.dated', { count: pages.length })}
          {calendar.prev && (
            <>
              {' · '}
              <Link
                href={monthHref(calendar.prev)}
                prefetch={false}
                className="hover:text-foreground underline underline-offset-2"
              >
                {t('calendar.earlier', { month: monthLabel(calendar.prev) })}
              </Link>
            </>
          )}
          {calendar.next && (
            <>
              {' · '}
              <Link
                href={monthHref(calendar.next)}
                prefetch={false}
                className="hover:text-foreground underline underline-offset-2"
              >
                {t('calendar.later', { month: monthLabel(calendar.next) })}
              </Link>
            </>
          )}
        </p>
      </div>

      {legend.length > 0 && (
        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {legend.map(({ id, slot, name }) => (
            <li key={id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn('size-2.5 rounded-sm', SLOT_BG[slot])}
              />
              {name}
            </li>
          ))}
        </ul>
      )}

      <UndatedNote undated={undated} t={t} />

      <div className="bg-border grid grid-cols-7 gap-px overflow-hidden rounded-lg border">
        {weekdays(locale).map((day) => (
          <div
            key={day}
            className="bg-muted text-muted-foreground px-2 py-1.5 text-xs font-medium"
          >
            {day}
          </div>
        ))}
        {weeks.flat().map((day, i) =>
          day === null ? (
            <div key={`blank-${i}`} className="bg-muted/60" />
          ) : (
            <div
              key={day.date}
              data-date={day.date}
              className="bg-background flex min-h-20 min-w-0 flex-col gap-1.5 p-1.5 sm:min-h-28 sm:p-2"
            >
              <span
                className={cn(
                  'text-xs',
                  day.pages.length > 0
                    ? 'font-semibold'
                    : 'text-muted-foreground',
                )}
              >
                {day.day}
              </span>
              {day.pages.length > 0 && (
                <>
                  <ul className="flex flex-wrap items-end gap-1">
                    {day.pages.slice(0, MAX_THUMBS).map((page) => (
                      <li key={page.id}>
                        <Link
                          href={pageHref(page.notebookId, page.id)}
                          prefetch={false}
                          aria-label={t('calendar.pageLink', {
                            notebook: page.notebookName,
                            number: page.position,
                            date: day.date,
                          })}
                          className="focus-visible:outline-ring relative block w-6 overflow-hidden rounded-sm border outline-offset-1 focus-visible:outline-2 sm:w-9"
                        >
                          <img
                            src={pageImageUrl(page.id)}
                            alt=""
                            loading="lazy"
                            className="aspect-[3/4] w-full object-cover"
                          />
                          <span
                            aria-hidden
                            className={cn(
                              'absolute inset-x-0 bottom-0 h-1',
                              SLOT_BG[slots.get(page.notebookId) ?? 0],
                            )}
                          />
                        </Link>
                      </li>
                    ))}
                    {day.pages.length > MAX_THUMBS && (
                      <li className="text-muted-foreground text-xs">
                        +{day.pages.length - MAX_THUMBS}
                      </li>
                    )}
                  </ul>
                  {day.heading && (
                    <p className="text-muted-foreground line-clamp-2 hidden text-xs leading-snug sm:block">
                      {day.heading}
                    </p>
                  )}
                </>
              )}
            </div>
          ),
        )}
      </div>
      <p className="text-muted-foreground text-xs">{t('calendar.hint')}</p>
    </section>
  );
}

function UndatedNote({ undated, t }: { undated: UndatedPages; t: LibraryT }) {
  const total = undated.waiting + undated.noDate + undated.gaveUp;
  if (total === 0) return null;
  const reasons = [
    undated.waiting > 0 && t('calendar.waiting', { count: undated.waiting }),
    undated.noDate > 0 && t('calendar.noDate', { count: undated.noDate }),
    undated.gaveUp > 0 && t('calendar.gaveUp', { count: undated.gaveUp }),
  ].filter(Boolean);
  return (
    <p className="bg-muted/50 rounded-lg border border-dashed px-3 py-2 text-sm">
      <span className="font-medium">
        {t('calendar.undated', { count: total })}
      </span>{' '}
      <span className="text-muted-foreground">
        {reasons.join(t('calendar.reasonSeparator'))}
        {t('calendar.end')}
      </span>
    </p>
  );
}
