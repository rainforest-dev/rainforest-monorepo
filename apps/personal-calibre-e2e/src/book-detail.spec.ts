import { expect, test } from '@playwright/test';

import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('book detail', () => {
  test('shows book title and author', async ({ page }) => {
    await page.goto('/books/1'); // Dune
    await expect(page.locator('h1')).toContainText('Dune');
    await expect(page.locator('text=Frank Herbert')).toBeVisible();
  });

  test('shows tags and tag editor', async ({ page }) => {
    await page.goto('/books/1');
    await expect(page.locator('text=sci-fi')).toBeVisible();
    await expect(page.locator('button:has-text("+ Add tag")')).toBeVisible();
  });

  test('back link with from param returns to filtered library', async ({ page }) => {
    await page.goto('/?author=1');
    await page.click('[data-testid="book-card"] >> nth=0');
    await expect(page).toHaveURL(/\/books\/\d+\?from=/);
    await page.click('text=← Back to library');
    await expect(page).toHaveURL(/author=1/);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });
});
