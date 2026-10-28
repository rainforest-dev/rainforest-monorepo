import { expect, test } from '@playwright/test';

// The strings below are English, whatever locale the suite runs in.
test.use({ locale: 'en-US' });

test.describe('a page the reading room does not have', () => {
  for (const [path, name, href] of [
    ['/rack/no-such-shelf', 'Back to Rack', '/rack'],
    ['/kb/no/such/note', 'Back to Knowledge', '/kb'],
    ['/rack/events/no-such-issue', 'Back to Magazines', '/rack/events'],
  ] as const) {
    test(`${path} answers 404 under the bar, with a way back`, async ({
      page,
    }) => {
      expect((await page.goto(path))?.status()).toBe(404);
      await expect(
        page.getByRole('heading', { name: 'This page is not in the library' }),
      ).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('link', { name })).toHaveAttribute(
        'href',
        href,
      );
    });
  }
});

test('titles name the page, then its collection, then the library', async ({
  page,
}) => {
  await page.goto('/rack');
  await expect(page).toHaveTitle('Rack · Rainforest Library');
  await page.goto('/rack/events');
  await expect(page).toHaveTitle('Magazines · Rainforest Library');
  await page.goto('/kb');
  await expect(page).toHaveTitle('Knowledge · Rainforest Library');
});
