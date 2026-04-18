import { expect, test } from '@playwright/test';

test('search input updates URL with q param', async ({ page }) => {
  await page.goto('/');

  const input = page.getByPlaceholder('Search books...');
  await input.fill('test');
  await input.press('Enter');

  await expect(page).toHaveURL(/[?&]q=test/);
});
