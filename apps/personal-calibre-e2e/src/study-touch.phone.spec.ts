import { type CDPSession, expect, type Page, test } from '@playwright/test';

import {
  canvasWrap,
  collectConsole,
  gotoStudy,
  prepareRun,
  shelves,
  studyOptions,
  type StudyRun,
} from './support/study';

type Rect = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };

const THREE: StudyRun = { renderer: 'three-tsl', backend: 'webgl2' };
const CSS: StudyRun = { renderer: 'css' };
const HOLD_MS = 600;

const card = (page: Page) => page.locator('[data-study-card]');

const optionIds = (page: Page) =>
  studyOptions(page).evaluateAll((elements) =>
    elements.map((element) => Number(element.getAttribute('data-book-id'))),
  );

const titleOf = (page: Page, id: number) =>
  page
    .locator(`[role="option"][data-book-id="${id}"]`)
    .getAttribute('aria-label')
    .then((label) => label?.split(', ')[0] ?? '');

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

const centreOf = (rect: Rect): Point => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height * 0.6,
});

async function tapBook(page: Page, run: StudyRun, id: number): Promise<void> {
  const { x, y } = centreOf(await frontRect(page, run, id));
  await page.touchscreen.tap(x, y);
}

async function tapButton(page: Page, name: string): Promise<void> {
  const box = await card(page).getByRole('button', { name }).boundingBox();
  if (!box) throw new Error(`no ${name} button`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function emptyPoint(page: Page, run: StudyRun): Promise<Point> {
  const box = await (
    run.renderer === 'css'
      ? shelves(page).first().locator('h2')
      : canvasWrap(page)
  ).boundingBox();
  if (!box) throw new Error('no empty space');
  return run.renderer === 'css'
    ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    : { x: box.x + box.width / 2, y: box.y + 6 };
}

async function pulledId(page: Page, run: StudyRun): Promise<string> {
  if (run.renderer !== 'css') {
    return (await canvasWrap(page).getAttribute('data-pulled-id')) ?? '';
  }
  return page.evaluate(
    () =>
      document
        .querySelector('[role="option"]:has(> [data-pulled]), [data-pulled]')
        ?.getAttribute('data-book-id') ?? '',
  );
}

async function expectPulled(page: Page, run: StudyRun, id: number) {
  await expect.poll(() => pulledId(page, run)).toBe(`${id}`);
  await expect(card(page)).toHaveAttribute('data-book-id', `${id}`);
  await expect(card(page).locator('[data-study-card-title]')).toHaveText(
    await titleOf(page, id),
  );
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

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.width - 0.5 &&
  b.left < a.left + a.width - 0.5 &&
  a.top < b.top + b.height - 0.5 &&
  b.top < a.top + a.height - 0.5;

for (const run of [THREE, CSS]) {
  const name = run.renderer;
  test.describe(`Study ${name} touch on phone`, () => {
    test.beforeEach(async ({ page }) => {
      await prepareRun(page, run);
      await gotoStudy(page, run, 'debug=1');
    });

    test('tap pulls, a second book switches directly, the first is tappable again', async ({
      page,
    }) => {
      const messages = collectConsole(page);
      const [a, b] = (await optionIds(page)).slice(1, 3);
      if (a === undefined || b === undefined) throw new Error('no books');
      await expect(card(page)).toHaveCount(0);
      await tapBook(page, run, a);
      await expectPulled(page, run, a);
      await tapBook(page, run, b);
      await expectPulled(page, run, b);
      await tapBook(page, run, a);
      await expectPulled(page, run, a);
      await expect(page).not.toHaveURL(/book=/);
      expect(messages()).toEqual([]);
    });

    test('tapping the pulled book opens its details', async ({ page }) => {
      const [a] = (await optionIds(page)).slice(2, 3);
      if (a === undefined) throw new Error('no book');
      await tapBook(page, run, a);
      await expectPulled(page, run, a);
      await page.waitForTimeout(400);
      await tapBook(page, run, a);
      await expect(page).toHaveURL(new RegExp(`book=${a}\\b`));
    });

    test('the card steps by swipe and buttons, and opens details', async ({
      page,
    }) => {
      const ids = await optionIds(page);
      const [a, b, c] = ids.slice(1, 4);
      if (a === undefined || b === undefined || c === undefined) {
        throw new Error('no books');
      }
      await tapBook(page, run, a);
      await expectPulled(page, run, a);

      const box = await card(page).boundingBox();
      if (!box) throw new Error('no card');
      const cdp = await page.context().newCDPSession(page);
      const y = box.y + box.height / 2;
      await touch(cdp, 'touchStart', { x: box.x + box.width * 0.7, y });
      for (const f of [0.6, 0.5, 0.4, 0.3]) {
        await touch(cdp, 'touchMove', { x: box.x + box.width * f, y });
      }
      await touch(cdp, 'touchEnd');
      await expectPulled(page, run, b);

      await tapButton(page, 'Next book');
      await expectPulled(page, run, c);
      await tapButton(page, 'Previous book');
      await expectPulled(page, run, b);

      await tapButton(page, 'Open details');
      await expect(page).toHaveURL(new RegExp(`book=${b}\\b`));
    });

    test('tapping empty space puts the book back and hides the card', async ({
      page,
    }) => {
      const [a] = (await optionIds(page)).slice(1, 2);
      if (a === undefined) throw new Error('no book');
      await tapBook(page, run, a);
      await expectPulled(page, run, a);
      const empty = await emptyPoint(page, run);
      await page.touchscreen.tap(empty.x, empty.y);
      await expect.poll(() => pulledId(page, run)).toBe('');
      await expect(card(page)).toHaveCount(0);
      await expect(page).not.toHaveURL(/book=/);
    });

    test('Escape puts the pulled book back', async ({ page }) => {
      const [a] = (await optionIds(page)).slice(1, 2);
      if (a === undefined) throw new Error('no book');
      await tapBook(page, run, a);
      await expectPulled(page, run, a);
      await page.keyboard.press('Escape');
      await expect.poll(() => pulledId(page, run)).toBe('');
      await expect(card(page)).toHaveCount(0);
    });

    test('the pulled book covers no other book and no heading', async ({
      page,
    }) => {
      const ids = await optionIds(page);
      const a = ids[2];
      if (a === undefined) throw new Error('no book');
      await tapBook(page, run, a);
      await expectPulled(page, run, a);
      await page.waitForTimeout(600);
      const pulled = await frontRect(page, run, a);
      const others = await Promise.all(
        ids
          .filter((id) => id !== a)
          .slice(0, 12)
          .map((id) => frontRect(page, run, id)),
      );
      for (const other of others) expect(overlaps(pulled, other)).toBe(false);
      const headings = await page
        .locator(name === 'css' ? '[role="group"] h2' : '[data-shelf-label]')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const { left, top, width, height } =
              element.getBoundingClientRect();
            return { left, top, width, height };
          }),
        );
      expect(headings.length).toBeGreaterThan(0);
      for (const heading of headings) {
        expect(overlaps(pulled, heading)).toBe(false);
      }
    });

    test('long-press then slide scrubs and keeps the last book', async ({
      page,
    }) => {
      const [a, b, c] = (await optionIds(page)).slice(1, 4);
      if (a === undefined || b === undefined || c === undefined) {
        throw new Error('no books');
      }
      const points = await Promise.all(
        [a, b, c].map(async (id) => centreOf(await frontRect(page, run, id))),
      );
      const scrollY = await page.evaluate(() => window.scrollY);
      const cdp = await page.context().newCDPSession(page);
      const [pa, pb, pc] = points as [Point, Point, Point];
      await touch(cdp, 'touchStart', pa);
      await page.waitForTimeout(HOLD_MS);
      await expect(card(page)).toHaveAttribute('data-scrubbing', 'true');
      await expectPulled(page, run, a);
      for (const to of [pb, pc]) {
        await touch(cdp, 'touchMove', { x: to.x, y: to.y + 4 });
        await touch(cdp, 'touchMove', to);
        await page.waitForTimeout(150);
      }
      await expectPulled(page, run, c);
      await touch(cdp, 'touchMove', { x: pc.x, y: pc.y - 400 });
      await touch(cdp, 'touchEnd');
      await expectPulled(page, run, c);
      await expect(card(page)).not.toHaveAttribute('data-scrubbing', 'true');
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
      await expect(page).not.toHaveURL(/book=/);
    });
  });
}

test('a quick swipe scrolls the css study and does not scrub', async ({
  page,
}) => {
  await prepareRun(page, CSS);
  await gotoStudy(page, CSS);
  const first = await studyOptions(page).first().boundingBox();
  if (!first) throw new Error('no spine');
  const cdp = await page.context().newCDPSession(page);
  const x = first.x + first.width / 2;
  const y = first.y + first.height / 2;
  await touch(cdp, 'touchStart', { x, y });
  for (let step = 1; step <= 8; step += 1) {
    await touch(cdp, 'touchMove', { x, y: y - step * 30 });
  }
  await touch(cdp, 'touchEnd');
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await expect(card(page)).toHaveCount(0);
});

test('a quick swipe pans the three study and does not scrub', async ({
  page,
}) => {
  await prepareRun(page, THREE);
  await gotoStudy(page, THREE, 'debug=1');
  const box = await canvasWrap(page).boundingBox();
  if (!box) throw new Error('no canvas');
  const cameraY = () =>
    page.evaluate(
      () =>
        (
          window as Window & {
            __calibreStudy?: { camera: { y: number } | null };
          }
        ).__calibreStudy?.camera?.y ?? null,
    );
  const before = await cameraY();
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.6;
  await touch(cdp, 'touchStart', { x, y });
  for (let step = 1; step <= 8; step += 1) {
    await touch(cdp, 'touchMove', { x, y: y - step * 30 });
  }
  await touch(cdp, 'touchEnd');
  await expect.poll(cameraY).not.toBe(before);
  await expect(canvasWrap(page)).toHaveAttribute('data-pulled-id', '');
  await expect(card(page)).toHaveCount(0);
});
