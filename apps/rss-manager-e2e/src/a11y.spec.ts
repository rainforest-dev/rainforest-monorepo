import { expect, test } from '@playwright/test';

import { type AxeIgnore, expectNoViolations } from './support/axe';
import { gotoTab, openValidate, type Tab } from './support/desk';
import { FEEDS } from './support/feed-server';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const PRE_REDESIGN_VIOLATIONS: Record<Tab, AxeIgnore[]> = {
  sources: [],
  topics: [{ rule: 'color-contrast', targetIncludes: 'bg-success' }],
  queue: [],
};

test.describe('accessibility', () => {
  for (const [tab, ignore] of Object.entries(PRE_REDESIGN_VIOLATIONS)) {
    test(`the ${tab} tab has no axe violations beyond the known ones`, async ({
      page,
    }) => {
      await gotoTab(page, tab as Tab);
      await expectNoViolations(page, { ignore });
    });
  }

  test('the Validate popover has no axe violations, with a result', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');
    const popover = await openValidate(page);
    await expectNoViolations(page);

    await popover.getByRole('textbox', { name: 'Feed URL' }).fill(FEEDS.rss);
    await page.keyboard.press('Enter');
    await expect(popover.getByRole('alert')).toContainText('Valid RSS feed');
    await expect(popover.getByRole('button', { name: 'Validate' })).toHaveCSS(
      'opacity',
      '1',
    );
    await expectNoViolations(page);
  });
});
