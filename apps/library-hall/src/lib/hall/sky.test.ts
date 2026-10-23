import { describe, expect, it } from 'vitest';

import { hallClock, skyLight, sunDirection, sunPosition } from './sky';

const deg = (radians: number) => (radians * 180) / Math.PI;
// Taipei is UTC+8 all year.
const taipei = (iso: string) => new Date(`${iso}+08:00`);

describe('sunPosition', () => {
  it('stands nearly overhead at noon on the June solstice', () => {
    const sun = sunPosition(taipei('2026-06-21T12:00:00'));
    expect(deg(sun.elevation)).toBeGreaterThan(85);
  });

  it('stands about 41° up, due south, at noon on the December solstice', () => {
    const sun = sunPosition(taipei('2026-12-21T12:00:00'));
    expect(deg(sun.elevation)).toBeCloseTo(41.5, 0);
    expect(deg(sun.azimuth)).toBeGreaterThan(170);
    expect(deg(sun.azimuth)).toBeLessThan(190);
  });

  it('rises in the east and is below the horizon at midnight', () => {
    const morning = sunPosition(taipei('2026-10-23T07:00:00'));
    expect(deg(morning.elevation)).toBeGreaterThan(0);
    expect(deg(morning.azimuth)).toBeGreaterThan(80);
    expect(deg(morning.azimuth)).toBeLessThan(120);
    expect(sunPosition(taipei('2026-10-23T00:00:00')).elevation).toBeLessThan(
      0,
    );
  });
});

describe('sunDirection', () => {
  it('points south and up for a southern noon sun', () => {
    const d = sunDirection({ elevation: Math.PI / 4, azimuth: Math.PI });
    expect(d.z).toBeGreaterThan(0.7);
    expect(d.y).toBeGreaterThan(0.7);
    expect(Math.abs(d.x)).toBeLessThan(1e-9);
  });

  it('puts east at +x and north at -z', () => {
    const east = sunDirection({ elevation: 0.2, azimuth: Math.PI / 2 });
    const north = sunDirection({ elevation: 0.2, azimuth: 0 });
    expect(east.x).toBeGreaterThan(0.9);
    expect(north.z).toBeLessThan(-0.9);
  });
});

describe('hallClock', () => {
  it('reads the time in Taipei, whatever zone the machine is in', () => {
    // 23:30 UTC on the 22nd is already the 23rd in Taipei.
    const pinned = hallClock(12, 0, new Date('2026-10-22T23:30:00Z'));
    expect(pinned.toISOString()).toBe('2026-10-23T04:00:00.000Z');
    expect(
      hallClock(7, 15, new Date('2026-10-23T10:00:00Z')).toISOString(),
    ).toBe('2026-10-22T23:15:00.000Z');
  });
});

describe('skyLight', () => {
  it('is day at noon, night at midnight, and lights the lamps at night', () => {
    const noon = skyLight((60 * Math.PI) / 180);
    const midnight = skyLight((-40 * Math.PI) / 180);
    expect(noon.night).toBe(0);
    expect(midnight.night).toBe(1);
    expect(midnight.lampIntensity).toBeGreaterThan(noon.lampIntensity);
    expect(noon.sunIntensity).toBeGreaterThan(midnight.sunIntensity);
  });

  it('turns the horizon warm at sunset', () => {
    const sunset = skyLight((2 * Math.PI) / 180);
    const [r, , b] = sunset.horizon;
    expect(r).toBeGreaterThan(b);
  });

  it('blends through dusk and hands the light to the moon in one step', () => {
    const at = (degrees: number) => skyLight((degrees * Math.PI) / 180);
    const dusk = at(-4);
    const lowSun = at(5);
    for (const light of [dusk, lowSun]) {
      expect(light.night).toBeGreaterThan(0);
      expect(light.night).toBeLessThan(1);
    }
    expect(lowSun.lampIntensity).toBeLessThan(dusk.lampIntensity);
    expect(lowSun.sunUp).toBe(true);
    expect(at(-9).sunUp).toBe(false);
    expect(at(-9).sunIntensity).toBeLessThan(lowSun.sunIntensity);
  });
});
