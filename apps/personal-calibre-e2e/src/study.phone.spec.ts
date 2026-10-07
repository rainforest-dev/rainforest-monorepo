import { expect, test } from '@playwright/test';

import {
  canvasWrap,
  collectConsole,
  expectPulledFocus,
  gotoStudy,
  headingCollisions,
  prepareRun,
  runName,
  studyOptions,
  THREE_RUNS,
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

  test('a spike renderer falls back to three-tsl on a phone', async ({
    page,
  }) => {
    for (const renderer of ['three-pathtrace']) {
      await page.goto(`/?view=study&groupBy=series&renderer=${renderer}`);
      await expect(page.locator('[data-study-ready]')).toHaveAttribute(
        'data-renderer',
        'three-tsl',
        { timeout: 30_000 },
      );
      await expect(canvasWrap(page)).toHaveAttribute(
        'data-renderer',
        'three-tsl',
      );
    }
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

for (const run of THREE_RUNS.filter((run) => run.backend === 'webgl2')) {
  test.describe(`Study ${runName(run)} on phone`, () => {
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

    for (const width of [375, 390]) {
      test(`?debug keeps the page inside a ${width}px screen`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await prepareRun(page, run);
        await gotoStudy(page, run, 'debug=1');
        await expect(page.locator('[data-backend-badge]')).toBeVisible();
        await expect(canvasWrap(page)).toHaveAttribute(
          'data-backend',
          'webgl2',
        );
        const widths = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(widths).toEqual({ scroll: width, inner: width });
        const badge = await page.locator('[data-backend-badge]').boundingBox();
        expect((badge?.x ?? 0) + (badge?.width ?? 0)).toBeLessThanOrEqual(
          width,
        );
      });
    }
  });
}
