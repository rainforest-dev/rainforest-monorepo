import { expect, test } from '@playwright/test';

test.describe('coming back to the hall', () => {
  test('is restored from the back/forward cache with the scene intact', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
    // Any other document will do; the hall server answers this path with its 404 page.
    await page.goto('/books?book=1');
    // A restore fires no load event, so wait only for the navigation to commit.
    await page.goBack({ waitUntil: 'commit' });
    await expect(page.locator('[data-hall-restored="bfcache"]')).toBeAttached();
    await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
  });

  test('shows the last frame until the rebuilt scene draws', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
    // Let the scene draw so the pagehide capture has something to save.
    await page.waitForTimeout(1500);
    await page.reload();
    const saved = await page.evaluate(() =>
      sessionStorage.getItem('library-hall:memory'),
    );
    expect(JSON.parse(saved ?? '{}').poster).toMatch(/^data:image\/jpeg/);
    await expect(page.locator('[data-hall-poster]')).toBeAttached();
    await expect(page.locator('[data-hall-poster]')).toHaveCount(0, {
      timeout: 20_000,
    });
  });
});
