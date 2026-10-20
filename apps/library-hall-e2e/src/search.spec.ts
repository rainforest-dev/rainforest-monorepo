import { expect, test } from '@playwright/test';

test.describe('searching the library', () => {
  test('finds items across collections and names the one that is down', async ({
    page,
  }) => {
    await page.goto('/');
    const box = page.getByRole('combobox', { name: '搜尋整座圖書館' });
    await box.fill('an');
    const options = page.getByRole('option');
    // "Lantern Weather" and "Garden Plans": one book and one notebook, merged into one list.
    await expect(options).toHaveCount(2);
    await expect(options.filter({ hasText: 'Lantern Weather' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Garden Plans' })).toHaveCount(1);
    await expect(page.getByText('報架暫時沒有回應')).toBeVisible();

    await box.press('ArrowDown');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    const href = await options.first().getByRole('link').getAttribute('href');
    expect(['/books?book=2', '/notebooks/n-2']).toContain(href);
  });

  test('says so when nothing matches', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: '搜尋整座圖書館' }).fill('zzz');
    await expect(page.getByText('找不到符合的項目')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);
  });
});
