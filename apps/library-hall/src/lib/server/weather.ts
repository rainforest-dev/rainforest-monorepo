import { z } from 'zod';

import {
  HALL_LATITUDE,
  HALL_LONGITUDE,
  type HallWeather,
  weatherFromCode,
} from '@/lib/hall';

/** Open-Meteo's current conditions over the hall: free, and no key to keep. */
export const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${HALL_LATITUDE}&longitude=${HALL_LONGITUDE}` +
  '&current=weather_code,cloud_cover,precipitation,temperature_2m&timezone=Asia%2FTaipei';

/** Weather changes slowly next to a visit, and the source asks callers not to hammer it. */
export const WEATHER_TTL_MS = 15 * 60_000;
/** After a failure, wait this long before asking again, so a dead source costs one request. */
const RETRY_MS = 5 * 60_000;
/** A failed refresh keeps showing the last reading until it is this old. */
const STALE_MS = 60 * 60_000;
const TIMEOUT_MS = 5000;

const currentSchema = z.object({
  current: z.object({
    weather_code: z.number(),
    cloud_cover: z.number().optional(),
    precipitation: z.number().optional(),
    temperature_2m: z.number().optional(),
  }),
});

let cached: {
  url: string;
  /** When the source was last asked, and when it last answered. */
  at: number;
  readAt: number;
  weather: HallWeather | null;
} | null = null;
let warned = false;

/** Forgets the cached weather; for tests. */
export function resetWeatherCache() {
  cached = null;
  warned = false;
}

/**
 * The weather over the hall now, fetched at most once every 15 minutes. `LIBRARY_WEATHER_URL`
 * points it at another Open-Meteo-shaped source, and `off` turns it off. When a refresh fails the
 * last reading stands for up to an hour; with none, the hall has no weather and its sky is clear.
 */
export async function loadWeather(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<HallWeather | null> {
  const configured = env['LIBRARY_WEATHER_URL']?.trim();
  if (configured === 'off') return null;
  const url = configured || OPEN_METEO_URL;
  const last = cached?.url === url ? cached : null;
  if (last) {
    const wait = last.readAt === last.at ? WEATHER_TTL_MS : RETRY_MS;
    if (now - last.at < wait) return last.weather;
  }
  try {
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { current } = currentSchema.parse(await response.json());
    const weather = weatherFromCode(
      current.weather_code,
      current.cloud_cover,
      current.precipitation,
      current.temperature_2m,
    );
    warned = false;
    cached = { url, at: now, readAt: now, weather };
    return weather;
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn(
        `[hall] weather from ${url} could not be read; the sky keeps its last reading for up to an hour, then clears: ${String(error)}`,
      );
    }
    // One failed refresh should not clear a rainy sky: keep the last reading while it is fresh.
    const kept =
      last?.weather && now - last.readAt < STALE_MS ? last.weather : null;
    cached = { url, at: now, readAt: last?.readAt ?? -Infinity, weather: kept };
    return kept;
  }
}
