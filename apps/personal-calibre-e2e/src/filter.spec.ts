import { expect, test } from '@playwright/test';

import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('filters', () => {
  test('author combobox filters grid', async ({ page }) => {
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by author"]');
    await page.fill('input[placeholder="Search author…"]', 'Herbert');
    await page.click('[cmdk-item]:has-text("Frank Herbert")');
    await expect(page).toHaveURL(/author=/);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });

  test('tag combobox filters grid', async ({ page }) => {
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by tag"]');
    await page.click('[cmdk-item]:has-text("fantasy")');
    await expect(page).toHaveURL(/tag=/);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });

  test('back navigation restores filter state', async ({ page }) => {
    await page.goto('/');
    await page.click('button[role="combobox"][aria-label="Filter by author"]');
    await page.click('[cmdk-item]:has-text("Frank Herbert")');
    const authorUrl = page.url();
    await page.click('[data-testid="book-card"] >> nth=0');
    await expect(page).toHaveURL(/\/books\/\d+/);
    await page.goBack();
    await expect(page).toHaveURL(authorUrl);
    await expect(page.locator('[data-testid="book-card"]')).toHaveCount(2);
  });

  test('platform filter shows undelivered books', async ({ page }) => {
    await page.goto('/');
    await page.selectOption('[aria-label="Filter by platform"]', 'readwise-reader');
    await expect(page.locator('[aria-label="Filter by delivery status"]')).toBeVisible();
    await page.selectOption('[aria-label="Filter by delivery status"]', 'false');
    await expect(page).toHaveURL(/platform=readwise-reader/);
    await expect(page.locator('[data-testid="book-card"]').first()).toBeVisible();
  });

  test('sort direction toggle changes URL', async ({ page }) => {
    await page.goto('/');
    await page.click('button[aria-label="Sort direction: ascending"]');
    await expect(page).toHaveURL(/sortDir=desc/);
    await page.click('button[aria-label="Sort direction: descending"]');
    await expect(page).not.toHaveURL(/sortDir=/);
  });

  test('clear all removes filter params', async ({ page }) => {
    await page.goto('/?author=1&tag=1');
    await page.click('button:has-text("Clear all")');
    await expect(page).toHaveURL('/');
  });
});
