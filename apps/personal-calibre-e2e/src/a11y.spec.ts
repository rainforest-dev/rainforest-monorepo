import { expect, type Page, test } from '@playwright/test';

import { type AxeIgnore, expectNoViolations } from './support/axe';
import { gotoLibrary, options, pane } from './support/library';
import { resetAppDb } from './support/reset-db';
import {
  canvasWrap,
  gotoStudy,
  runName,
  startRun,
  STUDY_RUNS,
  studyOptions,
} from './support/study';

const panel = (page: Page) => page.locator('#library-filters');

// Roving arrow nav plus scrollIntoView already reach every tile in a group's
// horizontally-scrolling row, so it needs no tab stop of its own.
const SCROLL_ROW_IGNORE: AxeIgnore[] = [
  {
    rule: 'scrollable-region-focusable',
    targetIncludes: 'aria-label="Books —',
  },
  { rule: 'scrollable-region-focusable', targetIncludes: '.st-row' },
];

const deliveryRow = (page: Page, platformKey: string) =>
  pane(page).locator(`[data-platform="${platformKey}"]`);

async function markAdded(page: Page, platformKey: string): Promise<void> {
  await deliveryRow(page, platformKey)
    .getByRole('button', { name: 'Mark added' })
    .click();
  await page.getByRole('dialog').getByLabel('Note').press('Enter');
}

async function expectToastPasses(
  page: Page,
  type: 'success' | 'error',
  text: string,
): Promise<void> {
  const toast = page.locator(`[data-sonner-toast][data-type="${type}"]`);
  await expect(toast).toContainText(text);
  await toast.hover();
  await expectNoViolations(page);
}

const PAGES = [
  ['shelf', '/'],
  ['grouped shelf', '/?groupBy=series', SCROLL_ROW_IGNORE],
  ['catalogue', '/?view=catalogue'],
  ['grouped catalogue', '/?view=catalogue&groupBy=tag'],
  ['shelf with the pane', '/?book=38'],
  ['catalogue with the pane', '/?view=catalogue&book=38'],
  ['permalink', '/books/38'],
  ['empty result', '/?q=zzzz-no-such-book'],
] as const satisfies ReadonlyArray<
  readonly [string, string] | readonly [string, string, AxeIgnore[]]
>;

test.describe('accessibility', () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== 'chromium',
      'only the Study cases run on study-webgpu',
    );
  });

  for (const [name, url, ignore] of PAGES) {
    test(`${name} has no axe violations`, async ({ page }) => {
      await gotoLibrary(page, url);
      await expectNoViolations(page, { ignore });
    });
  }

  test('the bulk toolbar has no axe violations', async ({ page }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    await page.keyboard.press('x');
    await expect(
      page.getByRole('toolbar', { name: 'Bulk actions' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });

  test('the filter panel has no axe violations with a filter active', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?tag=6');
    const clearAll = panel(page).getByRole('button', { name: 'Clear all' });
    if (!(await clearAll.isVisible())) {
      await page.getByRole('button', { name: 'Show filters' }).click();
    }
    await expect(clearAll).toBeVisible();
    await expectNoViolations(page);
  });

  test('the add-delivery form has no axe violations', async ({ page }) => {
    await gotoLibrary(page, '/?book=38');
    await pane(page)
      .getByRole('button', { name: /Mark added|Log again/ })
      .first()
      .click();
    await expect(
      page.getByRole('dialog').filter({ hasText: 'Mark as added to' }),
    ).toBeVisible();
    // Base UI's own aria-hidden, tabindex=0 focus-trap sentinels around the
    // popover, not app markup.
    await expectNoViolations(page, {
      ignore: [
        {
          rule: 'aria-hidden-focus',
          targetIncludes: 'data-base-ui-focus-guard',
        },
      ],
    });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the success toast has no axe violations in ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      try {
        await gotoLibrary(page, '/?book=41');
        await markAdded(page, 'kobo');
        await expectToastPasses(page, 'success', 'Logged Kobo');
      } finally {
        resetAppDb();
      }
    });

    test(`the error toast has no axe violations in ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.route('**/api/books/41/deliveries', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 500,
              json: { error: 'Injected delivery fault' },
            })
          : route.fallback(),
      );
      await gotoLibrary(page, '/?book=41');
      await markAdded(page, 'notebooklm');
      await expectToastPasses(
        page,
        'error',
        'Delivery failed — Injected delivery fault',
      );
    });
  }
});

for (const run of STUDY_RUNS) {
  test.describe(`accessibility, Study ${runName(run)}`, () => {
    const ignore = run.renderer === 'css' ? SCROLL_ROW_IGNORE : [];

    test.beforeEach(async ({ page }) => {
      await startRun(page, run);
    });

    test('study has no axe violations', async ({ page }) => {
      await gotoStudy(page, run);
      await expectNoViolations(page, { ignore });
    });

    test('study with a focused book has no axe violations', async ({
      page,
    }) => {
      await gotoStudy(page, run);
      await studyOptions(page).first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(studyOptions(page).nth(1)).toBeFocused();
      if (run.renderer !== 'css') {
        await expect(canvasWrap(page)).not.toHaveAttribute(
          'data-pulled-id',
          '',
        );
      }
      await expectNoViolations(page, { ignore });
    });

    test('study under reduced motion has no axe violations', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await gotoStudy(page, run);
      await studyOptions(page).first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(studyOptions(page).nth(1)).toBeFocused();
      await expectNoViolations(page, { ignore });
    });

    test('study with a selection and ?debug has no axe violations', async ({
      page,
    }) => {
      await gotoStudy(page, run, 'debug=1');
      await expect(page.locator('[data-backend-badge]')).toBeVisible();
      await studyOptions(page).first().focus();
      await page.keyboard.press('x');
      await expect(
        page.getByRole('toolbar', { name: 'Bulk actions' }),
      ).toBeVisible();
      await expectNoViolations(page, { ignore });
    });

    test('study with the pane has no axe violations', async ({ page }) => {
      await gotoStudy(page, run, 'book=38');
      await expect(pane(page)).toBeVisible();
      await expectNoViolations(page, { ignore });
    });
  });
}
