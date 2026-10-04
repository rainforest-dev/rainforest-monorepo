import { expect, type Page, test } from '@playwright/test';

const JUMP_PLACEHOLDER = '2025-11-08、上週六、中秋';

type Stub = { answer: 'busy' | 'hang' | 'slow' };

const stubLanguageModel = (page: Page, stub: Stub) =>
  page.addInitScript((s: Stub) => {
    const wantsChinese = (opts?: {
      expectedInputs?: { languages?: string[] }[];
    }) =>
      (opts?.expectedInputs ?? []).some((i) =>
        (i.languages ?? []).includes('zh'),
      );
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async (opts?: {
          expectedInputs?: { languages?: string[] }[];
        }) => (wantsChinese(opts) ? 'unavailable' : 'available'),
        create: async () => ({
          prompt: (_q: string, o?: { signal?: AbortSignal }) =>
            s.answer === 'busy'
              ? Promise.resolve(JSON.stringify({ text: 'Busy message 92' }))
              : new Promise((resolve, reject) => {
                  o?.signal?.addEventListener('abort', () =>
                    reject(new DOMException('aborted', 'AbortError')),
                  );
                  if (s.answer === 'slow')
                    setTimeout(
                      () => resolve(JSON.stringify({ text: 'x' })),
                      5000,
                    );
                }),
          destroy: () => undefined,
        }),
      },
    });
  }, stub);

const openJump = async (page: Page) => {
  await page.goto('/');
  await expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const dialog = page.getByRole('dialog');
  return {
    dialog,
    input: dialog.getByPlaceholder(JUMP_PLACEHOLDER),
    toggle: dialog.getByRole('switch', { name: 'AI 解析查詢（實驗）' }),
  };
};

const contentGroup = (dialog: ReturnType<Page['getByRole']>) =>
  dialog.getByRole('group', { name: '內容' });

test('without a built-in model the switch says so and search still works', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(globalThis, 'LanguageModel');
  });
  const { dialog, input, toggle } = await openJump(page);
  await expect(toggle).toBeDisabled();
  await expect(dialog).toContainText(
    '這個瀏覽器沒有內建 AI 模型，使用內建解析',
  );
  await input.fill('拉麵');
  await expect(contentGroup(dialog)).toContainText('2025-11-03');
});

test('with a model, English queries are parsed by it and Chinese ones say why not', async ({
  page,
}) => {
  await stubLanguageModel(page, { answer: 'busy' });
  const { dialog, input, toggle } = await openJump(page);
  await toggle.click();
  await expect(toggle).toBeChecked();
  await input.fill('ramen please');
  await expect(dialog.getByText('AI 解析', { exact: true })).toBeVisible();
  await expect(contentGroup(dialog)).toContainText('2025-10-31');
  await input.fill('拉麵');
  await expect(dialog).toContainText('AI 模型還不支援中文，這次用內建解析');
  await expect(contentGroup(dialog)).toContainText('2025-11-03');
});

test('the switch stays on in this browser after a reload', async ({ page }) => {
  await stubLanguageModel(page, { answer: 'busy' });
  const first = await openJump(page);
  await first.toggle.click();
  await expect(first.toggle).toBeChecked();
  const again = await openJump(page);
  await expect(again.toggle).toBeChecked();
});

test('a model that does not answer in time falls back to the built-in parser', async ({
  page,
}) => {
  await stubLanguageModel(page, { answer: 'hang' });
  const { dialog, input, toggle } = await openJump(page);
  await toggle.click();
  await input.fill('ramen please');
  await expect(dialog).toContainText('AI 解析逾時，改用內建解析', {
    timeout: 5000,
  });
});

test('with the switch on, a date with no record still offers the nearest day at once', async ({
  page,
}) => {
  await stubLanguageModel(page, { answer: 'slow' });
  const { dialog, input, toggle } = await openJump(page);
  await toggle.click();
  await expect(toggle).toBeChecked();
  await input.fill('2025-11-20');
  await expect(dialog).toContainText('按 Enter 跳到最近的 2025-11-03', {
    timeout: 1000,
  });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/day\/2025-11-03\?nearest=1$/);
});
