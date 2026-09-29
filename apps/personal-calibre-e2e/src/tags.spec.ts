import { expect, test } from '@playwright/test';

import { gotoLibrary, pane } from './support/library';
import { bookById, tagName } from './support/seed';

test.describe('tags', () => {
  test('shows the book’s tags on the permalink', async ({ page }) => {
    await gotoLibrary(page, '/books/3');
    for (const id of bookById(3).tagIds) {
      await expect(page.getByText(tagName(id), { exact: true })).toBeVisible();
    }
  });

  test('adds an existing tag in the pane', async ({ page }) => {
    await gotoLibrary(page, '/?book=43');
    await pane(page).getByRole('button', { name: 'Add tag' }).click();
    await page.getByPlaceholder('Search or create tag…').fill('win');
    await page.getByRole('option', { name: 'winter' }).click();
    await expect(
      pane(page).getByRole('button', { name: 'Remove tag winter' }),
    ).toBeVisible();
  });

  test('creates a new tag', async ({ page }) => {
    await gotoLibrary(page, '/?book=44');
    await pane(page).getByRole('button', { name: 'Add tag' }).click();
    await page.getByPlaceholder('Search or create tag…').fill('reading-group');
    await page.getByRole('option', { name: 'Create "reading-group"' }).click();
    await expect(
      pane(page).getByRole('button', { name: 'Remove tag reading-group' }),
    ).toBeVisible();
  });

  test('removes a tag', async ({ page }) => {
    await gotoLibrary(page, '/?book=45');
    await pane(page).getByRole('button', { name: 'Remove tag sea' }).click();
    await expect(
      pane(page).getByRole('button', { name: 'Remove tag sea' }),
    ).toHaveCount(0);
  });
});
