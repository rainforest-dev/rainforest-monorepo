import { expect, test } from '@playwright/test';

import { gotoLibrary } from './support/library';

test.describe('shell on phone', () => {
  test('shows the view switch as icons and no panel toggle', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const catalogue = page.getByRole('button', { name: 'Catalogue view' });
    await expect(catalogue).toBeVisible();
    await expect(
      catalogue.getByText('Catalogue', { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Hide filters' }),
    ).toBeHidden();
    await expect(page.locator('#library-filters')).toHaveCount(0);
  });
});
