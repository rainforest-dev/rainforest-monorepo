import { expect, test } from '@playwright/test';

import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('tag editing', () => {
  test('book detail shows existing tags', async ({ page }) => {
    await page.goto('/books/1'); // Dune has sci-fi, classic
    await expect(page.locator('text=sci-fi')).toBeVisible();
    await expect(page.locator('text=classic')).toBeVisible();
  });

  test('Add tag button is visible', async ({ page }) => {
    await page.goto('/books/1');
    await expect(page.locator('button:has-text("+ Add tag")')).toBeVisible();
  });

  test('adding an existing tag appears on page', async ({ page }) => {
    await page.goto('/books/7'); // Thinking Fast — has nonfiction, no self-help
    await page.click('button:has-text("+ Add tag")');
    await page.fill('input[placeholder="Search or create tag…"]', 'self');
    await page.locator('[cmdk-item]:has-text("self-help")').click();
    await expect(page.locator('text=self-help')).toBeVisible({ timeout: 5000 });
  });

  test('creating a new tag adds it to the book', async ({ page }) => {
    await page.goto('/books/5'); // The Hobbit
    await page.click('button:has-text("+ Add tag")');
    await page.fill('input[placeholder="Search or create tag…"]', 'adventure');
    await page.locator('text=Create "adventure"').first().click();
    await expect(page.locator('text=adventure')).toBeVisible({ timeout: 5000 });
  });

  test('removing a tag unlinks it from the book', async ({ page }) => {
    await page.goto('/books/1'); // Dune has classic
    await page.click('button[aria-label="Remove tag classic"]');
    await expect(page.locator('text=classic')).not.toBeVisible({ timeout: 5000 });
  });

  test('new tag appears in filter combobox', async ({ page }) => {
    await page.request.post('/api/books/5/tags', { data: { name: 'to-read' } });
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by tag"]');
    await expect(page.locator('[cmdk-item]:has-text("to-read")')).toBeVisible();
  });
});
