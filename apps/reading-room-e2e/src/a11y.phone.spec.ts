import { expect, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { bulkToolbar, selectedCount, validatePopover } from './support/desk';
import {
  detailSheet,
  gotoPhone,
  hideDevToolbar,
  openFilterSheet,
  queueItems,
  sheetFacet,
  sourceItem,
  sourceItems,
  topicItem,
  topicItems,
} from './support/phone';
import { resetVault } from './support/vault';

test.beforeEach(async ({ page }) => {
  resetVault();
  await hideDevToolbar(page);
});

test.describe('accessibility on phone', () => {
  test('the Sources tab has no axe violations', async ({ page }) => {
    await gotoPhone(page);
    await expect(sourceItems(page).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test('the Sources tab has no axe violations with chips applied', async ({
    page,
  }) => {
    await gotoPhone(page, '?q=o&status=active&stale=low-value,delivery-gap');
    await expect(sourceItems(page).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test('the Topics tab has no axe violations', async ({ page }) => {
    await gotoPhone(page, '?tab=topics');
    await expect(topicItems(page).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test('the Queue tab has no axe violations', async ({ page }) => {
    await gotoPhone(page, '?tab=queue');
    await expect(queueItems(page).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test('the filter Sheet has no axe violations', async ({ page }) => {
    await gotoPhone(page);
    await openFilterSheet(page);
    await sheetFacet(page, 'Status', 'Proposed').click();
    await expect(page).toHaveURL(/\?status=proposed$/);
    await expectNoViolations(page);
  });

  test('the detail Sheet has no axe violations', async ({ page }) => {
    await gotoPhone(page, '?source=Ferry+Ops');
    await expect(
      detailSheet(page).getByRole('heading', { name: 'Ferry Ops' }),
    ).toBeVisible();
    await expectNoViolations(page);

    await gotoPhone(page, '?source=Studio+Halcyon');
    await expect(
      detailSheet(page).getByRole('textbox', { name: 'Feed URL' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });

  test('Sources select mode with the floating bulk bar has no axe violations', async ({
    page,
  }) => {
    await gotoPhone(page);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await sourceItem(page, 'Birch Compiler').click();
    await sourceItem(page, 'Ferry Ops').click();
    await expect(selectedCount(page)).toHaveText('2 selected');
    await expectNoViolations(page);
  });

  test('Topics select mode with the floating bulk bar has no axe violations', async ({
    page,
  }) => {
    await gotoPhone(page, '?tab=topics');
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await topicItem(page, 'Home lab networking').click();
    await expect(bulkToolbar(page)).toBeVisible();
    await expectNoViolations(page);
  });

  test('the Validate popover has no axe violations', async ({ page }) => {
    await gotoPhone(page, '?tab=validate');
    await expect(validatePopover(page)).toBeVisible();
    await expectNoViolations(page);
  });
});
