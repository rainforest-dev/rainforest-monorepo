'use client';

import { useEffect, useState } from 'react';

import {
  hallClock,
  type HallWeather,
  isWeatherKind,
  typicalWeather,
} from '@/lib';

/** As often as the server asks the source; the browser keeps the answer for five minutes. */
const WEATHER_POLL_MS = 15 * 60_000;

/**
 * `?hallTime=HH:MM` pins the hall to that time today in Taipei, so a screenshot looks the same
 * whatever zone the machine taking it is in.
 */
function pinnedTime(): Date | null {
  const raw = new URLSearchParams(window.location.search).get('hallTime');
  const match = raw?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return hallClock(Number(match[1]), Number(match[2]));
}

/** `?hallWeather=rain` pins the weather, for screenshots and for seeing each kind. */
function pinnedWeather(): HallWeather | null {
  const raw = new URLSearchParams(window.location.search).get('hallWeather');
  return isWeatherKind(raw) ? typicalWeather(raw) : null;
}

/**
 * The current instant, read again every minute, which is as often as a shadow visibly moves.
 * `null` until the page has mounted, so a prerendered page never shows the build's time.
 */
export function useHallTime(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const pinned = pinnedTime();
    if (pinned) {
      setNow(pinned);
      return;
    }
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * The weather over the hall, from `/api/weather`, asked again every 15 minutes while the page
 * is open. `null` until it arrives, and whenever the server has none: the sky is clear then.
 */
export function useHallWeather(): HallWeather | null {
  const [weather, setWeather] = useState<HallWeather | null>(null);
  useEffect(() => {
    const pinned = pinnedWeather();
    if (pinned) {
      setWeather(pinned);
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const response = await fetch('/api/weather');
        if (!response.ok) return;
        const body = (await response.json()) as {
          weather?: HallWeather | null;
        };
        if (live) setWeather(body.weather ?? null);
      } catch {
        // No weather is a clear sky; the next poll tries again.
      }
    };
    void load();
    const id = window.setInterval(load, WEATHER_POLL_MS);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  return weather;
}
