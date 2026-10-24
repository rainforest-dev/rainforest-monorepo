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
const TIMEOUT_MS = 5000;

const currentSchema = z.object({
  current: z.object({
    weather_code: z.number(),
    cloud_cover: z.number().optional(),
    precipitation: z.number().optional(),
    temperature_2m: z.number().optional(),
  }),
});

let cached: { url: string; at: number; weather: HallWeather | null } | null =
  null;
let warned = false;

/** Forgets the cached weather; for tests. */
export function resetWeatherCache() {
  cached = null;
  warned = false;
}

/**
 * The weather over the hall now, fetched at most once every 15 minutes. `LIBRARY_WEATHER_URL`
 * points it at another Open-Meteo-shaped source, and `off` turns it off. When the source cannot
 * be reached the hall has no weather, and its sky stays clear.
 */
export async function loadWeather(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<HallWeather | null> {
  const configured = env['LIBRARY_WEATHER_URL']?.trim();
  if (configured === 'off') return null;
  const url = configured || OPEN_METEO_URL;
  if (cached?.url === url) {
    const ttl = cached.weather ? WEATHER_TTL_MS : RETRY_MS;
    if (now - cached.at < ttl) return cached.weather;
  }
  let weather: HallWeather | null = null;
  try {
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { current } = currentSchema.parse(await response.json());
    weather = weatherFromCode(
      current.weather_code,
      current.cloud_cover,
      current.precipitation,
      current.temperature_2m,
    );
    warned = false;
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn(
        `[hall] weather from ${url} could not be read; the sky stays clear: ${String(error)}`,
      );
    }
  }
  cached = { url, at: now, weather };
  return weather;
}
