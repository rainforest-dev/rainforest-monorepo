import { expect, type Page, test } from '@playwright/test';

import {
  deskTab,
  gotoTab,
  sourceRows,
  SOURCES_PAGE_SIZE,
  type Tab,
  tabSkeleton,
  validatePopover,
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
    await expect(tabSkeleton(page).locator(':scope > div')).toHaveCount(12);

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

const BROKEN: Record<
  Exclude<Tab, 'sources'>,
  {
    breakFile: () => void;
    api: string;
    what: string;
    rows: number;
    ready: (page: Page) => Promise<void>;
  }
> = {
  topics: {
    breakFile: () => removeFile(TOPICS_FILE),
    api: '**/api/topics',
    what: 'topic registry',
    rows: 8,
    ready: (page) =>
      expect(
        page.getByRole('main').getByText('Home lab networking'),
      ).toBeVisible(),
  },
  queue: {
    breakFile: () => writeVaultFile(QUEUE_FILE, '{"queue": ['),
    api: '**/api/reading-queue',
    what: 'reading queue',
    rows: 10,
    ready: (page) =>
      expect(
        page.getByRole('main').getByText(QUEUE.titles[0][1]),
      ).toBeVisible(),
  },
};

test.describe('loading', () => {
  for (const [tab, broken] of Object.entries(BROKEN)) {
    test(`Retry on ${tab} shows a ${broken.rows}-row Skeleton until the file loads`, async ({
      page,
    }) => {
      broken.breakFile();
      await page.goto(`/?tab=${tab}`);
      await waitForHydration(page);
      const alert = loadError(page, broken.what);
      await expect(alert).toBeVisible();

      resetVault();
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(broken.api, async (route) => {
        await held;
        await route.continue();
      });
      await alert.getByRole('button', { name: 'Retry' }).click();
      const skeleton = tabSkeleton(page);
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute('role', 'status');
      await expect(skeleton.locator(':scope > div')).toHaveCount(broken.rows);

      release();
      await expect(skeleton).toHaveCount(0);
      await expect(alert).toHaveCount(0);
      await broken.ready(page);
    });
  }
});

test.describe('empty registries', () => {
  test('an empty source registry offers to validate a feed', async ({
    page,
  }) => {
    writeVaultFile(
      SOURCES_FILE,
      '# RSS Source Registry\n\n## Active Sources\n\n## Proposed Sources\n',
    );
    await gotoTab(page, 'sources');
    await expect(page.getByRole('tab', { name: 'Sources 0' })).toBeVisible();
    await expect(page.getByText('No sources yet')).toBeVisible();
    await expect(
      page.getByText('Sources show up here once rss-discover proposes them.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Validate a feed URL' }).click();
    await expect(validatePopover(page)).toBeVisible();
  });

  test('an empty topic registry says no topics yet', async ({ page }) => {
    writeVaultFile(TOPICS_FILE, '# RSS Topic Registry\n\n## Active\n');
    await gotoTab(page, 'topics');
    await expect(page.getByText('No topics yet')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Topics/ })).toHaveText(
      'Topics',
    );
  });
});
