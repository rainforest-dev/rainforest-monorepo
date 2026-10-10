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

const frames = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );

test('landing on a day keeps its URL while the stream loads the next one', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  await expect(page.locator('#day-2025-11-04')).toBeAttached();
  await frames(page);
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
});

test('scrolling to the end passes through each short trailing day', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    await page.mouse.wheel(0, 40);
    await frames(page);
    seen.add(new URL(page.url()).pathname);
    const atEnd = await page.evaluate(
      () =>
        !!document.getElementById('day-2025-11-04') &&
        scrollY + innerHeight >= document.documentElement.scrollHeight - 1,
    );
    if (atEnd) break;
  }
  expect([...seen]).toContain('/day/2025-11-03');
  await expect(page).toHaveURL(/\/day\/2025-11-04$/);
});

test('a source link lands on its message even when the filter hides Slack', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await page
    .locator('astro-island[component-url*="SourceFilter"]:not([ssr])')
    .waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Slack', exact: true }).click();
  const link = page.locator(
    '#day-2025-11-01 [data-day-markers] [data-marker-source]',
  );
  await link.click();
  const id = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  await expect(page.locator(`[id="${id}"]`)).toBeInViewport();

  await page.goto('/day/2025-11-04');
  await page
    .locator('#day-2025-11-04 [data-day-markers] [data-marker-source]')
    .click();
  await expect(page).toHaveURL(/\/day\/2025-11-02#ev-/);
  const crossDay = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${crossDay}"]`)).toBeVisible();
});

test('the phone year bars stay centred in their row with or without a marker', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const offsets = await page.evaluate(() => {
    const row = [
      ...document.querySelectorAll<HTMLElement>('a[data-month-row="2025-11"]'),
    ].find((el) => el.checkVisibility());
    if (!row) return [];
    const rowBox = row.getBoundingClientRect();
    const centre = rowBox.top + rowBox.height / 2;
    return [...row.querySelectorAll<HTMLElement>('.h-4.w-2')].map((bar) => {
      const box = bar.getBoundingClientRect();
      return Math.abs(box.top + box.height / 2 - centre);
    });
  });
  expect(offsets.length).toBeGreaterThan(0);
  for (const offset of offsets) expect(offset).toBeLessThan(0.75);
  await expect(page.locator('[data-marker-dot]:visible')).toHaveCount(3);
});
