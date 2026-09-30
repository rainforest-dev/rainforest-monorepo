import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, pane } from './support/library';
import { resetAppDb } from './support/reset-db';

test.beforeEach(() => resetAppDb());

const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const row = (page: Page, platformKey: string) =>
  pane(page).locator(`[data-platform="${platformKey}"]`);

test.describe('deliveries', () => {
  test('Mark added shows at once, with URL and note in History', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?book=41');
    await expect(row(page, 'kobo')).toContainText('Not added');
    await row(page, 'kobo').getByRole('button', { name: 'Mark added' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mark as added to Kobo' });
    await expect(
      dialog.getByText("Logs today's date. Both fields are optional."),
    ).toBeVisible();
    await dialog.getByLabel('Reference URL').fill('javascript:alert(1)');
    await dialog.getByLabel('Reference URL').press('Enter');
    await expect(
      dialog.getByText('Reference URL must start with http:// or https://'),
    ).toBeVisible();
    await expect(row(page, 'kobo')).toContainText('Not added');
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
    await dialog
      .getByLabel('Reference URL')
      .fill('https://example.com/shelf/41');
    await dialog.getByLabel('Note').fill('first read');
    await dialog.getByLabel('Note').press('Enter');
    await expect(page.getByText('Logged Kobo')).toBeVisible();
    await expect(row(page, 'kobo')).toContainText(today());
    await expect(
      row(page, 'kobo').getByRole('button', { name: 'Log again' }),
    ).toBeVisible();
    await pane(page).getByText('History (1)').click();
    await expect(pane(page).getByText('first read')).toBeVisible();
    await expect(
      pane(page).getByRole('link', { name: 'https://example.com/shelf/41' }),
    ).toBeVisible();
  });

  test('History removes an event', async ({ page }) => {
    await gotoLibrary(page, '/?book=42');
    await row(page, 'notebooklm')
      .getByRole('button', { name: 'Mark added' })
      .click();
    await page
      .getByRole('dialog', { name: 'Mark as added to NotebookLM' })
      .getByRole('button', { name: 'Save' })
      .click();
    await pane(page).getByText('History (1)').click();
    await pane(page)
      .getByRole('button', { name: 'Remove NotebookLM event' })
      .click();
    await expect(row(page, 'notebooklm')).toContainText('Not added');
    await expect(pane(page).getByText(/History \(/)).toHaveCount(0);
  });

  test('seeded deliveries show their date', async ({ page }) => {
    await gotoLibrary(page, '/?book=1');
    await expect(row(page, 'kobo')).toContainText('2026-09-01');
    await expect(row(page, 'readwise-reader')).toContainText('Not added');
  });
});
