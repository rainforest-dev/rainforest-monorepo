import { expect, test } from '@playwright/test';

import { gotoLibrary, setPrefs } from './support/library';

test('the hall without WebGL lists bookcases that open in the Study', async ({
  page,
  context,
}) => {
  await setPrefs(context, { view: 'hall' });
  await gotoLibrary(page, '/?groupBy=series');
  await expect(page.locator('[data-hall-mode="css"]')).toHaveCount(1);
  await expect(page.locator('[data-hall-canvas]')).toHaveCount(0);
  const northbound = page
    .getByRole('list', { name: 'Bookcases' })
    .getByRole('button', { name: /Northbound/ });
  await expect(northbound).toContainText('20 books');
  await northbound.click();
  await expect(page).toHaveURL(/series=3/);
  await page.locator('[data-hall-back]').click();
  await expect(page.locator('[data-hall-mode="css"]')).toHaveCount(1);
});
