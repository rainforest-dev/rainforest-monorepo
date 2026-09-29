import { expect, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { gotoLibrary, options } from './support/library';

const PAGES = [
  ['shelf', '/'],
  ['grouped shelf', '/?groupBy=series'],
  ['catalogue', '/?view=catalogue'],
  ['grouped catalogue', '/?view=catalogue&groupBy=tag'],
  ['shelf with the pane', '/?book=38'],
  ['catalogue with the pane', '/?view=catalogue&book=38'],
  ['permalink', '/books/38'],
  ['empty result', '/?q=zzzz-no-such-book'],
] as const;

test.describe('accessibility', () => {
  for (const [name, url] of PAGES) {
    test(`${name} has no axe violations`, async ({ page }) => {
      await gotoLibrary(page, url);
      await expectNoViolations(page);
    });
  }

  test('the bulk toolbar has no axe violations', async ({ page }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press('x');
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });
});
