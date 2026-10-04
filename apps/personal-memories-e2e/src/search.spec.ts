import { expect, type Page, test } from '@playwright/test';

const JUMP_PLACEHOLDER = '2025-11-08、上週六、中秋';

const openJump = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const dialog = page.getByRole('dialog');
  return { dialog, input: dialog.getByPlaceholder(JUMP_PLACEHOLDER) };
};

const contentGroup = (dialog: ReturnType<Page['getByRole']>) =>
  dialog.getByRole('group', { name: '內容' });

test('a word finds the day it was said, and Enter goes there', async ({
  page,
}) => {
  const { dialog, input } = await openJump(page);
  await input.fill('拉麵');
  const first = contentGroup(dialog).getByRole('option').first();
  await expect(first).toContainText('2025-11-03');
  await expect(first).toContainText('台南的拉麵好好吃');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
});

test('a related word in another language finds the noodle day', async ({
  page,
}) => {
  const { dialog, input } = await openJump(page);
  await input.fill('吃麵');
  await expect(contentGroup(dialog)).toContainText('2025-11-01');
});

test('a festival with no record still offers the nearest day', async ({
  page,
}) => {
  const { dialog, input } = await openJump(page);
  await input.fill('2025 聖誕節');
  await expect(dialog).toContainText('2025 聖誕節（2025-12-25）沒有紀錄');
  await expect(contentGroup(dialog)).toHaveCount(0);
});

test("a person's name lists their days on every platform", async ({ page }) => {
  const { dialog, input } = await openJump(page);
  await input.fill('Bob');
  const group = contentGroup(dialog);
  await expect(group).toContainText('2025-11-02');
  await expect(group).toContainText('2025-11-03');
});

test('says so when only literal matches are available', async ({ page }) => {
  await page.route('**/search.json*', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            kind: 'content',
            date: '2025-11-03',
            score: 1,
            snippet: '台南的拉麵好好吃',
            source: 'line',
          },
        ],
        semantic: 'off',
        reason: 'ollama-unreachable',
      },
    }),
  );
  const { dialog, input } = await openJump(page);
  await input.fill('拉麵');
  await expect(dialog).toContainText(
    '語意搜尋暫時無法使用，只顯示字面相符的結果',
  );
  await expect(contentGroup(dialog)).toContainText('2025-11-03');
});
