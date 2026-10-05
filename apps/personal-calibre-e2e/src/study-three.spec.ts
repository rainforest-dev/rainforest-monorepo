import { expect, type Page, test } from '@playwright/test';

import { readPrefs, setPrefs } from './support/library';
import {
  canvasWrap,
  collectConsole,
  gotoStudy,
  hasWebGpu,
  prepareRun,
  studyOptions,
  type StudyRun,
} from './support/study';

type ThreeRun = Extract<StudyRun, { renderer: 'three-tsl' }>;

const BADGES = {
  webgpu: 'three-tsl · WebGPU',
  webgl2: 'three-tsl · WebGL2 fallback',
} as const;

function projectRun(): ThreeRun {
  return test.info().project.name === 'study-webgpu'
    ? { renderer: 'three-tsl', backend: 'webgpu' }
    : { renderer: 'three-tsl', backend: 'webgl2' };
}

async function prepare(page: Page, run: ThreeRun): Promise<void> {
  await prepareRun(page, run);
  if (run.backend === 'webgpu') {
    await page.goto('/favicon.ico');
    test.skip(!(await hasWebGpu(page)), 'this browser has no WebGPU adapter');
  }
}

test.describe('Study three-tsl', () => {
  test('mounts an aria-hidden canvas on the expected backend', async ({
    page,
    context,
  }) => {
    const run = projectRun();
    await setPrefs(context, { renderer: 'css' });
    await prepare(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run);

    const wrap = canvasWrap(page);
    await expect(wrap).toHaveAttribute('data-renderer', 'three-tsl');
    await expect(wrap).toHaveAttribute('data-backend', run.backend);
    await expect(wrap.locator('[aria-hidden="true"] canvas')).toHaveCount(1);
    await expect(page.locator('[data-backend-badge]')).toHaveCount(0);
    expect(await page.evaluate(() => '__calibreStudy' in window)).toBe(false);
    expect((await readPrefs(context))?.['renderer']).toBe('css');
    expect(messages()).toEqual([]);
  });

  test('?debug shows the backend badge and the probe', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run, 'debug=1');

    await expect(page.locator('[data-backend-badge]')).toHaveText(
      BADGES[run.backend],
    );
    const probe = await page.evaluate(() => {
      const study = (
        window as Window & {
          __calibreStudy?: {
            firstFrameAt: number | null;
            info: () => { backend: string; drawCalls: number };
          };
        }
      ).__calibreStudy;
      return study
        ? { firstFrameAt: study.firstFrameAt, ...study.info() }
        : null;
    });
    expect(probe?.firstFrameAt).not.toBeNull();
    expect(probe?.backend).toBe(run.backend);
    expect(probe?.drawCalls).toBeGreaterThan(0);
  });

  test('programs do not grow during a 40-step sweep', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run, 'debug=1');

    const programs = () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const study = (
                  window as Window & {
                    __calibreStudy?: { info: () => { programs: number } };
                  }
                ).__calibreStudy;
                resolve(study?.info().programs ?? -1);
              }),
            );
          }),
      );
    const before = await programs();
    expect(before).toBeGreaterThan(0);

    await studyOptions(page).first().focus();
    const keys = ['ArrowRight', 'x', 'ArrowDown', 'ArrowRight', 'x', 'End'];
    for (let step = 0; step < 40; step++) {
      await page.keyboard.press(keys[step % keys.length] ?? 'ArrowRight');
    }
    await expect(
      studyOptions(page).and(page.locator('[aria-selected="true"]')),
    ).not.toHaveCount(0);

    expect(await programs()).toBe(before);
    expect(messages()).toEqual([]);
  });

  test('a renderer that throws while starting falls back to the CSS study', async ({
    page,
    context,
  }) => {
    test.skip(
      test.info().project.name !== 'chromium',
      'the forced failure runs on the WebGL2 path only',
    );
    await setPrefs(context, { renderer: 'three-tsl' });
    await prepareRun(page, { renderer: 'three-tsl', backend: 'webgl2' });
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: function (this: HTMLCanvasElement, type: string, ...rest: []) {
          if (this.isConnected && (type === 'webgl2' || type === 'webgpu')) {
            throw new Error('forced start failure');
          }
          return getContext.call(this, type as '2d', ...rest);
        },
      });
    });
    await page.goto('/?view=study&groupBy=series&renderer=three-tsl');

    await expect(page.locator('[data-study-ready]')).toHaveAttribute(
      'data-renderer',
      'css',
    );
    await expect(
      page.getByText("3D isn't available here, showing the CSS study"),
    ).toHaveCount(1);
    await expect(canvasWrap(page)).toHaveCount(0);
    expect((await readPrefs(context))?.['renderer']).toBe('three-tsl');
  });
});
