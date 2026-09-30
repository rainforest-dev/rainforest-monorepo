import { expect, type Locator, test } from '@playwright/test';

import {
  BASE_URL,
  FAULT_COOKIE,
  gotoLibrary,
  options,
  pane,
  setPrefs,
} from './support/library';

async function expectRetryAlignedWithTitle(alert: Locator): Promise<void> {
  const title = alert.locator('[data-slot="alert-title"]');
  const retry = alert.getByRole('button', { name: 'Retry' });
  await expect
    .poll(async () => {
      const titleBox = await title.boundingBox();
      const retryBox = await retry.boundingBox();
      if (!titleBox || !retryBox) return null;
      return Math.abs(titleBox.x - retryBox.x);
    })
    .toBeLessThanOrEqual(1);
}

test.describe('states', () => {
  test('the Skeleton follows the view in the cookie', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'catalogue' });
    await page.goto('/?__delay=2500', { waitUntil: 'commit' });
    await expect(page.locator('[data-skeleton="catalogue"]')).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Books' })).toBeVisible({
      timeout: 15_000,
    });
    await setPrefs(context, { view: 'shelf' });
    await page.goto('/?__delay=2500', { waitUntil: 'commit' });
    await expect(page.locator('[data-skeleton="shelf"]')).toBeVisible();
  });

  test('a list fault shows the Alert with Retry', async ({ page }) => {
    await gotoLibrary(page, '/?__fault=list');
    const alert = page
      .getByRole('alert')
      .filter({ hasText: "Couldn't load the library" });
    await expect(alert).toContainText(
      'The book list request failed. Your filters and selection are kept, so a retry picks up where you were.',
    );
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expectRetryAlignedWithTitle(alert);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectRetryAlignedWithTitle(alert);
  });

  test('Retry recovers and keeps the selection', async ({ page, context }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press('x');
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toContainText('1 selected');
    await context.addCookies([
      { name: FAULT_COOKIE, value: 'list', url: BASE_URL },
    ]);
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    const alert = page
      .getByRole('alert')
      .filter({ hasText: "Couldn't load the library" });
    await expect(alert).toBeVisible();
    await context.clearCookies({ name: FAULT_COOKIE });
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(options(page)).toHaveCount(30);
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toContainText('1 selected');
  });

  test('a pane fault shows the compact pane error', async ({ page }) => {
    await gotoLibrary(page, '/?book=38&__fault=pane');
    const alert = pane(page).getByRole('alert');
    await expect(alert).toContainText("Couldn't load this book");
    await expect(
      pane(page).getByRole('button', { name: 'Retry' }),
    ).toBeVisible();
    await expect(options(page)).toHaveCount(30);
    await expectRetryAlignedWithTitle(alert);
  });
});
