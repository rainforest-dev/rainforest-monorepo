import { expect, type Page, test } from '@playwright/test';

import { gotoLibrary, setPrefs } from './support/library';

interface HallProbe {
  firstFrameAt: number | null;
  avatar: () => { x: number; z: number };
  walking: () => boolean;
  resorting: () => boolean;
  projectCase: (key: string) => { x: number; y: number } | null;
}

type Hall = Window & { __calibreHall?: HallProbe };

const firstFrame = (page: Page) =>
  page.evaluate(() => (window as Hall).__calibreHall?.firstFrameAt != null);
const avatar = (page: Page) =>
  page.evaluate(() => (window as Hall).__calibreHall?.avatar() ?? null);
const walking = (page: Page) =>
  page.evaluate(() => (window as Hall).__calibreHall?.walking() ?? false);
const resorting = (page: Page) =>
  page.evaluate(() => (window as Hall).__calibreHall?.resorting() ?? false);
const projectCase = (page: Page, key: string) =>
  page.evaluate(
    (k) => (window as Hall).__calibreHall?.projectCase(k) ?? null,
    key,
  );

async function gotoHall(page: Page, url = '/?groupBy=series') {
  await gotoLibrary(page, url);
  await expect(page.locator('[data-hall-mode="3d"]')).toHaveCount(1);
  await expect.poll(() => firstFrame(page)).toBe(true);
}

test.describe('Library hall', () => {
  test.beforeEach(async ({ context }) => {
    await setPrefs(context, { view: 'hall' });
  });

  test('lays out one labelled bookcase per series', async ({ page }) => {
    await gotoHall(page);
    const list = page.getByRole('list', { name: 'Bookcases' });
    await expect(
      list.getByRole('button', { name: /Northbound/ }),
    ).toContainText('20 books');
    await expect(page.locator('[data-hall-label="series-3"]')).toBeVisible();
    await expect(page.locator('[data-hall-canvas] canvas')).toHaveCount(1);
  });

  test('walks to a clicked bookcase, opens it in the Study and comes back', async ({
    page,
  }) => {
    await gotoHall(page);
    const start = await avatar(page);
    const point = await projectCase(page, 'series-3');
    if (!start || !point) throw new Error('hall not ready');
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => walking(page)).toBe(true);

    await expect(page).toHaveURL(/series=3/);
    await expect(page.locator('[data-view-region="study"]')).toBeVisible();

    await page.locator('[data-hall-back]').click();
    await expect(page.locator('[data-view-region="hall"]')).toBeVisible();
    await expect(page).not.toHaveURL(/series=3/);
    await expect.poll(() => firstFrame(page)).toBe(true);
    // Back in front of the bookcase it went into, not at the entrance.
    const back = await avatar(page);
    expect(back?.z).toBeLessThan(start.z - 1);
  });

  test('walks with the keyboard', async ({ page }) => {
    await gotoHall(page);
    const start = await avatar(page);
    await page.locator('[data-hall-canvas]').focus();
    await page.keyboard.down('w');
    await page.waitForTimeout(4000);
    await page.keyboard.up('w');
    const end = await avatar(page);
    if (!start || !end) throw new Error('no avatar');
    expect(end.z).toBeLessThan(start.z - 0.5);
  });

  test('re-sorts the books when the grouping changes', async ({ page }) => {
    await gotoHall(page);
    await page.getByRole('combobox', { name: 'Group' }).click();
    await page.getByRole('option', { name: 'Author' }).click();
    await expect(page).toHaveURL(/groupBy=author/);
    await expect.poll(() => resorting(page)).toBe(true);
    await expect.poll(() => resorting(page), { timeout: 10_000 }).toBe(false);
    await expect(
      page
        .getByRole('list', { name: 'Bookcases' })
        .getByRole('button', { name: /Northbound/ }),
    ).toHaveCount(0);
  });

  test('opens a bookcase from the keyboard list', async ({ page }) => {
    await gotoHall(page);
    await page
      .getByRole('list', { name: 'Bookcases' })
      .getByRole('button', { name: /Northbound/ })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/series=3/);
    await expect(page.locator('[data-view-region="study"]')).toBeVisible();
  });

  test('the switcher opens the hall from another view', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'shelf' });
    await gotoLibrary(page, '/?groupBy=series');
    await page.getByRole('button', { name: 'Hall view' }).click();
    await expect(page.locator('[data-hall-mode="3d"]')).toHaveCount(1);
    await page.keyboard.press('v');
    await expect(
      page.getByRole('region', { name: 'Shelf view' }),
    ).toBeVisible();
  });
});
