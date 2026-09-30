import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary } from './support/library';

const panel = (page: Page) => page.locator('#library-filters');

test.describe('filters', () => {
  test('a facet filters the list, titles the scope and adds a chip', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await panel(page)
      .getByRole('button', { name: 'Northbound', exact: true })
      .click();
    await expect(page).toHaveURL(/series=3/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Northbound',
    );
    await expect(page.getByText('20 of 70 books')).toBeVisible();
    await expect(
      panel(page).getByRole('heading', { name: 'Filters · 1' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Remove filter Series: Northbound' })
      .click();
    await expect(page).not.toHaveURL(/series=/);
  });

  test('Show all swaps in a filter list', async ({ page }) => {
    await gotoLibrary(page);
    await panel(page)
      .getByRole('region', { name: 'Authors' })
      .getByRole('button', { name: 'Show all 10' })
      .click();
    await panel(page).getByPlaceholder('Filter authors').fill('Ilv');
    await panel(page).getByRole('option', { name: 'Soren Ilves' }).click();
    await expect(page).toHaveURL(/author=10/);
  });

  test('the delivery facet filters On and Not on a platform', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await panel(page)
      .getByRole('button', { name: 'Kobo', exact: true })
      .click();
    await expect(page).toHaveURL(/platform=kobo/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('On Kobo');
    await expect(
      page.locator('[role="option"][data-book-id="1"]'),
    ).toBeVisible();
    await panel(page).getByRole('button', { name: 'Not on' }).click();
    await expect(page).toHaveURL(/delivered=false/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Not on Kobo',
    );
    await expect(page.locator('[role="option"][data-book-id="1"]')).toHaveCount(
      0,
    );
  });

  test('Clear all keeps book, view and group', async ({ page }) => {
    await gotoLibrary(page, '/?author=4&tag=6&book=38&groupBy=series');
    await panel(page).getByRole('button', { name: 'Clear all' }).click();
    await expect(page).toHaveURL(/\/\?book=38&groupBy=series$/);
  });

  test('sort, direction and group change the URL and drop page', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?page=2');
    await expect(
      page
        .getByRole('button', { name: 'Sort direction: ascending' })
        .locator('xpath=..'),
    ).toHaveAttribute('data-slot', 'button-group');
    await page
      .getByRole('button', { name: 'Sort direction: ascending' })
      .click();
    await expect(page).toHaveURL(/sortDir=desc/);
    await expect(page).not.toHaveURL(/page=/);
    await page.getByRole('combobox', { name: 'Sort' }).click();
    await page.getByRole('option', { name: 'Date added' }).click();
    await expect(page).toHaveURL(/sortBy=added/);
    await page.getByRole('combobox', { name: 'Group' }).click();
    await page.getByRole('option', { name: 'Series', exact: true }).click();
    await expect(page).toHaveURL(/groupBy=series/);
  });

  test('a new tag appears in the filter panel', async ({ page }) => {
    await page.request.post('/api/books/46/tags', {
      data: { name: 'to-read' },
    });
    await gotoLibrary(page);
    await panel(page)
      .getByRole('region', { name: 'Tags' })
      .getByRole('button', { name: /^Show all \d+$/ })
      .click();
    await panel(page).getByPlaceholder('Filter tags').fill('to-r');
    await expect(
      panel(page).getByRole('option', { name: 'to-read' }),
    ).toBeVisible();
  });
});
