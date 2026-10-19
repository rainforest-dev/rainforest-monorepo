import { expect, type Locator, type Page, test } from '@playwright/test';

import { gotoTab, openValidate, validateTrigger } from './support/desk';
import { FEEDS } from './support/feed-server';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

async function validate(page: Page, url: string): Promise<Locator> {
  await gotoTab(page, 'sources');
  const popover = await openValidate(page);
  const input = popover.getByRole('textbox', { name: 'Feed URL' });
  await expect(input).toBeFocused();
  await input.fill(url);
  await popover.getByRole('button', { name: 'Validate' }).click();
  return popover;
}

test.describe('validate popover', () => {
  test('the popover explains itself and starts empty', async ({ page }) => {
    await gotoTab(page, 'sources');
    const popover = await openValidate(page);
    await expect(popover).toContainText(
      'Check a URL before proposing it as a source.',
    );
    await expect(
      popover.getByRole('button', { name: 'Validate' }),
    ).toBeDisabled();
    await expect(popover.getByRole('alert')).toHaveCount(0);
  });

  test('a valid RSS feed shows its title and item count', async ({ page }) => {
    const alert = (await validate(page, FEEDS.rss)).getByRole('alert');
    await expect(alert).toContainText('Valid RSS feed');
    await expect(alert).toContainText('Title: Lantern Notes');
    await expect(alert).toContainText('3 items found');
  });

  test('a valid Atom feed is recognised', async ({ page }) => {
    const alert = (await validate(page, FEEDS.atom)).getByRole('alert');
    await expect(alert).toContainText('Valid ATOM feed');
    await expect(alert).toContainText('Title: Velvet DOM');
    await expect(alert).toContainText('2 items found');
  });

  test('an HTML page is not a feed', async ({ page }) => {
    const popover = await validate(page, FEEDS.html);
    await expect(popover.getByRole('alert')).toContainText(
      'Not a valid RSS or Atom feed',
    );
  });

  test('a missing feed reports the HTTP status', async ({ page }) => {
    const popover = await validate(page, FEEDS.missing);
    await expect(popover.getByRole('alert')).toContainText('HTTP 404');
  });

  test("an invalid URL shows the server's reason", async ({ page }) => {
    const popover = await validate(page, 'not a url');
    await expect(popover.getByRole('alert')).toContainText('Invalid URL');
  });

  test('Enter submits the form', async ({ page }) => {
    await gotoTab(page, 'sources');
    const popover = await openValidate(page);
    await popover.getByRole('textbox', { name: 'Feed URL' }).fill(FEEDS.rss);
    await page.keyboard.press('Enter');
    await expect(popover.getByRole('alert')).toContainText('Valid RSS feed');
  });

  test('the button is busy while a slow feed loads', async ({ page }) => {
    const popover = await validate(page, FEEDS.slow);
    const button = popover.getByRole('button', { name: 'Validate' });
    await expect(button).toBeDisabled();
    await expect(button.getByRole('status', { name: 'Loading' })).toBeVisible();
    await expect(popover.getByText('Fetching the feed…')).toBeVisible();
    await expect(popover.getByRole('alert')).toContainText('Valid RSS feed');
    await expect(button).toBeEnabled();
  });

  test('the result survives closing and reopening the popover', async ({
    page,
  }) => {
    const popover = await validate(page, FEEDS.rss);
    await expect(popover.getByRole('alert')).toContainText('Valid RSS feed');
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(validateTrigger(page)).toBeFocused();

    const reopened = await openValidate(page);
    await expect(
      reopened.getByRole('textbox', { name: 'Feed URL' }),
    ).toHaveValue(FEEDS.rss);
    await expect(reopened.getByRole('alert')).toContainText('Valid RSS feed');
  });
});
