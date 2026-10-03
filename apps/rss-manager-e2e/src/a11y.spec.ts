import { expect, type Locator, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import {
  bulkButton,
  chips,
  detailPane,
  facetOption,
  gotoSources,
  gotoTab,
  openSource,
  openValidate,
  rowCheckbox,
  selectedCount,
  sourceRow,
  sourceSearch,
  startSelecting,
  type Tab,
  toasts,
  topicRow,
} from './support/desk';
import { FEEDS } from './support/feed-server';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const TABS: readonly Tab[] = ['sources', 'topics', 'queue'];

const UNTINTED = 'rgba(0, 0, 0, 0)';

async function expectTinted(row: Locator): Promise<void> {
  await expect(row).not.toHaveCSS('background-color', UNTINTED);
}

async function hoverRow(row: Locator): Promise<void> {
  await row.hover({ position: { x: 4, y: 4 } });
  await expectTinted(row);
}

test.describe('accessibility', () => {
  for (const tab of TABS) {
    test(`the ${tab} tab has no axe violations`, async ({ page }) => {
      await gotoTab(page, tab);
      await expectNoViolations(page);
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
    await hoverRow(sourceRow(page, 'Ferry Ops'));
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

  test('the Sources tab has no axe violations in select mode with a toast', async ({
    page,
  }) => {
    await gotoSources(page);
    await startSelecting(page);
    for (const name of ['Birch Compiler', 'Ferry Ops', 'Token Tides'])
      await rowCheckbox(page, name).click();
    await expect(selectedCount(page)).toHaveText('3 selected');
    for (const name of ['Birch Compiler', 'Ferry Ops', 'Token Tides'])
      await expectTinted(sourceRow(page, name));
    await hoverRow(sourceRow(page, 'Cinder Blog'));
    await expectNoViolations(page);

    await bulkButton(page, 'Activate').click();
    const toast = toasts(page);
    await expect(toast).toContainText('Activated Birch Compiler');
    await toast.hover();
    await rowCheckbox(page, 'Ferry Ops').click();
    await toast.hover();
    await expect(toast).toBeVisible();
    await expectNoViolations(page);
  });

  test('the Topics tab has no axe violations in select mode, tinted', async ({
    page,
  }) => {
    await gotoTab(page, 'topics');
    await startSelecting(page);
    const chosen = [
      'Home lab networking',
      'Web platform & CSS',
      'Crypto markets',
    ];
    for (const name of chosen) await rowCheckbox(page, name).click();
    await expect(selectedCount(page)).toHaveText('3 selected');
    for (const name of chosen) await expectTinted(topicRow(page, name));
    await hoverRow(topicRow(page, 'Data visualisation'));
    await expectNoViolations(page);

    await hoverRow(topicRow(page, 'Home lab networking'));
    await expectNoViolations(page);
  });
});
