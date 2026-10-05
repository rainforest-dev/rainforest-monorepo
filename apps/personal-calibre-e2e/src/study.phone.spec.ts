import { expect, test } from '@playwright/test';

import {
  canvasWrap,
  collectConsole,
  expectPulledFocus,
  gotoStudy,
  headingFade,
  prepareRun,
  studyOptions,
} from './support/study';

const CSS = { renderer: 'css' } as const;

test.describe('Study on phone', () => {
  test('one bay per row, scaled spines and no page scroll', async ({
    page,
  }) => {
    await gotoStudy(page, CSS);
    const bays = page.locator('[data-bay]');
    await expect(bays.first()).toBeVisible();
    const lefts = await bays.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const first = studyOptions(page).first();
    const id = Number(await first.getAttribute('data-book-id'));
    const box = await first.boundingBox();
    expect(box?.width).toBeCloseTo((26 + ((id * 7) % 16)) * 0.82, 0);
  });

  test('key hints are hidden', async ({ page }) => {
    await gotoStudy(page, CSS);
    await expect(page.getByText('Along shelf')).toBeHidden();
  });

  test('Select mode toggles a spine', async ({ page }) => {
    await gotoStudy(page, CSS);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const first = studyOptions(page).first();
    await first.click();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(page).not.toHaveURL(/book=/);
  });
});

test.describe('Study three-tsl on phone', () => {
  const run = { renderer: 'three-tsl', backend: 'webgl2' } as const;

  test('a phone-height canvas, no page scroll, the pulled book follows focus', async ({
    page,
  }) => {
    await prepareRun(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run);

    const wrap = canvasWrap(page);
    await expect(wrap).toHaveAttribute('data-backend', 'webgl2');
    const box = await wrap.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('no canvas or viewport');
    expect(
      Math.abs(box.height - Math.min(viewport.height * 0.7, 640)),
    ).toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByText('Along shelf')).toBeHidden();

    await studyOptions(page).first().focus();
    await expectPulledFocus(page, run);
    await page.keyboard.press('ArrowRight');
    await expect(studyOptions(page).nth(1)).toBeFocused();
    await expectPulledFocus(page, run);
    expect(messages()).toEqual([]);
  });

  test('the pulled book fades only the headings it covers', async ({
    page,
  }) => {
    await prepareRun(page, run);
    const messages = collectConsole(page);
    await gotoStudy(page, run, 'debug=1');
    const fadeOf = () => headingFade(page);

    await studyOptions(page).first().focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(async () => {
        const state = await fadeOf();
        return (
          state.faded.length > 0 &&
          state.hiddenOpacity &&
          state.faded.join() === state.overlapping.join()
        );
      })
      .toBe(true);
    const covered = (await fadeOf()).faded;
    expect(covered).toContain(0);
    expect(await page.locator('[data-shelf-label]').count()).toBeGreaterThan(
      covered.length,
    );

    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => {
        const state = await fadeOf();
        return (
          !state.faded.includes(0) &&
          state.faded.join() === state.overlapping.join()
        );
      })
      .toBe(true);
    await expect(page.locator('[data-shelf-label]').first()).toHaveCSS(
      'opacity',
      '1',
    );
    expect(messages()).toEqual([]);
  });

  test('reduced motion fades no heading', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await prepareRun(page, run);
    await gotoStudy(page, run, 'debug=1');
    await studyOptions(page).first().focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    expect((await headingFade(page)).faded).toEqual([]);
  });
});
