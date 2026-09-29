import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, options } from './support/library';

async function expectNoSideScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test.describe('library on phone', () => {
  test('filters open in a left Sheet with Group at the top', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await expect(sheet.getByRole('combobox', { name: 'Group' })).toBeVisible();
    const tags = sheet.getByRole('region', { name: 'Tags' });
    const winter = tags.getByRole('button', { name: 'winter', exact: true });
    if (await winter.isVisible()) {
      await winter.click();
    } else {
      await tags.getByRole('button', { name: /^Show all/ }).click();
      await tags.getByPlaceholder('Filter tags').fill('winter');
      await tags.getByRole('option', { name: 'winter' }).click();
    }
    await expect(page).toHaveURL(/tag=6/);
  });

  test('tapping a tile opens the detail Sheet', async ({ page }) => {
    await gotoLibrary(page);
    await options(page).first().click();
    const sheet = page.getByRole('dialog', { name: 'Book details' });
    await expect(sheet.getByRole('heading', { level: 2 })).toBeVisible();
    await sheet.getByRole('button', { name: 'Close details' }).click();
    await expect(page).not.toHaveURL(/book=/);
  });

  test('Select mode marks tiles and floats the bulk bar', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await options(page).nth(0).click();
    await options(page).nth(1).click();
    await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    const bar = page.getByRole('toolbar', { name: 'Bulk actions' });
    await expect(bar).toContainText('2 selected');
    const box = await bar.boundingBox();
    expect(box && box.y + box.height).toBeGreaterThan(844 - 24);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(bar).toHaveCount(0);
  });

  test('the pager works', async ({ page }) => {
    await gotoLibrary(page);
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/page=2/);
  });

  test('no key hints and no horizontal page scroll', async ({ page }) => {
    for (const url of [
      '/',
      '/?view=catalogue',
      '/?groupBy=series',
      '/?book=38',
    ]) {
      await gotoLibrary(page, url);
      await expect(page.locator('[data-key-hints]')).toBeHidden();
      await expectNoSideScroll(page);
    }
  });

  test('opening the filters Sheet is treated as an overlay by shortcuts', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toBeFocused();
    const viewBefore = await page
      .locator('[data-view-region]')
      .getAttribute('data-view-region');
    await page.keyboard.press('v');
    await expect(sheet).toBeVisible();
    await expect(page.locator('[data-view-region]')).toHaveAttribute(
      'data-view-region',
      viewBefore ?? '',
    );
  });

  test('the compact pane error keeps Retry aligned under the title', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?book=38&__fault=pane');
    const alert = page
      .getByRole('dialog', { name: 'Book details' })
      .getByRole('alert');
    await expect(alert).toContainText("Couldn't load this book");
    const title = alert.locator('[data-slot="alert-title"]');
    const retry = alert.getByRole('button', { name: 'Retry' });
    await expect
      .poll(async () => {
        const titleBox = await title.boundingBox();
        const retryBox = await retry.boundingBox();
        if (!titleBox || !retryBox) return null;
        return Math.abs(titleBox.x - retryBox.x);
      })
      .toBeLessThanOrEqual(1);
  });
});
