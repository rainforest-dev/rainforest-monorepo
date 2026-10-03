import { expect, test } from '@playwright/test';

import { gotoTab, sourceRow, sourceRows } from './support/desk';
import {
  type FixtureSource,
  SOURCES,
  type SourceStatus,
} from './support/fixture-vault';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const countOf = (status: SourceStatus): number =>
  SOURCES.filter((s) => s.status === status).length;

const matches = (source: FixtureSource, text: string): boolean =>
  source.name.toLowerCase().includes(text) ||
  source.tags.some((t) => t.includes(text)) ||
  source.category.toLowerCase().includes(text);

test.describe('sources', () => {
  test('lists every source in the fixture vault', async ({ page }) => {
    await gotoTab(page, 'sources');
    expect(SOURCES.length).toBe(70);
    await expect(sourceRows(page)).toHaveCount(SOURCES.length);
    await expect(
      page.getByRole('button', { name: `All (${SOURCES.length})` }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('parses every section, stale type and the untyped legacy comment', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');
    await expect(sourceRow(page, 'Signal Garden')).toContainText('feed dead');
    await expect(sourceRow(page, 'Ferry Ops')).toContainText('delivery gap');
    await expect(sourceRow(page, 'Token Tides')).toContainText('low value');
    await expect(sourceRow(page, 'Prompt Almanac')).toContainText('flagged');
    await expect(sourceRow(page, 'Owl Street Essays')).toContainText(
      'proposed',
    );
    await expect(sourceRow(page, 'Studio Halcyon')).toContainText('no-rss');
    await expect(sourceRow(page, 'Faded Signals')).toContainText('retired');
    await expect(
      sourceRow(page, 'Ferry Ops').getByRole('link', { name: 'Re-subscribe' }),
    ).toBeVisible();
  });

  test('the status chips narrow the table', async ({ page }) => {
    await gotoTab(page, 'sources');
    for (const status of ['active', 'proposed', 'no-rss'] as const) {
      const chip = page.getByRole('button', {
        name: `${status} (${countOf(status)})`,
      });
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      await expect(sourceRows(page)).toHaveCount(countOf(status));
    }
    await page.getByRole('button', { name: /^All/ }).click();
    await expect(sourceRows(page)).toHaveCount(SOURCES.length);
  });

  test('the text filter matches name, tag and category', async ({ page }) => {
    await gotoTab(page, 'sources');
    const search = page.getByRole('searchbox', { name: 'Filter sources' });

    await search.fill('bits & pieces');
    await expect(sourceRows(page)).toHaveCount(1);
    await expect(sourceRow(page, 'Bits & Pieces Weekly')).toBeVisible();

    await search.fill('domain/design');
    await expect(sourceRows(page)).toHaveCount(
      SOURCES.filter((s) => matches(s, 'domain/design')).length,
    );

    await search.fill('writing & craft');
    await expect(sourceRows(page)).toHaveCount(4);
  });

  test('the text filter and a status chip combine', async ({ page }) => {
    await gotoTab(page, 'sources');
    await page.getByRole('searchbox', { name: 'Filter sources' }).fill('news');
    await page
      .getByRole('button', { name: `active (${countOf('active')})` })
      .click();
    const expected = SOURCES.filter(
      (s) => s.status === 'active' && matches(s, 'news'),
    ).length;
    await expect(sourceRows(page)).toHaveCount(expected);
  });

  test('a filter with no match says so', async ({ page }) => {
    await gotoTab(page, 'sources');
    await page
      .getByRole('searchbox', { name: 'Filter sources' })
      .fill('zzzz-no-such-source');
    await expect(sourceRows(page)).toHaveCount(0);
    await expect(
      page.getByText('No sources match the current filter.'),
    ).toBeVisible();
  });
});
