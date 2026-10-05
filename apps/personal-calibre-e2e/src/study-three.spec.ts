import { expect, type Page, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { readPrefs, setPrefs, tokenColor } from './support/library';
import { COVER_IDS } from './support/seed';
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

interface AtlasInfo {
  textures: number;
  coversCached: number;
  texturesSizeReported: number;
  atlasPpu: number | null;
  atlasFits: boolean | null;
  atlasBytes: number;
  atlasBytesEstimated: number;
  textureBytesEstimated: number;
  atlasRows: number;
  rows: number;
  lastAtlasAt: number | null;
  firstFrameAt: number | null;
}

const ATLAS_PPU_LADDER = [160, 128, 112, 96];

const atlasInfo = (page: Page) =>
  page.evaluate(() => {
    const study = (
      window as Window & {
        __calibreStudy?: {
          firstFrameAt: number | null;
          info: () => Omit<AtlasInfo, 'firstFrameAt'>;
        };
      }
    ).__calibreStudy;
    return study ? { ...study.info(), firstFrameAt: study.firstFrameAt } : null;
  });

async function allAtlases(page: Page, timeout = 3_000): Promise<AtlasInfo> {
  await expect
    .poll(
      async () => {
        const info = await atlasInfo(page);
        return info !== null && info.rows > 0 && info.atlasRows === info.rows;
      },
      { timeout },
    )
    .toBe(true);
  const info = await atlasInfo(page);
  if (!info) throw new Error('the study probe is missing');
  return info;
}

test.describe('Study three-tsl atlas', () => {
  test('visible rows draw first and every row has an atlas within 3 s', async ({
    page,
  }) => {
    const run = projectRun();
    await prepare(page, run);
    await page.setViewportSize({ width: 1100, height: 560 });
    const messages = collectConsole(page);
    await gotoStudy(page, run, 'debug=1&__pageSize=250');

    const info = await allAtlases(page);
    console.log(`[atlas] ${run.backend} ${JSON.stringify(info)}`);
    expect(info.rows).toBeGreaterThan(2);
    expect(ATLAS_PPU_LADDER).toContain(info.atlasPpu);
    expect(info.firstFrameAt).not.toBeNull();
    expect(info.lastAtlasAt).toBeGreaterThan(info.firstFrameAt ?? Infinity);
    expect(
      Math.abs(info.atlasBytes - info.atlasBytesEstimated) /
        info.atlasBytesEstimated,
    ).toBeLessThanOrEqual(0.01);
    expect(messages()).toEqual([]);
  });

  test('the default page keeps 160 px per unit', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run, 'debug=1');

    const info = await allAtlases(page);
    expect(info.atlasPpu).toBe(160);
    expect(info.atlasFits).toBe(true);
    expect(info.atlasBytes).toBeCloseTo(info.atlasBytesEstimated, 0);
  });

  test('page changes dispose the previous atlases', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoStudy(page, run, 'debug=1');

    await studyOptions(page).first().focus();
    const first = await allAtlases(page);
    const others = first.textures - first.atlasRows - first.coversCached;
    for (const [key, want] of [
      [']', 'page=2'],
      [']', 'page=3'],
      ['[', 'page=2'],
    ] as const) {
      await page.keyboard.press(key);
      await page.waitForURL((url) => url.search.includes(want));
      await expect(studyOptions(page).first()).toBeFocused();
      await allAtlases(page);
      await expect
        .poll(async () => {
          const info = await atlasInfo(page);
          return info ? info.textures - info.atlasRows - info.coversCached : -1;
        })
        .toBe(others);
    }
  });
});

type CoverProbeWindow = Window & {
  __calibreStudy?: {
    prewarmedAt: number | null;
    renderMs: number[];
    info: () => { coversCached: number };
  };
};

const coverRequests = (page: Page): (() => number[]) => {
  const ids: number[] = [];
  page.on('request', (request) => {
    const match = /\/api\/books\/(\d+)\/cover$/.exec(
      new URL(request.url()).pathname,
    );
    if (match && request.method() === 'GET') ids.push(Number(match[1]));
  });
  return () => [...ids];
};

const prewarmed = (page: Page) =>
  expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as CoverProbeWindow).__calibreStudy?.prewarmedAt ?? null,
        ),
      { timeout: 10_000 },
    )
    .not.toBeNull();

const coversCached = (page: Page) =>
  page.evaluate(
    () =>
      (window as CoverProbeWindow).__calibreStudy?.info().coversCached ?? -1,
  );

const overlay = (page: Page) => page.locator('[data-focus-overlay]');

async function expectOverlayInCanvas(page: Page): Promise<void> {
  await expect(overlay(page)).toBeVisible();
  const box = await overlay(page).boundingBox();
  const canvas = await canvasWrap(page).boundingBox();
  if (!box || !canvas) throw new Error('no overlay or canvas box');
  expect(box.width).toBeGreaterThan(4);
  expect(box.height).toBeGreaterThan(4);
  expect(box.x).toBeGreaterThanOrEqual(canvas.x - 0.5);
  expect(box.y).toBeGreaterThanOrEqual(canvas.y - 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(
    canvas.y + canvas.height + 0.5,
  );
}

async function tabIntoListbox(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const role = await page.evaluate(() =>
      document.activeElement?.getAttribute('role'),
    );
    if (role === 'option') return;
  }
  throw new Error('Tab never reached the listbox');
}

test.describe('Study three-tsl overlay and headings', () => {
  test('the focus overlay is visible and inside the canvas', async ({
    page,
  }) => {
    const run = projectRun();
    await prepare(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run, 'debug=1');

    await expect(overlay(page)).toBeHidden();
    await tabIntoListbox(page);
    await expectOverlayInCanvas(page);
    const before = await overlay(page).boundingBox();

    await page.keyboard.press('ArrowDown');
    await settledCamera(page);
    await expectOverlayInCanvas(page);
    await expect
      .poll(async () => (await overlay(page).boundingBox())?.y)
      .not.toBe(before?.y);

    const ids = await optionIds(page);
    const id = ids[2];
    if (id === undefined) throw new Error('no third book');
    const [rect] = await projectBooks(page, [id]);
    if (!rect) throw new Error('the probe projects no rect');
    await page.mouse.click(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    await expect(
      studyOptions(page).and(page.locator(`[data-book-id="${id}"]`)),
    ).toBeFocused();
    await expect(overlay(page)).toBeHidden();
    expect(messages()).toEqual([]);
  });

  test('the overlay outline is foreground', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run);

    await tabIntoListbox(page);
    await expect(overlay(page)).toBeVisible();
    const foreground = await tokenColor(page, '--foreground');
    const style = await overlay(page).evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        color: computed.outlineColor,
        width: computed.outlineWidth,
        bar: getComputedStyle(element.firstElementChild as Element)
          .backgroundColor,
      };
    });
    expect(style.color).toBe(foreground);
    expect(Number.parseFloat(style.width)).toBeGreaterThanOrEqual(2);
    expect(style.bar).toBe(foreground);
  });

  test('shelf headings show labels and counts', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run, 'debug=1');

    const labels = page.locator('[data-shelf-labels]');
    await expect(labels).toHaveAttribute('aria-hidden', 'true');
    const northbound = labels
      .locator('[data-shelf-label]')
      .filter({ hasText: /^Northbound/ })
      .first();
    await expect(northbound).toBeVisible();
    await expect(northbound).toContainText('20 books');
    const canvas = await canvasWrap(page).boundingBox();
    const box = await northbound.boundingBox();
    if (!canvas || !box) throw new Error('no label box');
    expect(box.y).toBeGreaterThanOrEqual(canvas.y);
    expect(box.y).toBeLessThan(canvas.y + canvas.height);

    await gotoStudy(page, run, 'debug=1&page=2');
    const first = labels.locator('[data-shelf-label]').first();
    await expect(first).toContainText('(continued)');
    await expect(first.locator('span').first()).toHaveClass(
      /text-muted-foreground/,
    );
  });
});

test.describe('Study three-tsl covers', () => {
  test('the pulled book shows the fixture cover', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    const requests = coverRequests(page);
    const messages = collectConsole(page);
    await gotoStudy(page, run, 'debug=1');
    await prewarmed(page);

    const covered = COVER_IDS[0];
    if (covered === undefined) throw new Error('no fixture cover');
    await page.locator(`[role="option"][data-book-id="${covered}"]`).focus();
    await expect(canvasWrap(page)).toHaveAttribute(
      'data-pulled-id',
      `${covered}`,
    );
    await expect.poll(() => coversCached(page)).toBeGreaterThanOrEqual(1);
    expect(requests()).toContain(covered);

    const plain = (await optionIds(page)).find((id) => !COVER_IDS.includes(id));
    if (plain === undefined) throw new Error('no book without a cover');
    await page.locator(`[role="option"][data-book-id="${plain}"]`).focus();
    await expect(canvasWrap(page)).toHaveAttribute(
      'data-pulled-id',
      `${plain}`,
    );
    await expect.poll(() => coversCached(page)).toBeGreaterThanOrEqual(2);
    expect(requests()).not.toContain(plain);
    expect(requests().every((id) => COVER_IDS.includes(id))).toBe(true);
    expect(messages()).toEqual([]);
  });

  test("the next page's covers are prefetched", async ({ page, browser }) => {
    const run = projectRun();
    const idsOn = async (pageNumber: number) => {
      const context = await browser.newContext();
      const probe = await context.newPage();
      await probe.goto(
        `/?view=study&groupBy=series&renderer=css&page=${pageNumber}`,
      );
      await expect(probe.locator('[data-study-ready]')).toHaveCount(1);
      const ids = await studyOptions(probe).evaluateAll((elements) =>
        elements.map((element) =>
          Number((element as HTMLElement).dataset['bookId']),
        ),
      );
      await context.close();
      return ids;
    };
    const next = await idsOn(2);
    const nextCovered = next.filter((id) => COVER_IDS.includes(id));
    expect(nextCovered.length).toBeGreaterThan(0);
    const lastPage = await idsOn(3);

    await prepare(page, run);
    const requests = coverRequests(page);
    await gotoStudy(page, run, 'debug=1');
    await prewarmed(page);
    await expect
      .poll(() => nextCovered.filter((id) => !requests().includes(id)))
      .toEqual([]);
    const uncovered = next.filter((id) => !COVER_IDS.includes(id));
    expect(requests().filter((id) => uncovered.includes(id))).toEqual([]);

    const onLast = coverRequests(page);
    await gotoStudy(page, run, 'debug=1&page=3');
    await prewarmed(page);
    await page.waitForTimeout(1_000);
    expect(onLast().filter((id) => !lastPage.includes(id))).toEqual([]);
  });

  test('the first pull after prewarm has no render spike', async ({ page }) => {
    const run = projectRun();
    await prepare(page, run);
    await gotoStudy(page, run, 'debug=1');
    await prewarmed(page);

    await studyOptions(page).first().focus();
    await expect(canvasWrap(page)).not.toHaveAttribute('data-pulled-id', '');
    await page.evaluate(() => {
      const study = (window as CoverProbeWindow).__calibreStudy;
      if (study) study.renderMs.length = 0;
    });
    for (let pull = 0; pull < 5; pull++) {
      const before = await activeBookId(page);
      await page.keyboard.press('ArrowRight');
      const after = await activeBookId(page);
      expect(after).not.toBe(before);
      await expect(canvasWrap(page)).toHaveAttribute(
        'data-pulled-id',
        after ?? '',
      );
      await page.waitForTimeout(400);
    }
    const max = await page.evaluate(() =>
      Math.max(
        ...((window as CoverProbeWindow).__calibreStudy?.renderMs ?? []),
      ),
    );
    console.log(`[prewarm] ${run.backend} max render ${max.toFixed(1)} ms`);
    if (run.backend === 'webgpu') expect(max).toBeLessThanOrEqual(25);
  });
});
