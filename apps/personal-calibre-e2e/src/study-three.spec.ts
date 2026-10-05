import { expect, type Page, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
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

interface ProbeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ProbeCamera {
  y: number;
  bounds: { minY: number; maxY: number };
}

type ProbeWindow = Window & {
  __calibreStudy?: {
    camera: ProbeCamera | null;
    projectBook: (bookId: number) => ProbeRect | null;
  };
};

const activeBookId = (page: Page) =>
  page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset['bookId'],
  );

const optionIds = (page: Page) =>
  studyOptions(page).evaluateAll((elements) =>
    elements.map((element) =>
      Number((element as HTMLElement).dataset['bookId']),
    ),
  );

const projectBooks = (page: Page, ids: number[]) =>
  page.evaluate(
    (bookIds) =>
      bookIds.map(
        (id) => (window as ProbeWindow).__calibreStudy?.projectBook(id) ?? null,
      ),
    ids,
  );

const cameraState = (page: Page) =>
  page.evaluate(() => (window as ProbeWindow).__calibreStudy?.camera ?? null);

async function settledCamera(page: Page): Promise<ProbeCamera> {
  const seen: { last: ProbeCamera | null } = { last: null };
  await expect
    .poll(async () => {
      const next = await cameraState(page);
      const same = next !== null && next.y === seen.last?.y;
      seen.last = next;
      return same;
    })
    .toBe(true);
  if (!seen.last) throw new Error('the study probe has no camera');
  return seen.last;
}

const bottomOf = (rect: ProbeRect) => rect.top + rect.height;

async function pixelAt(
  page: Page,
  x: number,
  y: number,
): Promise<[number, number, number]> {
  const shot = await page.screenshot({
    clip: { x: Math.round(x) - 2, y: Math.round(y) - 2, width: 4, height: 4 },
    scale: 'css',
  });
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return [0, 0, 0] as [number, number, number];
    ctx.drawImage(bitmap, 0, 0);
    const [r = 0, g = 0, b = 0] = ctx.getImageData(1, 1, 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, shot.toString('base64'));
}

test.describe('Study three-tsl scene', () => {
  test('the pulled book follows focus', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run);

    const wrap = canvasWrap(page);
    await studyOptions(page).first().focus();
    let previous = await activeBookId(page);
    await expect(wrap).toHaveAttribute('data-pulled-id', previous ?? '');
    for (const key of ['ArrowRight', 'ArrowDown', 'End', 'Control+Home']) {
      await page.keyboard.press(key);
      const active = await activeBookId(page);
      expect(active, `${key} moves focus`).not.toBe(previous);
      await expect(wrap).toHaveAttribute('data-pulled-id', active ?? '');
      previous = active;
    }
    expect(messages()).toEqual([]);
  });

  test('keyboard moves follow the 3D layout rows', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoStudy(page, run, 'debug=1');

    await studyOptions(page).first().focus();
    const first = Number(await activeBookId(page));
    await page.keyboard.press('ArrowDown');
    const below = Number(await activeBookId(page));
    await page.keyboard.press('End');
    const rowEnd = Number(await activeBookId(page));
    await page.keyboard.press('Home');
    const rowStart = Number(await activeBookId(page));
    await page.keyboard.press('ArrowUp');
    const above = Number(await activeBookId(page));
    await settledCamera(page);

    const rects = await projectBooks(page, [
      first,
      below,
      rowEnd,
      rowStart,
      above,
    ]);
    const [a, b, end, start, up] = rects;
    if (!a || !b || !end || !start || !up) {
      throw new Error('the probe projects no rect');
    }
    expect(bottomOf(b)).toBeGreaterThan(bottomOf(a) + a.height / 2);
    for (const rect of [end, start]) {
      expect(Math.abs(bottomOf(rect) - bottomOf(b))).toBeLessThan(2);
    }
    expect(end.left).toBeGreaterThan(start.left);
    expect(start.left).toBeLessThanOrEqual(b.left);
    expect(Math.abs(bottomOf(up) - bottomOf(a))).toBeLessThan(2);
  });

  test('a click on a spine focuses its option', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run, 'debug=1');

    const ids = await optionIds(page);
    const firstRow = await projectBooks(page, ids.slice(0, 3));
    const third = firstRow[2];
    const id = ids[2];
    if (!third || id === undefined) throw new Error('no third book');
    for (const rect of firstRow) {
      expect(rect && Math.abs(bottomOf(rect) - bottomOf(third))).toBeLessThan(
        2,
      );
    }
    await page.mouse.move(
      third.left + third.width / 2,
      third.top + third.height / 2,
    );
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('canvas')?.style.cursor),
      )
      .toBe('pointer');
    await page.mouse.click(
      third.left + third.width / 2,
      third.top + third.height / 2,
    );
    await expect(
      studyOptions(page).and(page.locator(`[data-book-id="${id}"]`)),
    ).toBeFocused();
    await expect(canvasWrap(page)).toHaveAttribute('data-pulled-id', `${id}`);
  });

  test('reduced motion has no pull', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoStudy(page, run);

    await studyOptions(page).first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(studyOptions(page).nth(1)).toBeFocused();
    await expect(canvasWrap(page)).toHaveAttribute('data-pulled-id', '');
  });

  test('the camera follows focus inside the clamp', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run, 'debug=1');

    await studyOptions(page).first().focus();
    const top = await settledCamera(page);
    expect(top.bounds.minY).toBeLessThan(top.bounds.maxY);
    expect(top.y).toBeCloseTo(top.bounds.maxY, 5);

    await page.keyboard.press('Control+End');
    const bottom = await settledCamera(page);
    expect(bottom.y).toBeCloseTo(bottom.bounds.minY, 5);

    const box = await canvasWrap(page).boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -10);
    const panned = await settledCamera(page);
    expect(panned.y).toBeGreaterThan(bottom.y);
    expect(panned.y).toBeLessThanOrEqual(panned.bounds.maxY);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('the wheel scrolls the page at the clamp', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run, 'debug=1&series=1');

    const camera = await settledCamera(page);
    expect(camera.bounds.minY).toBe(camera.bounds.maxY);
    const box = await canvasWrap(page).boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    expect((await settledCamera(page)).y).toBe(camera.y);
  });

  test('the 3D study with a pulled book has no axe violations', async ({
    page,
  }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run);

    await studyOptions(page).first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(canvasWrap(page)).not.toHaveAttribute('data-pulled-id', '');
    await expectNoViolations(page);
  });

  test('scheme change recolours', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoStudy(page, run, 'debug=1');

    const [id] = await optionIds(page);
    if (id === undefined) throw new Error('no book');
    await settledCamera(page);
    const [rect] = await projectBooks(page, [id]);
    if (!rect) throw new Error('the probe projects no rect');
    const x = rect.left + rect.width / 2;
    const y = rect.top - 20;
    const light = await pixelAt(page, x, y);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect
      .poll(async () => {
        const dark = await pixelAt(page, x, y);
        return dark.reduce(
          (sum, c, i) => sum + Math.abs(c - (light[i] ?? 0)),
          0,
        );
      })
      .toBeGreaterThan(60);
  });
});
