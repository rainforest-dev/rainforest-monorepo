import { expect, type Page, test } from '@playwright/test';

import { type AxeIgnore, expectNoViolations } from './support/axe';
import { gotoLibrary, options, pane } from './support/library';

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

const PAGES = [
  ['shelf', '/'],
  ['grouped shelf', '/?groupBy=series', SCROLL_ROW_IGNORE],
  ['catalogue', '/?view=catalogue'],
  ['grouped catalogue', '/?view=catalogue&groupBy=tag'],
  ['shelf with the pane', '/?book=38'],
  ['catalogue with the pane', '/?view=catalogue&book=38'],
  ['permalink', '/books/38'],
  ['empty result', '/?q=zzzz-no-such-book'],
  ['study', '/?view=study&groupBy=series', SCROLL_ROW_IGNORE],
  [
    'study with the pane',
    '/?view=study&groupBy=series&book=38',
    SCROLL_ROW_IGNORE,
  ],
] as const satisfies ReadonlyArray<
  readonly [string, string] | readonly [string, string, AxeIgnore[]]
>;

test.describe('accessibility', () => {
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
});
