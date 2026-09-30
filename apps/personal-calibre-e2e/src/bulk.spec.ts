import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, options } from './support/library';

const toolbar = (page: Page) =>
  page.getByRole('toolbar', { name: 'Bulk actions' });

async function selectOption(page: Page, index: number): Promise<number> {
  const option = options(page).nth(index);
  await option.focus();
  await page.keyboard.press('x');
  await expect(option).toHaveAttribute('aria-selected', 'true');
  return Number(await option.getAttribute('data-book-id'));
}

async function markDeliveredToReadwise(page: Page, count: number) {
  await toolbar(page).getByRole('combobox', { name: 'Add to' }).click();
  await page.getByRole('option', { name: 'Readwise Reader' }).click();
  await toolbar(page).getByRole('button', { name: 'Mark delivered' }).click();
  await expect(
    page.getByText(
      `${count} book${count === 1 ? '' : 's'} marked as delivered to Readwise Reader`,
    ),
  ).toBeVisible();
  await expect(toolbar(page)).toHaveCount(0);
}

async function expectLogged(page: Page, ids: number[]) {
  for (const id of ids) {
    const res = await page.request.get(`/api/books/${id}/deliveries`);
    const body = (await res.json()) as {
      events: Array<{ platformKey: string }>;
    };
    expect(body.events.map((e) => e.platformKey)).toContain('readwise-reader');
  }
}

test.describe('bulk', () => {
  test('Mark delivered from the Shelf logs every selected book', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=2');
    const ids = [await selectOption(page, 0), await selectOption(page, 1)];
    await expect(toolbar(page)).toContainText('2 selected');
    await markDeliveredToReadwise(page, 2);
    for (const id of ids) {
      await expect(
        page.locator(
          `[role="option"][data-book-id="${id}"] [title="On Readwise Reader"]`,
        ),
      ).toBeVisible();
    }
  });

  test('a selection made on page 1 counts on page 2 and bulk acts on both', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = await selectOption(page, 0);
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/page=2/);
    const second = await selectOption(page, 0);
    await expect(toolbar(page)).toContainText('2 selected');
    await markDeliveredToReadwise(page, 2);
    await expectLogged(page, [first, second]);
  });

  test('Select all N covers every page', async ({ page }) => {
    await gotoLibrary(page);
    await selectOption(page, 0);
    await toolbar(page).getByRole('button', { name: 'Select all 70' }).click();
    await expect(toolbar(page)).toContainText('70 selected');
    await toolbar(page)
      .getByRole('button', { name: 'Clear selection (Esc)' })
      .click();
    await expect(toolbar(page)).toHaveCount(0);
  });

  test('selected books hidden by a filter still count and get logged', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=2');
    const hidden = await selectOption(page, 2);
    await page
      .locator('#library-filters')
      .getByRole('button', { name: 'Tidewater Cycle', exact: true })
      .click();
    await expect(page).toHaveURL(/series=4/);
    await expect(toolbar(page)).toContainText('1 selected');
    const visible = await selectOption(page, 2);
    await expect(toolbar(page)).toContainText('2 selected');
    await markDeliveredToReadwise(page, 2);
    await expectLogged(page, [hidden, visible]);
  });

  test('ZIP downloads the selected books', async ({ page }) => {
    await gotoLibrary(page, '/?series=4');
    await selectOption(page, 0);
    const download = page.waitForEvent('download');
    await toolbar(page).getByRole('button', { name: 'ZIP' }).click();
    expect((await download).suggestedFilename()).toBe('books.zip');
  });

  test('Clear returns focus to the shelf', async ({ page }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await first.focus();
    await page.keyboard.press('x');
    await expect(toolbar(page)).toContainText('1 selected');
    await toolbar(page)
      .getByRole('button', { name: 'Clear selection (Esc)' })
      .click();
    await expect(toolbar(page)).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test('Esc from inside the toolbar clears the selection and returns focus to the shelf', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await first.focus();
    await page.keyboard.press('x');
    await expect(toolbar(page)).toContainText('1 selected');
    await toolbar(page).getByRole('button', { name: 'ZIP' }).focus();
    await page.keyboard.press('Escape');
    await expect(toolbar(page)).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test('Mark delivered sits in a group with its platform and shows a spinner while it runs', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?series=2');
    await selectOption(page, 2);
    const add = toolbar(page).getByRole('combobox', { name: 'Add to' });
    await expect(add.locator('xpath=..')).toHaveAttribute(
      'data-slot',
      'button-group',
    );
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/books/deliveries/bulk', async (route) => {
      await held;
      await route.continue();
    });
    await add.click();
    await page.getByRole('option', { name: 'Readwise Reader' }).click();
    const mark = toolbar(page).getByRole('button', { name: 'Mark delivered' });
    await mark.click();
    await expect(mark).toBeDisabled();
    await expect(mark.locator('[data-slot="spinner"]')).toBeVisible();
    await expect(
      toolbar(page).getByRole('button', { name: /ZIP/ }),
    ).toBeDisabled();
    release();
    await expect(toolbar(page)).toHaveCount(0);
  });
});
