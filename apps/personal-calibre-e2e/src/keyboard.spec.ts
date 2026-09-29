import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, options, tokenColor } from './support/library';

async function readColumns(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[role="option"]'));
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
});
