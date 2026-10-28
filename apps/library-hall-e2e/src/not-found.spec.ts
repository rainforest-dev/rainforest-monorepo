import { expect, test } from '@playwright/test';

// The strings below are English, whatever locale the suite runs in.
test.use({ locale: 'en-US' });

test('a path the hall does not have shows the not-found page under the bar', async ({
  page,
}) => {
  const res = await page.goto('/no-such-room');
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'This page is not in the library' }),
  ).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Back to the hall' }),
  ).toHaveAttribute('href', '/');
  await expect(
    page.getByRole('link', { name: /^Back to (?!the hall)/ }),
  ).toHaveCount(0);
});

test('the hall is titled with the library’s name alone', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Rainforest Library');
});
