import { expect, test } from '@playwright/test';

import { type AxeIgnore, expectNoViolations } from './support/axe';
import { gotoLibrary, options, pane } from './support/library';

// Roving arrow nav plus scrollIntoView already reach every tile in a group's
// horizontally-scrolling row, so it needs no tab stop of its own.
const GROUPED_SHELF_IGNORE: AxeIgnore[] = [
  {
    rule: 'scrollable-region-focusable',
    targetIncludes: 'aria-label="Books —',
  },
];

const PAGES = [
  ['shelf', '/'],
  ['grouped shelf', '/?groupBy=series', GROUPED_SHELF_IGNORE],
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
