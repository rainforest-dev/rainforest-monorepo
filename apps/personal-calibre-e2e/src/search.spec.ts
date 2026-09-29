import { expect, test } from '@playwright/test';

import { gotoLibrary, options, pane } from './support/library';

test.describe('search', () => {
  test('typing shows a search item and suggestions', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByPlaceholder('Search books').fill('Salt Archive');
    await expect(
      page.getByRole('option', { name: 'Search for "Salt Archive"' }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /The Salt Archive/ }),
    ).toBeVisible();
  });

  test('Enter commits the search to the URL', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByPlaceholder('Search books').fill('Halvik');
    await page.getByPlaceholder('Search books').press('Enter');
    await expect(page).toHaveURL(/q=Halvik/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Results for "Halvik"',
    );
    await expect(page.getByText('20 of 70 books')).toBeVisible();
  });

  test('picking a suggestion opens the pane', async ({ page }) => {
    await gotoLibrary(page);
    const input = page.getByPlaceholder('Search books');
    await input.fill('Salt Archive');
    await expect(
      page.getByRole('option', { name: /The Salt Archive/ }),
    ).toBeVisible();
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/book=1/);
    await expect(page).not.toHaveURL(/q=/);
    await expect(pane(page).locator('[data-book-detail="1"]')).toBeVisible();
  });

  test('the clear button removes the search', async ({ page }) => {
    await gotoLibrary(page, '/?q=Salt');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page).not.toHaveURL(/q=/);
  });

  test('typing in the search field, including Space and arrow keys, does not affect shelf selection or focus', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute('aria-selected', 'false');

    const input = page.getByPlaceholder('Search books');
    await input.fill('Salt Archive');
    await input.press('Space');
    await input.press('ArrowDown');
    await input.press('ArrowUp');

    await expect(first).toHaveAttribute('aria-selected', 'false');
    await expect(input).toBeFocused();
  });
});
