import {
  daysBetween,
  EVENT_PRESETS,
  EVENT_SHELVES,
  EVENT_SOURCES,
  EVENT_TOPICS,
  type EventShelf,
  type EventsResponse,
  type EventSubscriptions,
  LIBRARY_EVENTS_COOKIE,
  type LibraryEvent,
  type LibraryLocale,
  matchesSubscriptions,
  serializeEventSubscriptions,
  shelveEvents,
  TAIWAN_CITIES,
} from '@rainforest-dev/library-contract';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  cn,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@rainforest-dev/rainforest-react';
import { TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { roomT } from '@/locales';

import { EventCover } from './EventCover';

type T = ReturnType<typeof roomT>;

export interface EventsViewProps {
  locale: LibraryLocale;
  result: EventsResponse;
  initialSubscriptions: EventSubscriptions;
  /** Today in Taipei, from the server, so the shelves match what the server rendered. */
  today: string;
}

const YEAR_SECONDS = 60 * 60 * 24 * 365;

function saveSubscriptions(subs: EventSubscriptions) {
  document.cookie = `${LIBRARY_EVENTS_COOKIE}=${serializeEventSubscriptions(subs)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}

/** `10/18` this year, `2027/4/30` in another. */
function shortDay(day: string, today: string): string {
  const [y, m, d] = day.split('-');
  const md = `${Number(m)}/${Number(d)}`;
  return y === today.slice(0, 4) ? md : `${y}/${md}`;
}

function dateRange(event: LibraryEvent, today: string): string {
  const start = shortDay(event.start, today);
  return event.start === event.end
    ? start
    : `${start}–${shortDay(event.end, today)}`;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function EventCard({
  event,
  shelf,
  today,
  locale,
  t,
}: {
  event: LibraryEvent;
  shelf: EventShelf;
  today: string;
  locale: LibraryLocale;
  t: T;
}) {
  const left = daysBetween(today, event.end);
  const untilStart = daysBetween(today, event.start);
  const place = [event.venue, event.cities.join('、')]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      <EventCover event={event} label={t(`events.kind.${event.kind}`)} />
      <span className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="text-muted-foreground text-xs tabular-nums">
          {dateRange(event, today)}
          {shelf === 'ending' &&
            ` · ${left === 0 ? t('events.lastDay') : t('events.daysLeft', { count: left })}`}
          {(shelf === 'soon' || shelf === 'market') &&
            untilStart > 0 &&
            ` · ${t('events.startsIn', { count: untilStart })}`}
        </span>
        <span className="font-semibold leading-snug">{event.title}</span>
        {place && (
          <span className="text-muted-foreground text-xs">{place}</span>
        )}
        {event.topics.length > 0 && (
          <span className="mt-auto flex flex-wrap gap-1">
            {event.topics.map((key) => {
              const topic = EVENT_TOPICS.find((x) => x.key === key);
              return topic ? (
                <Badge key={key} variant="secondary">
                  {topic.labels[locale]}
                </Badge>
              ) : null;
            })}
          </span>
        )}
      </span>
    </>
  );
  const className = cn(
    'bg-card text-card-foreground flex w-full flex-col overflow-hidden rounded-md border border-t-4',
    shelf === 'ending' && 'border-t-destructive',
    shelf === 'now' && 'border-t-chart-2',
    shelf === 'market' && 'border-t-success',
    shelf === 'soon' && 'border-t-muted-foreground',
  );
  return (
    <li className="flex scroll-mt-20" data-event={event.id} data-fold-anchor>
      {event.url ? (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer"
          title={t('events.openSource')}
          className={cn(
            className,
            'hover:bg-accent focus-visible:ring-ring outline-none focus-visible:ring-2',
          )}
        >
          {body}
        </a>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

function OptionGroup({
  legend,
  hint,
  options,
  picked,
  onToggle,
}: {
  legend: string;
  hint?: string;
  options: { value: string; label: string; count: number }[];
  picked: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">
        {legend}
        {hint && (
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            {hint}
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <Checkbox
              checked={picked.includes(option.value)}
              onCheckedChange={() => onToggle(option.value)}
            />
            {option.label}
            <span className="text-muted-foreground text-xs tabular-nums">
              {option.count}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The magazine rack as a page: subscription checkboxes over four shelves. Picks are kept in a
 * cookie the hall reads too, so its rack shows the same events.
 */
export function EventsView({
  locale,
  result,
  initialSubscriptions,
  today,
}: EventsViewProps) {
  const t = roomT(locale);
  const [subs, setSubs] = useState(initialSubscriptions);
  const update = (next: EventSubscriptions) => {
    setSubs(next);
    saveSubscriptions(next);
  };
  const { events } = result;

  const cityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events)
      for (const city of event.cities)
        counts.set(city, (counts.get(city) ?? 0) + 1);
    return TAIWAN_CITIES.filter(
      (city) => counts.has(city) || subs.cities.includes(city),
    ).map((city) => ({
      value: city,
      label: city,
      count: counts.get(city) ?? 0,
    }));
  }, [events, subs.cities]);
  const topicOptions = useMemo(
    () =>
      EVENT_TOPICS.map((topic) => ({
        value: topic.key,
        label: topic.labels[locale],
        count: events.filter((e) => e.topics.includes(topic.key)).length,
      })),
    [events, locale],
  );
  const sourceOptions = EVENT_SOURCES.map((source) => ({
    value: source,
    label: t(`events.source.${source}`),
    count: events.filter((e) => e.source === source).length,
  }));

  const shown = useMemo(
    () => events.filter((e) => matchesSubscriptions(e, subs)),
    [events, subs],
  );
  const shelves = useMemo(() => shelveEvents(shown, today), [shown, today]);
  const onShelves = EVENT_SHELVES.reduce((n, s) => n + shelves[s].length, 0);
  const picked = subs.cities.length + subs.topics.length + subs.sources.length;

  return (
    <div className="flex flex-col gap-6">
      {/* The reader can toggle it before the island hydrates; the browser owns `open` then. */}
      <details
        className="bg-card rounded-md border p-4 [&[open]>summary]:mb-4"
        open={picked === 0 ? undefined : true}
        suppressHydrationWarning
      >
        <summary className="cursor-pointer text-sm font-semibold">
          {picked === 0
            ? `${t('events.subscriptions')} · ${t('events.everything')}`
            : t('events.subscriptionsCount', { count: picked })}
        </summary>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t('events.presets')}
            </span>
            {EVENT_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                size="sm"
                variant="outline"
                onClick={() => update({ ...subs, topics: [...preset.topics] })}
              >
                {preset.labels[locale]}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={picked === 0}
              onClick={() => update({ cities: [], topics: [], sources: [] })}
            >
              {t('events.clear')}
            </Button>
          </div>
          <OptionGroup
            legend={t('events.places')}
            hint={t('events.placesHint')}
            options={cityOptions}
            picked={subs.cities}
            onToggle={(city) =>
              update({ ...subs, cities: toggle(subs.cities, city) })
            }
          />
          <OptionGroup
            legend={t('events.topics')}
            hint={t('events.topicsHint')}
            options={topicOptions}
            picked={subs.topics}
            onToggle={(topic) =>
              update({ ...subs, topics: toggle(subs.topics, topic) })
            }
          />
          <OptionGroup
            legend={t('events.sources')}
            options={sourceOptions}
            picked={subs.sources}
            onToggle={(source) =>
              update({
                ...subs,
                sources: toggle(
                  subs.sources,
                  source as (typeof EVENT_SOURCES)[number],
                ),
              })
            }
          />
        </div>
      </details>

      <div
        role="group"
        aria-label={t('events.topicFilter')}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-muted-foreground text-xs">
          {t('events.topicFilter')}
        </span>
        <Button
          size="sm"
          variant={subs.topics.length === 0 ? 'secondary' : 'ghost'}
          aria-pressed={subs.topics.length === 0}
          onClick={() => update({ ...subs, topics: [] })}
        >
          {t('events.allTopics')}
        </Button>
        {topicOptions
          .filter((o) => o.count > 0 || subs.topics.includes(o.value))
          .map((option) => {
            const on = subs.topics.includes(option.value);
            return (
              <Button
                key={option.value}
                size="sm"
                variant={on ? 'secondary' : 'outline'}
                aria-pressed={on}
                onClick={() =>
                  update({ ...subs, topics: toggle(subs.topics, option.value) })
                }
              >
                {option.label}
                <span className="text-muted-foreground text-xs tabular-nums">
                  {option.count}
                </span>
              </Button>
            );
          })}
      </div>

      {result.failed.length > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>
            {t('events.failed', {
              sources: result.failed
                .map((s) => t(`events.source.${s}`))
                .join('、'),
            })}
          </AlertDescription>
        </Alert>
      )}

      {events.length === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>{t('events.noData')}</EmptyTitle>
            <EmptyDescription>{t('events.noDataHint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : onShelves === 0 ? (
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyTitle>{t('events.empty')}</EmptyTitle>
            <EmptyDescription>{t('events.emptyHint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {EVENT_SHELVES.filter((s) => shelves[s].length > 0).map((shelf) => {
            const headingId = `events-${shelf}`;
            return (
              <section
                key={shelf}
                aria-labelledby={headingId}
                data-event-shelf={shelf}
                className="flex flex-col gap-3"
              >
                <h3
                  id={headingId}
                  className="flex items-baseline gap-2 text-base font-semibold"
                >
                  {t(`events.shelf.${shelf}`)}
                  <span className="text-muted-foreground text-sm font-normal tabular-nums">
                    {shelves[shelf].length}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {t(`events.shelfHint.${shelf}`)}
                  </span>
                </h3>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {shelves[shelf].map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      shelf={shelf}
                      today={today}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        {t('events.shown', { shown: onShelves, total: events.length })}
        {result.fetchedAt &&
          ` · ${t('events.fetchedAt', {
            time: new Date(result.fetchedAt).toLocaleString(
              locale === 'en' ? 'en-GB' : 'zh-TW',
              {
                timeZone: 'Asia/Taipei',
                dateStyle: 'short',
                timeStyle: 'short',
              },
            ),
          })}`}
      </p>
    </div>
  );
}
