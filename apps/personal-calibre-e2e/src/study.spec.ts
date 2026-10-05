import { expect, type Page, test } from '@playwright/test';

import {
  gotoLibrary,
  options,
  pane,
  setPrefs,
  tokenColor,
} from './support/library';
import { bookById, BOOKS, SERIES } from './support/seed';
import { gotoStudy, shelves, studyOptions } from './support/study';

const CSS = { renderer: 'css' } as const;
const PAGE_SIZE = 30;

const bySort = (a: { sort: string }, b: { sort: string }) => {
  const x = a.sort.toLowerCase();
  const y = b.sort.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

function pageOf(ids: readonly number[], id: number): number {
  return Math.floor(ids.indexOf(id) / PAGE_SIZE) + 1;
}

function seriesOrderedIds(): number[] {
  const inSeries = [...SERIES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((s) =>
      BOOKS.filter((b) => b.seriesId === s.id)
        .sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0))
        .map((b) => b.id),
    );
  const standalone = BOOKS.filter((b) => b.seriesId === null)
    .sort(bySort)
    .map((b) => b.id);
  return [...inSeries, ...standalone];
}

function option(page: Page, id: number) {
  return page.locator(`[role="option"][data-book-id="${id}"]`);
}

test.describe('Study', () => {
  test('entering Study without a group sets groupBy=series', async ({
    page,
  }) => {
    const titlePage = pageOf(
      [...BOOKS].sort(bySort).map((b) => b.id),
      38,
    );
    await gotoLibrary(page, `/?page=${titlePage}`);
    const start = options(page).and(page.locator('[data-book-id="38"]'));
    await start.focus();
    await page.keyboard.press('v');
    await expect(page.locator('tr[data-book-id="38"]')).toBeFocused();
    await page.keyboard.press('v');
    await expect(page).toHaveURL(/groupBy=series/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(studyOptions(page).first()).toBeVisible();
    const firstPage = seriesOrderedIds().slice(0, PAGE_SIZE);
    const expected = firstPage.includes(38)
      ? option(page, 38)
      : studyOptions(page).first();
    await expect(expected).toBeFocused();
  });

  test('entering Study with Tag replaces it with series', async ({ page }) => {
    await gotoLibrary(page, '/');
    await page.goto('/?groupBy=tag&view=study');
    await expect(page).toHaveURL(/groupBy=series/);
    await expect(studyOptions(page).first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('region', { name: 'Shelf view' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Study keeps Author grouping', async ({ page }) => {
    await gotoLibrary(page, '/?groupBy=author&view=study');
    await expect(page).toHaveURL(/groupBy=author/);
    await expect(studyOptions(page).first()).toBeVisible();
  });

  test('the Group select offers Series and Author only in Study', async ({
    page,
  }) => {
    await gotoStudy(page, CSS);
    await page.getByRole('combobox', { name: 'Group' }).click();
    await expect(
      page.getByRole('option', { name: 'Series', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: 'Author', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: 'None', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('option', { name: 'Tag', exact: true }),
    ).toHaveCount(0);
  });

  test('one listbox of shelves with named groups and options', async ({
    page,
  }) => {
    await gotoStudy(page, CSS);
    await expect(
      page.getByRole('listbox', { name: 'Bookshelves' }),
    ).toHaveCount(1);
    const northbound = SERIES.find((s) => s.name === 'Northbound');
    await expect(
      shelves(page).filter({ has: option(page, northbound?.first ?? 0) }),
    ).toHaveAccessibleName(`Northbound, ${northbound?.count} books`);
    const book = bookById(seriesOrderedIds()[0] ?? 0);
    const first = option(page, book.id);
    await expect(first).toHaveAttribute(
      'aria-label',
      new RegExp(`^${book.title}, `),
    );
    await expect(first).toHaveAttribute('aria-selected', 'false');
    await expect(shelves(page)).toHaveCount(3);
  });

  test('keyboard: arrows, rows, page ends, selection and the pane', async ({
    page,
  }) => {
    await gotoStudy(page, CSS);
    await expect(page.locator('[role="option"][tabindex="0"]')).toHaveCount(1);
    const firstShelf = shelves(page).first().getByRole('option');
    const secondShelf = shelves(page).nth(1).getByRole('option');
    await firstShelf.last().focus();
    await page.keyboard.press('ArrowRight');
    await expect(secondShelf.first()).toBeFocused();

    await firstShelf.first().focus();
    const row = await firstShelf.first().getAttribute('data-nav-row');
    await page.keyboard.press('ArrowDown');
    const focused = page.locator('[role="option"]:focus');
    await expect(focused).toHaveCount(1);
    expect(await focused.getAttribute('data-nav-row')).not.toBe(row);
    await expect(focused).toHaveAttribute(
      'data-nav-row',
      (await secondShelf.first().getAttribute('data-nav-row')) ?? '',
    );

    await secondShelf.nth(1).focus();
    await page.keyboard.press('End');
    await expect(secondShelf.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(secondShelf.first()).toBeFocused();
    await page.keyboard.press('Control+End');
    await expect(studyOptions(page).last()).toBeFocused();

    const target = studyOptions(page).first();
    await target.focus();
    await page.keyboard.press('x');
    await expect(target).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Space');
    await expect(target).toHaveAttribute('aria-selected', 'false');
    const id = await target.getAttribute('data-book-id');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`book=${id}`));
    await expect(pane(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/book=/);
    await expect(target).toBeFocused();

    await page.keyboard.press(']');
    await expect(page).toHaveURL(/page=2/);
    await expect(studyOptions(page).first()).toBeFocused();
  });

  test('leaving Study with v keeps groupBy=series and the focused book', async ({
    page,
  }) => {
    await gotoStudy(page, CSS);
    const third = studyOptions(page).nth(2);
    const id = await third.getAttribute('data-book-id');
    await third.focus();
    await page.keyboard.press('v');
    await expect(
      page.getByRole('region', { name: 'Shelf view' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/groupBy=series/);
    await expect(option(page, Number(id))).toBeFocused();
  });

  test('the Skeleton shows three bays', async ({ page, context }) => {
    await setPrefs(context, { view: 'study' });
    await page.goto('/?groupBy=series&__delay=1500', { waitUntil: 'commit' });
    const skeleton = page.locator('[data-skeleton="study"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.locator('[data-skeleton-bay]')).toHaveCount(3);
  });

  test('the switcher shows Study and v cycles all three views', async ({
    page,
  }) => {
    await gotoLibrary(page, '/?groupBy=series');
    const views = page.getByRole('group', { name: 'View' }).getByRole('button');
    await expect(views).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: 'Study view' }),
    ).toBeVisible();
    const first = options(page).first();
    await first.focus();
    for (const name of ['Catalogue', 'Study', 'Shelf']) {
      await page.keyboard.press('v');
      await expect(
        page.getByRole('region', { name: `${name} view` }),
      ).toBeVisible();
    }
  });

  test('css cues: focus is foreground and selection is primary', async ({
    page,
  }) => {
    await gotoStudy(page, CSS);
    const first = studyOptions(page).first();
    await first.focus();
    await page.keyboard.press('x');
    const foreground = await tokenColor(page, '--foreground');
    const primary = await tokenColor(page, '--primary');
    await expect
      .poll(() =>
        first
          .locator('[data-spine]')
          .evaluate((el) => getComputedStyle(el).outlineColor),
      )
      .toBe(foreground);
    await expect
      .poll(() =>
        first
          .locator('[data-select-mark]')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe(primary);
  });

  test('reduced motion keeps the ring and has no transform', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoStudy(page, CSS);
    const first = studyOptions(page).first();
    await first.focus();
    await first.hover();
    const foreground = await tokenColor(page, '--foreground');
    await expect
      .poll(() =>
        first
          .locator('.st-book')
          .evaluate((el) => getComputedStyle(el).transform),
      )
      .toBe('none');
    await expect
      .poll(() =>
        first
          .locator('[data-spine]')
          .evaluate((el) => getComputedStyle(el).outlineColor),
      )
      .toBe(foreground);
  });

  test('CJK spines are upright and Latin apostrophes are sideways', async ({
    page,
  }) => {
    const ids = seriesOrderedIds();
    const orientation = async (id: number) => {
      await gotoStudy(page, CSS, `page=${pageOf(ids, id)}`);
      return option(page, id)
        .locator('[data-spine-title]')
        .evaluate((el) => getComputedStyle(el).textOrientation);
    };
    expect(await orientation(44)).toBe('upright');
    expect(await orientation(45)).toBe('upright');
    expect(await orientation(48)).toBe('sideways');
  });

  test('the cover face shows the fixture cover on focus only', async ({
    page,
  }) => {
    await gotoStudy(page, CSS);
    const book = option(page, 7);
    const cover = book.locator('img[src="/api/books/7/cover"]');
    await expect(cover).toHaveCount(0);
    await book.focus();
    await expect(cover).toHaveCount(1);
    await studyOptions(page).first().focus();
    await expect(cover).toHaveCount(0);
  });
});
