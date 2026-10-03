import { expect, type Page, test } from '@playwright/test';

import { gotoTab } from './support/desk';
import { FEEDS } from './support/feed-server';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

async function validate(page: Page, url: string): Promise<void> {
  await gotoTab(page, 'validate');
  await page.getByRole('textbox', { name: 'Feed URL to validate' }).fill(url);
  await page.getByRole('button', { name: 'Validate' }).click();
}

test.describe('validate', () => {
  test('a valid RSS feed shows its title and item count', async ({ page }) => {
    await validate(page, FEEDS.rss);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Valid RSS feed');
    await expect(alert).toContainText('Title: Lantern Notes');
    await expect(alert).toContainText('3 items found');
  });

  test('a valid Atom feed is recognised', async ({ page }) => {
    await validate(page, FEEDS.atom);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Valid ATOM feed');
    await expect(alert).toContainText('Title: Velvet DOM');
    await expect(alert).toContainText('2 items found');
  });

  test('an HTML page is not a feed', async ({ page }) => {
    await validate(page, FEEDS.html);
    await expect(page.getByRole('alert')).toContainText(
      'Not a valid RSS or Atom feed',
    );
  });

  test('a missing feed reports the HTTP status', async ({ page }) => {
    await validate(page, FEEDS.missing);
    await expect(page.getByRole('alert')).toContainText('HTTP 404');
  });

  test('an invalid URL is rejected by the server', async ({ page }) => {
    await validate(page, 'not a url');
    await expect(page.getByRole('alert')).toContainText('Server error: 400');
  });

  test('the button is busy while a slow feed loads', async ({ page }) => {
    await validate(page, FEEDS.slow);
    await expect(page.getByRole('button', { name: 'Validate' })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('Valid RSS feed');
    await expect(page.getByRole('button', { name: 'Validate' })).toBeEnabled();
  });
});
