import { expect, test } from '@playwright/test';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

test.describe('group-by', () => {
  test('group by series shows series section headers', async ({ page }) => {
    await page.goto('/?groupBy=series');
    await expect(page.locator('h2:has-text("Dune Chronicles")')).toBeVisible();
    await expect(page.locator('h2:has-text("Foundation Series")')).toBeVisible();
    await expect(page.locator('h2:has-text("The Lord of the Rings")')).toBeVisible();
  });

  test('group by tag shows tag section headers', async ({ page }) => {
    await page.goto('/?groupBy=tag');
    await expect(page.locator('h2:has-text("sci-fi")')).toBeVisible();
    await expect(page.locator('h2:has-text("fantasy")')).toBeVisible();
    await expect(page.locator('h2:has-text("nonfiction")')).toBeVisible();
  });

  test('group by author shows author section headers', async ({ page }) => {
    await page.goto('/?groupBy=author');
    await expect(page.locator('h2:has-text("Frank Herbert")')).toBeVisible();
    await expect(page.locator('h2:has-text("Isaac Asimov")')).toBeVisible();
  });

  test('ungrouped section appears for books without a series', async ({ page }) => {
    await page.goto('/?groupBy=series');
    await expect(page.locator('h2:has-text("Ungrouped")')).toBeVisible();
  });

  test('See all link not shown when group has 6 or fewer books', async ({ page }) => {
    await page.goto('/?groupBy=series');
    // All series in fixture have <=6 books — no "See all" links
    await expect(page.locator('text=See all')).not.toBeVisible();
  });

  test('filter + group-by compose: nonfiction books grouped by author', async ({ page }) => {
    await page.goto('/?tag=4&groupBy=author');
    await expect(page.locator('h2:has-text("Daniel Kahneman")')).toBeVisible();
    await expect(page.locator('h2:has-text("James Clear")')).toBeVisible();
    await expect(page.locator('h2:has-text("Frank Herbert")')).not.toBeVisible();
  });
});
