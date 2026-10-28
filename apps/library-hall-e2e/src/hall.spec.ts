import { expect, test } from '@playwright/test';

test.describe('the hall', () => {
  test('shelves every reachable collection and names the one that is down', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-hall-mode="3d"]')).toBeAttached();
    await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
    // Sorted by topic by default, every collection in one wing. The fixture still sends the
    // legacy `tag:` keys, which the hall reads as topics.
    await expect(
      page.locator('[data-hall-case="topics-topic-sea"]'),
    ).toBeAttached();
    await expect(
      page.locator('[data-hall-case="topics-topic-winter"]'),
    ).toBeAttached();
    await expect(page.locator('[data-hall-missing]')).toContainText('報架');
    // One untagged book and one notebook have no topic, and the sign says so. The other
    // notebook's `ocean` stands with the books under `sea`, through the topic map.
    await expect(page.locator('[data-hall-sign="topics"]')).toHaveText(
      '主題2 件沒有主題',
    );
    await expect(
      page.locator('[data-hall-case="topics-topic-ocean"]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-hall-case="topics-none"]')).toBeAttached();
    // By collection, each collection stands in a wing of its own, under its name.
    await page.locator('[data-group-by="collection"]').click();
    await expect(page.locator('[data-hall-sign="books"]')).toHaveText('書');
    await expect(page.locator('[data-hall-sign="notebooks"]')).toHaveText(
      '筆記本',
    );
    await expect(
      page.locator('[data-hall-case="notebooks-all"]'),
    ).toBeAttached();
  });

  test('offers the four shared groupings and reads an old link', async ({
    page,
  }) => {
    await page.goto('/?group=tag');
    const options = page.locator('[data-group-by]');
    await expect(options).toHaveCount(4);
    expect(
      await options.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-group-by')),
      ),
    ).toEqual(['topic', 'creator', 'month', 'collection']);
    await expect(page.locator('[data-group-by="topic"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('[data-group-by="series"]')).toHaveCount(0);
  });

  for (const time of ['12:00', '23:00']) {
    test(`draws the hall by day and by night (${time})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/?hallTime=${time}`);
      await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as { __libraryHall?: { firstFrameAt: number | null } })
                .__libraryHall?.firstFrameAt ?? null,
          ),
        )
        .not.toBeNull();
      expect(errors).toEqual([]);
    });
  }

  test("says Taipei's time and weather, from the hall's weather source", async ({
    page,
  }) => {
    await page.goto('/?hallTime=09:05');
    await expect(page.locator('[data-hall-conditions]')).toHaveText(
      '台北 09:05 · 陰 22°C',
    );
    await expect(page.locator('[data-hall-conditions]')).toHaveAttribute(
      'data-hall-conditions',
      'overcast',
    );
  });

  // What each pinned weather must put in the scene, so a sky that stops following the weather
  // fails here rather than drawing a clear hall.
  const SCENES = {
    rain: { raining: true, lightning: false, fogFar: 80 },
    storm: { raining: true, lightning: true, fogFar: 65 },
    fog: { raining: false, lightning: false, fogFar: 24 },
    clear: { raining: false, lightning: false, fogFar: 110 },
  };
  for (const [weather, scene] of Object.entries(SCENES)) {
    test(`draws the hall in ${weather} weather`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/?hallTime=16:00&hallWeather=${weather}`);
      await expect(page.locator('[data-hall-conditions]')).toHaveAttribute(
        'data-hall-conditions',
        weather,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as { __libraryHall?: { firstFrameAt: number | null } })
                .__libraryHall?.firstFrameAt ?? null,
          ),
        )
        .not.toBeNull();
      const drawn = await page.evaluate(() =>
        (
          window as {
            __libraryHall?: {
              weather: () => {
                rainDrops: number;
                lightning: boolean;
                fogFar: number | null;
              };
            };
          }
        ).__libraryHall?.weather(),
      );
      expect({
        raining: (drawn?.rainDrops ?? 0) > 0,
        lightning: drawn?.lightning,
        fogFar: drawn?.fogFar,
      }).toEqual(scene);
      expect(errors).toEqual([]);
    });
  }

  test('raises and sinks bookcases as the grouping needs', async ({ page }) => {
    await page.goto('/');
    const standing = page.locator('[data-hall-canvas] [data-hall-label]');
    // By topic: sea, winter, and one case for everything without a topic.
    await expect(standing).toHaveCount(3);
    await page.locator('[data-group-by="collection"]').click();
    await expect(standing).toHaveCount(2);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as { __libraryHall?: { resorting: () => boolean } }
            ).__libraryHall?.resorting() ?? true,
        ),
      )
      .toBe(false);
  });

  test('turns the view by dragging or with the buttons, without walking', async ({
    page,
  }) => {
    await page.goto('/');
    const canvas = page.locator('[data-hall-canvas] canvas');
    await expect(canvas).toBeVisible();
    const read = (name: 'yaw' | 'avatar' | 'walking') =>
      page.evaluate(
        (n) =>
          (
            window as unknown as {
              __libraryHall?: Record<string, () => unknown>;
            }
          ).__libraryHall?.[n]?.(),
        name,
      );
    const yaw = () => read('yaw') as Promise<number>;
    const avatar = () => read('avatar');
    const walking = () => read('walking');
    await expect.poll(yaw).toBe(0);
    const start = await avatar();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas');
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y, { steps: 6 });
    await page.mouse.up();
    expect(await yaw()).toBeLessThan(-0.3);
    expect(await walking()).toBe(false);
    expect(await avatar()).toEqual(start);

    await page.locator('[data-hall-view="reset"]').click();
    expect(await yaw()).toBe(0);
    await page.locator('[data-hall-view="turn-left"]').click();
    expect(await yaw()).toBeCloseTo(Math.PI / 4);
  });

  test('stands the magazine rack by the door, with what the reader subscribes to', async ({
    page,
    context,
  }) => {
    test.setTimeout(150_000);
    await page.goto('/');
    await expect(page.locator('[data-hall-rack-sign]')).toHaveText(
      '雜誌架4 場',
    );
    await expect(
      page.locator('[data-hall-list] [data-hall-rack]'),
    ).toContainText('即將結束 1');

    // The reading room's page writes this cookie; the hall reads the same one.
    await context.addCookies([
      {
        name: 'library-events',
        value: encodeURIComponent(
          JSON.stringify({ cities: [], topics: ['toys'], sources: [] }),
        ),
        url: page.url(),
      },
    ]);
    await page.reload();
    await expect(page.locator('[data-hall-rack-sign]')).toHaveText(
      '雜誌架1 場',
    );

    // Clicking the rack walks up to it and opens the reading room's rack page.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as { __libraryHall?: { firstFrameAt: number | null } })
              .__libraryHall?.firstFrameAt ?? null,
        ),
      )
      .not.toBeNull();
    const at = await page.evaluate(() =>
      (
        window as unknown as {
          __libraryHall: { projectRack: () => { x: number; y: number } };
        }
      ).__libraryHall.projectRack(),
    );
    await page.mouse.click(at.x, at.y);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as { __libraryHall?: { walking: () => boolean } }
            ).__libraryHall?.walking() ?? false,
        ),
      )
      .toBe(true);
    // The software renderer draws a few frames a second, so the walk takes a while.
    await page.waitForURL('**/rack/events', { timeout: 90_000 });
  });

  test('stands the newspaper stand across the door, and opens the reading room', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.goto('/');
    // The rack's shelf is down in this suite, so the stand has no papers to count.
    await expect(page.locator('[data-hall-papers-sign]')).toHaveText('報架');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as { __libraryHall?: { firstFrameAt: number | null } })
              .__libraryHall?.firstFrameAt ?? null,
        ),
      )
      .not.toBeNull();
    const at = await page.evaluate(() =>
      (
        window as unknown as {
          __libraryHall: { projectPapers: () => { x: number; y: number } };
        }
      ).__libraryHall.projectPapers(),
    );
    await page.mouse.click(at.x, at.y);
    await page.waitForURL(/\/rack$/, { timeout: 90_000 });
  });

  test('re-sorts the bookcases by collection', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-group-by="collection"]').click();
    await expect(page).toHaveURL(/group=collection/);
    const labels = page.locator('[data-hall-list] [data-hall-case]');
    await expect(labels).toHaveCount(2);
    await expect(labels.filter({ hasText: '書' })).toHaveCount(1);
    await expect(labels.filter({ hasText: '筆記本' })).toHaveCount(1);
  });
});
