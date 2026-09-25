import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const NOTES = path.join(__dirname, '..', 'test-output', 'notes');
const noteFile = (date: string) =>
  path.join(NOTES, date.slice(0, 4), `${date}.md`);

const waitForLightboxReady = (page: Page) =>
  expect(page.locator('html[data-lightbox-ready]')).toHaveCount(1);

const waitForAppBarReady = (page: Page) =>
  expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);

const readNote = (date: string) =>
  existsSync(noteFile(date)) ? readFileSync(noteFile(date), 'utf8') : '';

const stripCover = (date: string) => {
  const file = noteFile(date);
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  const stripped = text.replace(/^cover: .*\n/m, '');
  if (stripped !== text) writeFileSync(file, stripped);
};

test.describe.configure({ mode: 'serial' });

test('home is a heatmap of the fixture days', async ({ page }) => {
  await page.goto('/');
  const days = page.locator('a[data-date]');
  await expect(days).toHaveCount(4);
  await expect(page.locator('a[data-date="2025-11-01"]')).toHaveAttribute(
    'href',
    '/day/2025-11-01',
  );
});

test('the month calendar shows each day with its cover or a line', async ({
  page,
}) => {
  const response = await page.goto('/month/2025-11');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '2025 年 11 月',
  );
  const cell = (date: string) => page.locator(`a[data-date="${date}"]:visible`);
  await expect(cell('2025-11-01').locator('img')).toHaveAttribute(
    'src',
    /AAAAAAAA-0000-0000-0000-000000000001/,
  );
  await expect(cell('2025-11-03')).toContainText('「New week, new plans」');
  await expect(page.locator('[data-date="2025-11-05"]:visible')).toHaveText(
    '5',
  );
  await cell('2025-11-03').click();
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);

  expect((await page.goto('/month/1999-01'))?.status()).toBe(404);
  await expect(
    page.getByRole('link', { name: '2025-10-31（週五）' }),
  ).toBeVisible();
});

test('old week links redirect to their first day', async ({ page }) => {
  await page.goto('/week/2025-W44');
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  const response = await page.goto('/day/1999-01-01');
  expect(response?.status()).toBe(404);
});

test('a day shows messages and photos in order, with the source filter', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  await expect(day.getByRole('heading')).toHaveText('2025-11-01（週六）');
  // content-visibility:auto defers layout until the section is in view.
  await expect(day).toContainText('照片 7 張');
  await expect(day).toContainText('Alice 🌷 LINE');
  // content-visibility:auto blanks innerText pre-render; textContent needs no layout.
  const texts = await day
    .locator('[data-event-id]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ''));
  const indexOf = (needle: string) =>
    texts.findIndex((t) => t.includes(needle));
  expect(indexOf('Morning @Alice')).toBeLessThan(indexOf('Lunch plan'));

  const photo = day.getByRole('img', { name: 'Weekend, Food' });
  await expect(photo).toBeVisible();
  // toBeVisible() checks layout, not decode; poll past a cold /thumb encode.
  await expect
    .poll(
      () =>
        photo.evaluate((img: HTMLImageElement) =>
          img.complete ? img.naturalWidth : 0,
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await page.getByLabel('照片').uncheck();
  await expect(photo).toBeHidden();
  await page.reload();
  await expect(page.getByLabel('照片')).not.toBeChecked();
  await page.getByLabel('照片').check();
});

test('a photo run longer than 4 collapses the rest behind a +N tile', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  const burst = day.locator('[data-burst]').first();
  await expect(burst.locator('li[data-event-id]')).toHaveCount(7);
  await expect(burst.locator('li[data-overflow]')).toHaveCount(3);
  await expect(burst.locator('[data-more] [data-scrim]')).toHaveText('+4');
});

test("the owner's rows are indented from everyone else's", async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  const ownerRow = day
    .locator('[data-event-id][data-author="Bob"]')
    .first()
    .locator('[data-row-body]');
  const otherRow = day
    .locator('[data-event-id][data-author="Alice 🌷"]')
    .first()
    .locator('[data-row-body]');
  const [ownerLeft, otherLeft] = await Promise.all([
    ownerRow.evaluate((el) => el.getBoundingClientRect().left),
    otherRow.evaluate((el) => el.getBoundingClientRect().left),
  ]);
  expect(ownerLeft).toBeGreaterThan(otherLeft);
});

test('each speaker keeps an accent on every row', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  const accentOf = (author: string) =>
    day
      .locator('li[data-accent]', {
        has: page.locator(`[data-author="${author}"]`),
      })
      .first()
      .getAttribute('data-accent');
  expect(await accentOf('Alice 🌷')).not.toBe(await accentOf('Bob'));
  const width = await day
    .locator('[data-event-id][data-author="Bob"] [data-row-body]')
    .first()
    .evaluate((el) => getComputedStyle(el).borderLeftWidth);
  expect(width).toBe('2px');
});

test('a thumbnail request returns a webp image', async ({ request }) => {
  const response = await request.get(
    '/thumb/AAAAAAAA-0000-0000-0000-000000000001?w=480',
  );
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/webp');
});

test('scrolling loads neighbouring days and follows the URL', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await expect(page.locator('#day-2025-11-01')).toBeAttached();
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await page.locator('#day-2025-11-03').scrollIntoViewIfNeeded();
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
});

test('a day note and an annotation are saved to the vault folder', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await panel.getByLabel('當天的回憶').fill('那天下雨。');
  await expect(panel).toContainText('已儲存');

  const message = page.locator('[data-event-id]', { hasText: 'Lunch plan' });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  await panel
    .getByLabel(/^眉批：/)
    .last()
    .fill('後來那家店關了');
  await expect(panel).toContainText('已儲存');
  await expect(message).toHaveAttribute('data-annotated', '');

  const text = readFileSync(noteFile('2025-11-01'), 'utf8');
  expect(text).toContain('那天下雨。');
  expect(text).toContain('## 眉批');
  expect(text).toContain('後來那家店關了');

  await page.reload();
  await expect(panel.getByLabel('當天的回憶')).toHaveValue('那天下雨。');
});

test('an edit made in Obsidian meanwhile raises a conflict', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toHaveValue('那天下雨。');
  const file = noteFile('2025-11-01');
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace('那天下雨。', 'Obsidian 改的'),
  );

  await panel.getByLabel('當天的回憶').fill('app 改的');
  await expect(panel).toContainText('有衝突');
  const obsidianCard = panel
    .getByRole('heading', { name: 'Obsidian 的版本' })
    .locator('..');
  await obsidianCard.getByRole('button', { name: '保留這個版本' }).click();
  await expect(panel.getByLabel('當天的回憶')).toHaveValue('Obsidian 改的');
});

test('the +N tile opens the whole burst, and 設為封面 is saved', async ({
  page,
}) => {
  stripCover('2025-11-01');
  await page.goto('/day/2025-11-01');
  await waitForLightboxReady(page);
  await page.locator('#day-2025-11-01 [data-burst] [data-more] a').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('照片 · 4 / 7');
  await expect(
    dialog.getByRole('button', { name: '設為封面', exact: true }),
  ).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('照片 · 7 / 7');
  await expect(dialog.getByRole('button', { name: '下一張' })).toBeDisabled();

  await dialog.getByRole('button', { name: '照片 · 1 / 7' }).click();
  await expect(dialog.getByText('目前的封面')).toBeVisible();
  await dialog.getByRole('button', { name: '照片 · 3 / 7' }).click();
  await dialog.getByRole('button', { name: '設為封面', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '已設為封面' }),
  ).toBeVisible();
  await expect
    .poll(() => readNote('2025-11-01'), { timeout: 15_000 })
    .toMatch(/^cover: DDDDDDDD-0000-0000-0000-000000000004$/m);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await page.goto('/month/2025-11');
  await expect(
    page.locator('a[data-date="2025-11-01"]:visible img'),
  ).toHaveAttribute('src', /DDDDDDDD-0000-0000-0000-000000000004/);
});

test('a video in a burst plays and cannot be set as cover', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await waitForLightboxReady(page);
  await page
    .locator('#day-2025-11-02 [data-burst] a[data-lightbox]')
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('video')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '設為封面', exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: '已設為封面', exact: true }),
  ).toHaveCount(0);
});

test('media supports HTTP range requests for video playback', async ({
  request,
}) => {
  const response = await request.get(
    '/media/99999999-0000-0000-0000-000000000009',
    { headers: { Range: 'bytes=0-9' } },
  );
  expect(response.status()).toBe(206);
  expect(response.headers()['content-range']).toMatch(/^bytes 0-9\/\d+$/);
  expect(response.headers()['accept-ranges']).toBe('bytes');
  expect(response.headers()['content-length']).toBe('10');
});

test('a note typed just before scrolling stays on its own day', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  const panel = page.getByRole('complementary', { name: '筆記' });
  const body = panel.getByLabel('當天的回憶');
  await expect(body).toBeEnabled();
  await body.fill('十一月二日的筆記');

  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await page
    .locator('#day-2025-11-03')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(panel).toContainText('2025-11-03（週一）');
  await expect(body).toHaveValue('');

  const read = (date: string) =>
    existsSync(noteFile(date)) ? readFileSync(noteFile(date), 'utf8') : '';
  await expect.poll(() => read('2025-11-02')).toContain('十一月二日的筆記');
  expect(read('2025-11-03')).not.toContain('十一月二日的筆記');
});

test('the hour strip jumps to an hour and follows the scroll', async ({
  page,
}) => {
  await page.goto('/day/2025-10-31');
  const strip = page.locator('#day-2025-10-31 [data-hour-strip]');
  await expect(strip).toBeVisible();
  await strip.getByRole('link', { name: '15 點，10 則' }).click();
  await expect(
    page.getByText('Busy message 81', { exact: true }),
  ).toBeInViewport();
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '15',
  );
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 101' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '17',
  );
});

test('the hour strip works on a day loaded while scrolling', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await expect(page.locator('#day-2025-10-31')).toBeAttached();
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const strip = page.locator('#day-2025-10-31 [data-hour-strip]');
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '10',
  );
  await strip.getByRole('link', { name: '08 點，10 則' }).click();
  await expect(
    page.getByText('Busy message 11', { exact: true }),
  ).toBeInViewport();
});

test.describe('an annotation signed through Access', () => {
  test.use({
    extraHTTPHeaders: {
      'Cf-Access-Authenticated-User-Email': 'alice@example.com',
    },
  });

  test('carries the signed-in author', async ({ page }) => {
    await page.goto('/day/2025-11-02');
    const panel = page.getByRole('complementary', { name: '筆記' });
    await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
    const message = page.locator('[data-event-id]', {
      hasText: 'Thread reply',
    });
    await message.hover();
    await message.getByRole('button', { name: '眉批' }).click();
    await panel
      .getByLabel(/^眉批：/)
      .last()
      .fill('Alice 寫的眉批');
    await expect(panel).toContainText('已儲存');
    await expect
      .poll(() => readFileSync(noteFile('2025-11-02'), 'utf8'))
      .toMatch(/ src:slack by:Alice %%$/m);
    await expect(panel.getByText('Alice', { exact: true })).toBeVisible();
    await expect(panel.getByPlaceholder('你的名字')).toHaveCount(0);
  });

  test('resolving a conflict does not re-prompt a signed-in user for a name', async ({
    page,
  }) => {
    await page.goto('/day/2025-10-31');
    const panel = page.getByRole('complementary', { name: '筆記' });
    await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
    await panel.getByLabel('當天的回憶').fill('Alice 的版本');
    await expect(panel).toContainText('已儲存');

    const file = noteFile('2025-10-31');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('Alice 的版本', 'Obsidian 改的'),
    );
    await panel.getByLabel('當天的回憶').fill('app 又改了');
    await expect(panel).toContainText('有衝突');
    const obsidianCard = panel
      .getByRole('heading', { name: 'Obsidian 的版本' })
      .locator('..');
    await obsidianCard.getByRole('button', { name: '保留這個版本' }).click();
    await expect(panel.getByLabel('當天的回憶')).toHaveValue('Obsidian 改的');
    await expect(panel.getByPlaceholder('你的名字')).toHaveCount(0);
  });
});

test('without an identity, the name set once in the panel signs 眉批', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
  await panel.getByPlaceholder('你的名字').fill('Bob');
  await panel.getByPlaceholder('你的名字').press('Enter');
  const message = page.locator('[data-event-id]', { hasText: 'Coffee first' });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  await panel
    .getByLabel(/^眉批：/)
    .last()
    .fill('Bob 的眉批');
  await expect(panel).toContainText('已儲存');
  await expect
    .poll(() => readFileSync(noteFile('2025-11-03'), 'utf8'))
    .toMatch(/ by:Bob %%$/m);
});

test('a brand-new annotation keeps its established author across a second save, even if the viewer identity changes meanwhile', async ({
  page,
  context,
}) => {
  await context.setExtraHTTPHeaders({
    'Cf-Access-Authenticated-User-Email': 'alice@example.com',
  });
  await page.goto('/day/2025-10-31');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toBeEnabled();

  const message = page.locator('[data-event-id]', {
    hasText: 'Busy message 90',
  });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  const textarea = panel.getByLabel(/^眉批：/).last();
  await textarea.fill('第一次寫的');
  await expect(panel).toContainText('已儲存');
  await expect
    .poll(() => readFileSync(noteFile('2025-10-31'), 'utf8'))
    .toMatch(/ by:Alice %%$/m);

  await context.setExtraHTTPHeaders({
    'Cf-Access-Authenticated-User-Email': 'bob@example.com',
  });
  await textarea.fill('第一次寫的，補充一些');
  await expect(panel).toContainText('已儲存');
  expect(readFileSync(noteFile('2025-10-31'), 'utf8')).toMatch(
    / by:Alice %%$/m,
  );
});

test('the date jump opens a typed day, or the nearest one', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const input = page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD');
  await input.fill('2025-11-0');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(3);
  await input.fill('2025/11/2');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/day\/2025-11-02/);

  await page.getByRole('button', { name: '跳至日期' }).first().click();
  await page
    .getByRole('dialog')
    .getByPlaceholder('YYYY-MM-DD')
    .fill('2025-11-20');
  await expect(page.getByRole('dialog')).toContainText(
    '沒有這一天，按 Enter 跳到最近的 2025-11-03',
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    '沒有這一天，已跳到最近的 2025-11-03（週一）',
  );
});

test('the keyboard button opens the shortcuts overlay', async ({ page }) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '鍵盤快速鍵' }).click();
  const dialog = page.getByRole('dialog', { name: '鍵盤快速鍵' });
  await expect(dialog).toContainText('在日子間移動');
  await dialog.getByRole('button', { name: '關閉' }).click();
  await expect(dialog).toBeHidden();
});

test('the 年/月/日 tabs follow the day in view', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  // 2025-10-31 loads eagerly above 2025-11-01 (Task 1 step 7); scrolling up
  // into it must move the active day, and the tabs, to October.
  await expect(page.locator('#day-2025-10-31')).toBeAttached();
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  const monthTab = page.getByRole('tab', { name: '月' });
  await expect(monthTab).toHaveAttribute('href', '/month/2025-10');
  // The bar is sticky, so the tab must still be reachable without scrolling up.
  await expect(monthTab).toBeInViewport();
  await monthTab.click();
  await expect(page).toHaveURL(/\/month\/2025-10$/);
});

test('the date jump ignores an Enter fired mid-IME composition', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const input = page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD');
  // An exact match selects through cmdk's own Enter, not this onKeyDown guard.
  await input.fill('2025-11-20');
  await expect(page.getByRole('dialog')).toContainText(
    '沒有這一天，按 Enter 跳到最近的 2025-11-03',
  );
  await input.dispatchEvent('keydown', {
    key: 'Enter',
    keyCode: 229,
    isComposing: true,
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/day\/2025-11-03/);
});

test('keys: j and k, n, ? and /, and Escape only when nothing else claims it', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  await page.keyboard.press('j');
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await waitForAppBarReady(page);
  await page.keyboard.press('k');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await waitForAppBarReady(page);

  const memory = page.getByLabel('當天的回憶');
  const before = await memory.inputValue();
  await page.keyboard.press('n');
  await expect(memory).toBeFocused();
  await page.keyboard.type('jk');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await expect(memory).toHaveValue(`${before}jk`);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await memory.evaluate((el) => (el as HTMLElement).blur());

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: '鍵盤快速鍵' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  await page.keyboard.press('/');
  await expect(
    page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD'),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await waitForAppBarReady(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await waitForAppBarReady(page);

  await page.locator('a[data-date="2025-11-01"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('a[data-date="2025-11-02"]')).toBeFocused();
});

test('Escape collapses an expanded phone note sheet before it zooms out', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  const collapsed = page.getByRole('button', { name: '展開筆記' });
  await collapsed.click();
  const expanded = page.getByRole('button', { name: '收合筆記' });
  await expect(expanded).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await expect(collapsed).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
});

test('zooming out after scrolling into a different month lands on the day in view', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await expect(page.locator('#day-2025-10-31')).toBeAttached();
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-10$/);
  await waitForAppBarReady(page);
  await expect(page.getByRole('tablist', { name: '縮放' })).toBeInViewport();

  const cell = page.locator('a[data-date="2025-10-31"]:visible');
  await expect(cell).toHaveAttribute(
    'style',
    /view-transition-name: day-2025-10-31/,
  );
  await expect(cell).toBeFocused();

  await cell.click();
  await expect(
    page.locator('#day-2025-10-31 [data-morph="day-2025-10-31"]'),
  ).toHaveAttribute('style', /view-transition-name: day-2025-10-31/);
});

test('under reduced motion no element morphs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/month/2025-11');
  await page.locator('a[data-date="2025-11-01"]:visible').click();
  const name = await page
    .locator('#day-2025-11-01 [data-morph="day-2025-11-01"]')
    .evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(name).toBe('none');
});

test('a transient view-transition name is cleared once the transition finishes, and the app bar keeps its own', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.locator('a[data-morph="month-2025-11"]:visible').click();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await waitForAppBarReady(page);

  const monthSection = page.locator('section[data-morph="month-2025-11"]');
  await expect
    .poll(() =>
      monthSection.evaluate((el) => getComputedStyle(el).viewTransitionName),
    )
    .toBe('none');

  const headerName = await page
    .locator('header')
    .first()
    .evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(headerName).toBe('app-bar');
});
