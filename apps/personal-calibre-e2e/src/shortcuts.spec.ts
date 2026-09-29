import { expect, test } from '@playwright/test';

import { gotoLibrary, options, pane } from './support/library';
import { BOOKS } from './support/seed';

test.describe('shortcuts', () => {
  test('/ focuses search', async ({ page }) => {
    await gotoLibrary(page);
    await page.keyboard.press('/');
    await expect(page.getByPlaceholder('Search books')).toBeFocused();
  });

  test('v cycles the views and keeps focus on the same book', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const third = options(page).nth(2);
    const id = await third.getAttribute('data-book-id');
    await third.focus();
    await page.keyboard.press('v');
    await expect(
      page.getByRole('region', { name: 'Catalogue view' }),
    ).toBeVisible();
    await expect(page.locator(`tr[data-book-id="${id}"]`)).toBeFocused();
    await page.keyboard.press('v');
    await expect(
      page.getByRole('region', { name: 'Shelf view' }),
    ).toBeVisible();
    await expect(
      page.locator(`[role="option"][data-book-id="${id}"]`),
    ).toBeFocused();
  });

  test('v strips a stale ?view= and keeps focus on the same book', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue');
    const third = page.locator('tr[data-book-id]').nth(2);
    await third.focus();
    const id = await third.getAttribute('data-book-id');
    await page.keyboard.press('v');
    await expect(page).not.toHaveURL(/view=/);
    await expect(
      page.locator(`[role="option"][data-book-id="${id}"]`),
    ).toBeFocused();
  });

  test('Esc closes the pane and returns focus, then clears the selection', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await first.focus();
    await page.keyboard.press('x');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/book=/);
    await expect(pane(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/book=/);
    await expect(first).toBeFocused();
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toContainText('1 selected');
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toHaveCount(0);
    await expect(first).toHaveAttribute('aria-selected', 'false');
  });

  test('] and [ change page and focus its first item, and do nothing at the ends', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('[');
    await expect(page).not.toHaveURL(/page=/);
    await expect(options(page).first()).toBeFocused();
    await page.keyboard.press('[');
    await page.waitForTimeout(400);
    await expect(page).not.toHaveURL(/page=/);
    await gotoLibrary(page, '/?page=3');
    await options(page).first().focus();
    await page.keyboard.press(']');
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/page=3/);
  });

  test('a rapid ]] press pages forward once, not twice', async ({ page }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/page=2/);
    await page.goBack();
    await expect(page).not.toHaveURL(/page=/);
  });

  test('page keys keep the pane open', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/book=38/);
    await expect(pane(page).locator('[data-book-detail="38"]')).toBeVisible();
  });

  test('Esc closes a pane whose book is on another page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await gotoLibrary(page);
    const onPage = new Set(
      await options(page).evaluateAll((els) =>
        els.map((el) => Number(el.getAttribute('data-book-id'))),
      ),
    );
    const elsewhere = BOOKS.find((b) => !onPage.has(b.id));
    expect(elsewhere).toBeDefined();
    await gotoLibrary(page, `/?book=${elsewhere?.id}`);
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/book=/);
    await options(page).first().focus();
    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await expect(options(page).first()).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('key hints show the page entry only with more than one page', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await expect(page.locator('[data-key-hints]')).toContainText('Page');
    await gotoLibrary(page, '/?series=4');
    await expect(page.locator('[data-key-hints]')).not.toContainText('Page');
  });
});
