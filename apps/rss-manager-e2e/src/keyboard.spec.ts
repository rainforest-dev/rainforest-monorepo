import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import {
  bulkToolbar,
  deskTab,
  detailPane,
  gotoSources as gotoDesk,
  gotoTab,
  openValidate,
  pager,
  READER_FEEDS_URL,
  sectionOf,
  selectedCount,
  sourceRow,
  sourceSearch,
  toasts,
  topicRow,
  topicSearch,
  topicsGrid,
} from './support/desk';
import { FEEDS } from './support/feed-server';
import { SOURCES } from './support/fixture-vault';
import {
  canDropWritePermission,
  makeReadOnly,
  readVault,
  resetVault,
  SOURCES_FILE,
  TOPICS_FILE,
} from './support/vault';

test.beforeEach(() => resetVault());

const urlOf = (name: string): string => {
  const source = SOURCES.find((s) => s.name === name);
  if (!source) throw new Error(`No fixture source ${name}`);
  return source.url;
};

async function gotoSources(page: Page, search = ''): Promise<void> {
  await gotoDesk(page, search);
  await expect(async () => {
    await page.keyboard.press('/');
    await expect(sourceSearch(page)).toBeFocused({ timeout: 250 });
  }).toPass();
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
}

const stops = (page: Page) => page.locator('tbody tr[tabindex="0"]');

const keyHints = (page: Page) => page.locator('[data-key-hints]');

function countPatches(page: Page): string[] {
  const patches: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') patches.push(r.postData() ?? '');
  });
  return patches;
}

async function focusRow(page: Page, name: string) {
  const row = sourceRow(page, name);
  await row.focus();
  await expect(row).toBeFocused();
  return row;
}

async function dispatchComposing(page: Page, key: string, keyCode?: number) {
  await page.evaluate(
    ([k, code]) => {
      const init: KeyboardEventInit & { keyCode?: number } = {
        key: k,
        bubbles: true,
        cancelable: true,
        isComposing: code === undefined,
      };
      const event = new KeyboardEvent('keydown', init);
      if (code !== undefined)
        Object.defineProperty(event, 'keyCode', { get: () => code });
      (document.activeElement ?? document.body).dispatchEvent(event);
    },
    [key, keyCode] as const,
  );
}

async function stubReader(context: BrowserContext): Promise<void> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route('https://read.readwise.io/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Feeds</title><p>Reader stand-in</p>',
    }),
  );
}

test.describe('keyboard: rows', () => {
  test('the table has one tab stop, and arrows, Home and End move it', async ({
    page,
  }) => {
    await gotoSources(page);
    await expect(page.getByRole('grid', { name: 'Sources' })).toBeVisible();
    await expect(stops(page)).toHaveCount(1);
    await expect(stops(page)).toHaveAttribute(
      'data-nav-key',
      'Atlas of Small Tools',
    );

    await focusRow(page, 'Atlas of Small Tools');
    await page.keyboard.press('ArrowUp');
    await expect(sourceRow(page, 'Atlas of Small Tools')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(sourceRow(page, 'Cinder Blog')).toBeFocused();
    await expect(sourceRow(page, 'Cinder Blog')).toHaveCSS(
      'outline-style',
      'solid',
    );
    await expect(stops(page)).toHaveCount(1);
    await expect(stops(page)).toHaveAttribute('data-nav-key', 'Cinder Blog');

    await page.keyboard.press('End');
    await expect(sourceRow(page, 'Gradient Postcards')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(sourceRow(page, 'Gradient Postcards')).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press('Home');
    await expect(sourceRow(page, 'Atlas of Small Tools')).toBeFocused();
  });

  test('Tab leaves the table from the row, and the row controls are off the tab order', async ({
    page,
  }) => {
    await gotoSources(page);
    await focusRow(page, 'Birch Compiler');
    await page.keyboard.press('Tab');
    await expect(
      pager(page).getByRole('button', { name: 'Next' }),
    ).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(sourceRow(page, 'Birch Compiler')).toBeFocused();

    const row = sourceRow(page, 'Birch Compiler');
    for (const control of [
      row.getByRole('button', { name: 'Birch Compiler' }),
      row.getByRole('button', { name: 'Activate' }),
      row.getByRole('button', { name: 'Retire' }),
    ])
      await expect(control).toHaveAttribute('tabindex', '-1');
  });

  test('clicking a row makes it the tab stop', async ({ page }) => {
    await gotoSources(page);
    await sourceRow(page, 'Fable Stack').getByText('Proposed').click();
    await expect(sourceRow(page, 'Fable Stack')).toBeFocused();
    await expect(stops(page)).toHaveAttribute('data-nav-key', 'Fable Stack');
  });

  test('← and → change pages, focus the first row, and stop at the ends', async ({
    page,
  }) => {
    await gotoSources(page);
    await focusRow(page, 'Cinder Blog');
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/\/$/);
    await expect(sourceRow(page, 'Cinder Blog')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(sourceRow(page, 'Grid & Gutter')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/\?page=3$/);
    await expect(sourceRow(page, 'Dust Jacket')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/\?page=3$/);
    await expect(sourceRow(page, 'Dust Jacket')).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(sourceRow(page, 'Grid & Gutter')).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\?page=3$/);
  });

  test('Enter opens the pane, Esc closes it and focus returns to the row', async ({
    page,
  }) => {
    await gotoSources(page);
    await focusRow(page, 'Birch Compiler');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?source=Cinder\+Blog$/);
    const pane = detailPane(page);
    await expect(
      pane.getByRole('heading', { level: 2, name: 'Cinder Blog' }),
    ).toBeVisible();
    await expect(sourceRow(page, 'Cinder Blog')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(detailPane(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(sourceRow(page, 'Cinder Blog')).toBeFocused();

    await page.keyboard.press('Enter');
    await detailPane(page)
      .getByRole('button', { name: 'Close details' })
      .focus();
    await page.keyboard.press('Escape');
    await expect(detailPane(page)).toHaveCount(0);
    await expect(sourceRow(page, 'Cinder Blog')).toBeFocused();
  });

  test('x and Space toggle the selection and enter select mode', async ({
    page,
  }) => {
    await gotoSources(page);
    const row = await focusRow(page, 'Birch Compiler');
    await page.keyboard.press('x');
    await expect(selectedCount(page)).toHaveText('1 selected');
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('grid', { name: 'Sources' })).toHaveAttribute(
      'aria-multiselectable',
      'true',
    );
    await expect(row).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await expect(selectedCount(page)).toHaveText('2 selected');
    await page.keyboard.press(' ');
    await expect(selectedCount(page)).toHaveText('1 selected');
    await expect(sourceRow(page, 'Cinder Blog')).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('Esc closes the pane, then clears the selection, then leaves select mode', async ({
    page,
  }) => {
    await gotoSources(page);
    await focusRow(page, 'Birch Compiler');
    await page.keyboard.press('x');
    await page.keyboard.press('Enter');
    await expect(detailPane(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detailPane(page)).toHaveCount(0);
    await expect(selectedCount(page)).toHaveText('1 selected');

    await page.keyboard.press('Escape');
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(sourceRow(page, 'Birch Compiler')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Select', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Select all on this page' }),
    ).toHaveCount(0);
  });

  test('Esc from the bulk toolbar clears and puts focus back on the rows', async ({
    page,
  }) => {
    await gotoSources(page);
    await focusRow(page, 'Cinder Blog');
    await page.keyboard.press('x');
    await bulkToolbar(page)
      .getByRole('button', { name: 'Clear selection' })
      .focus();
    await page.keyboard.press('Escape');
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(sourceRow(page, 'Cinder Blog')).toBeFocused();
  });
});

test.describe('keyboard: writes', () => {
  test('a activates a proposed source and focus follows the row', async ({
    page,
  }) => {
    const patches = countPatches(page);
    await gotoSources(page);
    await focusRow(page, 'Birch Compiler');
    await page.keyboard.press('a');
    await expect(toasts(page)).toContainText('Activated Birch Compiler');
    expect(patches.map((p) => JSON.parse(p))).toEqual([
      { names: ['Birch Compiler'], action: 'activate' },
    ]);
    expect(sectionOf(readVault(SOURCES_FILE), 'Birch Compiler')).toBe(
      'Active Sources',
    );
    await expect(sourceRow(page, 'Birch Compiler')).toContainText('Active');
    await expect(sourceRow(page, 'Birch Compiler')).toBeFocused();
  });

  test('r retires an active source', async ({ page }) => {
    const patches = countPatches(page);
    await gotoSources(page);
    await focusRow(page, 'Byte Ledger');
    await page.keyboard.press('r');
    await expect(toasts(page)).toContainText('Retired Byte Ledger');
    expect(patches.map((p) => JSON.parse(p))).toEqual([
      { names: ['Byte Ledger'], action: 'retire' },
    ]);
    expect(sectionOf(readVault(SOURCES_FILE), 'Byte Ledger')).toBe('Retired');
    await expect(page.locator('tbody tr:focus')).toHaveCount(1);
  });

  test('a and r do nothing where the action does not apply', async ({
    page,
  }) => {
    const patches = countPatches(page);
    await gotoSources(page);
    const before = readVault(SOURCES_FILE);

    await focusRow(page, 'Byte Ledger');
    await page.keyboard.press('a');
    await gotoSources(page, '?page=3');
    await focusRow(page, 'Dust Jacket');
    await page.keyboard.press('r');
    await page.waitForTimeout(300);

    expect(patches).toEqual([]);
    expect(readVault(SOURCES_FILE)).toBe(before);
    await expect(toasts(page)).toHaveCount(0);
  });

  test('r on a delivery-gap row re-subscribes: a new page, the clipboard, no write', async ({
    page,
    context,
  }) => {
    await stubReader(context);
    const patches = countPatches(page);
    await gotoSources(page);
    const before = readVault(SOURCES_FILE);

    await focusRow(page, 'Ferry Ops');
    const opened = context.waitForEvent('page');
    await page.keyboard.press('r');
    const reader = await opened;
    await reader.waitForLoadState();
    expect(reader.url()).toBe(READER_FEEDS_URL);

    await page.bringToFront();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      urlOf('Ferry Ops'),
    );
    await expect(
      sourceRow(page, 'Ferry Ops').getByRole('link', { name: 'Copied' }),
    ).toBeVisible();
    expect(readVault(SOURCES_FILE)).toBe(before);
    expect(patches).toEqual([]);
  });
});

test.describe('keyboard: read-only vault', () => {
  test.skip(!canDropWritePermission, 'root ignores the permission bits');

  test('a and r write nothing, while r still re-subscribes', async ({
    page,
    context,
  }) => {
    await stubReader(context);
    makeReadOnly(SOURCES_FILE);
    const patches = countPatches(page);
    await gotoSources(page);
    await expect(page.getByRole('status')).toContainText('Read-only vault');
    const before = readVault(SOURCES_FILE);

    await focusRow(page, 'Birch Compiler');
    await page.keyboard.press('a');
    await page.keyboard.press('r');
    await page.keyboard.press('x');
    await expect(selectedCount(page)).toHaveText('1 selected');

    await focusRow(page, 'Ferry Ops');
    const opened = context.waitForEvent('page');
    await page.keyboard.press('r');
    expect((await opened).url()).toBe(READER_FEEDS_URL);

    expect(patches).toEqual([]);
    expect(readVault(SOURCES_FILE)).toBe(before);
  });
});

test.describe('keyboard: global keys', () => {
  test('/ focuses the search, and keys typed there stay text', async ({
    page,
  }) => {
    await gotoSources(page);
    await expect(
      sourceSearch(page).locator('..').getByText('/', { exact: true }),
    ).toBeVisible();
    await page.keyboard.press('/');
    await expect(sourceSearch(page)).toBeFocused();
    await page.keyboard.type('x2a/]');
    await expect(sourceSearch(page)).toHaveValue('x2a/]');
    await expect(page).not.toHaveURL(/tab=/);
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(
      sourceSearch(page).locator('..').getByText('/', { exact: true }),
    ).toHaveCount(0);
  });

  test('1 to 3 switch tabs, from the page and from a row', async ({ page }) => {
    await gotoSources(page);
    await focusRow(page, 'Birch Compiler');
    await page.keyboard.press('2');
    await expect(page).toHaveURL(/\?tab=topics$/);
    await expect(deskTab(page, 'topics')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('3');
    await expect(page).toHaveURL(/\?tab=queue$/);
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/\/$/);
    await expect(deskTab(page, 'sources')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goBack();
    await expect(page).toHaveURL(/\?tab=queue$/);
  });

  test('[ and ] page from anywhere on Sources and stop at the ends', async ({
    page,
  }) => {
    await gotoSources(page);
    await page.keyboard.press('[');
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(sourceRow(page, 'Grid & Gutter')).toBeFocused();
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/\?page=3$/);
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/\?page=3$/);
    await page.keyboard.press('[');
    await expect(page).toHaveURL(/\?page=2$/);

    await page.keyboard.press('2');
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/\?tab=topics&page=2$/);
  });

  test('keys are skipped with a modifier held', async ({ page }) => {
    const patches = countPatches(page);
    await gotoSources(page);
    await focusRow(page, 'Birch Compiler');
    for (const key of [
      'Control+ArrowDown',
      'Alt+2',
      'Control+x',
      'Control+a',
      'Alt+r',
      'Alt+]',
    ])
      await page.keyboard.press(key);
    await expect(sourceRow(page, 'Birch Compiler')).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    await expect(bulkToolbar(page)).toHaveCount(0);
    expect(patches).toEqual([]);
  });

  test('keys are skipped during an IME composition', async ({ page }) => {
    await gotoSources(page);
    await focusRow(page, 'Birch Compiler');
    await dispatchComposing(page, 'ArrowDown');
    await dispatchComposing(page, 'x', 229);
    await dispatchComposing(page, '2');
    await expect(sourceRow(page, 'Birch Compiler')).toBeFocused();
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);

    await page.keyboard.press('ArrowDown');
    await expect(sourceRow(page, 'Cinder Blog')).toBeFocused();
  });

  test('keys are skipped inside the Validate popover', async ({ page }) => {
    await gotoSources(page, '?source=Birch+Compiler');
    const popover = await openValidate(page);
    await popover.getByRole('textbox', { name: 'Feed URL' }).fill(FEEDS.rss);
    await popover.getByRole('button', { name: 'Validate' }).focus();
    await page.keyboard.press('2');
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/\?source=Birch\+Compiler$/);

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(detailPane(page)).toBeVisible();
  });
});

test.describe('keyboard: hints', () => {
  test('Sources shows the key row, Kbd hints and no page hint on one page', async ({
    page,
  }) => {
    await gotoSources(page);
    const hints = keyHints(page);
    await expect(hints).toBeVisible();
    await expect(hints).toContainText('Search');
    await expect(hints).toContainText('Move');
    await expect(hints).toContainText('Page');
    await expect(hints).toContainText('Details');
    await expect(hints).toContainText('Close, then clear');
    await expect(hints.locator('[data-slot="kbd-group"]')).toHaveCount(8);

    await sourceSearch(page).fill('Lantern');
    await expect(pager(page)).toHaveCount(0);
    await expect(hints).not.toContainText('Page');
    await expect(hints.locator('[data-slot="kbd-group"]')).toHaveCount(7);

    await sourceSearch(page).fill('');
    await focusRow(page, 'Cinder Blog');
    await page.keyboard.press('x');
    await expect(
      bulkToolbar(page).getByText('Esc', { exact: true }),
    ).toBeVisible();
  });

  test('Topics shows its row keys, and Queue the tab keys', async ({
    page,
  }) => {
    await gotoSources(page);
    await page.keyboard.press('2');
    const topics = page
      .getByRole('tabpanel', { name: /^Topics/ })
      .locator('[data-key-hints]');
    await expect(topics).toBeVisible();
    for (const label of [
      'Search',
      'Move',
      'Select',
      'Activate',
      'Decline',
      'Clear selection',
      'Switch tab',
    ])
      await expect(topics).toContainText(label);
    await expect(topics.locator('[data-slot="kbd-group"]')).toHaveCount(7);

    await page.keyboard.press('3');
    const queue = page
      .getByRole('tabpanel', { name: /^Queue/ })
      .locator('[data-key-hints]');
    await expect(queue).toBeVisible();
    await expect(queue).toHaveText(/123\s*Switch tab/);
  });

  test('no axe violations with the key row, a focused row and select mode', async ({
    page,
  }) => {
    await gotoSources(page);
    await focusRow(page, 'Cinder Blog');
    await page.keyboard.press('ArrowDown');
    await expect(keyHints(page)).toBeVisible();
    await expectNoViolations(page);

    await page.keyboard.press('x');
    await expect(selectedCount(page)).toHaveText('1 selected');
    await expectNoViolations(page);
  });
});

async function gotoTopics(page: Page): Promise<void> {
  await gotoTab(page, 'topics');
  await expect(async () => {
    await page.keyboard.press('/');
    await expect(topicSearch(page)).toBeFocused({ timeout: 250 });
  }).toPass();
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
}

const topicStops = (page: Page) =>
  topicsGrid(page).locator('tbody tr[tabindex="0"]');

async function focusTopic(page: Page, name: string) {
  const row = topicRow(page, name);
  await row.focus();
  await expect(row).toBeFocused();
  return row;
}

function countTopicPatches(page: Page): unknown[] {
  const bodies: unknown[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().endsWith('/api/topics'))
      bodies.push(r.postDataJSON());
  });
  return bodies;
}

test.describe('keyboard: topics', () => {
  test('the table has one tab stop, and arrows, Home and End move it', async ({
    page,
  }) => {
    await gotoTopics(page);
    await expect(topicStops(page)).toHaveCount(1);
    await expect(topicStops(page)).toHaveAttribute(
      'data-nav-key',
      'Accessibility audits',
    );
    for (const button of await topicRow(page, 'Home lab networking')
      .getByRole('button')
      .all())
      await expect(button).toHaveAttribute('tabindex', '-1');

    await focusTopic(page, 'Accessibility audits');
    await page.keyboard.press('ArrowUp');
    await expect(topicRow(page, 'Accessibility audits')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(topicRow(page, 'Data visualisation')).toBeFocused();
    await expect(topicStops(page)).toHaveAttribute(
      'data-nav-key',
      'Data visualisation',
    );
    await page.keyboard.press('End');
    await expect(topicRow(page, 'Gaming hardware')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(topicRow(page, 'Accessibility audits')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/\?tab=topics$/);
    await expect(topicRow(page, 'Accessibility audits')).toBeFocused();

    await page.keyboard.press('/');
    await expect(topicSearch(page)).toBeFocused();
  });

  test('x and Space select, then Esc clears and leaves select mode', async ({
    page,
  }) => {
    await gotoTopics(page);
    const row = await focusTopic(page, 'Home lab networking');
    await page.keyboard.press('x');
    await expect(selectedCount(page)).toHaveText('1 selected');
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await expect(topicsGrid(page)).toHaveAttribute(
      'aria-multiselectable',
      'true',
    );
    await expect(row).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await expect(selectedCount(page)).toHaveText('2 selected');
    await expect(bulkToolbar(page)).toContainText('Decline 2');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.keyboard.press('Escape');
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(topicRow(page, 'Local-first apps')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Select', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Select all shown' }),
    ).toHaveCount(0);
  });

  test('Esc from the bulk toolbar clears and puts focus back on the rows', async ({
    page,
  }) => {
    await gotoTopics(page);
    await focusTopic(page, 'Crypto markets');
    await page.keyboard.press('x');
    await bulkToolbar(page)
      .getByRole('button', { name: 'Clear selection' })
      .focus();
    await page.keyboard.press('Escape');
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(topicRow(page, 'Crypto markets')).toBeFocused();
  });

  test('d declines and a activates where the rule applies, and focus follows', async ({
    page,
  }) => {
    const patches = countTopicPatches(page);
    await gotoTopics(page);
    await focusTopic(page, 'Home lab networking');
    await page.keyboard.press('d');
    await expect(
      toasts(page).filter({ hasText: 'Declined Home lab networking' }),
    ).toBeVisible();
    expect(sectionOf(readVault(TOPICS_FILE), 'Home lab networking')).toBe(
      'Declined',
    );
    const row = topicRow(page, 'Home lab networking');
    await expect(row).toContainText('Declined');
    await expect(row).toBeFocused();

    await page.keyboard.press('d');
    await page.keyboard.press('a');
    await expect(
      toasts(page).filter({ hasText: 'Activated Home lab networking' }),
    ).toBeVisible();
    expect(sectionOf(readVault(TOPICS_FILE), 'Home lab networking')).toBe(
      'Active',
    );
    await expect(row).toBeFocused();

    await page.keyboard.press('a');
    await page.keyboard.press('d');
    await page.waitForTimeout(300);
    expect(patches).toEqual([
      { names: ['Home lab networking'], action: 'decline' },
      { names: ['Home lab networking'], action: 'activate' },
    ]);
  });
});

test.describe('keyboard: topics on a read-only vault', () => {
  test.skip(!canDropWritePermission, 'root ignores the permission bits');

  test('a and d write nothing, while x still selects', async ({ page }) => {
    makeReadOnly(TOPICS_FILE);
    const patches = countTopicPatches(page);
    await gotoTopics(page);
    await expect(page.getByRole('status')).toContainText('Read-only vault');
    const before = readVault(TOPICS_FILE);

    await focusTopic(page, 'Local-first apps');
    await page.keyboard.press('a');
    await page.keyboard.press('d');
    await page.keyboard.press('x');
    await expect(selectedCount(page)).toHaveText('1 selected');
    await page.waitForTimeout(300);

    expect(patches).toEqual([]);
    expect(readVault(TOPICS_FILE)).toBe(before);
    await expect(toasts(page)).toHaveCount(0);
  });
});
