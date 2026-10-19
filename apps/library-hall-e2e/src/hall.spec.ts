import { expect, test } from '@playwright/test';

test.describe('the hall', () => {
  test('shelves every reachable collection and names the one that is down', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-hall-mode="3d"]')).toBeAttached();
    await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
    // Sorted by topic by default: the books' tags, then the shelf without one.
    await expect(page.locator('[data-hall-case="tag-sea"]')).toBeAttached();
    await expect(page.locator('[data-hall-case="tag-winter"]')).toBeAttached();
    await expect(page.locator('[data-hall-missing]')).toContainText('報架');
  });

  test('re-sorts the bookcases by collection', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-group-by="collection"]').click();
    await expect(page).toHaveURL(/group=collection/);
    const labels = page.locator('[data-hall-list] [data-hall-case]');
    await expect(labels).toHaveCount(2);
    await expect(labels.filter({ hasText: '筆記本' })).toHaveCount(1);
  });
});
