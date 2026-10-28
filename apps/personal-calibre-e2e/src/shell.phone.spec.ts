import { expect, test } from '@playwright/test';

import { gotoLibrary } from './support/library';

test.describe('shell on phone', () => {
  test('shows the views in their own row and no panel toggle', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const catalogue = page.getByRole('button', { name: 'Catalogue view' });
    await expect(catalogue).toBeVisible();
    // The row under the bar has room for the names, so they show on a phone too.
    await expect(
      catalogue.getByText('Catalogue', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Catalogue view' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Hide sidebar' }),
    ).toBeHidden();
    await expect(page.locator('#library-sidebar')).toHaveCount(0);
  });
});
