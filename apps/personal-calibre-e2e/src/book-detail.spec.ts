import { expect, test } from '@playwright/test';

test('displays book details with title and download buttons', async ({ page }) => {
  await page.goto('/books/1');

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('a[download]').first()).toBeVisible();
});
