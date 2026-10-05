import { writeFile } from 'node:fs/promises';

import { type Browser, expect, type Page, test } from '@playwright/test';

import { diffScreenshots } from './support/pixels';
import {
  canvasWrap,
  collectConsole,
  gotoStudy,
  hasWebGpu,
  prepareRun,
  studyOptions,
} from './support/study';

const VIEWPORT = { width: 1440, height: 900 };
const MAX_RATIO = 0.003;

type Scheme = 'light' | 'dark';
type Backend = 'webgpu' | 'webgl2';

interface SettleState {
  rows: number;
  atlasRows: number;
  coversCached: number;
  prewarmedAt: number | null;
  cameraY: number | null;
}

const settleState = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<SettleState | null>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const study = (
              window as Window & {
                __calibreStudy?: {
                  prewarmedAt: number | null;
                  camera: { y: number } | null;
                  info: () => {
                    rows: number;
                    atlasRows: number;
                    coversCached: number;
                  };
                };
              }
            ).__calibreStudy;
            if (!study) return resolve(null);
            const { rows, atlasRows, coversCached } = study.info();
            resolve({
              rows,
              atlasRows,
              coversCached,
              prewarmedAt: study.prewarmedAt,
              cameraY: study.camera?.y ?? null,
            });
          }),
        );
      }),
  );

async function settle(page: Page): Promise<void> {
  const seen: { last: string | null } = { last: null };
  await expect
    .poll(
      async () => {
        const state = await settleState(page);
        const ready =
          state !== null &&
          state.rows > 0 &&
          state.atlasRows === state.rows &&
          state.prewarmedAt !== null;
        const key = JSON.stringify(state);
        const stable = ready && key === seen.last;
        seen.last = key;
        return stable;
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(true);
}

async function capture(
  browser: Browser,
  scheme: Scheme,
  backend: Backend,
): Promise<Buffer> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    colorScheme: scheme,
  });
  try {
    const page = await context.newPage();
    const run = { renderer: 'three-tsl', backend } as const;
    await prepareRun(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run, 'debug=1');
    await expect(canvasWrap(page)).toHaveAttribute('data-backend', backend);
    for (let i = 0; i < 40; i++) {
      const role = await page.evaluate(() =>
        document.activeElement?.getAttribute('role'),
      );
      if (role === 'option') break;
      await page.keyboard.press('Tab');
    }
    await expect(studyOptions(page).first()).toBeFocused();
    await expect(canvasWrap(page)).toHaveAttribute('data-pulled-id', '');
    await settle(page);
    const shot = await canvasWrap(page).locator('canvas').screenshot({
      animations: 'disabled',
      caret: 'hide',
    });
    expect(messages()).toEqual([]);
    return shot;
  } finally {
    await context.close();
  }
}

test.describe('Study parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/favicon.ico');
    test.skip(!(await hasWebGpu(page)), 'this browser has no WebGPU adapter');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`WebGPU and the WebGL2 fallback match, ${scheme}`, async ({
      browser,
      page,
    }, testInfo) => {
      const webgpu = await capture(browser, scheme, 'webgpu');
      const webgl2 = await capture(browser, scheme, 'webgl2');
      for (const [backend, body] of [
        ['webgpu', webgpu],
        ['webgl2', webgl2],
      ] as const) {
        const path = testInfo.outputPath(`${scheme}-${backend}.png`);
        await writeFile(path, body);
        await testInfo.attach(`${scheme}-${backend}.png`, {
          path,
          contentType: 'image/png',
        });
      }

      const diff = await diffScreenshots(page, webgpu, webgl2);
      console.log(
        `[parity] ${scheme} ${(diff.ratio * 100).toFixed(3)}% (${diff.mismatched}/${diff.total}), off edge ${diff.offEdge}`,
      );
      await testInfo.attach(`${scheme}-diff.json`, {
        body: JSON.stringify(diff),
        contentType: 'application/json',
      });
      expect(diff.ratio).toBeLessThanOrEqual(MAX_RATIO);
      expect(diff.offEdge).toBe(0);
    });
  }
});
