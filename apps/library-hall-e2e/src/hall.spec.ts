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
    // One untagged book and both notebooks have no topic, and the sign says so.
    await expect(page.locator('[data-hall-sign="topics"]')).toHaveText(
      '主題3 件沒有主題',
    );
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
