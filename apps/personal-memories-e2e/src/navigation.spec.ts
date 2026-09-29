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

test('Back from a scrolled day marks, focuses and starts the keys from the later day', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-01').click();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');

  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = visibleCell(page, '2025-11-03');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toHaveAttribute('aria-description', '上次看到');
  await expect(cell.getByText('上次看到')).toBeVisible();
  await expect(cell).toBeFocused();
  await expect(page.locator('[data-last-viewed]:visible')).toHaveCount(1);
  await expect(stops(page, 'week')).toHaveAttribute('data-date', '2025-11-03');

  await page.keyboard.press('ArrowUp');
  await expect(visibleCell(page, '2025-11-01')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(visibleCell(page, '2025-11-02')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
});

test('Escape from a scrolled day lands on the later day as well', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = visibleCell(page, '2025-11-03');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toBeFocused();
});

test('a second visit moves the mark instead of adding one', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-01').click();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await page.goBack();
  await expect(visibleCell(page, '2025-11-01')).toHaveAttribute(
    'data-last-viewed',
    '',
  );

  await page.goForward();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');
  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await expect(visibleCell(page, '2025-11-03')).toHaveAttribute(
    'data-last-viewed',
    '',
  );
  await expect(page.locator('[data-last-viewed]:visible')).toHaveCount(1);
  await expect(
    page.locator('[data-grid="week"] [data-last-viewed]'),
  ).toHaveCount(1);
});

test('a repeat arrival on the same day restarts the last-viewed flash', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-01').click();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = visibleCell(page, '2025-11-01');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect
    .poll(() => cell.evaluate((el) => el.getAnimations().length))
    .toBe(0);

  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  const restarted = await cell.evaluate((el) =>
    el
      .getAnimations()
      .some(
        (a) =>
          (a as { animationName?: string }).animationName ===
            'last-viewed-flash' && a.playState === 'running',
      ),
  );
  expect(restarted).toBe(true);
});

test('the year marks the month row you came from, or the day', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  const row = page.locator('a[data-month-row="2025-11"]:visible');
  await expect(row).toHaveAttribute('data-last-viewed', '');
  await expect(row).toHaveAttribute('aria-description', '上次看到');
  await expect(row).toBeFocused();

  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  await page.getByRole('tab', { name: '年' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  const cell = page.locator('a[data-date="2025-11-02"]');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toBeFocused();
  await expect(page.locator('a[data-month-row][data-last-viewed]')).toHaveCount(
    0,
  );
  await expect(stops(page, 'year')).toHaveAttribute('data-date', '2025-11-02');
});

test('moving focus onto 年 keeps the day page on its day', async ({ page }) => {
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  await expect(page.locator('#day-2025-11-01')).toBeAttached();
  const scrolled = await page.evaluate(() => scrollY);
  await page.getByRole('tab', { name: '日' }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: '年' })).toBeFocused();
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  expect(await page.evaluate(() => scrollY)).toBe(scrolled);
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  const cell = page.locator('a[data-date="2025-11-02"]');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toBeFocused();
});

test('the app bar leads a day with a link back to its month, following the day in view', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await expect(page.getByRole('link', { name: '← 全部日子' })).toHaveCount(0);
  const november = page.getByRole('link', { name: '回到 11 月' });
  await expect(november).toHaveText('← 11 月');
  await expect(november).toHaveAttribute('href', '/month/2025-11');

  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  const october = page.getByRole('link', { name: '回到 10 月' });
  await expect(october).toHaveAttribute('href', '/month/2025-10');
  await expect(october).toBeInViewport();
});

test('the back link lands on the day in view like Escape does', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await scrollToDay(page, '2025-11-03');
  await page.getByRole('link', { name: '回到 11 月' }).click();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  const cell = visibleCell(page, '2025-11-03');
  await expect(cell).toHaveAttribute('data-last-viewed', '');
  await expect(cell).toBeFocused();
});

test('on a phone the back link fits in the app bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  await expect(page.getByRole('link', { name: '回到 11 月' })).toBeInViewport({
    ratio: 1,
  });
  await expect(
    page.locator('header').first().getByText('回憶', { exact: true }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('a month cell previews its day after a short hover, at once while moving on, and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  const cell = visibleCell(page, '2025-11-03');
  const preview = cell.locator('[data-preview]');
  await cell.hover();
  expect(await preview.isVisible()).toBe(false);
  await expect(preview).toBeVisible();
  await expect(preview).toBeInViewport({ ratio: 1 });
  await expect(preview).toContainText('2025-11-03（週一）');
  await expect(preview).toContainText('「New week, new plans」');
  const [c, p] = await Promise.all([cell.boundingBox(), preview.boundingBox()]);
  expect(c && p && (p.y + p.height <= c.y || p.y >= c.y + c.height)).toBe(true);

  const neighbour = visibleCell(page, '2025-11-02');
  await neighbour.hover();
  expect(await neighbour.locator('[data-preview]').isVisible()).toBe(true);
  await expect(preview).toBeHidden();

  await page.mouse.move(0, 0);
  await expect(neighbour.locator('[data-preview]')).toBeHidden();

  await neighbour.focus();
  await page.keyboard.press('ArrowRight');
  await expect(cell).toBeFocused();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await expect(cell).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
});

test('arriving by Escape focuses the day without opening its preview', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  await waitForAppBarReady(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await expect(visibleCell(page, '2025-11-03')).toBeFocused();
  await expect(page.locator('[data-preview]:popover-open')).toHaveCount(0);
});

test('pagehide resets an open preview before a bfcache restore', async ({
  page,
}) => {
  await page.goto('/month/2025-11');
  await waitForAppBarReady(page);
  await visibleCell(page, '2025-11-02').focus();
  await page.keyboard.press('ArrowRight');
  const cell = visibleCell(page, '2025-11-03');
  const preview = cell.locator('[data-preview]');
  await expect(cell).toBeFocused();
  await expect(preview).toBeVisible();

  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    ),
  );
  await expect(preview).toBeHidden();
});

test.describe('previews on touch', () => {
  test.use({ hasTouch: true });

  const touch = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page);
    return (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      touchPoints: { x: number; y: number; id: number }[],
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  };

  const centre = async (page: Page, date: string) => {
    const box = await visibleCell(page, date).boundingBox();
    if (!box) throw new Error(`no box for ${date}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  };

  test('a long press shows the preview without opening the day, and the next tap closes it', async ({
    page,
  }) => {
    await page.goto('/month/2025-11');
    await waitForAppBarReady(page);
    const send = await touch(page);
    const preview = visibleCell(page, '2025-11-03').locator('[data-preview]');
    await send('touchStart', [await centre(page, '2025-11-03')]);
    await page.waitForTimeout(600);
    await expect(preview).toBeVisible();
    await send('touchEnd', []);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/month\/2025-11$/);
    await expect(preview).toBeVisible();

    await page.touchscreen.tap(20, 400);
    await expect(preview).toBeHidden();
    await expect(page).toHaveURL(/\/month\/2025-11$/);

    await visibleCell(page, '2025-11-02').tap();
    await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  });

  test('a tap that lands on a cell while closing a pinned preview does not also navigate', async ({
    page,
  }) => {
    await page.goto('/month/2025-11');
    await waitForAppBarReady(page);
    const send = await touch(page);
    const preview = visibleCell(page, '2025-11-03').locator('[data-preview]');
    await send('touchStart', [await centre(page, '2025-11-03')]);
    await page.waitForTimeout(600);
    await expect(preview).toBeVisible();
    await send('touchEnd', []);
    await page.waitForTimeout(300);
    await expect(preview).toBeVisible();

    await visibleCell(page, '2025-11-02').tap();
    await expect(preview).toBeHidden();
    await expect(page).toHaveURL(/\/month\/2025-11$/);

    await visibleCell(page, '2025-11-02').tap();
    await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  });

  test('Esc closes a long-pressed preview, and a second Esc zooms out', async ({
    page,
  }) => {
    await page.goto('/month/2025-11');
    await waitForAppBarReady(page);
    const send = await touch(page);
    const preview = visibleCell(page, '2025-11-03').locator('[data-preview]');
    await send('touchStart', [await centre(page, '2025-11-03')]);
    await page.waitForTimeout(600);
    await expect(preview).toBeVisible();
    await send('touchEnd', []);
    await page.waitForTimeout(300);
    await expect(preview).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    await expect(page).toHaveURL(/\/month\/2025-11$/);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  });

  test('a finger that moves before the long press fires shows nothing', async ({
    page,
  }) => {
    await page.goto('/month/2025-11');
    await waitForAppBarReady(page);
    const send = await touch(page);
    const start = await centre(page, '2025-11-03');
    await send('touchStart', [start]);
    await send('touchMove', [{ ...start, x: start.x + 20 }]);
    await page.waitForTimeout(600);
    await send('touchEnd', []);
    await expect(page.locator('[data-preview]:popover-open')).toHaveCount(0);
  });
});
