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

  test('names the calendar’s month and weekdays in Chinese', async ({
    page,
  }) => {
    await page.goto('/notebooks?view=calendar&month=2026-10');
    await expect(
      page.getByRole('heading', { name: '2026 年 10 月' }),
    ).toBeVisible();
    await expect(page.getByText('週日', { exact: true })).toBeVisible();
  });

  test('sends a URL that names a locale to the plain one', async ({ page }) => {
    await page.goto('/notebooks/en');
    await expect(page).toHaveURL(/\/notebooks$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  });
});
