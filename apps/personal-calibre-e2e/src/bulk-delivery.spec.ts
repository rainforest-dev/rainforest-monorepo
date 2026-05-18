import { expect, test } from '@playwright/test';

import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('bulk delivery', () => {
  test('select books, deliver, toast shown, badges update', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Select")');
    await page.click('[data-testid="book-card"] >> nth=0');
    await page.click('[data-testid="book-card"] >> nth=1');
    await expect(page.locator('text=2 selected')).toBeVisible();
    await page.click('button:has-text("Add to platform")');
    await expect(page.locator('text=marked as delivered')).toBeVisible({ timeout: 5000 });
    // Select mode should be cleared
    await expect(page.locator('text=2 selected')).not.toBeVisible();
    // After reload, RW badge should appear on delivered books
    await page.reload();
    await expect(page.locator('text=RW').first()).toBeVisible();
  });

  test('delivered=false filter shows zero results after delivering all books', async ({ page }) => {
    // Deliver all 8 books
    await page.goto('/');
    await page.click('button:has-text("Select")');
    await page.click('text=Select all (8)');
    await page.click('button:has-text("Add to platform")');
    await expect(page.locator('text=marked as delivered')).toBeVisible({ timeout: 5000 });

    // Filter for undelivered
    await page.goto('/?platform=readwise-reader&delivered=false');
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(0);
    await expect(page.locator('text=No books found')).toBeVisible();
  });
});
