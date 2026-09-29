import { expect, test } from '@playwright/test';

import { gotoLibrary, pane } from './support/library';
import { authorName, bookById } from './support/seed';

const tidewater2 = bookById(38);

test.describe('detail pane', () => {
  test('?book= opens the pane and survives a reload', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await expect(
      pane(page).getByRole('heading', { level: 2, name: tidewater2.title }),
    ).toBeVisible();
    await expect(
      pane(page).getByText('Tidewater Cycle · Book 2'),
    ).toBeVisible();
    await page.reload();
    await expect(
      pane(page).getByRole('heading', { level: 2, name: tidewater2.title }),
    ).toBeVisible();
  });

  test('Close details closes the pane', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await pane(page).getByRole('button', { name: 'Close details' }).click();
    await expect(page).not.toHaveURL(/book=/);
    await expect(pane(page)).toHaveCount(0);
  });

  test('Back closes the pane', async ({ page }) => {
    await gotoLibrary(page, '/');
    await gotoLibrary(page, '/?book=38');
    await page.goBack();
    await expect(page).not.toHaveURL(/book=/);
    await expect(pane(page)).toHaveCount(0);
  });

  test('Open full page loads the permalink', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await pane(page).getByRole('link', { name: 'Open full page' }).click();
    await expect(page).toHaveURL(/\/books\/38$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      tidewater2.title,
    );
    await expect(pane(page)).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Library' }).first(),
    ).toHaveAttribute('href', '/');
  });

  test('Read links to the reader and is absent without an EPUB', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?book=38');
    await expect(
      pane(page).getByRole('link', { name: 'Read' }),
    ).toHaveAttribute('href', '/read/38');
    await gotoLibrary(page, '/?book=46');
    await expect(
      pane(page).getByRole('heading', { level: 2, name: bookById(46).title }),
    ).toBeVisible();
    await expect(pane(page).getByRole('link', { name: 'Read' })).toHaveCount(0);
  });

  test('series and author links set the filter and keep the pane', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?book=38');
    await pane(page)
      .getByRole('link', { name: 'Tidewater Cycle · Book 2' })
      .click();
    await expect(page).toHaveURL(/series=4/);
    await expect(page).toHaveURL(/book=38/);
    await pane(page)
      .getByRole('link', { name: authorName(1) })
      .click();
    await expect(page).toHaveURL(/author=1/);
  });

  test('Download lists each format with its size', async ({ page }) => {
    await gotoLibrary(page, '/?book=1');
    await pane(page).getByRole('button', { name: 'Download' }).click();
    await expect(page.getByRole('menuitem', { name: /EPUB/ })).toHaveAttribute(
      'href',
      '/files/book-1/book-1.epub',
    );
    await expect(page.getByRole('menuitem', { name: /PDF/ })).toContainText(
      'KB',
    );
  });

  test('shows the metadata and the rating', async ({ page }) => {
    await gotoLibrary(page, '/?book=1');
    await expect(
      pane(page).getByRole('img', { name: 'Rated 5 of 5' }),
    ).toBeVisible();
    await expect(pane(page).getByText('Paper Lantern Books')).toBeVisible();
    await expect(pane(page).getByText('EPUB · PDF')).toBeVisible();
  });
});
