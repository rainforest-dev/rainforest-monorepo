import { expect, type Page, test } from '@playwright/test';

const waitForAppBarReady = (page: Page) =>
  expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);

const visibleCell = (page: Page, date: string) =>
  page.locator(`a[data-date="${date}"]:visible`);

const stops = (page: Page, grid: 'year' | 'week' | 'list') =>
  page.locator(`[data-grid="${grid}"] a[data-date][tabindex="0"]`);

const scrollToDay = async (page: Page, date: string) => {
  const day = page.locator(`#day-${date}`);
  await expect(async () => {
    await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
    await expect(day).toBeAttached({ timeout: 1000 });
  }).toPass();
  await day.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(new RegExp(`/day/${date}$`));
};

const recordReveal = (page: Page) =>
  page.addInitScript(() => {
    addEventListener('pagereveal', (event) => {
      const root = document.documentElement;
      root.dataset['revealTransition'] = String(!!event.viewTransition);
      requestAnimationFrame(() => {
        root.dataset['revealStyle'] =
          document.getElementById('reveal-morph')?.textContent ?? '';
      });
    });
  });

test.describe.configure({ mode: 'serial' });

test('each grid has one tab stop, the latest day with data, and Tab lands on it', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  for (const grid of ['week', 'list'] as const) {
    await expect(stops(page, grid)).toHaveCount(1);
    await expect(stops(page, grid)).toHaveAttribute('data-date', '2025-11-03');
  }
  await page.getByRole('button', { name: '上個月' }).focus();
  await page.keyboard.press('Tab');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-grid] a[data-date]:focus')).toHaveCount(0);

  await page.goto('/');
  await waitForAppBarReady(page);
  await expect(stops(page, 'year')).toHaveCount(1);
  await expect(stops(page, 'year')).toHaveAttribute('data-date', '2025-11-03');
  await page.locator('[data-grid="year"] a[href="/month/2025-11"]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('a[data-date="2025-11-03"]')).toBeFocused();
});

test('arrow keys, Home and End move through the month calendar and carry the tab stop', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-03').focus();
  await page.keyboard.press('ArrowUp');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(visibleCell(page, '2025-11-02')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await page.keyboard.press('End');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(stops(page, 'week')).toHaveCount(1);
  await expect(stops(page, 'week')).toHaveAttribute('data-date', '2025-11-02');

  const scrolled = await page.evaluate(() => scrollY);
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-02')).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scrolled);
});

test('arrow keys move between month rows on the year heatmap', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  const cell = (date: string) => page.locator(`a[data-date="${date}"]`);
  await cell('2025-11-03').focus();
  await page.keyboard.press('ArrowUp');
  await expect(cell('2025-10-31')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(cell('2025-11-03')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(cell('2025-10-31')).toBeFocused();
  await expect(stops(page, 'year')).toHaveCount(1);
  await expect(stops(page, 'year')).toHaveAttribute('data-date', '2025-10-31');
});

test('on a phone, ↑ and ↓ move one day through the month list', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-02').focus();
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await expect(stops(page, 'list')).toHaveAttribute('data-date', '2025-11-01');
});

test('the year and month pages hint their arrow keys, and the day page does not', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  const hints = page.locator('[data-key-hints]');
  await expect(hints).toBeVisible();
  for (const label of ['前後一天', '前後一週', '打開那一天'])
    await expect(hints).toContainText(label);

  await page.goto('/');
  await expect(page.locator('[data-key-hints]')).toContainText('上下一個月');

  await page.goto('/day/2025-11-01');
  await expect(page.locator('[data-key-hints]')).toHaveCount(0);
});

test('Back from a day scrolled past its first names the later day for the morph', async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await recordReveal(page);
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-01').click();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');

  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-reveal-transition', 'true');
  await expect(html).toHaveAttribute(
    'data-reveal-style',
    '[data-morph]{view-transition-name:none!important}' +
      '[data-morph="day-2025-11-03"]{view-transition-name:day-2025-11-03!important}',
  );
  await expect.poll(() => page.locator('style#reveal-morph').count()).toBe(0);
  expect(errors).toEqual([]);
});
