import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'test-output', 'v2c');
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

test.skip(!process.env['V2C_VISUAL'], 'captures run with V2C_VISUAL=1');
test.describe.configure({ mode: 'serial' });

const settle = async (page: Page) => {
  await expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
};

const noSideScroll = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

for (const scheme of SCHEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`v2c visual ${scheme} ${viewport.width}`, () => {
      test.use({ colorScheme: scheme, viewport });
      const shot = (surface: string) =>
        path.join(OUT, `app-${surface}-${scheme}-${viewport.width}.png`);

      test('day stream', async ({ page }) => {
        await page.goto('/day/2025-11-01');
        await settle(page);
        await noSideScroll(page);
        await page.screenshot({ path: shot('day') });
      });

      test('photo burst', async ({ page }) => {
        await page.goto('/day/2025-11-01');
        await settle(page);
        const burst = page.locator('#day-2025-11-01 [data-burst]').first();
        await burst.evaluate((el) => {
          const li = el.closest('li[data-source="photo"]');
          const header = li?.closest('section')?.querySelector('header');
          if (!li || !header) return;
          window.scrollBy(
            0,
            li.getBoundingClientRect().top -
              header.getBoundingClientRect().bottom -
              16,
          );
        });
        await noSideScroll(page);
        await burst
          .locator('xpath=ancestor::li[@data-source="photo"][1]')
          .screenshot({ path: shot('burst') });
      });

      test('inline 眉批', async ({ page }) => {
        await page.setExtraHTTPHeaders({
          'Cf-Access-Authenticated-User-Email': 'alice@example.com',
        });
        await page.goto('/day/2025-10-31');
        await settle(page);
        const row = page
          .locator('#day-2025-10-31 [data-event-id]', {
            hasText: 'Busy message 1',
          })
          .first();
        if ((await row.getAttribute('data-annotated')) === null) {
          await row.focus();
          await row.getByRole('button', { name: '眉批' }).click();
          await page
            .getByLabel(/^眉批：Busy message 1$/)
            .fill('那天早上的第一則');
          await expect(page.getByText('已儲存').first()).toBeVisible();
          await page.keyboard.press('Escape');
        }
        await expect(row.locator('[data-note]')).toBeVisible();
        await expect(row.locator('[data-note-by]')).toHaveText(' · Alice');
        await row.evaluate((el) => {
          (document.activeElement as HTMLElement | null)?.blur();
          el.scrollIntoView({ block: 'center' });
        });
        await noSideScroll(page);
        await row.screenshot({ path: shot('inline-note') });
      });

      test('notes panel', async ({ page }) => {
        await page.goto('/day/2025-11-01');
        await settle(page);
        if (viewport.width === 390) {
          const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
          await sheet.screenshot({ path: shot('notes-peek') });
          await sheet.getByRole('button', { name: '展開筆記' }).click();
          await expect(sheet.getByLabel('當天的回憶')).toBeVisible();
          await page.evaluate(() =>
            Promise.all(document.getAnimations().map((a) => a.finished)),
          );
          await page.screenshot({ path: shot('notes') });
          return;
        }
        await noSideScroll(page);
        await page
          .getByRole('complementary', { name: '筆記' })
          .screenshot({ path: shot('notes') });
      });
    });
  }
}
