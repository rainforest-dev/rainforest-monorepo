import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const PHASE = process.env['NAV_VISUAL'];
const OUT = path.join(__dirname, '..', 'test-output', 'nav');
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
] as const;

test.skip(
  PHASE !== 'before' && PHASE !== 'after',
  'captures run with NAV_VISUAL=before or NAV_VISUAL=after',
);
test.describe.configure({ mode: 'serial' });

const settle = async (page: Page) => {
  await expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]),
  );
};

for (const scheme of SCHEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`nav visual ${scheme} ${viewport.width}`, () => {
      test.use({
        colorScheme: scheme,
        viewport: { width: viewport.width, height: viewport.height },
        ...('isMobile' in viewport
          ? {
              isMobile: viewport.isMobile,
              deviceScaleFactor: viewport.deviceScaleFactor,
            }
          : {}),
      });
      const shot = (surface: string) =>
        path.join(OUT, `${PHASE}-${surface}-${scheme}-${viewport.width}.png`);

      test('month after zooming out of a day', async ({ page }) => {
        await page.goto('/day/2025-11-03');
        await settle(page);
        await page.keyboard.press('Escape');
        await expect(page).toHaveURL(/\/month\/2025-11$/);
        await settle(page);
        await page.screenshot({ path: shot('month-from-day') });
      });

      test('year after zooming out of a month', async ({ page }) => {
        await page.goto('/month/2025-11');
        await settle(page);
        await page.keyboard.press('Escape');
        await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
        await settle(page);
        await page.screenshot({ path: shot('year-from-month') });
      });

      test('day app bar', async ({ page }) => {
        await page.goto('/day/2025-11-03');
        await settle(page);
        await page
          .locator('header')
          .first()
          .screenshot({ path: shot('day-app-bar') });
      });

      test('previews', async ({ page }) => {
        test.skip(viewport.width < 640, 'hover previews are a desktop surface');
        await page.goto('/month/2025-11');
        await settle(page);
        await page.locator('a[data-date="2025-11-03"]:visible').hover();
        await page.waitForTimeout(500);
        await page.screenshot({ path: shot('month-preview') });
        await page.goto('/');
        await settle(page);
        await page.locator('a[data-date="2025-11-03"]').hover();
        await page.waitForTimeout(500);
        await page.screenshot({ path: shot('year-preview') });
      });
    });
  }
}
