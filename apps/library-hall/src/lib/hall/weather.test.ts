import { describe, expect, it } from 'vitest';

import { skyLight } from './sky';
import { typicalWeather, weatherFromCode, weatherSky } from './weather';

const RAD = Math.PI / 180;

describe('weatherFromCode', () => {
  it('names each WMO family', () => {
    expect(weatherFromCode(0, 5).kind).toBe('clear');
    expect(weatherFromCode(2, 50).kind).toBe('cloudy');
    expect(weatherFromCode(3, 100).kind).toBe('overcast');
    expect(weatherFromCode(45).kind).toBe('fog');
    expect(weatherFromCode(53).kind).toBe('drizzle');
    expect(weatherFromCode(63).kind).toBe('rain');
    expect(weatherFromCode(81).kind).toBe('rain');
    expect(weatherFromCode(95).kind).toBe('storm');
  });

  it('lets the reported cover decide between clear and cloudy', () => {
    expect(weatherFromCode(1, 20).kind).toBe('clear');
    expect(weatherFromCode(1, 70).kind).toBe('cloudy');
    expect(weatherFromCode(0, 95).kind).toBe('overcast');
  });

  it('raises the downpour with the amount of rain, and keeps a dry sky dry', () => {
    expect(weatherFromCode(61, 100, 0.2).rain).toBeCloseTo(0.6);
    expect(weatherFromCode(65, 100, 16).rain).toBe(1);
    expect(weatherFromCode(3, 100, 0.4).rain).toBe(0);
  });

  it('never reports less cloud than the kind implies, and keeps the temperature', () => {
    const w = weatherFromCode(63, 10, 1, 21.6);
    expect(w.cloud).toBeGreaterThanOrEqual(0.95);
    expect(w.temperature).toBe(21.6);
    expect('temperature' in weatherFromCode(0)).toBe(false);
  });
});

describe('weatherSky', () => {
  const noon = skyLight(60 * RAD);

  it('leaves the clear sky alone', () => {
    const sky = weatherSky(noon, null);
    expect(sky.zenith).toEqual(noon.zenith);
    expect(sky.discVisible).toBe(true);
    expect(weatherSky(noon, typicalWeather('clear')).sunIntensity).toBe(
      noon.sunIntensity,
    );
  });

  it('greys an overcast sky, hides the sun and softens its light', () => {
    const sky = weatherSky(noon, typicalWeather('overcast'));
    const spread = (c: readonly number[]) => Math.max(...c) - Math.min(...c);
    expect(spread(sky.zenith)).toBeLessThan(spread(noon.zenith) / 2);
    expect(sky.discVisible).toBe(false);
    expect(sky.sunIntensity).toBeLessThan(noon.sunIntensity / 2);
    expect(sky.ambientIntensity).toBeGreaterThan(noon.ambientIntensity);
    expect(sky.fill).toBeLessThan(1);
  });

  it('pulls the fog in for rain, and further for fog', () => {
    const clear = weatherSky(noon, null);
    const rain = weatherSky(noon, typicalWeather('rain'));
    const fog = weatherSky(noon, typicalWeather('fog'));
    expect(rain.fogFar).toBeLessThan(clear.fogFar);
    expect(fog.fogFar).toBeLessThan(rain.fogFar);
  });

  it('keeps a cloudy night dark, and leaves its lamps as they were', () => {
    const night = skyLight(-30 * RAD);
    const sky = weatherSky(night, typicalWeather('overcast'));
    const brightness = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;
    expect(brightness(sky.zenith)).toBeLessThan(brightness(noon.zenith) / 3);
    expect(sky.lampIntensity).toBeCloseTo(night.lampIntensity);
  });

  it('darkens the sky and the fill light as the rain grows', () => {
    const drizzle = weatherSky(noon, typicalWeather('drizzle'));
    const rain = weatherSky(noon, typicalWeather('rain'));
    const storm = weatherSky(noon, typicalWeather('storm'));
    const brightness = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;
    expect(brightness(rain.zenith)).toBeLessThan(brightness(drizzle.zenith));
    expect(brightness(storm.zenith)).toBeLessThan(brightness(rain.zenith));
    expect(rain.fill).toBeLessThan(drizzle.fill);
    expect(storm.fill).toBeLessThan(rain.fill);
  });
});
