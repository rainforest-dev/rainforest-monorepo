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

  test('closing a book opened from an off-page search suggestion keeps focus in the search input', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const input = page.getByPlaceholder('Search books');
    await input.fill('Lantern Ledger');
    await expect(
      page.getByRole('option', { name: /The Lantern Ledger/ }),
    ).toBeVisible();
    await page.getByRole('option', { name: /The Lantern Ledger/ }).click();
    await expect(page).toHaveURL(/book=24/);
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(page).not.toHaveURL(/book=/);
    await input.click();
    await page
      .getByRole('option', { name: 'Search for "Lantern Ledger"' })
      .click();
    await expect(page).toHaveURL(/q=Lantern/);
    await expect(page.locator('[data-book-id="24"]')).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('after Back navigation, the search field reflects the URL and keeps its focus', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?q=Halvik');
    const input = page.getByPlaceholder('Search books');
    await expect(input).toHaveValue('Halvik');

    await page.getByRole('link', { name: 'Library' }).click();
    await expect(page).toHaveURL('/');
    await expect(input).toHaveValue('');

    await input.focus();
    await expect(input).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(/q=Halvik/);
    await expect(input).toHaveValue('Halvik');
    await expect(input).toBeFocused();
  });
});
