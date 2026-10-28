import { expect, test } from '@playwright/test';

import { appPath, gotoLibrary } from './support/library';

// The strings below are English, whatever locale the suite runs in.
test.use({ locale: 'en-US' });

test.describe('a page the catalogue does not have', () => {
  test('shows the library’s not-found page under the bar, with a way back', async ({
    page,
  }) => {
    for (const path of ['/books/999999', '/no/such/shelf']) {
      await page.goto(appPath(path));
      await expect(
        page.getByRole('heading', { name: 'This page is not in the library' }),
      ).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Back to Books' }),
      ).toHaveAttribute('href', '/books');
      await expect(
        page.getByRole('link', { name: 'Back to the hall' }),
      ).toHaveAttribute('href', '/');
    }
  });

  test('answers a path no page matches with 404', async ({ page }) => {
    expect((await page.goto(appPath('/no/such/shelf')))?.status()).toBe(404);
  });
});

test('titles name the page, then Books, then the library', async ({ page }) => {
  await gotoLibrary(page);
  await expect(page).toHaveTitle('Books · Rainforest Library');
  await page.goto(appPath('/books/1'));
  await expect(page).toHaveTitle(/^.+ · Books · Rainforest Library$/);
  const book = (await page.title()).split(' · ')[0];
  await page.goto(appPath('/read/1'));
  await expect(page).toHaveTitle(`${book} · Books · Rainforest Library`);
});
