/**
 * The weather outside the hall's windows: what the sky over Taipei is doing now, reduced to the
 * few things the scene can show. Clouds grey the sky and soften the sun's shadows, rain falls
 * past the windows, fog closes in, and a storm flashes now and then.
 */
import type { SkyLight } from './sky';

type Rgb = readonly [number, number, number];

export const WEATHER_KINDS = [
  'clear',
  'cloudy',
  'overcast',
  'fog',
  'drizzle',
  'rain',
  'storm',
] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

export interface HallWeather {
  kind: WeatherKind;
  /** How much of the sky is cloud, 0 to 1. */
  cloud: number;
  /** How hard it rains, 0 (dry) to 1 (a downpour). */
  rain: number;
  /** Air temperature in °C, when the source gave one. */
  temperature?: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The weather a WMO weather code names, as Open-Meteo reports it. */
function kindOfCode(code: number, cloud: number): WeatherKind {
  if (code >= 95) return 'storm';
  if (code >= 80) return 'rain';
  // Snow and sleet do not fall on Taipei; show them as the rain they would be here.
  if (code >= 61) return 'rain';
  if (code >= 51) return 'drizzle';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'overcast';
  if (code === 2) return 'cloudy';
  if (code === 1) return cloud >= 0.5 ? 'cloudy' : 'clear';
  return cloud >= 0.85 ? 'overcast' : cloud >= 0.4 ? 'cloudy' : 'clear';
}

/** The least cloud each kind implies, for a source that reports the kind but not the cover. */
const MIN_CLOUD: Record<WeatherKind, number> = {
  clear: 0,
  cloudy: 0.4,
  overcast: 0.9,
  fog: 0.8,
  drizzle: 0.85,
  rain: 0.95,
  storm: 1,
};

/** How hard each kind rains when the source gives no amount. */
const BASE_RAIN: Record<WeatherKind, number> = {
  clear: 0,
  cloudy: 0,
  overcast: 0,
  fog: 0,
  drizzle: 0.25,
  rain: 0.6,
  storm: 0.9,
};

/**
 * The hall's weather from a WMO code, cloud cover in percent and precipitation in mm per hour.
 * An amount of rain raises the downpour from the code's base: 8 mm an hour is a heavy one.
 */
export function weatherFromCode(
  code: number,
  cloudCoverPercent?: number,
  precipitationMm?: number,
  temperature?: number,
): HallWeather {
  const reported = clamp01((cloudCoverPercent ?? 0) / 100);
  const kind = kindOfCode(code, reported);
  const base = BASE_RAIN[kind];
  const rain =
    base === 0 ? 0 : clamp01(Math.max(base, (precipitationMm ?? 0) / 8));
  return {
    kind,
    cloud: Math.max(reported, MIN_CLOUD[kind]),
    rain,
    ...(temperature === undefined || !Number.isFinite(temperature)
      ? {}
      : { temperature }),
  };
}

/** One kind of weather at its usual strength, for `?hallWeather=rain` and for tests. */
export function typicalWeather(kind: WeatherKind): HallWeather {
  return { kind, cloud: MIN_CLOUD[kind], rain: BASE_RAIN[kind] };
}

export function isWeatherKind(value: unknown): value is WeatherKind {
  return (WEATHER_KINDS as readonly unknown[]).includes(value);
}

const OVERCAST = {
  day: [168, 174, 182] as Rgb,
  night: [24, 28, 38] as Rgb,
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export interface WeatherSky extends SkyLight {
  /** Whether the sun's or moon's disc shows through the cloud. */
  discVisible: boolean;
  /** How much of the clear sky's fill light still comes in: less under a heavy sky. */
  fill: number;
  /** Where the fog starts and is complete, in metres from the camera. */
  fogNear: number;
  fogFar: number;
}

/**
 * The sky's light under `weather`: cloud greys the sky toward an overcast grey of the same
 * brightness of day, and takes strength from the sun (and its shadows) while the diffuse light
 * gains a little. Rain and fog pull the fog in. With no weather the sky is the clear one.
 */
export function weatherSky(
  sky: SkyLight,
  weather: HallWeather | null,
): WeatherSky {
  const clear: WeatherSky = {
    ...sky,
    discVisible: true,
    fill: 1,
    fogNear: 30,
    fogFar: 110,
  };
  if (!weather) return clear;
  // Light cloud barely touches the sky; it greys fast once most of it is covered.
  const cover = clamp01((weather.cloud - 0.3) / 0.7) ** 1.2;
  const grey = mix(OVERCAST.night, OVERCAST.day, 1 - sky.night);
  const dim = 1 - 0.25 * weather.rain;
  const tone = (c: Rgb): Rgb => {
    const g = mix(c, grey, cover * 0.85);
    return [g[0] * dim, g[1] * dim, g[2] * dim];
  };
  const fog = weather.kind === 'fog';
  return {
    ...sky,
    zenith: tone(sky.zenith),
    horizon: tone(sky.horizon),
    sun: mix(sky.sun, grey, cover * 0.5),
    sunIntensity: sky.sunIntensity * (1 - 0.8 * cover),
    ambientIntensity: sky.ambientIntensity * (1 + 0.6 * cover),
    // Lamps come up a little on a dark day.
    lampIntensity: sky.lampIntensity + 0.8 * cover * (1 - sky.night),
    discVisible: cover < 0.6,
    fill: 1 - 0.3 * cover - 0.15 * weather.rain,
    fogNear: fog ? 2 : 30 - 18 * weather.rain,
    fogFar: fog ? 24 : 110 - 50 * weather.rain,
  };
}
