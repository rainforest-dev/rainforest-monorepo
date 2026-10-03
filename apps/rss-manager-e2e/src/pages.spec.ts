import { expect, test } from '@playwright/test';

import {
  facetOption,
  gotoSources,
  pager,
  sourceNames,
  sourceRows,
  SOURCES_PAGE_SIZE,
  sourceSearch,
} from './support/desk';
import { SOURCES } from './support/fixture-vault';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const total = SOURCES.length;
const pageCount = Math.ceil(total / SOURCES_PAGE_SIZE);
const lastPageRows = total - (pageCount - 1) * SOURCES_PAGE_SIZE;

test.describe('source pages', () => {
  test('the fixture spans three pages', () => {
    expect(total).toBe(70);
    expect(pageCount).toBe(3);
  });

  test('30 rows a page in the desk order, with a pager', async ({ page }) => {
    await gotoSources(page);
    await expect(sourceRows(page)).toHaveCount(SOURCES_PAGE_SIZE);
    const names = sourceNames(page);
    await expect(names.first()).toHaveText('Atlas of Small Tools');
    await expect(names.nth(19)).toHaveText('Tin Roof Radio');
    await expect(names.nth(20)).toHaveText('Dispatch Nine');
    await expect(names.nth(25)).toHaveText('Token Tides');
    await expect(names.nth(26)).toHaveText('Bits & Pieces Weekly');

    const nav = pager(page);
    await expect(nav).toContainText(`1–30 of ${total}`);
    await expect(nav).toContainText(`Page 1 of ${pageCount}`);
    await expect(nav.getByRole('button', { name: 'Prev' })).toBeDisabled();
  });

  test('Next and Prev walk the pages and push history', async ({ page }) => {
    await gotoSources(page);
    const nav = pager(page);

    await nav.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(nav).toContainText(`31–60 of ${total}`);
    await expect(sourceRows(page)).toHaveCount(SOURCES_PAGE_SIZE);

    await nav.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\?page=3$/);
    await expect(nav).toContainText(`61–${total} of ${total}`);
    await expect(sourceRows(page)).toHaveCount(lastPageRows);
    await expect(sourceNames(page).first()).toHaveText('Dust Jacket');
    await expect(sourceNames(page).last()).toHaveText('Static Bloom');
    await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();

    await nav.getByRole('button', { name: 'Prev' }).click();
    await expect(page).toHaveURL(/\?page=2$/);

    await page.goBack();
    await expect(page).toHaveURL(/\?page=3$/);
    await expect(nav).toContainText(`Page 3 of ${pageCount}`);
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(nav).toContainText(`Page 1 of ${pageCount}`);
  });

  test('a page past the end clamps to the last page', async ({ page }) => {
    await gotoSources(page, '?page=9');
    await expect(page).toHaveURL(/\?page=3$/);
    await expect(sourceRows(page)).toHaveCount(lastPageRows);
    await expect(pager(page)).toContainText(`Page 3 of ${pageCount}`);
  });

  test('a page past the end of a filtered list clamps to page 1', async ({
    page,
  }) => {
    await gotoSources(page, '?status=retired&page=2');
    await expect(page).toHaveURL(/\?status=retired$/);
    await expect(sourceRows(page)).toHaveCount(
      SOURCES.filter((s) => s.status === 'retired').length,
    );
    await expect(pager(page)).toHaveCount(0);
  });

  test('a facet change drops the page', async ({ page }) => {
    await gotoSources(page, '?page=2');
    await facetOption(page, 'Status', 'Active').click();
    await expect(page).toHaveURL(/\?status=active$/);
    await expect(pager(page)).toContainText('Page 1 of 2');
  });

  test('a search drops the page', async ({ page }) => {
    await gotoSources(page, '?page=3');
    await sourceSearch(page).fill('a');
    await expect(page).toHaveURL(/\?q=a$/);
    await expect(pager(page)).toContainText('Page 1 of');
  });
});
