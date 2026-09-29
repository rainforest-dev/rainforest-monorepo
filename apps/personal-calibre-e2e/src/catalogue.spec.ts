import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, tokenColor } from './support/library';
import { bookById } from './support/seed';

const grid = (page: Page) => page.getByRole('grid', { name: 'Books' });
const rows = (page: Page) => grid(page).locator('tr[data-nav-key]');
const toolbar = (page: Page) =>
  page.getByRole('toolbar', { name: 'Bulk actions' });

test.describe('catalogue', () => {
  test('shows the page as a table', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue');
    await expect(
      page.getByRole('region', { name: 'Catalogue view' }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(30);
    for (const name of ['Title', 'Author', 'Formats', 'Delivered', 'Year']) {
      await expect(
        grid(page).getByRole('columnheader', { name, exact: true }),
      ).toBeVisible();
    }
  });

  test('hides Formats and Year while the pane is open', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue&book=38');
    await expect(
      grid(page).getByRole('columnheader', { name: 'Formats' }),
    ).toHaveCount(0);
    await expect(
      grid(page).getByRole('columnheader', { name: 'Year' }),
    ).toHaveCount(0);
  });

  test('shows delivery pills, or a dash named Not delivered', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue&page=2');
    const one = grid(page).locator('tr[data-book-id="1"]');
    await expect(one).toContainText('Kobo');
    await expect(one).toContainText('NotebookLM');
    const plain = grid(page).locator('tr[data-book-id="39"]');
    await expect(
      plain.getByRole('img', { name: 'Not delivered' }),
    ).toBeVisible();
  });

  test('groups rows under group headings', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue&groupBy=series');
    await expect(
      grid(page).getByRole('heading', { name: 'Amber Road' }),
    ).toBeVisible();
    await expect(
      grid(page).getByRole('button', { name: 'See all 20' }),
    ).toBeVisible();
  });

  test('one tab stop; arrows, Home/End in the group and Ctrl+End to the page end', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue&groupBy=series');
    await expect(grid(page).locator('tr[tabindex="0"]')).toHaveCount(1);
    await rows(page).first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows(page).nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(rows(page).nth(7)).toBeFocused();
    await page.keyboard.press('Control+End');
    await expect(rows(page).last()).toBeFocused();
    await page.keyboard.press('Control+Home');
    await expect(rows(page).first()).toBeFocused();
    await page.keyboard.press('Space');
    await expect(rows(page).first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(
        `book=${await rows(page).first().getAttribute('data-book-id')}`,
      ),
    );
  });

  test('focus is foreground and selection is primary', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue');
    const row = rows(page).first();
    await row.focus();
    await page.keyboard.press('x');
    const title = bookById(
      Number(await row.getAttribute('data-book-id')),
    ).title;
    await expect
      .poll(() => row.evaluate((el) => getComputedStyle(el).outlineColor))
      .toBe(await tokenColor(page, '--foreground'));
    await expect
      .poll(() =>
        row
          .getByRole('checkbox', { name: `Select ${title}` })
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe(await tokenColor(page, '--primary'));
  });

  test('the header checkbox selects or clears the current page only', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue');
    const header = grid(page).getByRole('checkbox', {
      name: 'Select all on this page',
    });
    await header.click();
    await expect(toolbar(page)).toContainText('30 selected');
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(header).toHaveAttribute('aria-checked', 'false');
    await header.click();
    await expect(toolbar(page)).toContainText('60 selected');
    await header.click();
    await expect(toolbar(page)).toContainText('30 selected');
  });

  test('bulk Mark delivered works from the Catalogue', async ({ page }) => {
    await gotoLibrary(page, '/?view=catalogue&series=1');
    await rows(page).nth(0).focus();
    await page.keyboard.press('x');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('x');
    await toolbar(page).getByRole('combobox', { name: 'Add to' }).click();
    await page.getByRole('option', { name: 'Readwise Reader' }).click();
    await toolbar(page).getByRole('button', { name: 'Mark delivered' }).click();
    await expect(
      page.getByText('2 books marked as delivered to Readwise Reader'),
    ).toBeVisible();
    await expect(rows(page).nth(0)).toContainText('Readwise Reader');
  });
});
