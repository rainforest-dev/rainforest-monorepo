import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadWeather,
  OPEN_METEO_URL,
  resetWeatherCache,
  WEATHER_TTL_MS,
} from './weather';

const reply = (current: object) =>
  vi.fn(async () => Response.json({ current }));

describe('loadWeather', () => {
  beforeEach(() => {
    resetWeatherCache();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it("reads Open-Meteo's current conditions over Taipei", async () => {
    const fetcher = reply({
      weather_code: 61,
      cloud_cover: 100,
      precipitation: 1.2,
      temperature_2m: 22.4,
    });
    const weather = await loadWeather({}, fetcher as typeof fetch, 0);
    expect(fetcher).toHaveBeenCalledWith(OPEN_METEO_URL, expect.anything());
    expect(OPEN_METEO_URL).toContain('latitude=25.05');
    expect(weather).toMatchObject({ kind: 'rain', temperature: 22.4 });
  });

  it('asks again only after 15 minutes', async () => {
    const fetcher = reply({ weather_code: 0, cloud_cover: 0 });
    const f = fetcher as typeof fetch;
    await loadWeather({}, f, 0);
    await loadWeather({}, f, WEATHER_TTL_MS - 1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await loadWeather({}, f, WEATHER_TTL_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('has no weather when the source fails, and warns once', async () => {
    const fetcher = vi.fn(async () => new Response('nope', { status: 503 }));
    const f = fetcher as typeof fetch;
    expect(await loadWeather({}, f, 0)).toBeNull();
    expect(await loadWeather({}, f, 10 * 60_000)).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('has no weather when the source answers 200 with something else', async () => {
    for (const body of [{ error: true }, { current: { weather_code: 'x' } }]) {
      resetWeatherCache();
      vi.mocked(console.warn).mockClear();
      const fetcher = vi.fn(async () => Response.json(body));
      expect(await loadWeather({}, fetcher as typeof fetch, 0)).toBeNull();
      expect(console.warn).toHaveBeenCalledTimes(1);
    }
  });

  it('waits 5 minutes after a failure before asking again', async () => {
    const fetcher = vi.fn(async () => new Response('nope', { status: 503 }));
    const f = fetcher as typeof fetch;
    await loadWeather({}, f, 0);
    await loadWeather({}, f, 4 * 60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await loadWeather({}, f, 5 * 60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the last reading through a failed refresh, for up to an hour', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ current: { weather_code: 63 } }))
      .mockResolvedValue(new Response('down', { status: 503 }));
    const f = fetcher as unknown as typeof fetch;
    await loadWeather({}, f, 0);
    expect(await loadWeather({}, f, WEATHER_TTL_MS)).toMatchObject({
      kind: 'rain',
    });
    expect(await loadWeather({}, f, 59 * 60_000)).toMatchObject({
      kind: 'rain',
    });
    expect(await loadWeather({}, f, 65 * 60_000)).toBeNull();
  });

  it('takes another source, and can be turned off', async () => {
    const fetcher = reply({ weather_code: 3 });
    const f = fetcher as typeof fetch;
    await loadWeather({ LIBRARY_WEATHER_URL: 'http://fixture/weather' }, f, 0);
    expect(fetcher).toHaveBeenCalledWith(
      'http://fixture/weather',
      expect.anything(),
    );
    expect(await loadWeather({ LIBRARY_WEATHER_URL: 'off' }, f, 0)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
