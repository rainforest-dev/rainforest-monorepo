import { expect, test } from '@playwright/test';

import {
  deskTab,
  gotoTab,
  sourceRows,
  SOURCES_PAGE_SIZE,
  validatePopover,
  validateTrigger,
  waitForHydration,
} from './support/desk';
import { QUEUE, SOURCES, TOPICS } from './support/fixture-vault';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const proposedTopics = TOPICS.filter((t) => t.status === 'proposed').length;

test.describe('shell', () => {
  test('the header names the app, the registry file and every tab with its count', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');
    const banner = page.getByRole('banner');
    await expect(
      banner.getByRole('heading', { level: 1, name: 'RSS Manager' }),
    ).toBeVisible();
    await expect(banner.getByText('RSS-Source-Registry.md')).toBeVisible();

    await expect(
      page.getByRole('tab', { name: `Sources ${SOURCES.length}` }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('tab', { name: `Topics ${proposedTopics} proposed` }),
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: `Queue ${QUEUE.titles.length}` }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: /Validate/ })).toHaveCount(0);

    const main = page.getByRole('main');
    await expect(
      main.getByRole('heading', { level: 2, name: 'Sources' }),
    ).toBeVisible();
    await expect(sourceRows(page)).toHaveCount(SOURCES_PAGE_SIZE);
  });

  test('the header names the file behind the active tab', async ({ page }) => {
    const banner = page.getByRole('banner');
    const files = banner.getByText(/^(RSS-.*\.md|reading-queue\.json)$/);

    await page.goto('/?tab=topics');
    await expect(files).toHaveText('RSS-Topic-Registry.md');
    await waitForHydration(page);

    await deskTab(page, 'queue').click();
    await expect(files).toHaveText('reading-queue.json');

    await page.keyboard.press('1');
    await expect(files).toHaveText('RSS-Source-Registry.md');

    await page.goBack();
    await expect(page).toHaveURL(/\?tab=queue$/);
    await expect(files).toHaveText('reading-queue.json');
  });

  test('the first paint already has rows, before any API call', async ({
    page,
  }) => {
    const apiCalls: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url());
    });
    await page.goto('/?tab=topics');
    await expect(
      page
        .getByRole('grid', { name: 'Topics' })
        .getByText('Home lab networking'),
    ).toBeVisible();
    await page.goto('/?tab=queue');
    await expect(
      page
        .getByRole('grid', { name: 'Reading queue' })
        .getByText(QUEUE.titles[0][1]),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(apiCalls).toEqual([]);
  });

  test('clicking a tab writes ?tab= and clicking Sources removes it', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');

    await deskTab(page, 'topics').click();
    await expect(page).toHaveURL(/\/\?tab=topics$/);
    await expect(deskTab(page, 'topics')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Topics' }),
    ).toBeVisible();

    await deskTab(page, 'queue').click();
    await expect(page).toHaveURL(/\/\?tab=queue$/);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Reading queue' }),
    ).toBeVisible();

    await deskTab(page, 'sources').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(sourceRows(page)).toHaveCount(SOURCES_PAGE_SIZE);
  });

  for (const tab of ['topics', 'queue'] as const) {
    test(`?tab=${tab} opens that tab from the server`, async ({ page }) => {
      await page.goto(`/?tab=${tab}`);
      await expect(deskTab(page, tab)).toHaveAttribute('aria-selected', 'true');
    });
  }

  test('an unknown tab falls back to sources', async ({ page }) => {
    await page.goto('/?tab=nope');
    await expect(deskTab(page, 'sources')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test("a tab change carries no other tab's params into the URL", async ({
    page,
  }) => {
    await page.goto('/?page=2');
    await waitForHydration(page);

    await deskTab(page, 'topics').click();
    await expect(page).toHaveURL(/\/\?tab=topics$/);
    await page.getByRole('button', { name: /^Proposed \d+$/ }).click();
    await expect(page).toHaveURL(/\/\?tab=topics&tstatus=proposed$/);

    await deskTab(page, 'queue').click();
    await expect(page).toHaveURL(/\/\?tab=queue$/);
    await page.getByRole('button', { name: /^T2:/ }).click();
    await expect(page).toHaveURL(/\/\?tab=queue&tier=2$/);

    await page.keyboard.press('1');
    await expect(page).toHaveURL(/\/\?page=2$/);
    await page.keyboard.press('2');
    await expect(page).toHaveURL(/\/\?tab=topics&tstatus=proposed$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/\?page=2$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/\?tab=queue&tier=2$/);
    await expect(page.getByRole('button', { name: /^T2:/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.goto('/?tab=topics&page=2&tier=3&q=css');
    await waitForHydration(page);
    await deskTab(page, 'queue').click();
    await expect(page).toHaveURL(/\/\?tab=queue&tier=3$/);
  });

  test('reload keeps the tab, and Back and Forward walk the tab history', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');
    await deskTab(page, 'topics').click();
    await deskTab(page, 'queue').click();
    await expect(page).toHaveURL(/\?tab=queue$/);

    await page.reload();
    await waitForHydration(page);
    await expect(deskTab(page, 'queue')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.goBack();
    await expect(page).toHaveURL(/\?tab=topics$/);
    await expect(deskTab(page, 'topics')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Topics' }),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(deskTab(page, 'sources')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.goForward();
    await expect(deskTab(page, 'topics')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('?tab=validate opens Sources with the Validate popover open', async ({
    page,
  }) => {
    await page.goto('/?tab=validate');
    await waitForHydration(page);
    const popover = validatePopover(page);
    await expect(popover).toBeVisible();
    await expect(
      popover.getByRole('textbox', { name: 'Feed URL' }),
    ).toBeFocused();
    await expect(deskTab(page, 'sources')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page).toHaveURL(/\/$/);

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(validateTrigger(page)).toBeFocused();

    await page.reload();
    await expect(deskTab(page, 'sources')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(validatePopover(page)).toHaveCount(0);
  });
});
