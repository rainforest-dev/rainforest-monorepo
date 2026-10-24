'use client';

import { useLibraryLocale, useLibraryT } from '@rainforest-dev/library-shell';

import { cn, type HallWeather } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';

/**
 * The time and weather the hall's sky shows, in words: `台北 18:24 · 雨 22°C`. The sky itself
 * carries the same thing, but a dim room at dusk reads as broken unless it says why.
 */
export function HallConditions({
  now,
  weather,
  className,
}: {
  now: Date;
  weather: HallWeather | null;
  className?: string;
}) {
  const t = useLibraryT(HALL_NAMESPACE);
  const locale = useLibraryLocale();
  const time = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Taipei',
  }).format(now);
  const parts = [`${t('conditions.place')} ${time}`];
  if (weather) {
    parts.push(
      [
        t(`conditions.weather.${weather.kind}`),
        weather.temperature === undefined
          ? null
          : t('conditions.temperature', {
              value: Math.round(weather.temperature),
            }),
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  return (
    <p
      data-hall-conditions={weather?.kind ?? 'none'}
      aria-label={t('conditions.label')}
      className={cn(
        'bg-card/85 text-foreground w-fit rounded px-2 py-0.5 text-xs shadow-sm',
        className,
      )}
    >
      {parts.join(' · ')}
    </p>
  );
}
