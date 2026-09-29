import { expect, test } from '@playwright/test';

import { gotoLibrary, options, pane } from './support/library';

test.describe('shelf', () => {
  test('shows the first page as a cover grid', async ({ page }) => {
    await gotoLibrary(page);
    await expect(
      page.getByRole('region', { name: 'Shelf view' }),
    ).toBeVisible();
    await expect(options(page)).toHaveCount(30);
    await expect(
      page.getByRole('navigation', { name: 'Pagination' }),
    ).toContainText('Page 1 of 3');
  });

  test('clicking a tile opens the pane and Back closes it', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    const id = await first.getAttribute('data-book-id');
    await first.click();
    await expect(page).toHaveURL(new RegExp(`book=${id}`));
    await expect(
      pane(page).locator(`[data-book-detail="${id}"]`),
    ).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/book=/);
  });

  test('marks show the platforms a book is on', async ({ page }) => {
    await gotoLibrary(page, '/?author=6');
    const tile = page.locator('[role="option"][data-book-id="1"]');
    await expect(tile.locator('[title="On Kobo"]')).toContainText('KB');
    await expect(tile.locator('[title="On NotebookLM"]')).toContainText('NLM');
  });

  test('groups by series with See all for a group this page cuts short', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=series');
    await expect(
      page.getByRole('group', { name: 'Amber Road, 8 books' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: 'Glass Orchard, 7 books' })
        .getByRole('button', { name: /See all/ }),
    ).toHaveCount(0);
    await page
      .getByRole('group', { name: 'Northbound, 20 books' })
      .getByRole('button', { name: 'See all 20' })
      .click();
    await expect(page).toHaveURL(/series=3/);
    await expect(page).not.toHaveURL(/groupBy=/);
  });

  test('a group split across pages repeats its heading with (continued)', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=series&page=2');
    const shelf = page.getByRole('region', { name: 'Shelf view' });
    await expect(shelf.getByRole('group').first()).toHaveAccessibleName(
      'Northbound (continued), 20 books',
    );
    await expect(
      shelf.getByRole('heading', { name: 'Northbound (continued)' }),
    ).toBeVisible();
  });

  test('the tile shows a new mark after Mark added in the pane', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=4&book=40');
    await pane(page)
      .locator('[data-platform="kobo"]')
      .getByRole('button', { name: /Mark added|Log again/ })
      .click();
    await page
      .getByRole('dialog', { name: 'Mark as added to Kobo' })
      .getByRole('button', { name: 'Save' })
      .click();
    await expect(
      page.locator('[role="option"][data-book-id="40"] [title="On Kobo"]'),
    ).toBeVisible();
  });

  test('an empty result offers Clear filters', async ({ page }) => {
    await gotoLibrary(page, '/?q=zzzz-no-such-book');
    await expect(page.getByText('No books match these filters.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(options(page)).toHaveCount(30);
  });
});
