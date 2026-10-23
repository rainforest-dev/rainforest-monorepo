/**
 * The light outside the hall's windows, from the real sun over Taipei: where it stands now, and the
 * colours of the sky, the sunlight and the lamps that follow from it. Weather is not modelled.
 *
 * The hall's entrance faces south, so north is -z and east is +x.
 */

type Rgb = readonly [number, number, number];

/** Taipei, close enough for every reader of this library. */
export const HALL_LATITUDE = 25.05;
export const HALL_LONGITUDE = 121.6;

const RAD = Math.PI / 180;
/** Taipei keeps UTC+8 all year. */
const HALL_UTC_OFFSET_HOURS = 8;

/** The instant it is `hours`:`minutes` in Taipei on the Taipei calendar day that contains `now`. */
export function hallClock(
  hours: number,
  minutes: number,
  now = new Date(),
): Date {
  const local = new Date(now.getTime() + HALL_UTC_OFFSET_HOURS * 3_600_000);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      hours - HALL_UTC_OFFSET_HOURS,
      minutes,
    ),
  );
}

export interface SunPosition {
  /** Radians above the horizon; negative at night. */
  elevation: number;
  /** Radians clockwise from north. */
  azimuth: number;
}

/**
 * The sun's position, from NOAA's low-precision solar equations: within about a degree, which is
 * far finer than a shadow on a bookcase can show.
 */
export function sunPosition(
  date: Date,
  latitude = HALL_LATITUDE,
  longitude = HALL_LONGITUDE,
): SunPosition {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);
  const hours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear + (hours - 12) / 24);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const solarMinutes = hours * 60 + equationOfTime + 4 * longitude;
  const hourAngle = (solarMinutes / 4 - 180) * RAD;
  const lat = latitude * RAD;
  const cosZenith =
    Math.sin(lat) * Math.sin(declination) +
    Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat),
  );
  return {
    elevation: Math.PI / 2 - zenith,
    // atan2 above measures from south; turn it to clockwise from north.
    azimuth: (azimuth + Math.PI) % (2 * Math.PI),
  };
}

/** A unit vector from the hall towards the sun, in scene axes. */
export function sunDirection({ elevation, azimuth }: SunPosition): {
  x: number;
  y: number;
  z: number;
} {
  const flat = Math.cos(elevation);
  return {
    x: flat * Math.sin(azimuth),
    y: Math.sin(elevation),
    z: -flat * Math.cos(azimuth),
  };
}

export interface SkyLight {
  /** 0 by day, 1 in full night, between at dusk and dawn. */
  night: number;
  zenith: Rgb;
  horizon: Rgb;
  ground: Rgb;
  /** Whether the shadow-casting light is the sun (true) or the moon. */
  sunUp: boolean;
  /** Sunlight (or moonlight) colour and strength, for the one shadow-casting light. */
  sun: Rgb;
  sunIntensity: number;
  /** The lamps indoors: barely on at noon, warm and bright at night. */
  lampIntensity: number;
  ambientIntensity: number;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const DAY = {
  zenith: [74, 132, 214] as Rgb,
  horizon: [196, 222, 245] as Rgb,
  ground: [96, 128, 74] as Rgb,
  sun: [255, 244, 222] as Rgb,
};
const GOLDEN = {
  zenith: [92, 108, 170] as Rgb,
  horizon: [250, 170, 112] as Rgb,
  sun: [255, 176, 110] as Rgb,
};
const NIGHT = {
  zenith: [10, 16, 38] as Rgb,
  horizon: [34, 46, 82] as Rgb,
  ground: [22, 30, 26] as Rgb,
  moon: [150, 170, 220] as Rgb,
};

/** The sky's colours and the lights' strengths for a sun at `elevation` radians. */
export function skyLight(elevation: number): SkyLight {
  const degrees = elevation / RAD;
  // Full night below -8°, full day above 12°; golden light peaks as the sun meets the horizon.
  const day = smooth(-8, 12, degrees);
  const golden = Math.max(0, 1 - Math.abs(degrees - 2) / 12) * day;
  const zenith = mix(
    mix(NIGHT.zenith, DAY.zenith, day),
    GOLDEN.zenith,
    golden * 0.5,
  );
  const horizon = mix(
    mix(NIGHT.horizon, DAY.horizon, day),
    GOLDEN.horizon,
    golden,
  );
  const sunUp = day > 0.02;
  const sun = sunUp ? mix(DAY.sun, GOLDEN.sun, golden) : NIGHT.moon;
  return {
    night: 1 - day,
    zenith,
    horizon,
    ground: mix(NIGHT.ground, DAY.ground, day),
    sunUp,
    sun,
    // The sun's strength grows as it climbs; at night a faint moon keeps shapes readable.
    sunIntensity: sunUp ? 0.4 + 2.2 * smooth(-2, 40, degrees) : 0.25,
    lampIntensity: 0.6 + 2.4 * (1 - day),
    ambientIntensity: 0.25 + 0.4 * day,
  };
}
