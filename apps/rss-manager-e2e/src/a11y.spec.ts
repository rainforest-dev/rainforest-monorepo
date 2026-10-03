import { expect, type Page, test } from '@playwright/test';

import { type AxeIgnore, expectNoViolations } from './support/axe';
import {
  chips,
  detailPane,
  facetOption,
  gotoSources,
  gotoTab,
  openSource,
  openValidate,
  sourceSearch,
  type Tab,
} from './support/desk';
import { FEEDS } from './support/feed-server';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const PRE_REDESIGN_VIOLATIONS: Record<Tab, AxeIgnore[]> = {
  sources: [],
  topics: [{ rule: 'color-contrast', targetIncludes: 'bg-success' }],
  queue: [],
};

async function settleHover(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  for (const row of await page.locator('tbody tr').all())
    await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
}

test.describe('accessibility', () => {
  for (const [tab, ignore] of Object.entries(PRE_REDESIGN_VIOLATIONS)) {
    test(`the ${tab} tab has no axe violations beyond the known ones`, async ({
      page,
    }) => {
      await gotoTab(page, tab as Tab);
      await expectNoViolations(page, { ignore });
    });
  }

  test('the Sources tab has no axe violations with filters applied', async ({
    page,
  }) => {
    await gotoSources(page);
    await facetOption(page, 'Status', 'Active').click();
    await facetOption(page, 'Stale', 'Low value').click();
    await sourceSearch(page).fill('o');
    await expect(chips(page).getByRole('listitem')).toHaveCount(4);
    await expectNoViolations(page);

    await sourceSearch(page).fill('zzzz');
    await expect(page.getByText('No sources match')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the Sources tab has no axe violations with the pane open', async ({
    page,
  }) => {
    await gotoSources(page);
    const pane = await openSource(page, 'Ferry Ops');
    await expect(pane.getByRole('alert')).toContainText('Delivery gap');
    await settleHover(page);
    await expectNoViolations(page);

    await pane.getByRole('button', { name: 'Validate feed' }).click();
    await expect(pane.getByRole('alert').last()).toContainText('HTTP 404');
    await expectNoViolations(page);

    await gotoSources(page, '?source=Studio+Halcyon');
    await expect(
      detailPane(page).getByRole('textbox', { name: 'Feed URL' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });

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
