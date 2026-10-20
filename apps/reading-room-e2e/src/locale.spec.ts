import { expect, test } from '@playwright/test';

test.describe('the reading room’s language', () => {
  test('an English browser gets English, on the rack and in the knowledge base', async ({
    page,
  }) => {
    await page.goto('/rack/sources');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('tab', { name: /^Sources/ })).toBeVisible();
    await page.goto('/kb');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page
        .getByRole('main')
        .getByRole('heading', { name: 'Knowledge base', level: 2 }),
    ).toBeVisible();
  });

  test.describe('in a Chinese browser', () => {
    test.use({ locale: 'zh-TW' });

    test('follows the browser, then the reader’s pick, at the same URL', async ({
      page,
      context,
    }) => {
      await page.goto('/rack/sources');
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
      await expect(page.getByRole('tab', { name: /^來源/ })).toBeVisible();
      await expect(
        page.getByRole('searchbox', { name: '搜尋來源' }),
      ).toBeVisible();

      // The switch lives in an island; a click before it hydrates does nothing.
      await expect(async () => {
        await page.getByRole('button', { name: '切換成英文' }).click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en', {
          timeout: 2_000,
        });
      }).toPass();
      await expect(page).toHaveURL(/\/rack\/sources$/);
      await expect(
        page.getByRole('searchbox', { name: 'Search sources' }),
      ).toBeVisible();
      const prefs = (await context.cookies()).find(
        (c) => c.name === 'library-prefs',
      );
      expect(decodeURIComponent(prefs?.value ?? '')).toContain('"locale":"en"');
    });
  });
});
