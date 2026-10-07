import { expect, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { readPrefs, setPrefs } from './support/library';
import {
  canvasWrap,
  gotoStudy,
  prepareRun,
  studyOptions,
  type ThreeRun,
} from './support/study';

const RUN = { renderer: 'three-tsl', backend: 'webgl2' } as const;
const FALLBACK_RUNS: readonly ThreeRun[] = [
  RUN,
  { renderer: 'three-glsl', backend: 'webgl2' },
];
const TOAST = "3D isn't available here, showing the CSS study";

test.describe('Study without WebGL or WebGPU', () => {
  for (const run of FALLBACK_RUNS) {
    test(`${run.renderer} falls back to the CSS study once per tab`, async ({
      page,
      context,
    }) => {
      await setPrefs(context, { renderer: 'three-tsl' });
      await prepareRun(page, run);
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
      await gotoStudy(page, run);

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
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`the fallback has no axe violations in ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await prepareRun(page, RUN);
      await gotoStudy(page, RUN, 'debug=1');
      await expect(page.locator('[data-study-ready]')).toHaveAttribute(
        'data-renderer',
        'css',
      );
      await expect(page.getByText(TOAST)).toHaveCount(1);
      await page.locator('[data-sonner-toast]').hover();
      await expect(page.locator('[data-backend-badge]')).toHaveText('css');
      await expectNoViolations(page, {
        ignore: [
          { rule: 'scrollable-region-focusable', targetIncludes: '.st-row' },
        ],
      });
    });
  }

  test('after the fallback the Renderer select shows CSS and the cookie keeps three-tsl', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'study', renderer: 'three-tsl' });
    await prepareRun(page, RUN);
    await page.goto('/?groupBy=series');
    await expect(page.locator('[data-study-ready]')).toHaveAttribute(
      'data-renderer',
      'css',
    );
    const trigger = page.getByRole('combobox', { name: 'Renderer' });
    await expect(trigger).toContainText('CSS');
    await expect(trigger).not.toContainText('three.js');
    expect((await readPrefs(context))?.['renderer']).toBe('three-tsl');
  });

  test('a three-glsl cookie falls back to the CSS study and keeps the cookie', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'study', renderer: 'three-glsl' });
    await page.goto('/?groupBy=series');
    const study = page.locator('[data-study-ready]');
    await expect(study).toHaveAttribute('data-renderer', 'css');
    await expect(study).toHaveAttribute('data-backend', 'css');
    await expect(canvasWrap(page)).toHaveCount(0);
    await expect(page.getByText(TOAST)).toHaveCount(1);
    await expect(
      page.getByRole('combobox', { name: 'Renderer' }),
    ).toContainText('CSS');
    expect((await readPrefs(context))?.['renderer']).toBe('three-glsl');
  });

  test('choosing CSS in the Renderer select writes it to the cookie', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'study', renderer: 'three-tsl' });
    await prepareRun(page, RUN);
    await page.goto('/?groupBy=series');
    await expect(page.locator('[data-study-ready]')).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Renderer' }).click();
    await page.getByRole('option', { name: 'CSS', exact: true }).click();
    await expect
      .poll(async () => (await readPrefs(context))?.['renderer'])
      .toBe('css');
  });
});
