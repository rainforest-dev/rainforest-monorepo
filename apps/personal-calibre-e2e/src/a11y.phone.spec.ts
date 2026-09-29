import { expect, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { gotoLibrary } from './support/library';

test.describe('accessibility on phone', () => {
  test('the shelf has no axe violations', async ({ page }) => {
    await gotoLibrary(page);
    await expectNoViolations(page);
  });

  test('the compact catalogue has no axe violations', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue');
    await expectNoViolations(page);
  });

  test('the filter Sheet has no axe violations', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('the detail Sheet has no axe violations', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await expect(
      page.getByRole('dialog', { name: 'Book details' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });
});
