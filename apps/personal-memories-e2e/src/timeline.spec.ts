import { expect, test } from '@playwright/test';

test('index lists the fixture weeks, newest first', async ({ page }) => {
  await page.goto('/');

  const weeks = page.locator('[data-week]');
  await expect(weeks).toHaveCount(2);
  await expect(weeks.nth(0)).toContainText('2025-W45');
  await expect(weeks.nth(0)).toContainText('2025-11-03 – 2025-11-09');
  await expect(weeks.nth(1)).toContainText('2025-W44');
  await expect(weeks.nth(1)).toContainText('照片 2');
});

test('a week page shows messages and photos in chronological order', async ({
  page,
}) => {
  await page.goto('/week/2025-W44');

  const saturday = page.locator('#day-2025-11-01');
  await expect(saturday.getByRole('heading')).toHaveText('2025-11-01（週六）');

  const events = saturday.locator('[data-event-id]');
  const texts = await events.allInnerTexts();
  const indexOf = (needle: string) =>
    texts.findIndex((text) => text.includes(needle));

  const message = events.nth(indexOf('Morning @Alice'));
  await expect(message).toContainText('09:00');
  await expect(message).toContainText('Bob');

  const photo = saturday.getByRole('img', { name: 'Weekend, Food' });
  await expect(photo).toHaveAttribute('loading', 'lazy');
  expect(
    await photo.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);

  const photoIndex = await events.evaluateAll((els) =>
    els.findIndex((el) => el.querySelector('img[alt="Weekend, Food"]')),
  );
  expect(indexOf('Morning @Alice')).toBeLessThan(photoIndex);
  expect(photoIndex).toBeLessThan(indexOf('Lunch plan'));

  const photoEvent = events.nth(photoIndex);
  await page.getByLabel('照片').uncheck();
  await expect(photoEvent).toBeHidden();
  await page.reload();
  await expect(page.getByLabel('照片')).not.toBeChecked();
  await expect(photoEvent).toBeHidden();
});

test('an unknown week is a 404', async ({ page }) => {
  const response = await page.goto('/week/1999-W01');
  expect(response?.status()).toBe(404);
});
