import { expect, test } from '@playwright/test';

import {
  chips,
  deskTab,
  detailPane,
  expectFacet,
  facetOption,
  filterPanel,
  gotoSources,
  openSource,
  sourceCount,
  sourceNames,
  sourceRows,
  sourceSearch,
  waitForHydration,
} from './support/desk';
import { SOURCES, type SourceStatus } from './support/fixture-vault';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const total = SOURCES.length;
const countOf = (status: SourceStatus): number =>
  SOURCES.filter((s) => s.status === status).length;

test.describe('source filters', () => {
  test('every facet lists its options with counts', async ({ page }) => {
    await gotoSources(page);
    await expectFacet(page, 'Status', 'Active', countOf('active'));
    await expectFacet(page, 'Status', 'Proposed', countOf('proposed'));
    await expectFacet(page, 'Status', 'No RSS', countOf('no-rss'));
    await expectFacet(page, 'Status', 'Retired', countOf('retired'));

    await expectFacet(page, 'Stale', 'Feed dead', 1);
    await expectFacet(page, 'Stale', 'Delivery gap', 2);
    await expectFacet(page, 'Stale', 'Low value', 2);
    await expectFacet(page, 'Stale', 'Unspecified', 1);

    await expectFacet(page, 'Category', 'Design', 6);
    await expectFacet(
      page,
      'Category',
      'Uncategorised',
      SOURCES.filter((s) => !s.category).length,
    );

    await expect(sourceCount(page)).toHaveText(`${total} sources`);
  });

  test('the stale facet counts non-retired sources only', async ({ page }) => {
    await gotoSources(page);
    const retiredStale = SOURCES.filter(
      (s) => s.status === 'retired' && s.staleComment?.startsWith('feed-dead'),
    );
    expect(retiredStale.length).toBeGreaterThan(0);
    await expectFacet(page, 'Stale', 'Feed dead', 1);

    await facetOption(page, 'Status', 'Retired').click();
    for (const label of ['Feed dead', 'Delivery gap', 'Low value'])
      await expectFacet(page, 'Stale', label, 0);
  });

  test('options OR within a group and groups AND, with counts that follow', async ({
    page,
  }) => {
    await gotoSources(page);
    await facetOption(page, 'Status', 'Proposed').click();
    await facetOption(page, 'Status', 'No RSS').click();
    const proposedOrNoRss = countOf('proposed') + countOf('no-rss');
    await expect(sourceRows(page)).toHaveCount(proposedOrNoRss);
    await expect(sourceCount(page)).toHaveText(
      `${proposedOrNoRss} of ${total} sources`,
    );
    await expect(page).toHaveURL(/\?status=proposed%2Cno-rss$/);

    await facetOption(page, 'Status', 'Proposed').click();
    await facetOption(page, 'Status', 'No RSS').click();
    await facetOption(page, 'Status', 'Active').click();
    await facetOption(page, 'Stale', 'Delivery gap').click();
    await expect(sourceNames(page)).toHaveText(['Dispatch Nine', 'Ferry Ops']);
    await expect(page).toHaveURL(/\?status=active&stale=delivery-gap$/);

    await expectFacet(page, 'Status', 'Active', 2, true);
    await expectFacet(page, 'Status', 'Proposed', 0);
    await expectFacet(page, 'Stale', 'Delivery gap', 2, true);
    await expectFacet(page, 'Stale', 'Low value', 2);
    await expectFacet(page, 'Category', 'Tech News & Industry', 1);
    await expectFacet(page, 'Category', 'Systems & Infrastructure', 1);
  });

  test('a zero-count option stays enabled and leads to an empty state', async ({
    page,
  }) => {
    await gotoSources(page);
    await facetOption(page, 'Status', 'Retired').click();
    const unspecified = facetOption(page, 'Stale', 'Unspecified');
    await expect(unspecified).toHaveAccessibleName('Unspecified 0');
    await expect(unspecified).toBeEnabled();
    await unspecified.click();
    await expect(sourceRows(page)).toHaveCount(0);
    await expect(page.getByText('No sources match')).toBeVisible();
    await expect(
      page.getByText('2 filters applied. Remove one or clear them all.'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(sourceCount(page)).toHaveText(`${total} sources`);
    await expect(page).toHaveURL(/\/$/);
  });

  test('tags show eight options until Show all', async ({ page }) => {
    await gotoSources(page);
    const tags = filterPanel(page).getByRole('group', { name: 'Tags' });
    const allTags = new Set(SOURCES.flatMap((s) => s.tags));
    await expect(tags.getByRole('checkbox')).toHaveCount(8);
    await expectFacet(
      page,
      'Tags',
      'domain/news',
      SOURCES.filter((s) => s.tags.includes('domain/news')).length,
    );

    await tags
      .getByRole('button', { name: `Show all ${allTags.size}` })
      .click();
    await expect(tags.getByRole('checkbox')).toHaveCount(allTags.size);
    await facetOption(page, 'Tags', 'tech/rust').click();
    await expect(sourceNames(page)).toHaveText([
      'Birch Compiler',
      'Kite & Key',
    ]);

    await tags.getByRole('button', { name: 'Show fewer' }).click();
    await expect(tags.getByRole('checkbox')).toHaveCount(9);
    await expectFacet(page, 'Tags', 'tech/rust', 2, true);
  });

  test('chips name each filter, remove one at a time, and Clear all keeps the open source', async ({
    page,
  }) => {
    await gotoSources(page, '?status=active&cat=Design&tag=tech%2Fcss');
    const row = chips(page);
    await expect(row.getByRole('listitem')).toHaveText([
      'Status: Active',
      'Category: Design',
      'Tag: tech/css',
      'Clear all',
    ]);
    await expect(sourceNames(page)).toHaveText(['Ink Orchard']);
    await expect(
      filterPanel(page).getByRole('heading', { name: 'Filters · 3' }),
    ).toBeVisible();

    await row.getByRole('button', { name: 'Remove Category: Design' }).click();
    await expect(page).toHaveURL(/\?status=active&tag=tech%2Fcss$/);
    await expect(sourceRows(page)).toHaveCount(4);
    await expectFacet(page, 'Category', 'Design', 1);

    await openSource(page, 'Lantern Notes');
    await row.getByRole('button', { name: 'Clear all' }).click();
    await expect(chips(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/\?source=Lantern\+Notes$/);
    await expect(detailPane(page)).toBeVisible();
    await expect(sourceCount(page)).toHaveText(`${total} sources`);
  });

  test('the panel Clear all clears the search too', async ({ page }) => {
    await gotoSources(page, '?q=notes&stale=low-value');
    await expect(sourceSearch(page)).toHaveValue('notes');
    await filterPanel(page).getByRole('button', { name: 'Clear all' }).click();
    await expect(sourceSearch(page)).toHaveValue('');
    await expect(page).toHaveURL(/\/$/);
    await expect(sourceCount(page)).toHaveText(`${total} sources`);
  });

  test('search matches name, feed URL, category and tag', async ({ page }) => {
    await gotoSources(page);
    const search = sourceSearch(page);

    await search.fill('bits & pieces');
    await expect(sourceNames(page)).toHaveText(['Bits & Pieces Weekly']);
    await expect(page).toHaveURL(/\?q=bits\+%26\+pieces$/);
    await expect(chips(page).getByRole('listitem').first()).toHaveText(
      'Search: bits & pieces',
    );

    await search.fill('3033/velvet-dom/atom');
    await expect(sourceNames(page)).toHaveText(['Velvet DOM']);

    await search.fill('WRITING & CRAFT');
    await expect(sourceRows(page)).toHaveCount(4);

    await search.fill('tech/python');
    await expect(sourceRows(page)).toHaveCount(
      SOURCES.filter((s) => s.tags.includes('tech/python')).length,
    );

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(search).toHaveValue('');
    await expect(page).toHaveURL(/\/$/);
  });

  test('search and facets combine', async ({ page }) => {
    await gotoSources(page);
    await sourceSearch(page).fill('news');
    await facetOption(page, 'Status', 'Active').click();
    const expected = SOURCES.filter(
      (s) =>
        s.status === 'active' &&
        [s.name, s.url, s.category, ...s.tags].some((f) =>
          f.toLowerCase().includes('news'),
        ),
    ).length;
    await expect(sourceRows(page)).toHaveCount(expected);
    await expect(page).toHaveURL(/\?q=news&status=active$/);
  });

  test('reload restores the filters, the search and the counts', async ({
    page,
  }) => {
    await gotoSources(page);
    await facetOption(page, 'Status', 'Proposed').click();
    await sourceSearch(page).fill('dev');
    await expect(page).toHaveURL(/\?q=dev&status=proposed$/);
    const names = await sourceNames(page).allTextContents();

    await page.reload();
    await waitForHydration(page);
    await expect(sourceSearch(page)).toHaveValue('dev');
    await expectFacet(page, 'Status', 'Proposed', names.length, true);
    await expect(sourceNames(page)).toHaveText(names);
  });

  test('Back returns to the filtered list after opening a source or another tab', async ({
    page,
  }) => {
    await gotoSources(page);
    await facetOption(page, 'Stale', 'Low value').click();
    await expect(sourceNames(page)).toHaveText([
      'Folio & Frame',
      'Token Tides',
    ]);

    await openSource(page, 'Token Tides');
    await deskTab(page, 'topics').click();
    await expect(page).toHaveURL(/tab=topics/);

    await page.goBack();
    await expect(page).toHaveURL(/\?stale=low-value&source=Token\+Tides$/);
    await expect(detailPane(page)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\?stale=low-value$/);
    await expect(detailPane(page)).toHaveCount(0);
    await expectFacet(page, 'Stale', 'Low value', 2, true);
    await expect(sourceNames(page)).toHaveText([
      'Folio & Frame',
      'Token Tides',
    ]);
  });
});
