import { expect, test } from '@playwright/test';

import { readPrefs, setPrefs } from './support/library';
import {
  canvasWrap,
  gotoStudy,
  prepareRun,
  studyOptions,
} from './support/study';

const RUN = { renderer: 'three-tsl', backend: 'webgl2' } as const;
const TOAST = "3D isn't available here, showing the CSS study";

test.describe('Study without WebGL or WebGPU', () => {
  test('three-tsl falls back to the CSS study once per tab', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { renderer: 'three-tsl' });
    await prepareRun(page, RUN);
    const scripts: Promise<string | null>[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'script') return;
      scripts.push(
        response.text().then(
          (body) =>
            /isWebGLRenderer|isWebGPURenderer/.test(body)
              ? response.url()
              : null,
          () => null,
        ),
      );
    });
    await gotoStudy(page, RUN);

    const study = page.locator('[data-study-ready]');
    await expect(study).toHaveAttribute('data-renderer', 'css');
    await expect(study).toHaveAttribute('data-backend', 'css');
    await expect(canvasWrap(page)).toHaveCount(0);
    await expect(studyOptions(page).first()).toBeVisible();
    await expect(page.getByText(TOAST)).toHaveCount(1);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('calibre-study-fallback'),
      ),
    ).toBe('1');

    await page.reload();
    await expect(page.locator('[data-library-ready]')).toHaveCount(1);
    await expect(study).toHaveAttribute('data-renderer', 'css');
    await expect(studyOptions(page).first()).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByText(TOAST)).toHaveCount(0);

    expect((await readPrefs(context))?.['renderer']).toBe('three-tsl');
    expect((await Promise.all(scripts)).filter(Boolean)).toEqual([]);
  });
});
