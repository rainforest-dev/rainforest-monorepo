import { expect, test } from '@playwright/test';

import {
  BASE_URL,
  FAULT_COOKIE,
  gotoLibrary,
  options,
  pane,
} from './support/library';
import { BOOKS, titleSort } from './support/seed';

const HALVIK = 4;

test.describe('search', () => {
  test('typing shows a search item and suggestions', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByPlaceholder('Search books').fill('Salt Archive');
    await expect(
      page.getByRole('option', { name: 'Search for "Salt Archive"' }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /The Salt Archive/ }),
    ).toBeVisible();
  });

  test('Enter commits the search to the URL', async ({ page }) => {
    await gotoLibrary(page);
    await page.getByPlaceholder('Search books').fill('Halvik');
    await page.getByPlaceholder('Search books').press('Enter');
    await expect(page).toHaveURL(/q=Halvik/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Results for "Halvik"',
    );
    await expect(page.getByText('20 of 70 books')).toBeVisible();
  });

  test('picking a suggestion opens the pane', async ({ page }) => {
    await gotoLibrary(page);
    const input = page.getByPlaceholder('Search books');
    await input.fill('Salt Archive');
    await expect(
      page.getByRole('option', { name: /The Salt Archive/ }),
    ).toBeVisible();
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/book=1/);
    await expect(page).not.toHaveURL(/q=/);
    await expect(pane(page).locator('[data-book-detail="1"]')).toBeVisible();
  });

  test('the clear button removes the search', async ({ page }) => {
    await gotoLibrary(page, '/?q=Salt');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page).not.toHaveURL(/q=/);
  });

  test('typing in the search field, including Space and arrow keys, does not affect shelf selection or focus', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const first = options(page).first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute('aria-selected', 'false');

    const input = page.getByPlaceholder('Search books');
    await input.fill('Salt Archive');
    await input.press('Space');
    await input.press('ArrowDown');
    await input.press('ArrowUp');

    await expect(first).toHaveAttribute('aria-selected', 'false');
    await expect(input).toBeFocused();
  });

  test('closing a book opened from an off-page search suggestion keeps focus in the search input', async ({
    page,
  }) => {
    await gotoLibrary(page);
    const input = page.getByPlaceholder('Search books');
    await input.fill('Lantern Ledger');
    await expect(
      page.getByRole('option', { name: /The Lantern Ledger/ }),
    ).toBeVisible();
    await page.getByRole('option', { name: /The Lantern Ledger/ }).click();
    await expect(page).toHaveURL(/book=24/);
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(page).not.toHaveURL(/book=/);
    await input.click();
    await page
      .getByRole('option', { name: 'Search for "Lantern Ledger"' })
      .click();
    await expect(page).toHaveURL(/q=Lantern/);
    await expect(page.locator('[data-book-id="24"]')).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('after Back navigation, the search field reflects the URL and keeps its focus', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?q=Halvik');
    const input = page.getByPlaceholder('Search books');
    await expect(input).toHaveValue('Halvik');

    await page.getByRole('link', { name: 'Library' }).click();
    await expect(page).toHaveURL('/');
    await expect(input).toHaveValue('');

    await input.focus();
    await expect(input).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(/q=Halvik/);
    await expect(input).toHaveValue('Halvik');
    await expect(input).toBeFocused();
  });
});

test.describe('shared search', () => {
  test('the list page keeps title order for a query', async ({ page }) => {
    const expected = BOOKS.filter((b) => b.authorIds.includes(HALVIK))
      .map((b) => ({ id: String(b.id), sort: titleSort(b.title) }))
      .sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
      .map((b) => b.id);
    await gotoLibrary(page, '/?q=Halvik');
    await expect(page.getByText(`${expected.length} of`)).toBeVisible();
    const shown = await page
      .locator('[data-view-region] [data-book-id]')
      .evaluateAll((els) => [
        ...new Set(els.map((el) => el.getAttribute('data-book-id'))),
      ]);
    expect(shown).toEqual(expected);
  });

  test('the search box finds a book by meaning, and falls back to lexical when the embedder fails', async ({
    page,
    context,
  }) => {
    await expect
      .poll(
        async () =>
          (
            (await (
              await page.request.get('/api/books/search?q=harbor')
            ).json()) as { semantic: string }
          ).semantic,
        { timeout: 30_000 },
      )
      .toBe('on');

    await gotoLibrary(page);
    const input = page.getByPlaceholder('Search books');
    await input.fill('harbor');
    await expect(page.getByRole('option', { name: /海港來信/ })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('semantic-hit.png'),
    });

    await context.addCookies([
      { name: FAULT_COOKIE, value: 'embed', url: BASE_URL },
    ]);
    const response = page.waitForResponse((r) =>
      r.url().includes('/api/books/search?q=port'),
    );
    await input.fill('port');
    expect(await (await response).json()).toMatchObject({
      semantic: 'off',
      reason: 'ollama-unreachable',
    });
    await expect(
      page.getByRole('option', { name: 'Search for "port"' }),
    ).toBeVisible();
    await expect(page.getByRole('option', { name: /海港來信/ })).toHaveCount(0);
  });
});
