import { expect, test } from '@playwright/test';

test.describe('the hall on a phone', () => {
  test('starts as a list of bookcases and loads 3D on request', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('[data-hall-mode="css"]')).toBeAttached();
    await expect(
      page.locator('[data-hall-case="books-tag-sea"]'),
    ).toBeVisible();

    await page.locator('[data-hall-enter-3d]').click();
    await expect(page.locator('[data-hall-mode="3d"]')).toBeAttached();
    await expect(page.locator('[data-hall-canvas] canvas')).toBeVisible();
  });
});
