import { expect, type Page, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import {
  EVENT_PAGE_IMAGE,
  EVENT_POSTER,
  EVENT_TITLES,
} from './support/events-fixture';
import { hideDevToolbar } from './support/phone';

/** An event's card, never its title in the island's serialized props. */
const card = (page: Page, title: string) =>
  page.locator('[data-event]').filter({ hasText: title });

const shelf = (page: Page, name: string) =>
  page.getByRole('region', { name: new RegExp(`^${name} \\d+`) });

test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await hideDevToolbar(page);
});

test.describe('magazine rack', () => {
  test('shelves every event by when it ends or opens', async ({ page }) => {
    await page.goto('/rack/events');
    await expect(shelf(page, 'Ending soon')).toContainText(EVENT_TITLES.ending);
    await expect(shelf(page, 'On now')).toContainText(EVENT_TITLES.now);
    await expect(shelf(page, 'On now')).toContainText(EVENT_TITLES.tainan);
    await expect(shelf(page, 'Markets')).toContainText(EVENT_TITLES.market);
    await expect(shelf(page, 'Opening soon')).toContainText(EVENT_TITLES.soon);
    await expectNoViolations(page);
  });

  test('keeps the reader’s subscriptions across a reload', async ({ page }) => {
    await page.goto('/rack/events');
    await page.getByText(/^Subscriptions/).click();
    // The checkboxes live in an island; a click before it hydrates does nothing.
    await expect(async () => {
      await page.getByRole('button', { name: 'Green and meat-free' }).click();
      await expect(card(page, EVENT_TITLES.ending)).toBeHidden({
        timeout: 2_000,
      });
    }).toPass();
    await expect(card(page, EVENT_TITLES.now)).toBeVisible();
    await expect(card(page, EVENT_TITLES.market)).toBeVisible();

    await page.reload();
    await expect(card(page, EVENT_TITLES.now)).toBeVisible();
    await expect(card(page, EVENT_TITLES.ending)).toBeHidden();

    await page.getByRole('checkbox', { name: /^臺南市/ }).click();
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });

  test('filters by topic from the chips above the shelves', async ({
    page,
  }) => {
    await page.goto('/rack/events');
    const topics = page.getByRole('group', { name: 'By topic' });
    const toys = topics.getByRole('button', { name: /^Toys/ });
    // A click before the island hydrates does nothing, so retry it, but only while the chip is
    // still off: a second click that lands would turn it off again.
    await expect(async () => {
      if ((await toys.getAttribute('aria-pressed')) !== 'true')
        await toys.click();
      await expect(toys).toHaveAttribute('aria-pressed', 'true', {
        timeout: 2_000,
      });
    }).toPass();
    await expect(card(page, EVENT_TITLES.now)).toBeHidden();
    await expect(card(page, EVENT_TITLES.soon)).toBeVisible();

    await topics.getByRole('button', { name: 'All topics' }).click();
    await expect(card(page, EVENT_TITLES.now)).toBeVisible();
  });

  test('shows each event’s poster, or a drawn cover without one', async ({
    page,
  }) => {
    await page.goto('/rack/events');
    await expect(
      card(page, EVENT_TITLES.now).locator('[data-cover="image"] img'),
    ).toHaveAttribute('src', EVENT_POSTER);
    await expect(
      card(page, EVENT_TITLES.ending).locator('[data-cover="drawn"]'),
    ).toBeVisible();
    // The page's own picture is read in the background, for a later visit.
    await expect(async () => {
      await page.reload();
      await expect(
        card(page, EVENT_TITLES.soon).locator('[data-cover="image"] img'),
      ).toHaveAttribute('src', EVENT_PAGE_IMAGE, { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('draws a cover when a poster fails to load', async ({ page }) => {
    await page.route('**/events/poster.svg', (route) =>
      route.fulfill({ status: 404, body: 'gone' }),
    );
    await page.goto('/rack/events');
    await expect(
      card(page, EVENT_TITLES.now).locator('[data-cover="drawn"]'),
    ).toBeVisible();
  });

  test('serves the events as JSON for the hall', async ({ request }) => {
    const response = await request.get('/rack/api/events');
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      events: { title: string }[];
      failed: string[];
    };
    expect(body.failed).toEqual([]);
    expect(body.events.map((e) => e.title)).toEqual(
      expect.arrayContaining(Object.values(EVENT_TITLES)),
    );
  });
});
