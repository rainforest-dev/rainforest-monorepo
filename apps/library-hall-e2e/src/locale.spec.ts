import { expect, test } from '@playwright/test';

test.describe('the hall’s language', () => {
  test.use({ locale: 'en-US' });

  test("says Taipei's time and weather in English, and only the time when there is no weather", async ({
    page,
  }) => {
    await page.goto('/?hallTime=09:05');
    await expect(page.locator('[data-hall-conditions]')).toHaveText(
      'Taipei 09:05 · Overcast 22°C',
    );
    await page.route('**/api/weather', (route) =>
      route.fulfill({ json: { weather: null } }),
    );
    await page.reload();
    await expect(page.locator('[data-hall-conditions="none"]')).toHaveText(
      'Taipei 09:05',
    );
  });

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
