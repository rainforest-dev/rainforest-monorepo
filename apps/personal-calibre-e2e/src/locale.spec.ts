import { expect, test } from '@playwright/test';

import { appPath, gotoLibrary } from './support/library';

test.describe('the library’s language', () => {
  test.use({ locale: 'zh-TW' });

  test('follows the browser, then the reader’s pick, at the same URL', async ({
    page,
    context,
  }) => {
    await gotoLibrary(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
    await expect(page.getByPlaceholder('搜尋書')).toBeVisible();

    await page.getByRole('button', { name: '切換成英文' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveURL(new RegExp(`${appPath('/')}$`));
    await expect(page.getByPlaceholder('Search books')).toBeVisible();
    const prefs = (await context.cookies()).find(
      (c) => c.name === 'library-prefs',
    );
    expect(decodeURIComponent(prefs?.value ?? '')).toContain('"locale":"en"');
  });

  test('sends a URL that names a locale to the plain one', async ({ page }) => {
    await page.goto(appPath('/en/read/1'));
    await expect(page).toHaveURL(new RegExp(`${appPath('/read/1')}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  });
});
