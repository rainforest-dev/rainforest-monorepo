import { expect, test } from '@playwright/test';

import { gotoLibrary, readPrefs, setPrefs } from './support/library';
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
    await expect(page.locator('#library-filters')).toBeVisible();
    await page.getByRole('button', { name: 'Hide filters' }).click();
    await expect(page.locator('#library-filters')).toBeHidden();
    expect(await readPrefs(context)).toMatchObject({ panel: false });
    await gotoLibrary(page);
    await expect(
      page.getByRole('button', { name: 'Show filters' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  test('the permalink renders without the panel or the pane', async ({
    page,
  }) => {
    await gotoLibrary(page, '/books/1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      bookById(1).title,
    );
    await expect(page.locator('#library-filters')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Shelf view' })).toHaveCount(
      0,
    );
  });
});
