import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import {
  canvasWrap,
  collectConsole,
  gotoStudy,
  prepareRun,
  studyOptions,
  type StudyRun,
} from './support/study';

type Rect = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };

const THREE: StudyRun = { renderer: 'three-tsl', backend: 'webgl2' };
const CSS: StudyRun = { renderer: 'css' };
const HOLD_MS = 600;

const card = (page: Page) => page.locator('[data-study-card]');
const dialog = (page: Page) => page.getByRole('dialog', { name: /3D view/ });
const slider = (page: Page) => dialog(page).getByRole('slider');
const thumb = (page: Page) =>
  card(page).getByRole('button', { name: /^Inspect .* in 3D$/ });

const optionIds = (page: Page) =>
  studyOptions(page).evaluateAll((elements) =>
    elements.map((element) => Number(element.getAttribute('data-book-id'))),
  );

function frontRect(page: Page, run: StudyRun, id: number): Promise<Rect> {
  return page.evaluate(
    ({ id, three }) => {
      if (three) {
        const probe = (
          window as Window & {
            __calibreStudy?: { projectFront: (id: number) => Rect | null };
          }
        ).__calibreStudy;
        const rect = probe?.projectFront(id);
        if (!rect) throw new Error(`book ${id} is not on screen`);
        return rect;
      }
      const element = document.querySelector(
        `[role="option"][data-book-id="${id}"] [data-spine]`,
      );
      if (!element) throw new Error(`no spine ${id}`);
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    },
    { id, three: run.renderer !== 'css' },
  );
}

async function tapAt(page: Page, rect: Rect) {
  await page.touchscreen.tap(
    rect.left + rect.width / 2,
    rect.top + rect.height * 0.6,
  );
}

async function pulledId(page: Page, run: StudyRun): Promise<string> {
  if (run.renderer !== 'css') {
    return (await canvasWrap(page).getAttribute('data-pulled-id')) ?? '';
  }
  return page.evaluate(
    () =>
      document.querySelector('[data-pulled]')?.getAttribute('data-book-id') ??
      '',
  );
}

async function pull(page: Page, run: StudyRun, id: number, still = false) {
  await tapAt(page, await frontRect(page, run, id));
  if (!still) await expect.poll(() => pulledId(page, run)).toBe(`${id}`);
  await expect(card(page)).toHaveAttribute('data-book-id', `${id}`);
}

async function openInspect(
  page: Page,
  run: StudyRun,
  id: number,
  still = false,
) {
  await pull(page, run, id, still);
  const box = await thumb(page).boundingBox();
  if (!box) throw new Error('no thumbnail');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.25);
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('[data-inspect-scrim]')).toBeVisible();
  if (run.renderer !== 'css') {
    await expect(canvasWrap(page)).toHaveAttribute(
      'data-inspecting-id',
      `${id}`,
    );
  }
}

async function stageRect(page: Page): Promise<Rect> {
  const box = await page.locator('[data-inspect-stage]').boundingBox();
  if (!box) throw new Error('no stage');
  return { left: box.x, top: box.y, width: box.width, height: box.height };
}

async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  point?: Point,
) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point ? [{ x: point.x, y: point.y }] : [],
  });
}

function inspectedRect(page: Page, run: StudyRun, id: number): Promise<Rect> {
  return page.evaluate(
    ({ id, three }) => {
      if (three) {
        const probe = (
          window as Window & {
            __calibreStudy?: { projectBook: (id: number) => Rect | null };
          }
        ).__calibreStudy;
        const rect = probe?.projectBook(id);
        if (!rect) throw new Error(`book ${id} is not on screen`);
        return rect;
      }
      const element = document.querySelector('[data-inspect] [data-css-book]');
      if (!element) throw new Error('no inspected book');
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    },
    { id, three: run.renderer !== 'css' },
  );
}

for (const run of [THREE, CSS]) {
  test.describe(`Study ${run.renderer} inspect on phone`, () => {
    test.beforeEach(async ({ page }) => {
      await prepareRun(page, run);
      await gotoStudy(page, run, 'debug=1');
    });

    test('the thumbnail opens inspect, a drag turns the book, a tap outside closes it', async ({
      page,
    }) => {
      const messages = collectConsole(page);
      const [a, b] = (await optionIds(page)).slice(2, 4);
      if (a === undefined || b === undefined) throw new Error('no books');
      await openInspect(page, run, a);

      const stage = await stageRect(page);
      await expect
        .poll(async () => (await inspectedRect(page, run, a)).height)
        .toBeGreaterThan(stage.height * 0.5);
      await expect(slider(page)).toHaveAttribute('aria-valuenow', '0');

      const scrollY = await page.evaluate(() => window.scrollY);
      const cdp = await page.context().newCDPSession(page);
      const centre = {
        x: stage.left + stage.width / 2,
        y: stage.top + stage.height / 2,
      };
      await touch(cdp, 'touchStart', centre);
      for (let step = 1; step <= 8; step += 1) {
        await touch(cdp, 'touchMove', {
          x: centre.x + step * 12,
          y: centre.y + step * 6,
        });
      }
      await touch(cdp, 'touchEnd');
      await expect(slider(page)).not.toHaveAttribute('aria-valuenow', '0');
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
      await expect(dialog(page)).toBeVisible();

      await page.touchscreen.tap(stage.left + 14, stage.top + 70);
      await expect(dialog(page)).toHaveCount(0);
      await expect(card(page)).toBeVisible();
      await expect(card(page)).toHaveAttribute('data-book-id', `${a}`);
      expect(await pulledId(page, run)).toBe(`${a}`);
      if (run.renderer !== 'css') {
        await expect(canvasWrap(page)).not.toHaveAttribute(
          'data-inspecting-id',
        );
      }

      await page.waitForTimeout(600);
      await pull(page, run, b);
      await expect(page).not.toHaveURL(/book=/);
      expect(messages()).toEqual([]);
    });

    test('arrow keys turn the book; Escape closes and focus returns to the thumbnail', async ({
      page,
    }) => {
      const [a] = (await optionIds(page)).slice(2, 3);
      if (a === undefined) throw new Error('no book');
      await openInspect(page, run, a);
      await expect(slider(page)).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(slider(page)).toHaveAttribute('aria-valuenow', '15');
      for (let step = 0; step < 5; step += 1) {
        await page.keyboard.press('ArrowRight');
      }
      await expect(slider(page)).toHaveAttribute('aria-valuetext', 'Spine');
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect(thumb(page)).toBeFocused();
      await expect(card(page)).toHaveAttribute('data-book-id', `${a}`);
      expect(await pulledId(page, run)).toBe(`${a}`);
    });

    test('a long press on the shelf while inspecting does not scrub', async ({
      page,
    }) => {
      const [a, b] = (await optionIds(page)).slice(2, 4);
      if (a === undefined || b === undefined) throw new Error('no books');
      const target = await frontRect(page, run, b);
      await openInspect(page, run, a);
      const cdp = await page.context().newCDPSession(page);
      const point = {
        x: target.left + target.width / 2,
        y: target.top + target.height * 0.6,
      };
      await touch(cdp, 'touchStart', point);
      await page.waitForTimeout(HOLD_MS);
      await touch(cdp, 'touchMove', { x: point.x + 20, y: point.y });
      await touch(cdp, 'touchEnd');
      await expect(card(page)).not.toHaveAttribute('data-scrubbing', 'true');
      expect(await pulledId(page, run)).toBe(`${a}`);
      await expect(dialog(page)).toBeVisible();
    });

    test('the open inspect view has no axe violations', async ({ page }) => {
      const [a] = (await optionIds(page)).slice(2, 3);
      if (a === undefined) throw new Error('no book');
      await openInspect(page, run, a);
      await expectNoViolations(page);
    });

    test('with reduced motion inspect opens in its end pose', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const [a] = (await optionIds(page)).slice(2, 3);
      if (a === undefined) throw new Error('no book');
      await openInspect(page, run, a, true);
      const stage = await stageRect(page);
      await expect
        .poll(async () => (await inspectedRect(page, run, a)).height, {
          timeout: 1000,
        })
        .toBeGreaterThan(stage.height * 0.5);
      expect(
        await page.evaluate(
          () =>
            document
              .querySelector('[data-inspect]')
              ?.getAnimations({ subtree: true }).length ?? -1,
        ),
      ).toBe(0);
    });
  });
}
