import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test('FTS returns results for partial title match', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Search books..."]', 'Dune');
    await expect(page.locator('.absolute.border').or(page.locator('[role="listbox"]'))).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=Dune').first()).toBeVisible();
  });

  test('selecting autocomplete suggestion navigates to book detail', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Search books..."]', 'Dune');
    await page.waitForTimeout(400);
    await page.locator('.absolute.border >> [role="button"]').first().click();
    await expect(page).toHaveURL(/\/books\/\d+/);
  });

  test('pressing Enter commits search to URL and shows results', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Search books..."]', 'Foundation');
    await page.press('input[placeholder="Search books..."]', 'Enter');
    await expect(page).toHaveURL(/q=Foundation/);
    await expect(page.locator('[data-testid="book-card"]').first()).toBeVisible();
  });

  test('clear button removes search from URL', async ({ page }) => {
    await page.goto('/?q=Dune');
    await page.click('button[aria-label="Clear search"]');
    await expect(page).toHaveURL('/');
  });
});
