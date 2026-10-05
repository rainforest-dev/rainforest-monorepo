import { expect, test } from '@playwright/test';

import { gotoStudy, studyOptions } from './support/study';

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
