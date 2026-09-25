import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const NOTES = path.join(__dirname, '..', 'test-output', 'notes');
const noteFile = (date: string) =>
  path.join(NOTES, date.slice(0, 4), `${date}.md`);

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  // The dev toolbar overlays clicks near the bottom of the page in dev mode.
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none; }' });
});

test('home is a heatmap of the fixture days', async ({ page }) => {
  await page.goto('/');
  const days = page.locator('a[data-date]');
  await expect(days).toHaveCount(4);
  await expect(page.locator('a[data-date="2025-11-01"]')).toHaveAttribute(
    'href',
    '/day/2025-11-01',
  );
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
  // content-visibility:auto blanks innerText pre-render; textContent needs no layout.
  const texts = await day
    .locator('[data-event-id]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ''));
  const indexOf = (needle: string) =>
    texts.findIndex((t) => t.includes(needle));
  expect(indexOf('Morning @Alice')).toBeLessThan(indexOf('Lunch plan'));

  const photo = day.getByRole('img', { name: 'Weekend, Food' });
  await expect(photo).toBeVisible();
  expect(
    await photo.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);

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
  const [ownerPadding, otherPadding] = await Promise.all([
    ownerRow.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft)),
    otherRow.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft)),
  ]);
  expect(ownerPadding).toBeGreaterThan(otherPadding);
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
