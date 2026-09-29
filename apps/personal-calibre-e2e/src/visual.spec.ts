import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const PHASE = process.env['CALIBRE_VISUAL'];
const OUT = path.join(__dirname, '..', 'test-output', 'visual');
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false, scale: 1 },
  { name: 'phone', width: 390, height: 844, isMobile: true, scale: 2 },
] as const;

interface Surface {
  name: string;
  url: string;
  afterOnly?: true;
  phoneOnly?: true;
  act?: (page: Page, phone: boolean) => Promise<void>;
}

const SURFACES: Surface[] = [
  { name: 'library', url: '/' },
  { name: 'grouped', url: '/?groupBy=series' },
  { name: 'page-2', url: '/?page=2' },
  { name: 'book', url: '/books/38' },
  { name: 'pane', url: '/?book=38', afterOnly: true },
  { name: 'catalogue', url: '/?view=catalogue', afterOnly: true },
  { name: 'catalogue-pane', url: '/?view=catalogue&book=38', afterOnly: true },
  {
    name: 'selection',
    url: '/',
    afterOnly: true,
    act: async (page, phone) => {
      const tiles = page
        .getByRole('listbox', { name: 'Books' })
        .getByRole('option');
      if (phone) {
        await page.getByRole('button', { name: 'Select', exact: true }).click();
        await tiles.nth(0).click();
        await tiles.nth(1).click();
      } else {
        await tiles.nth(0).focus();
        await page.keyboard.press('x');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('x');
      }
    },
  },
  {
    name: 'filters-sheet',
    url: '/',
    afterOnly: true,
    phoneOnly: true,
    act: async (page) => {
      await page.getByRole('button', { name: /^Filters/ }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    },
  },
];

test.skip(
  PHASE !== 'before' && PHASE !== 'after',
  'captures run with CALIBRE_VISUAL=before or CALIBRE_VISUAL=after',
);
test.describe.configure({ mode: 'serial' });

const settle = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
};

for (const scheme of SCHEMES) {
  for (const vp of VIEWPORTS) {
    test.describe(`visual ${scheme} ${vp.name}`, () => {
      test.use({
        colorScheme: scheme,
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        deviceScaleFactor: vp.scale,
      });
      for (const surface of SURFACES) {
        test(surface.name, async ({ page }) => {
          test.skip(PHASE === 'before' && !!surface.afterOnly, 'after-only');
          test.skip(!!surface.phoneOnly && !vp.isMobile, 'phone-only');
          await page.goto(surface.url);
          await settle(page);
          await surface.act?.(page, vp.isMobile);
          await settle(page);
          await page.screenshot({
            path: path.join(
              OUT,
              `${PHASE}-${surface.name}-${scheme}-${vp.width}.png`,
            ),
            fullPage: true,
          });
        });
      }
    });
  }
}
