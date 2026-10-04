import { expect, type Page, test } from '@playwright/test';

import {
  bulkButton,
  bulkToolbar,
  chips,
  deskTab,
  pager,
  sectionOf,
  selectedCount,
  SOURCES_PAGE_SIZE,
  tabSkeleton,
  toasts,
  topicStatusButton,
  validatePopover,
  validateTrigger,
} from './support/desk';
import { QUEUE, SOURCES } from './support/fixture-vault';
import {
  detailSheet,
  expectNoSideScroll,
  filtersButton,
  filterSheet,
  gotoPhone,
  hideDevToolbar,
  openFilterSheet,
  PHONE_HEIGHT,
  queueItems,
  sheetFacet,
  sourceItem,
  sourceItemButton,
  sourceItems,
  topicItem,
  topicItems,
} from './support/phone';
import {
  readVault,
  removeFile,
  resetVault,
  SOURCES_FILE,
  TOPICS_FILE,
} from './support/vault';

test.beforeEach(async ({ page }) => {
  resetVault();
  await hideDevToolbar(page);
});

async function expectFloatingBar(page: Page): Promise<void> {
  const box = await bulkToolbar(page).boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.x).toBe(8);
  expect(box.x + box.width).toBe(390 - 8);
  expect(box.y + box.height).toBe(PHONE_HEIGHT - 8);
}

test.describe('Sources on phone', () => {
  test('rows are list items with name, host and badges, and no table or key hints', async ({
    page,
  }) => {
    await gotoPhone(page);
    await expect(sourceItems(page)).toHaveCount(SOURCES_PAGE_SIZE);
    await expect(page.getByRole('grid')).toHaveCount(0);
    await expect(page.locator('[data-slot="key-hints"]')).toBeHidden();
    await expect(
      page.getByRole('complementary', { name: 'Filters' }),
    ).toBeHidden();

    const ferry = sourceItem(page, 'Ferry Ops');
    await expect(ferry).toContainText('127.0.0.1:3033');
    await expect(ferry).toContainText('Active');
    await expect(ferry).toContainText('Delivery gap');
    await expect(sourceItemButton(page, 'Ferry Ops')).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );

    await pager(page).getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(sourceItems(page)).toHaveCount(SOURCES_PAGE_SIZE);
  });

  test('before hydration the server HTML already shows list rows and no pane', async ({
    page,
  }) => {
    await page.route('**/src/components/RegistryDesk.tsx*', (route) =>
      route.abort(),
    );
    await page.goto('/?source=Ferry+Ops');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(1);
    await expect(sourceItems(page)).toHaveCount(SOURCES_PAGE_SIZE);
    await expect(page.getByRole('grid')).toHaveCount(0);
    await expect(
      page.getByRole('complementary', { name: 'Source details' }),
    ).toHaveCount(0);
    await expectNoSideScroll(page);
  });

  test('the toolbar reads search, Filters, count and Select', async ({
    page,
  }) => {
    await gotoPhone(page);
    const search = page.getByRole('searchbox', { name: 'Search sources' });
    const filters = filtersButton(page);
    const count = page.getByText(`${SOURCES.length} sources`, {
      exact: true,
    });
    const select = page.getByRole('button', { name: 'Select', exact: true });
    const [searchBox, filtersBox, countBox, selectBox] = await Promise.all(
      [search, filters, count, select].map((l) => l.boundingBox()),
    );
    expect(searchBox && filtersBox && countBox && selectBox).toBeTruthy();
    if (!searchBox || !filtersBox || !countBox || !selectBox) return;
    expect(searchBox.width).toBeGreaterThan(300);
    expect(filtersBox.y).toBeGreaterThan(searchBox.y + searchBox.height - 1);
    expect(countBox.x).toBeGreaterThan(filtersBox.x + filtersBox.width);
    expect(selectBox.x).toBeGreaterThan(countBox.x + countBox.width);
  });

  test('the filter Sheet applies facets to the URL and closes on Show N sources', async ({
    page,
  }) => {
    await gotoPhone(page);
    await expect(filtersButton(page)).toHaveAccessibleName('Filters');
    const sheet = await openFilterSheet(page);
    await expect(sheet.getByRole('group', { name: 'Status' })).toBeVisible();
    await expect(sheet.getByRole('group', { name: 'Tags' })).toBeAttached();

    await sheetFacet(page, 'Status', 'Proposed').click();
    await expect(page).toHaveURL(/\?status=proposed$/);
    const proposed = SOURCES.filter((s) => s.status === 'proposed').length;
    const show = sheet.getByRole('button', { name: /^Show \d+ sources?$/ });
    await expect(show).toHaveText(`Show ${proposed} sources`);

    await sheetFacet(page, 'Stale', 'Delivery gap').click();
    await expect(page).toHaveURL(/\?status=proposed&stale=delivery-gap$/);
    await sheetFacet(page, 'Status', 'Active').click();
    await expect(page).toHaveURL(
      /\?status=(active%2Cproposed|proposed%2Cactive)&stale=delivery-gap$/,
    );
    const shown = await show.textContent();
    const n = Number(shown?.match(/\d+/)?.[0]);
    await show.click();
    await expect(filterSheet(page)).toHaveCount(0);
    await expect(sourceItems(page)).toHaveCount(n);
    await expect(filtersButton(page)).toHaveAccessibleName('Filters 3 applied');
    await expect(chips(page).getByRole('listitem')).toHaveCount(4);
    await expect(filtersButton(page)).toBeFocused();

    await openFilterSheet(page);
    await filterSheet(page).getByRole('button', { name: 'Clear all' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press('Escape');
    await expect(filterSheet(page)).toHaveCount(0);
    await expect(sourceItems(page)).toHaveCount(SOURCES_PAGE_SIZE);
    await expect(filtersButton(page)).toHaveAccessibleName('Filters');
  });

  test('chips scroll sideways instead of wrapping', async ({ page }) => {
    await gotoPhone(
      page,
      '?status=active,proposed,no-rss&stale=feed-dead,low-value,delivery-gap',
    );
    const list = chips(page);
    await expect(list.getByRole('listitem')).toHaveCount(7);
    const box = await list.boundingBox();
    expect(box?.height).toBeLessThan(40);
    expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );
    await expectNoSideScroll(page);
  });

  test('tapping a row opens the detail Sheet; its close button returns focus to the row', async ({
    page,
  }) => {
    await gotoPhone(page);
    await sourceItemButton(page, 'Birch Compiler').click();
    const sheet = detailSheet(page);
    await expect(
      sheet.getByRole('heading', { level: 2, name: 'Birch Compiler' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\?source=Birch\+Compiler$/);
    await expect(
      page.getByRole('complementary', { name: 'Source details' }),
    ).toHaveCount(0);
    const height = (await sheet.boundingBox())?.height ?? 0;
    expect(Math.abs(height - PHONE_HEIGHT * 0.88)).toBeLessThan(2);

    await sheet.getByRole('button', { name: 'Close details' }).click();
    await expect(detailSheet(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(sourceItemButton(page, 'Birch Compiler')).toBeFocused();
  });

  test('?source= opens the detail Sheet from a deep link, and Esc closes it', async ({
    page,
  }) => {
    await page.goto('/?source=Ferry+Ops');
    const sheet = detailSheet(page);
    await expect(
      sheet.getByRole('heading', { level: 2, name: 'Ferry Ops' }),
    ).toBeVisible();
    await expect(sheet.getByRole('alert')).toContainText('Delivery gap');
    await expect(
      sheet.getByRole('link', { name: 'Re-subscribe' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detailSheet(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(sourceItemButton(page, 'Ferry Ops')).toBeFocused();
  });

  test('Back closes the detail Sheet and Forward reopens it', async ({
    page,
  }) => {
    await gotoPhone(page);
    await sourceItemButton(page, 'Folio & Frame').click();
    await expect(
      detailSheet(page).getByRole('heading', { name: 'Folio & Frame' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\?source=Folio\+%26\+Frame$/);

    await page.goBack();
    await expect(detailSheet(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(sourceItemButton(page, 'Folio & Frame')).toBeFocused();

    await page.goForward();
    await expect(
      detailSheet(page).getByRole('heading', { name: 'Folio & Frame' }),
    ).toBeVisible();
  });

  test('Activate in the detail Sheet writes the vault', async ({ page }) => {
    await gotoPhone(page, '?source=Owl+Street+Essays');
    const sheet = detailSheet(page);
    await sheet.getByRole('button', { name: 'Activate' }).click();
    await expect(sheet.getByRole('button', { name: 'Retire' })).toBeVisible();
    expect(readVault(SOURCES_FILE)).toContain('- [x] **Owl Street Essays**');
  });

  test('select mode toggles rows on tap and floats the bulk bar for one batch write', async ({
    page,
  }) => {
    const patches: unknown[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        request.url().endsWith('/api/sources')
      )
        patches.push(request.postDataJSON());
    });
    await gotoPhone(page);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(
      sourceItems(page).getByRole('checkbox', { name: /^Select / }),
    ).toHaveCount(SOURCES_PAGE_SIZE);
    await expect(
      sourceItems(page).getByRole('button', { name: 'Birch Compiler' }),
    ).toHaveCount(0);

    const chosen = ['Birch Compiler', 'Cinder Blog', 'Fable Stack'];
    for (const name of chosen) await sourceItem(page, name).click();
    await expect(
      page.getByRole('checkbox', { name: 'Select Cinder Blog' }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(detailSheet(page)).toHaveCount(0);
    await expect(selectedCount(page)).toHaveText('3 selected');
    await expectFloatingBar(page);
    await expect(
      page.getByRole('searchbox', { name: 'Search sources' }),
    ).toBeVisible();
    await expectNoSideScroll(page);

    await sourceItem(page, 'Fable Stack').click();
    await expect(selectedCount(page)).toHaveText('2 selected');
    await sourceItem(page, 'Fable Stack').click();

    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 3');
    await bulkButton(page, 'Activate').click();
    await expect(toasts(page)).toContainText('Activated 3 sources');
    await expect(bulkToolbar(page)).toHaveCount(0);
    expect(patches).toEqual([
      { names: expect.arrayContaining(chosen), action: 'activate' },
    ]);
    expect((patches[0] as { names: string[] }).names).toHaveLength(3);
    const markdown = readVault(SOURCES_FILE);
    for (const name of chosen)
      expect(sectionOf(markdown, name)).toBe('Active Sources');

    await sourceItem(page, 'Atlas of Small Tools').click();
    await bulkToolbar(page).getByRole('button', { name: 'Done' }).click();
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(
      sourceItems(page).getByRole('checkbox', { name: /^Select / }),
    ).toHaveCount(0);
  });
});

test.describe('header on phone', () => {
  test('brand and the Validate icon button share the top row, tabs sit under it', async ({
    page,
  }) => {
    await gotoPhone(page);
    const banner = page.getByRole('banner');
    const brand = banner.getByRole('heading', { level: 1 });
    const trigger = validateTrigger(page);
    await expect(trigger.getByText('Validate URL')).toBeHidden();
    const [brandBox, triggerBox, tabBox] = await Promise.all([
      brand.boundingBox(),
      trigger.boundingBox(),
      deskTab(page, 'queue').boundingBox(),
    ]);
    expect(brandBox && triggerBox && tabBox).toBeTruthy();
    if (!brandBox || !triggerBox || !tabBox) return;
    expect(brandBox.height).toBe(52);
    expect(triggerBox.width).toBeLessThan(40);
    expect(Math.abs(triggerBox.y - brandBox.y)).toBeLessThan(brandBox.height);
    expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(390 - 16);
    expect(tabBox.y).toBeGreaterThanOrEqual(brandBox.y + brandBox.height);
    await expect(banner.getByText('RSS-Source-Registry.md')).toBeHidden();

    await trigger.click();
    await expect(validatePopover(page)).toBeVisible();
    await expectNoSideScroll(page);
  });
});

test.describe('Topics on phone', () => {
  test('rows are list items; the status filter and bulk Decline work at 390', async ({
    page,
  }) => {
    await gotoPhone(page, '?tab=topics');
    await expect(topicItems(page)).toHaveCount(12);
    await expect(page.getByRole('grid')).toHaveCount(0);
    await expect(topicItem(page, 'Accessibility audits')).toContainText(
      'Proposed',
    );

    await topicStatusButton(page, 'Proposed').click();
    await expect(page).toHaveURL(/\?tab=topics&tstatus=proposed$/);
    await expect(topicItems(page)).toHaveCount(4);

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const chosen = ['Accessibility audits', 'Data visualisation'];
    for (const name of chosen) await topicItem(page, name).click();
    await expect(selectedCount(page)).toHaveText('2 selected');
    await expectFloatingBar(page);
    await expect(
      page.getByRole('group', { name: 'Topic status' }),
    ).toBeVisible();
    await expectNoSideScroll(page);

    await bulkButton(page, 'Decline').click();
    await expect(toasts(page)).toContainText('Declined 2 topics');
    const markdown = readVault(TOPICS_FILE);
    for (const name of chosen)
      expect(sectionOf(markdown, name)).toBe('Declined');
  });

  test('a row button activates one topic', async ({ page }) => {
    await gotoPhone(page, '?tab=topics');
    await topicItem(page, 'Local-first apps')
      .getByRole('button', { name: 'Activate' })
      .click();
    await expect(topicItem(page, 'Local-first apps')).toContainText('Active');
    expect(sectionOf(readVault(TOPICS_FILE), 'Local-first apps')).toBe(
      'Active',
    );
  });
});

test.describe('Queue on phone', () => {
  const minutesOrder = QUEUE.titles
    .map(([, title, minutes], i) => ({ title, minutes, rank: i + 1 }))
    .sort((a, b) => a.minutes - b.minutes || a.rank - b.rank)
    .map((row) => row.title);

  test('rows are list items; the Sort Select and direction button write the URL', async ({
    page,
  }) => {
    await gotoPhone(page, '?tab=queue');
    await expect(queueItems(page)).toHaveCount(QUEUE.titles.length);
    await expect(page.getByRole('grid')).toHaveCount(0);
    const first = queueItems(page).first();
    await expect(first.getByRole('link')).toHaveText(QUEUE.titles[0][1]);
    await expect(first).toContainText('Rank 1');
    await expect(first).toContainText(`T${QUEUE.titles[0][0]}`);
    await expect(first).toContainText(`${QUEUE.titles[0][2]} min`);

    await page.getByRole('combobox', { name: 'Sort by' }).click();
    await page.getByRole('option', { name: 'Minutes' }).click();
    await expect(page).toHaveURL(/\?tab=queue&sort=minutes$/);
    await expect(queueItems(page).getByRole('link')).toHaveText(minutesOrder);

    await page.getByRole('button', { name: 'Ascending' }).click();
    await expect(page).toHaveURL(/\?tab=queue&sort=minutes&dir=desc$/);
    await expect(
      page.getByRole('button', { name: 'Descending' }),
    ).toBeVisible();
    await expect(queueItems(page).first().getByRole('link')).toHaveText(
      minutesOrder[minutesOrder.length - 1],
    );

    await page
      .getByRole('group', { name: 'Tier' })
      .getByRole('button', {
        name: /^T1:/,
      })
      .click();
    await expect(page).toHaveURL(/\?tab=queue&tier=1&sort=minutes&dir=desc$/);
    const tierOne = QUEUE.titles.filter(([tier]) => tier === 1).length;
    await expect(queueItems(page)).toHaveCount(tierOne);
  });
});

test.describe('no horizontal page scroll at 390', () => {
  const STATES: Array<{
    name: string;
    url: string;
    act?: (page: Page) => Promise<void>;
    setup?: () => void;
  }> = [
    { name: 'Sources', url: '' },
    {
      name: 'a source registry that failed to load, retrying',
      url: '',
      setup: () => removeFile(SOURCES_FILE),
      act: async (page) => {
        await page.route('**/api/sources', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          await route.continue();
        });
        await page.getByRole('button', { name: 'Retry' }).click();
        await expect(tabSkeleton(page)).toBeVisible();
        await expect(
          tabSkeleton(page).locator(':scope > div:visible'),
        ).toHaveCount(7);
      },
    },
    { name: 'Sources page 3', url: '?page=3' },
    { name: 'Sources with no match', url: '?q=zzzz' },
    {
      name: 'Sources with a long search chip',
      url: `?q=${'averylongsearchterm'.repeat(4)}`,
    },
    {
      name: 'the filter Sheet',
      url: '?status=proposed',
      act: async (page) => {
        await openFilterSheet(page);
      },
    },
    {
      name: 'the detail Sheet',
      url: '?source=Ferry+Ops',
      act: async (page) => {
        await expect(detailSheet(page)).toBeVisible();
      },
    },
    {
      name: 'the detail Sheet of a no-RSS source',
      url: '?source=Studio+Halcyon',
      act: async (page) => {
        await expect(
          detailSheet(page).getByRole('textbox', { name: 'Feed URL' }),
        ).toBeVisible();
      },
    },
    {
      name: 'Sources select mode',
      url: '',
      act: async (page) => {
        await page.getByRole('button', { name: 'Select', exact: true }).click();
        await sourceItem(page, 'Birch Compiler').click();
        await expect(bulkToolbar(page)).toBeVisible();
      },
    },
    {
      name: 'the Validate popover',
      url: '?tab=validate',
      act: async (page) => {
        await expect(validatePopover(page)).toBeVisible();
      },
    },
    { name: 'Topics', url: '?tab=topics' },
    {
      name: 'Topics select mode',
      url: '?tab=topics',
      act: async (page) => {
        await page.getByRole('button', { name: 'Select', exact: true }).click();
        await topicItem(page, 'Crypto markets').click();
        await expect(bulkToolbar(page)).toBeVisible();
      },
    },
    { name: 'Queue', url: '?tab=queue' },
    {
      name: 'Queue with the Sort Select open',
      url: '?tab=queue',
      act: async (page) => {
        await page.getByRole('combobox', { name: 'Sort by' }).click();
        await expect(page.getByRole('listbox')).toBeVisible();
      },
    },
  ];

  for (const { name, url, act, setup } of STATES) {
    test(name, async ({ page }) => {
      setup?.();
      await gotoPhone(page, url);
      await act?.(page);
      await expectNoSideScroll(page);
    });
  }
});
