import { expect, type Page, test } from '@playwright/test';

import {
  deskTab,
  gotoTab,
  sourceRows,
  SOURCES_PAGE_SIZE,
  tabSkeleton,
  waitForHydration,
} from './support/desk';
import { QUEUE, SOURCES, TOPICS } from './support/fixture-vault';
import {
  QUEUE_FILE,
  removeFile,
  resetVault,
  SOURCES_FILE,
  TOPICS_FILE,
  writeVaultFile,
} from './support/vault';

test.beforeEach(() => resetVault());

const loadError = (page: Page, what: string) =>
  page.getByRole('alert').filter({ hasText: `Couldn't read the ${what}` });

test.describe('load errors', () => {
  test('a missing source registry fails the sources tab only', async ({
    page,
  }) => {
    removeFile(SOURCES_FILE);
    await page.goto('/');
    await waitForHydration(page);
    const alert = loadError(page, 'source registry');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      'Nothing was changed. Retry after the vault finishes syncing.',
    );
    await expect(alert.locator('code')).toContainText('ENOENT');
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeEnabled();
    await expect(page.getByRole('tab', { name: 'Sources' })).toBeVisible();

    await deskTab(page, 'topics').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
      page.getByRole('main').getByText('Home lab networking'),
    ).toBeVisible();

    await deskTab(page, 'queue').click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
      page.getByRole('main').getByText(QUEUE.titles[0][1]),
    ).toBeVisible();
  });

  test('a missing topic registry fails the topics tab', async ({ page }) => {
    removeFile(TOPICS_FILE);
    await page.goto('/?tab=topics');
    await waitForHydration(page);
    await expect(loadError(page, 'topic registry')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Topics/ })).toHaveText(
      'Topics',
    );
  });

  test('a malformed reading queue fails the queue tab', async ({ page }) => {
    writeVaultFile(QUEUE_FILE, '{"generated": "2026-09-30", "queue": [');
    await page.goto('/?tab=queue');
    await waitForHydration(page);
    await expect(loadError(page, 'reading queue')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Queue' })).toBeVisible();
  });

  test('Retry recovers once the file is back', async ({ page }) => {
    removeFile(SOURCES_FILE);
    await page.goto('/');
    await waitForHydration(page);
    const alert = loadError(page, 'source registry');
    await expect(alert).toBeVisible();

    resetVault();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/sources', async (route) => {
      await held;
      await route.continue();
    });

    const retry = alert.getByRole('button', { name: 'Retry' });
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(tabSkeleton(page)).toBeVisible();

    release();
    await expect(alert).toHaveCount(0);
    await expect(tabSkeleton(page)).toHaveCount(0);
    await expect(sourceRows(page)).toHaveCount(SOURCES_PAGE_SIZE);
    await expect(
      page.getByRole('tab', { name: `Sources ${SOURCES.length}` }),
    ).toBeVisible();
  });

  test('Retry keeps the Alert while the file is still missing', async ({
    page,
  }) => {
    removeFile(TOPICS_FILE);
    await page.goto('/?tab=topics');
    await waitForHydration(page);
    const alert = loadError(page, 'topic registry');
    const response = page.waitForResponse('**/api/topics');
    await alert.getByRole('button', { name: 'Retry' }).click();
    expect((await response).status()).toBe(500);
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeEnabled();

    resetVault();
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(alert).toHaveCount(0);
    await expect(
      page.getByRole('tab', {
        name: `Topics ${TOPICS.filter((t) => t.status === 'proposed').length} proposed`,
      }),
    ).toBeVisible();
  });

  test('Retry on the queue recovers the reading queue', async ({ page }) => {
    writeVaultFile(QUEUE_FILE, '{"generated": "2026-09-30", "queue": [');
    await gotoTab(page, 'sources');
    await deskTab(page, 'queue').click();
    const alert = loadError(page, 'reading queue');
    await expect(alert).toBeVisible();

    resetVault();
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(alert).toHaveCount(0);
    await expect(
      page.getByRole('tab', { name: `Queue ${QUEUE.titles.length}` }),
    ).toBeVisible();
  });
});
