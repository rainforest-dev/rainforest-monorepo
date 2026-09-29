import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, options, tokenColor } from './support/library';

async function tileTitle(page: Page, id: string | null): Promise<string> {
  const label = await page
    .locator(`[role="option"][data-book-id="${id}"]`)
    .getAttribute('aria-label');
  return (label ?? '').split(', ')[0] ?? '';
}

async function clickBetweenTiles(page: Page): Promise<void> {
  const first = await options(page).first().boundingBox();
  const second = await options(page).nth(1).boundingBox();
  if (!first || !second) throw new Error('tiles are not laid out yet');
  await page.mouse.click((first.x + first.width + second.x) / 2, first.y + 4);
}

async function isActiveElementBody(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement === document.body);
}

async function readColumns(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const shelf = document.querySelector('[aria-label^="Books"]');
    const tiles = Array.from(shelf?.querySelectorAll('[role="option"]') ?? []);
    const first = tiles[0]?.getBoundingClientRect();
    if (!first || first.width === 0) return null;
    return tiles.filter((t) => t.getBoundingClientRect().top === first.top)
      .length;
  });
}

async function columns(page: Page): Promise<number> {
  await expect.poll(() => readColumns(page)).not.toBeNull();
  return (await readColumns(page)) as number;
}

test.describe('shelf keyboard', () => {
  test('has one tab stop, reached by Tab from the toolbar', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await expect(options(page).first()).toBeVisible();
    await expect(page.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
    await page.getByRole('button', { name: /Sort direction/ }).focus();
    await page.keyboard.press('Tab');
    await expect(options(page).first()).toBeFocused();
  });

  test('arrows move in reading order and stop at the ends', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await expect(options(page).first()).toBeVisible();
    await options(page).first().focus();
    await page.keyboard.press('ArrowLeft');
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(options(page).nth(1)).toBeFocused();
    await expect(page.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
    await options(page).last().focus();
    await page.keyboard.press('ArrowRight');
    await expect(options(page).last()).toBeFocused();
  });

  test('ArrowDown and ArrowUp move between rows', async ({ page }) => {
    await gotoLibrary(page);
    const cols = await columns(page);
    await options(page).first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(options(page).nth(cols)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(options(page).first()).toBeFocused();
  });

  test('Home and End stay in the row; Ctrl+Home and Ctrl+End reach the page ends', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const cols = await columns(page);
    await options(page).nth(1).focus();
    await page.keyboard.press('End');
    await expect(options(page).nth(cols - 1)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('Control+End');
    await expect(options(page).last()).toBeFocused();
    await page.keyboard.press('Control+Home');
    await expect(options(page).first()).toBeFocused();
  });

  test('x and Space toggle the selection and Enter opens the pane', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await expect(first).toBeVisible();
    await first.focus();
    await page.keyboard.press('x');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(`book=${await first.getAttribute('data-book-id')}`),
    );
    await expect(first).toBeFocused();
  });

  test('focus is foreground and selection is primary', async ({ page }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await expect(first).toBeVisible();
    await first.focus();
    await page.keyboard.press('x');
    const foreground = await tokenColor(page, '--foreground');
    const primary = await tokenColor(page, '--primary');
    await expect
      .poll(() =>
        first
          .locator('[data-tile-cover]')
          .evaluate((el) => getComputedStyle(el).outlineColor),
      )
      .toBe(foreground);
    await expect
      .poll(() =>
        first
          .locator('[data-select-mark]')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe(primary);
  });

  test('with tag grouping, x selects every copy and arrows reach the other copy', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=tag&series=4');
    const copies = page.locator('[role="option"][data-book-id="39"]');
    await expect(copies.first()).toBeVisible();
    await expect(copies).toHaveCount(2);
    await copies.first().focus();
    await page.keyboard.press('x');
    await expect(copies.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(copies.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(copies.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(copies.nth(1)).toBeFocused();
  });

  test('a back navigation that removes the focused tile moves focus to the remaining tile, not the body', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const firstId = await options(page).first().getAttribute('data-book-id');
    const secondId = await options(page).nth(1).getAttribute('data-book-id');
    const secondTitle = await tileTitle(page, secondId);

    await page.goto(`/?q=${encodeURIComponent(secondTitle)}`);
    await expect(page.locator('[data-library-ready]')).toHaveCount(1);
    await page.getByRole('link', { name: 'Library' }).click();
    await expect(page).toHaveURL('/');

    const first = page.locator(`[role="option"][data-book-id="${firstId}"]`);
    await expect(first).toBeVisible();
    await first.focus();
    await expect(first).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(/q=/);
    await expect(
      page.locator(`[role="option"][data-book-id="${firstId}"]`),
    ).toHaveCount(0);
    await expect(options(page).first()).toBeFocused();
  });

  test('a click to a non-focusable area is not overridden by a later, unrelated content change', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=4');
    const trackedId = await options(page).first().getAttribute('data-book-id');

    await page.getByRole('link', { name: 'Library' }).click();
    await expect(page).toHaveURL('/');

    const tracked = page.locator(
      `[role="option"][data-book-id="${trackedId}"]`,
    );
    await expect(tracked).toBeVisible();
    await tracked.focus();
    await expect(tracked).toBeFocused();

    await clickBetweenTiles(page);
    await expect.poll(() => isActiveElementBody(page)).toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(/series=4/);
    await expect(options(page).first()).toHaveAttribute(
      'data-book-id',
      trackedId ?? '',
    );
    await expect(tracked).toBeAttached();
    await expect.poll(() => isActiveElementBody(page)).toBe(true);
  });

  test('a stale focus memory is dropped once focus moves to a control outside the shelf', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const firstId = await options(page).first().getAttribute('data-book-id');
    const secondId = await options(page).nth(1).getAttribute('data-book-id');
    const secondTitle = await tileTitle(page, secondId);

    await page.goto(`/?q=${encodeURIComponent(secondTitle)}`);
    await expect(page.locator('[data-library-ready]')).toHaveCount(1);
    await page.getByRole('link', { name: 'Library' }).click();
    await expect(page).toHaveURL('/');

    const first = page.locator(`[role="option"][data-book-id="${firstId}"]`);
    await expect(first).toBeVisible();
    await first.focus();
    await expect(first).toBeFocused();

    await clickBetweenTiles(page);
    await expect.poll(() => isActiveElementBody(page)).toBe(true);

    const search = page.getByPlaceholder('Search books');
    await search.focus();
    await expect(search).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(/q=/);
    await expect(first).toHaveCount(0);
    await expect(search).toBeFocused();

    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await expect.poll(() => isActiveElementBody(page)).toBe(true);

    await page.goForward();
    await expect(page).toHaveURL('/');
    await expect(options(page).first()).toHaveAttribute(
      'data-book-id',
      firstId ?? '',
    );
    await expect.poll(() => isActiveElementBody(page)).toBe(true);
  });
});

test.describe('view switch focus', () => {
  test('the Catalogue opens on the book focused in the Shelf', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const third = options(page).nth(2);
    await third.focus();
    const id = await third.getAttribute('data-book-id');
    await page.getByRole('button', { name: 'Catalogue view' }).click();
    await expect(page.locator(`tr[data-book-id="${id}"]`)).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});

test.describe('grouped shelf keyboard', () => {
  test('keeps exactly one tab stop across every group', async ({ page }) => {
    await gotoLibrary(page, '/?groupBy=series');
    const shelf = page.getByRole('region', { name: 'Shelf view' });
    await expect(shelf.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
    await expect(shelf.locator('[role="listbox"][tabindex]')).toHaveCount(0);
  });

  test('Tab from the toolbar lands on a tile', async ({ page }) => {
    await gotoLibrary(page, '/?groupBy=series');
    await page.getByRole('button', { name: /Sort direction/ }).focus();
    await page.keyboard.press('Tab');
    await expect(options(page).first()).toBeFocused();
  });

  test('ArrowDown from one group moves focus into the next group', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=series');
    const first = options(page).first();
    const firstRow = await first.getAttribute('data-nav-row');
    await first.focus();
    await page.keyboard.press('ArrowDown');
    const active = page.locator('[role="option"][tabindex="0"]');
    await expect(active).toBeFocused();
    expect(await active.getAttribute('data-nav-row')).not.toBe(firstRow);
  });
});
