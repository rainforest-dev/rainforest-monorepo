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
  await expect(days).toHaveCount(3);
  await expect(page.locator('a[data-date="2025-11-01"]')).toHaveAttribute(
    'href',
    '/day/2025-11-01',
  );
});

test('old week links redirect to their first day', async ({ page }) => {
  await page.goto('/week/2025-W44');
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  const response = await page.goto('/day/1999-01-01');
  expect(response?.status()).toBe(404);
});

test('a day shows messages and photos in order, with the source filter', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  await expect(day.getByRole('heading')).toHaveText('2025-11-01（週六）');
  const texts = await day.locator('[data-event-id]').allInnerTexts();
  const indexOf = (needle: string) =>
    texts.findIndex((t) => t.includes(needle));
  expect(indexOf('Morning @Alice')).toBeLessThan(indexOf('Lunch plan'));

  const photo = day.getByRole('img', { name: 'Weekend, Food' });
  expect(
    await photo.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);

  await page.getByLabel('照片').uncheck();
  await expect(photo).toBeHidden();
  await page.reload();
  await expect(page.getByLabel('照片')).not.toBeChecked();
  await page.getByLabel('照片').check();
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
  await panel.getByRole('button', { name: '用 Obsidian 的版本' }).click();
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
