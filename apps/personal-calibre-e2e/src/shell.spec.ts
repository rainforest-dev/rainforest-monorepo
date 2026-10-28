import { expect, test } from '@playwright/test';

import {
  gotoLibrary,
  readLibraryPrefs,
  readPrefs,
  setPrefs,
} from './support/library';
import { bookById } from './support/seed';

test.describe('shell', () => {
  test('switches views and remembers the choice', async ({ page, context }) => {
    await gotoLibrary(page);
    const shelf = page.getByRole('button', { name: 'Shelf view' });
    const catalogue = page.getByRole('button', { name: 'Catalogue view' });
    await expect(shelf).toHaveAttribute('aria-pressed', 'true');
    await catalogue.click();
    await expect(catalogue).toHaveAttribute('aria-pressed', 'true');
    expect(await readPrefs(context)).toMatchObject({ view: 'catalogue' });
    await gotoLibrary(page);
    await expect(
      page.getByRole('button', { name: 'Catalogue view' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('?view= overrides the cookie for one load without writing it', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'shelf' });
    await gotoLibrary(page, '/?view=catalogue');
    await expect(
      page.getByRole('button', { name: 'Catalogue view' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await readPrefs(context)).toMatchObject({ view: 'shelf' });
  });

  test('switching the view clears a stale ?view= so it does not win again on reload', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?view=catalogue');
    await page.getByRole('button', { name: 'Shelf view' }).click();
    await expect(page).not.toHaveURL(/view=/);
    await page.reload();
    await expect(page.locator('[data-library-ready]')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Shelf view' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page).not.toHaveURL(/view=/);
  });

  test('hides and shows the filter panel and remembers it', async ({
    page,
    context,
  }) => {
    await gotoLibrary(page);
    await expect(page.locator('#library-sidebar')).toBeVisible();
    await page.getByRole('button', { name: 'Hide sidebar' }).click();
    await expect(page.locator('#library-sidebar')).toBeHidden();
    expect(await readLibraryPrefs(context)).toMatchObject({ sidebar: false });
    await gotoLibrary(page);
    // Closed before the first paint, from the shared cookie.
    await expect(page.locator('#library-sidebar')).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Show sidebar' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  test('the permalink renders without the panel or the pane', async ({
    page,
  }) => {
    await gotoLibrary(page, '/books/1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      bookById(1).title,
    );
    await expect(page.locator('#library-sidebar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Shelf view' })).toHaveCount(
      0,
    );
    const crumbs = page.getByRole('navigation', { name: 'You are here' });
    await expect(crumbs.getByRole('link', { name: 'Books' })).toHaveAttribute(
      'href',
      '/books',
    );
    await expect(crumbs).toContainText(bookById(1).title);
    // The bar's search is the library-wide one on every page.
    await expect(
      page
        .getByRole('banner')
        .getByRole('combobox', { name: 'Search the whole library' }),
    ).toBeVisible();
  });
});
