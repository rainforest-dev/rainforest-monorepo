import { expect, test } from '@playwright/test';

import { gotoLibrary } from './support/library';

test.describe('catalogue on phone', () => {
  test('the compact grid exposes column headers to assistive tech', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue');
    const grid = page.getByRole('grid', { name: 'Books' });
    await expect(
      grid.getByRole('columnheader', { name: 'Select' }),
    ).toHaveCount(1);
    await expect(grid.getByRole('columnheader', { name: 'Book' })).toHaveCount(
      1,
    );
  });

  test('arrow key navigation still moves between rows in the compact grid', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue');
    const rows = page
      .getByRole('grid', { name: 'Books' })
      .locator('tr[data-nav-key]');
    await rows.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
  });
});
