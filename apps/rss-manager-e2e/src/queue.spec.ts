import { expect, test } from '@playwright/test';

import { gotoTab } from './support/desk';
import { QUEUE } from './support/fixture-vault';
import { QUEUE_FILE, removeFile, resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const TIERS = [
  'Finish what you started',
  'Blind spot in your stack',
  'Wiki leverage',
  'Covered interest',
];

test.describe('queue', () => {
  test('renders every tier, the counts and the stale panel', async ({
    page,
  }) => {
    await gotoTab(page, 'queue');
    for (const tier of TIERS) {
      await expect(
        page.getByRole('heading', { level: 3, name: tier }),
      ).toBeVisible();
    }
    await expect(page.getByRole('listitem')).toHaveCount(
      QUEUE.titles.length + QUEUE.staleCount,
    );
    await expect(
      page.getByText(`${QUEUE.titles.length} queued`, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: `Stale (${QUEUE.staleCount})`,
      }),
    ).toBeVisible();
  });

  test('a sort mode reorders the queue', async ({ page }) => {
    await gotoTab(page, 'queue');
    const shortest = [...QUEUE.titles].sort((a, b) => a[2] - b[2])[0][1];
    const button = page.getByRole('button', { name: 'Shortest first' });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('listitem').first()).toContainText(shortest);
  });

  test('a missing reading-queue.json shows the empty state', async ({
    page,
  }) => {
    removeFile(QUEUE_FILE);
    await page.goto('/?tab=queue');
    await expect(
      page.getByText('No reading queue has been generated yet.'),
    ).toBeVisible();
  });
});
