import { writeFile } from 'node:fs/promises';

import { type Browser, expect, type Page, test } from '@playwright/test';

import { diffScreenshots } from './support/pixels';
import { COVER_IDS } from './support/seed';
import {
  canvasWrap,
  collectConsole,
  gotoStudy,
  hasWebGpu,
  prepareRun,
  runName,
  studyOptions,
  type ThreeRun,
} from './support/study';

const VIEWPORT = { width: 1440, height: 900 };
const PULLED_INDEX = 4;

type Scheme = 'light' | 'dark';
type ParityPose = 'shelf' | 'pulled' | 'inspect';

interface ParityPair {
  reference: ThreeRun;
  candidate: ThreeRun;
  poses: readonly ParityPose[];
}

const POSE_LIMITS: Record<
  ParityPose,
  { maxRatio: number; maxOffEdge: number }
> = {
  shelf: { maxRatio: 0.003, maxOffEdge: 0 },
  pulled: { maxRatio: 0.003, maxOffEdge: 0 },
  inspect: { maxRatio: 0.005, maxOffEdge: 0 },
};

const TSL_WEBGPU: ThreeRun = { renderer: 'three-tsl', backend: 'webgpu' };
const TSL_WEBGL2: ThreeRun = { renderer: 'three-tsl', backend: 'webgl2' };
const GLSL: ThreeRun = { renderer: 'three-glsl', backend: 'webgl2' };

const PARITY_PAIRS: readonly ParityPair[] = [
  { reference: TSL_WEBGPU, candidate: TSL_WEBGL2, poses: ['shelf'] },
  {
    reference: TSL_WEBGL2,
    candidate: GLSL,
    poses: ['shelf', 'pulled', 'inspect'],
  },
  {
    reference: TSL_WEBGPU,
    candidate: GLSL,
    poses: ['shelf', 'pulled', 'inspect'],
  },
];

const needsWebGpu = (pair: ParityPair) =>
  [pair.reference, pair.candidate].some((run) => run.backend === 'webgpu');

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

async function stableShot(page: Page): Promise<Buffer> {
  const canvas = canvasWrap(page).locator('canvas');
  const shoot = () =>
    canvas.screenshot({ animations: 'disabled', caret: 'hide' });
  let last = await shoot();
  for (let attempt = 0; attempt < 40; attempt++) {
    await page.waitForTimeout(250);
    const next = await shoot();
    if (next.equals(last)) return next;
    last = next;
  }
  throw new Error('the canvas never settled');
}

async function focusFirstOption(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const role = await page.evaluate(() =>
      document.activeElement?.getAttribute('role'),
    );
    if (role === 'option') break;
    await page.keyboard.press('Tab');
  }
  await expect(studyOptions(page).first()).toBeFocused();
}

async function pose(page: Page, name: ParityPose): Promise<void> {
  await focusFirstOption(page);
  if (name === 'shelf') {
    await expect(canvasWrap(page)).toHaveAttribute('data-pulled-id', '');
    return;
  }
  if (name === 'pulled') {
    for (let i = 0; i < PULLED_INDEX; i++) {
      await page.keyboard.press('ArrowRight');
    }
    const target = studyOptions(page).nth(PULLED_INDEX);
    await expect(target).toBeFocused();
    const id = await target.getAttribute('data-book-id');
    await expect(canvasWrap(page)).toHaveAttribute('data-pulled-id', id ?? '');
    return;
  }
  const ids = await studyOptions(page).evaluateAll((elements) =>
    elements.map((element) => Number(element.getAttribute('data-book-id'))),
  );
  const covered = ids.find((id) => COVER_IDS.includes(id));
  if (covered === undefined) throw new Error('no covered book on the page');
  await studyOptions(page)
    .and(page.locator(`[data-book-id="${covered}"]`))
    .focus();
  const card = page.locator('[data-study-card]');
  await expect(card).toHaveAttribute('data-book-id', `${covered}`);
  await card.locator('[data-study-card-thumb]').click();
  const slider = page
    .getByRole('dialog', { name: /3D view/ })
    .getByRole('slider');
  await expect(slider).toBeFocused();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(canvasWrap(page)).toHaveAttribute(
    'data-inspecting-id',
    `${covered}`,
  );
}

const captures = new Map<string, Promise<Buffer>>();

function capture(
  browser: Browser,
  run: ThreeRun,
  name: ParityPose,
  scheme: Scheme,
): Promise<Buffer> {
  const key = `${runName(run)}:${name}:${scheme}`;
  const cached = captures.get(key);
  if (cached) return cached;
  const shot = shootPose(browser, run, name, scheme);
  captures.set(key, shot);
  shot.catch(() => captures.delete(key));
  return shot;
}

async function shootPose(
  browser: Browser,
  run: ThreeRun,
  name: ParityPose,
  scheme: Scheme,
): Promise<Buffer> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    reducedMotion: name === 'pulled' ? 'no-preference' : 'reduce',
    colorScheme: scheme,
  });
  try {
    const page = await context.newPage();
    await prepareRun(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run, 'debug=1');
    await expect(canvasWrap(page)).toHaveAttribute('data-backend', run.backend);
    await pose(page, name);
    await settle(page);
    const shot = await stableShot(page);
    expect(messages()).toEqual([]);
    return shot;
  } finally {
    await context.close();
  }
}

test.describe('Study parity', () => {
  for (const pair of PARITY_PAIRS) {
    const label = `${runName(pair.reference)} vs ${runName(pair.candidate)}`;
    for (const name of pair.poses) {
      for (const scheme of ['light', 'dark'] as const) {
        test(`${label}, ${name}, ${scheme}`, async ({
          browser,
          page,
        }, testInfo) => {
          test.skip(
            needsWebGpu(pair) && testInfo.project.name !== 'study-webgpu',
            'WebGPU pairs run on the headed study-webgpu project',
          );
          await page.goto('/favicon.ico');
          if (needsWebGpu(pair)) {
            test.skip(
              !(await hasWebGpu(page)),
              'this browser has no WebGPU adapter',
            );
          }

          const reference = await capture(
            browser,
            pair.reference,
            name,
            scheme,
          );
          const candidate = await capture(
            browser,
            pair.candidate,
            name,
            scheme,
          );
          for (const [run, body] of [
            [pair.reference, reference],
            [pair.candidate, candidate],
          ] as const) {
            const file = `${name}-${scheme}-${runName(run)}.png`;
            const path = testInfo.outputPath(file);
            await writeFile(path, body);
            await testInfo.attach(file, { path, contentType: 'image/png' });
          }

          const diff = await diffScreenshots(page, reference, candidate);
          console.log(
            `[parity] ${label} ${name} ${scheme} ${(diff.ratio * 100).toFixed(3)}% (${diff.mismatched}/${diff.total}), off edge ${diff.offEdge}`,
          );
          await testInfo.attach(`${name}-${scheme}-diff.json`, {
            body: JSON.stringify(diff),
            contentType: 'application/json',
          });
          const limits = POSE_LIMITS[name];
          expect(diff.ratio).toBeLessThanOrEqual(limits.maxRatio);
          expect(diff.offEdge).toBeLessThanOrEqual(limits.maxOffEdge);
        });
      }
    }
  }
});
