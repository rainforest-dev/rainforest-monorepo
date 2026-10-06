import { expect, test } from '@playwright/test';

import {
  canvasWrap,
  collectConsole,
  expectPulledFocus,
  gotoStudy,
  headingCollisions,
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

  test('author headings on a shared row never overlap', async ({ page }) => {
    await prepareRun(page, run);
    await gotoStudy(page, run, 'groupBy=author&page=2');
    const labels = page.locator('[data-shelf-label]');
    await expect(labels.first()).toBeVisible();
    const tops = await labels.evaluateAll((elements) =>
      elements.map((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    );
    expect(new Set(tops).size).toBeLessThan(tops.length);
    for (let i = 0; i < 4; i += 1) {
      expect(await headingCollisions(page, '[data-shelf-label]')).toEqual([]);
      await canvasWrap(page).hover();
      await page.mouse.wheel(0, 300);
    }
  });
});
