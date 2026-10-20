import { expect, test } from '@playwright/test';

test.describe('the hall’s language', () => {
  test.use({ locale: 'en-US' });

  test('follows the browser, then the reader’s pick, at the same URL', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('link', { name: 'Rainforest Library' }),
    ).toBeVisible();
    await expect(page.locator('[data-hall-missing]')).toContainText('Rack');

    await page.getByRole('button', { name: 'Switch to Chinese' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-hall-missing]')).toContainText('報架');
    const prefs = (await context.cookies()).find(
      (c) => c.name === 'library-prefs',
    );
    expect(decodeURIComponent(prefs?.value ?? '')).toContain('"locale":"zh"');

    await page.getByRole('button', { name: '切換成英文' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
