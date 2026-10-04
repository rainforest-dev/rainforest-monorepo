import { expect, type Page, test } from '@playwright/test';

import {
  deskTab,
  gotoTab,
  queueGrid,
  queueHeader,
  queueRows,
  queueTitles,
  tierButton,
  tierFilter,
  waitForHydration,
} from './support/desk';
import { FEED_ORIGIN } from './support/feed-server';
import { QUEUE, readingQueueJson } from './support/fixture-vault';
import {
  QUEUE_FILE,
  removeFile,
  resetVault,
  writeVaultFile,
} from './support/vault';

test.beforeEach(() => resetVault());

interface Row {
  rank: number;
  tier: number;
  title: string;
  minutes: number;
  days: number;
  progress: number;
  wiki: number;
  decay: number;
}

const ROWS: Row[] = QUEUE.titles.map(
  ([tier, title, minutes, days, progress, wiki], i) => ({
    rank: i + 1,
    tier,
    title,
    minutes,
    days,
    progress,
    wiki,
    decay: i % 3 === 0 ? 0 : 1,
  }),
);

const COLUMNS: Array<{
  header: string;
  key: string;
  compare: (a: Row, b: Row) => number;
}> = [
  { header: 'Tier', key: 'tier', compare: (a, b) => a.tier - b.tier },
  {
    header: 'Item',
    key: 'title',
    compare: (a, b) => a.title.localeCompare(b.title),
  },
  { header: 'Decay', key: 'decay', compare: (a, b) => a.decay - b.decay },
  { header: 'Min', key: 'minutes', compare: (a, b) => a.minutes - b.minutes },
  { header: 'Saved', key: 'saved', compare: (a, b) => a.days - b.days },
  { header: 'Wiki', key: 'wiki', compare: (a, b) => a.wiki - b.wiki },
  {
    header: 'Read',
    key: 'read',
    compare: (a, b) => a.progress - b.progress,
  },
];

const SORTABLE = ['Rank', ...COLUMNS.map((c) => c.header)];

function expected(
  compare: (a: Row, b: Row) => number,
  dir: 'asc' | 'desc',
  rows: Row[] = ROWS,
): string[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows]
    .sort((a, b) => sign * compare(a, b) || a.rank - b.rank)
    .map((r) => r.title);
}

async function expectSorted(
  page: Page,
  header: string,
  dir: 'ascending' | 'descending',
): Promise<void> {
  for (const name of SORTABLE)
    await expect(queueHeader(page, name)).toHaveAttribute(
      'aria-sort',
      name === header ? dir : 'none',
    );
}

async function sortBy(page: Page, header: string): Promise<void> {
  await queueHeader(page, header).getByRole('button').click();
}

const cell = (page: Page, row: number, column: number) =>
  queueRows(page).nth(row).locator('td').nth(column);

test.describe('queue: table', () => {
  test('lists every item in rank order with the summary and Read text', async ({
    page,
  }) => {
    await gotoTab(page, 'queue');
    await expect(queueRows(page)).toHaveCount(ROWS.length);
    await expect(queueTitles(page)).toHaveText(ROWS.map((r) => r.title));
    await expectSorted(page, 'Rank', 'ascending');
    await expect(
      page.getByText(
        `${ROWS.length} queued · 3 in backlog · ${QUEUE.staleCount} stale · ${ROWS.length + QUEUE.staleCount + 3} scanned · generated 2026-09-30`,
      ),
    ).toBeVisible();

    await expect(cell(page, 0, 8)).toHaveText('40% read');
    await expect(cell(page, 1, 8)).toHaveText('15% read');
    await expect(cell(page, 2, 8)).toHaveText('');

    const first = queueRows(page).first();
    await expect(first.getByRole('link')).toHaveAttribute(
      'href',
      `${FEED_ORIGIN}/read/e2e-1`,
    );
    await expect(first).toContainText('example.test');
    await expect(first).toContainText('domain/frontend');
    await expect(cell(page, 0, 3).locator('p')).toHaveAttribute(
      'title',
      'fixture reason 1',
    );
    await expect(cell(page, 0, 1)).toHaveText('T1');
    await expect(cell(page, 0, 4)).toHaveText('time-sensitive');
    await expect(cell(page, 1, 4)).toHaveText('evergreen');
    await expect(cell(page, 0, 5)).toHaveText('18');
    await expect(cell(page, 0, 6)).toHaveText('4d ago');
    await expect(cell(page, 0, 7)).toHaveText('6');
  });

  test('Rank flips to descending and back', async ({ page }) => {
    await gotoTab(page, 'queue');
    await sortBy(page, 'Rank');
    await expectSorted(page, 'Rank', 'descending');
    await expect(page).toHaveURL(/\?tab=queue&dir=desc$/);
    await expect(queueTitles(page)).toHaveText(
      ROWS.map((r) => r.title).reverse(),
    );
    await sortBy(page, 'Rank');
    await expectSorted(page, 'Rank', 'ascending');
    await expect(page).toHaveURL(/\?tab=queue$/);
  });

  for (const { header, key, compare } of COLUMNS) {
    test(`${header} sorts ascending, then descending`, async ({ page }) => {
      await gotoTab(page, 'queue');
      await sortBy(page, header);
      await expectSorted(page, header, 'ascending');
      await expect(page).toHaveURL(new RegExp(`\\?tab=queue&sort=${key}$`));
      await expect(queueTitles(page)).toHaveText(expected(compare, 'asc'));

      await sortBy(page, header);
      await expectSorted(page, header, 'descending');
      await expect(page).toHaveURL(
        new RegExp(`\\?tab=queue&sort=${key}&dir=desc$`),
      );
      await expect(queueTitles(page)).toHaveText(expected(compare, 'desc'));
    });
  }

  test('another column starts ascending, and ties keep rank order both ways', async ({
    page,
  }) => {
    await gotoTab(page, 'queue');
    await sortBy(page, 'Wiki');
    await expect(queueTitles(page).nth(0)).toHaveText(
      'Plain-Text Build Graphs',
    );
    await expect(queueTitles(page).nth(1)).toHaveText(
      'Notes from a Router Rebuild',
    );
    await expect(queueTitles(page).nth(2)).toHaveText(
      'Small Typesetting Mistakes',
    );

    await sortBy(page, 'Wiki');
    const titles = await queueTitles(page).allTextContents();
    expect(titles.slice(-3)).toEqual([
      'Notes from a Router Rebuild',
      'Small Typesetting Mistakes',
      'Plain-Text Build Graphs',
    ]);

    await sortBy(page, 'Min');
    await expectSorted(page, 'Min', 'ascending');
    await expect(page).toHaveURL(/\?tab=queue&sort=minutes$/);
  });

  test('a sorted URL renders sorted from the server', async ({ page }) => {
    await page.goto('/?tab=queue&sort=saved&dir=desc');
    await expect(queueTitles(page)).toHaveText(
      expected((a, b) => a.days - b.days, 'desc'),
    );
    await expectSorted(page, 'Saved', 'descending');
  });
});

test.describe('queue: tier filter', () => {
  test('filters by tier, keeps the sort and survives reload', async ({
    page,
  }) => {
    await gotoTab(page, 'queue');
    const buttons = tierFilter(page).getByRole('button');
    await expect(buttons).toHaveText(['All', 'T1', 'T2', 'T3', 'T4']);
    for (const [i, name] of [
      'All',
      'T1: Finish what you started',
      'T2: Blind spot in your stack',
      'T3: Wiki leverage',
      'T4: Covered interest',
    ].entries())
      await expect(buttons.nth(i)).toHaveAccessibleName(name);
    await expect(tierButton(page, 'All')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await tierButton(page, 'T2').hover();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(
      'Blind spot in your stack',
    );

    await tierButton(page, 'T2').click();
    await expect(page).toHaveURL(/\?tab=queue&tier=2$/);
    await expect(tierButton(page, 'T2')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const tier2 = ROWS.filter((r) => r.tier === 2);
    await expect(queueTitles(page)).toHaveText(tier2.map((r) => r.title));

    await sortBy(page, 'Min');
    await sortBy(page, 'Min');
    await expect(page).toHaveURL(/\?tab=queue&tier=2&sort=minutes&dir=desc$/);
    const sorted = expected((a, b) => a.minutes - b.minutes, 'desc', tier2);
    await expect(queueTitles(page)).toHaveText(sorted);

    await page.reload();
    await waitForHydration(page);
    await expect(tierButton(page, 'T2')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expectSorted(page, 'Min', 'descending');
    await expect(queueTitles(page)).toHaveText(sorted);

    await tierButton(page, 'All').click();
    await expect(page).toHaveURL(/\?tab=queue&sort=minutes&dir=desc$/);
    await expect(queueRows(page)).toHaveCount(ROWS.length);
  });

  test('tier changes replace history, so Back leaves the tab', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');
    await deskTab(page, 'queue').click();
    await expect(page).toHaveURL(/\?tab=queue$/);
    await tierButton(page, 'T2').click();
    await tierButton(page, 'T4').click();
    await expect(page).toHaveURL(/\?tab=queue&tier=4$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(deskTab(page, 'sources')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.goForward();
    await expect(page).toHaveURL(/\?tab=queue&tier=4$/);
    await expect(tierButton(page, 'T4')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(queueTitles(page)).toHaveText(
      ROWS.filter((r) => r.tier === 4).map((r) => r.title),
    );
  });

  test('a tier with no items says so and offers every tier', async ({
    page,
  }) => {
    const data = JSON.parse(readingQueueJson());
    data.queue = data.queue.filter((item: { tier: number }) => item.tier !== 3);
    data.queue[0].decay = 'unknown';
    writeVaultFile(QUEUE_FILE, JSON.stringify(data));

    await page.goto('/?tab=queue&tier=3');
    await waitForHydration(page);
    await expect(page.getByText('No items in tier 3')).toBeVisible();
    await expect(tierButton(page, 'T3')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show all tiers' }).click();
    await expect(page).toHaveURL(/\?tab=queue$/);
    await expect(queueRows(page)).toHaveCount(data.queue.length);
    await expect(cell(page, 0, 4)).toHaveText('');
  });
});

test.describe('queue: stale panel and states', () => {
  test('the stale panel groups items by reason, read-only', async ({
    page,
  }) => {
    await gotoTab(page, 'queue');
    const panel = page.getByRole('region', {
      name: `Stale (${QUEUE.staleCount})`,
    });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Read-only.');
    await expect(panel.getByRole('heading', { level: 4 })).toHaveText([
      'Read but never archived (1)',
      'Time-sensitive and past its window (1)',
      'Evergreen, but off your current stack (1)',
      'Deferred to Later and never opened (1)',
      'Duplicate of another saved item (1)',
    ]);
    await expect(panel.getByRole('listitem')).toHaveCount(QUEUE.staleCount);
    const expired = panel.getByRole('list', {
      name: 'Time-sensitive and past its window (1)',
    });
    await expect(expired.getByRole('link')).toHaveText(
      'Conference Schedule for Last Spring',
    );
    await expect(expired).toContainText('time-sensitive');
    await expect(expired).toContainText('2025-02-15');
    await expect(panel.getByRole('button')).toHaveCount(0);
  });

  test('a missing reading-queue.json shows the empty state', async ({
    page,
  }) => {
    removeFile(QUEUE_FILE);
    await page.goto('/?tab=queue');
    await waitForHydration(page);
    await expect(
      page.getByText('No reading queue has been generated yet.'),
    ).toBeVisible();
    await expect(
      page.getByText('reading-queue', { exact: true }),
    ).toBeVisible();
    await expect(queueGrid(page)).toHaveCount(0);
    await expect(tierFilter(page)).toHaveCount(0);
  });

  test('a malformed reading-queue.json shows the load error', async ({
    page,
  }) => {
    writeVaultFile(QUEUE_FILE, '{"generated": "2026-09-30", "queue": [');
    await page.goto('/?tab=queue');
    await waitForHydration(page);
    const alert = page
      .getByRole('alert')
      .filter({ hasText: "Couldn't read the reading queue" });
    await expect(alert).toBeVisible();
    await expect(alert.locator('code')).toContainText(
      'reading-queue.json: not valid JSON',
    );
    await expect(queueGrid(page)).toHaveCount(0);
  });
});

test.describe('queue: keyboard', () => {
  test('rows rove with the arrows, Home and End, and Enter opens Reader', async ({
    page,
    context,
  }) => {
    await gotoTab(page, 'queue');
    await expect(queueGrid(page).locator('tbody tr[tabindex="0"]')).toHaveCount(
      1,
    );
    await cell(page, 0, 0).click();
    const rows = queueRows(page);
    await expect(rows.nth(0)).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(rows.last()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(rows.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(rows.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(queueGrid(page).locator('tbody tr[tabindex="0"]')).toHaveText(
      new RegExp(ROWS[1].title),
    );

    const popup = context.waitForEvent('page');
    await page.keyboard.press('Enter');
    expect((await popup).url()).toBe(`${FEED_ORIGIN}/read/e2e-2`);
    await (await popup).close();

    await rows.nth(1).focus();
    for (const key of ['x', ' ', 'a', 'r', 'ArrowRight', ']'])
      await page.keyboard.press(key);
    await expect(rows.nth(1)).toBeFocused();
    await expect(page).toHaveURL(/\?tab=queue$/);
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    await page.keyboard.press('2');
    await expect(page).toHaveURL(/\?tab=topics$/);
  });

  test('sort headers are buttons the keyboard can press', async ({ page }) => {
    await gotoTab(page, 'queue');
    await queueHeader(page, 'Saved').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expectSorted(page, 'Saved', 'ascending');
    await page.keyboard.press('Space');
    await expectSorted(page, 'Saved', 'descending');
    await expect(page).toHaveURL(/\?tab=queue&sort=saved&dir=desc$/);
  });
});
