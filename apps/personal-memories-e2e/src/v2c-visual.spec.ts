import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'test-output', 'v2c');
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

test.skip(!process.env['V2C_VISUAL'], 'captures run with V2C_VISUAL=1');

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
        await burst.scrollIntoViewIfNeeded();
        await noSideScroll(page);
        await burst
          .locator('xpath=ancestor::li[@data-source="photo"][1]')
          .screenshot({ path: shot('burst') });
      });
    });
  }
}
