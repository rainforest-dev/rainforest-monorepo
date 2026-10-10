import { expect, test } from '@playwright/test';

test('the year heatmap draws leave and WFH bars and opens a marker-only day', async ({
  page,
}) => {
  await page.goto('/');
  const split = page.locator(
    'a[data-date="2025-11-03"] [data-marker-bar="alice"]',
  );
  await expect(
    split.locator('[data-kind="leave"][data-part="am"]'),
  ).toHaveCount(1);
  await expect(split.locator('[data-kind="wfh"][data-part="pm"]')).toHaveCount(
    1,
  );
  await expect(page.locator('a[data-date="2025-11-03"]')).toHaveAttribute(
    'aria-label',
    /Alice 請假・上午、WFH・下午/,
  );
  await expect(
    page.locator('a[data-date="2025-11-01"] [data-marker-bar]').first(),
  ).toHaveAttribute('data-marker-bar', 'bob');
  const leaveOnly = page.locator('a[data-date="2025-11-04"]');
  await expect(leaveOnly).toHaveAttribute('href', '/day/2025-11-04');
  await expect(
    leaveOnly.locator('[data-kind="leave"][data-part="full"]'),
  ).toHaveCount(1);
});

test('the month calendar badges marker days and links a marker-only day', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  const cell = page.locator('a[data-date="2025-11-03"]:visible');
  await expect(cell.locator('[data-marker-badge]')).toHaveText([
    /A 請假・上午/,
    /A WFH・下午/,
  ]);
  await expect(page.locator('a[data-date="2025-11-04"]:visible')).toHaveCount(
    1,
  );
});

test('a marker-only day lists its marker and links back to the message', async ({
  page,
}) => {
  const response = await page.goto('/day/2025-11-04');
  expect(response?.status()).toBe(200);
  const row = page.locator('#day-2025-11-04 [data-day-markers] li');
  await expect(row).toHaveText(/Alice 請假（全天）/);
  const link = row.locator('[data-marker-source]');
  await expect(link).toHaveAttribute('href', /^\/day\/2025-11-02#ev-/);
  await link.click();
  await expect(page).toHaveURL(/\/day\/2025-11-02#ev-/);
  const id = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
});

test('a marker posted on its own day links within the page', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await expect(
    page.locator('#day-2025-11-01 [data-day-markers] [data-marker-source]'),
  ).toHaveAttribute('href', /^#ev-/);
});

test('markers stay when the source filter hides Slack', async ({ page }) => {
  await page.goto('/day/2025-11-03');
  await page
    .locator('astro-island[component-url*="SourceFilter"]:not([ssr])')
    .waitFor({ state: 'attached' });
  const toggle = page.getByRole('button', { name: 'Slack', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.locator('#day-2025-11-03 [data-day-markers] li'),
  ).toHaveCount(2);
  await expect(
    page.locator('#day-2025-11-03 [data-day-markers]'),
  ).toBeVisible();
});

test('the stream partial serves a marker-only day', async ({ request }) => {
  const response = await request.get('/day/2025-11-04/partial');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('data-day-markers');
});
