import { expect, test } from '@playwright/test';

test.describe('the hall', () => {
  test('shelves every reachable collection and names the one that is down', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-hall-mode="3d"]')).toBeAttached();
    await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
    // Sorted by topic by default: the books' tags, then the shelf without one.
    await expect(
      page.locator('[data-hall-case="books-tag-sea"]'),
    ).toBeAttached();
    await expect(
      page.locator('[data-hall-case="books-tag-winter"]'),
    ).toBeAttached();
    await expect(page.locator('[data-hall-missing]')).toContainText('報架');
    // Each collection stands in a wing of its own, under its name.
    await expect(page.locator('[data-hall-sign="books"]')).toHaveText('書');
    await expect(page.locator('[data-hall-sign="notebooks"]')).toHaveText(
      '筆記本',
    );
    await expect(
      page.locator('[data-hall-case="notebooks-all"]'),
    ).toBeAttached();
  });

  test('raises and sinks bookcases as the grouping needs', async ({ page }) => {
    await page.goto('/');
    const standing = page.locator('[data-hall-canvas] [data-hall-label]');
    // By topic: sea, winter and untagged books, and the notebooks.
    await expect(standing).toHaveCount(4);
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
