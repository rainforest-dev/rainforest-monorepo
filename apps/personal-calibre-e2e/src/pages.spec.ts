import { expect, test } from '@playwright/test';

import { gotoLibrary, options, pane } from './support/library';

const pager = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Pagination' });

test.describe('pages', () => {
  test('the pager moves between pages and Back returns', async ({ page }) => {
    await gotoLibrary(page);
    await pager(page).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(pager(page)).toContainText('Page 2 of 3');
    await page.goBack();
    await expect(page).not.toHaveURL(/page=/);
    await expect(pager(page)).toContainText('Page 1 of 3');
  });

  test('an out-of-range page lands on the last page with every param kept', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?page=99&groupBy=series&sortDir=desc&book=38');
    await expect(page).toHaveURL(/page=3/);
    for (const param of ['groupBy=series', 'sortDir=desc', 'book=38']) {
      await expect(page).toHaveURL(new RegExp(param));
    }
    await expect(pager(page)).toContainText('Page 3 of 3');
  });

  test('an astronomically large page redirects to the last page instead of erroring', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?page=999999999999');
    await expect(page).toHaveURL(/page=3/);
    await expect(page.locator('[data-load-error]')).toHaveCount(0);
    await expect(pager(page)).toContainText('Page 3 of 3');
  });

  test('junk params are ignored', async ({ page }) => {
    await gotoLibrary(page, '/?page=abc&author=abc&groupBy=nope');
    await expect(pager(page)).toContainText('Page 1 of 3');
    await expect(options(page)).toHaveCount(30);
  });

  test('?book= survives a page change with the pane open', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await pager(page).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/book=38/);
    await expect(pane(page).locator('[data-book-detail="38"]')).toBeVisible();
  });

  test('the pager hides on a single page', async ({ page }) => {
    await gotoLibrary(page, '/?series=4');
    await expect(options(page)).toHaveCount(6);
    await expect(pager(page)).toHaveCount(0);
  });
});
