import { expect, test } from '@playwright/test';

test('displays a grid of books on the homepage', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.grid')).toBeVisible();
  await expect(page.locator('text=/\\d+ books total/')).toBeVisible();
});
