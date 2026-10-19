import { expect, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { hideDevToolbar } from './support/phone';

test.describe('knowledge base on a phone', () => {
  test.beforeEach(({ page }) => hideDevToolbar(page));

  test('the contents fold into a disclosure and the page reads in one column', async ({
    page,
  }) => {
    await page.goto('/kb/pages/tech-kites');
    const toc = page.locator('details').filter({ hasText: '知識庫目錄' });
    await expect(toc).toBeVisible();
    await expect(toc.getByRole('link', { name: 'Wind' })).toBeHidden();

    await toc.locator('summary').click();
    await toc.getByRole('link', { name: 'Wind' }).click();
    await expect(page).toHaveURL(/\/kb\/pages\/wind$/);

    const width = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(390);
    await expectNoViolations(page);
  });
});
