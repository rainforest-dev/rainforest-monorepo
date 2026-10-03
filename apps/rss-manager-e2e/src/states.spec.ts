import { expect, test } from '@playwright/test';

import { gotoTab } from './support/desk';
import {
  QUEUE_FILE,
  removeFile,
  resetVault,
  SOURCES_FILE,
  TOPICS_FILE,
  writeVaultFile,
} from './support/vault';

test.beforeEach(() => resetVault());

test.describe('load errors', () => {
  test('a missing source registry fails the sources tab only', async ({
    page,
  }) => {
    removeFile(SOURCES_FILE);
    await page.goto('/?tab=sources');
    await expect(page.getByText('Failed to load sources.')).toBeVisible();

    await gotoTab(page, 'topics');
    await expect(page.getByText('Failed to load topics.')).toHaveCount(0);
  });

  test('a missing topic registry fails the topics tab', async ({ page }) => {
    removeFile(TOPICS_FILE);
    await page.goto('/?tab=topics');
    await expect(page.getByText('Failed to load topics.')).toBeVisible();
  });

  test('a malformed reading queue fails the queue tab', async ({ page }) => {
    writeVaultFile(QUEUE_FILE, '{"generated": "2026-09-30", "queue": [');
    await page.goto('/?tab=queue');
    await expect(
      page.getByText('Failed to load the reading queue.'),
    ).toBeVisible();
  });
});
