import { expect, test } from '@playwright/test';

test.describe('the notebooks’ language', () => {
  test.use({ locale: 'zh-TW' });

  test('follows the browser, then the reader’s pick, at the same URL', async ({
    page,
    context,
  }) => {
    await page.goto('/notebooks');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
    await expect(page.getByLabel('筆記本名稱')).toBeVisible();

    await page.getByRole('button', { name: '切換成英文' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveURL(/\/notebooks$/);
    await expect(page.getByLabel('Notebook name')).toBeVisible();
    const prefs = (await context.cookies()).find(
      (c) => c.name === 'library-prefs',
    );
    expect(decodeURIComponent(prefs?.value ?? '')).toContain('"locale":"en"');
  });

  test('sends a URL that names a locale to the plain one', async ({ page }) => {
    await page.goto('/notebooks/en');
    await expect(page).toHaveURL(/\/notebooks$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  });
});
