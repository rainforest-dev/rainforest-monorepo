import { expect, test } from '@playwright/test';

import {
  detailPane,
  gotoSources,
  openSource,
  sourceRow,
  sourceRows,
  waitForHydration,
} from './support/desk';
import { FEED_ORIGIN } from './support/feed-server';
import { SOURCES } from './support/fixture-vault';
import { readVault, resetVault, SOURCES_FILE } from './support/vault';

test.beforeEach(() => resetVault());

const urlOf = (name: string): string => {
  const source = SOURCES.find((s) => s.name === name);
  if (!source) throw new Error(`No fixture source ${name}`);
  return source.url;
};

const openButton = (page: Parameters<typeof sourceRow>[0], name: string) =>
  sourceRow(page, name).getByRole('button', { name, exact: true });

test.describe('source detail pane', () => {
  test('clicking a name opens the pane, hides the wide columns and writes ?source=', async ({
    page,
  }) => {
    await gotoSources(page);
    const head = page.locator('thead');
    await expect(head.getByRole('columnheader')).toHaveText([
      'Source',
      'Category',
      'Tags',
      'Status',
      'Proposed',
      'Actions',
    ]);

    const pane = await openSource(page, 'Birch Compiler');
    await expect(page).toHaveURL(/\?source=Birch\+Compiler$/);
    await expect(head.getByRole('columnheader')).toHaveText([
      'Source',
      'Status',
      'Actions',
    ]);
    await expect(openButton(page, 'Birch Compiler')).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(pane).toContainText('Proposed');
    await expect(pane).toContainText('Uncategorised');
    await expect(pane.getByRole('definition').first()).toContainText(
      urlOf('Birch Compiler'),
    );
    await expect(pane).toContainText('2026-09-10');
    await expect(pane.getByRole('button', { name: 'Activate' })).toBeVisible();
  });

  test('clicking elsewhere on a row opens it too, and another row switches the pane', async ({
    page,
  }) => {
    await gotoSources(page);
    await sourceRow(page, 'Ferry Ops').getByText('Active').click();
    const pane = detailPane(page);
    await expect(
      pane.getByRole('heading', { level: 2, name: 'Ferry Ops' }),
    ).toBeVisible();

    await openButton(page, 'Token Tides').click();
    await expect(
      pane.getByRole('heading', { level: 2, name: 'Token Tides' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\?source=Token\+Tides$/);
  });

  test('?source= opens the pane from the server and survives reload', async ({
    page,
  }) => {
    await page.goto('/?source=Bits+%26+Pieces+Weekly');
    const pane = detailPane(page);
    await expect(
      pane.getByRole('heading', { level: 2, name: 'Bits & Pieces Weekly' }),
    ).toBeVisible();
    await waitForHydration(page);
    await page.reload();
    await expect(
      pane.getByRole('heading', { level: 2, name: 'Bits & Pieces Weekly' }),
    ).toBeVisible();
  });

  test('an unknown ?source= says so', async ({ page }) => {
    await gotoSources(page, '?source=Nope');
    await expect(detailPane(page)).toContainText('No source named “Nope”');
  });

  test('the close button closes the pane and focus returns to the row', async ({
    page,
  }) => {
    await gotoSources(page);
    const pane = await openSource(page, 'Signal Garden');
    await pane.getByRole('button', { name: 'Close details' }).click();
    await expect(detailPane(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(openButton(page, 'Signal Garden')).toBeFocused();
  });

  test('Esc closes the pane and focus returns to the row', async ({ page }) => {
    await gotoSources(page);
    const pane = await openSource(page, 'Dispatch Nine');
    await pane.getByRole('button', { name: 'Validate feed' }).focus();
    await page.keyboard.press('Escape');
    await expect(detailPane(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(openButton(page, 'Dispatch Nine')).toBeFocused();
  });

  test('Esc in the search field leaves the pane open', async ({ page }) => {
    await gotoSources(page);
    await openSource(page, 'Dispatch Nine');
    await page.getByRole('searchbox', { name: 'Search sources' }).focus();
    await page.keyboard.press('Escape');
    await expect(detailPane(page)).toBeVisible();
  });

  test('Back closes the pane and focus returns to the row', async ({
    page,
  }) => {
    await gotoSources(page);
    const pane = await openSource(page, 'Folio & Frame');
    await pane.getByRole('button', { name: 'Close details' }).focus();
    await page.goBack();
    await expect(detailPane(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(openButton(page, 'Folio & Frame')).toBeFocused();

    await page.goForward();
    await expect(
      detailPane(page).getByRole('heading', { name: 'Folio & Frame' }),
    ).toBeVisible();
  });

  const STALE_CASES: Array<{
    name: string;
    title: string;
    body: string;
    fix: string | null;
  }> = [
    {
      name: 'Signal Garden',
      title: 'Feed dead',
      body: '404 since 2026-08-02',
      fix: 'Validate the feed below. If it is still down, retire the source.',
    },
    {
      name: 'Ferry Ops',
      title: 'Delivery gap',
      body: 'feed has 12 new items, Reader shows none',
      fix: 'Re-subscribe in Readwise: paste the feed URL into Add feeds (Shift + A).',
    },
    {
      name: 'Token Tides',
      title: 'Low value',
      body: 'mostly reposted press releases',
      fix: 'Retire it unless the last few weeks changed your mind.',
    },
    {
      name: 'Folio & Frame',
      title: 'Low value',
      body: 'The feed publishes, but little of it is worth reading.',
      fix: 'Retire it unless the last few weeks changed your mind.',
    },
    {
      name: 'Prompt Almanac',
      title: 'Unspecified',
      body: 'no posts since the spring',
      fix: null,
    },
  ];

  for (const { name, title, body, fix } of STALE_CASES) {
    test(`the stale Alert for ${name} reads ${title}`, async ({ page }) => {
      await gotoSources(page, `?source=${encodeURIComponent(name)}`);
      const alert = detailPane(page).getByRole('alert');
      await expect(alert).toHaveCount(1);
      await expect(alert).toContainText(title);
      await expect(alert).toContainText(body);
      if (fix) await expect(alert).toContainText(fix);
      else await expect(alert.locator('p')).toHaveCount(1);
    });
  }

  test('a delivery-gap source offers Re-subscribe and says why not Retire', async ({
    page,
  }) => {
    await gotoSources(page, '?source=Ferry+Ops');
    const pane = detailPane(page);
    await expect(
      pane.getByRole('link', { name: 'Re-subscribe' }),
    ).toBeVisible();
    await expect(pane.getByRole('button', { name: 'Retire' })).toHaveCount(0);
    await expect(pane).toContainText(
      'Not offered for retirement: the feed still publishes, and Readwise is the part that stopped.',
    );
  });

  test('a retired source shows no stale Alert, though the vault keeps the comment', async ({
    page,
  }) => {
    expect(readVault(SOURCES_FILE)).toContain(
      '**Faded Signals** #domain/news <!-- stale: feed-dead',
    );
    await gotoSources(page, '?source=Faded+Signals');
    const pane = detailPane(page);
    await expect(
      pane.getByRole('heading', { name: 'Faded Signals' }),
    ).toBeVisible();
    await expect(pane.getByRole('alert')).toHaveCount(0);
    await expect(pane).not.toContainText('Feed dead');
  });

  test('Validate feed checks the source against the feed server', async ({
    page,
  }) => {
    await gotoSources(page, '?source=Lantern+Notes');
    const pane = detailPane(page);
    await pane.getByRole('button', { name: 'Validate feed' }).click();
    const result = pane.getByRole('alert');
    await expect(result).toContainText('Valid RSS feed');
    await expect(result).toContainText('Title: Lantern Notes');
    await expect(result).toContainText('3 items found');

    await gotoSources(page, '?source=Velvet+DOM');
    await detailPane(page)
      .getByRole('button', { name: 'Validate feed' })
      .click();
    await expect(detailPane(page).getByRole('alert')).toContainText(
      'Valid ATOM feed',
    );
  });

  test('Validate feed reports a dead feed', async ({ page }) => {
    await gotoSources(page, '?source=Signal+Garden');
    const pane = detailPane(page);
    await pane.getByRole('button', { name: 'Validate feed' }).click();
    await expect(pane.getByRole('alert').last()).toContainText('HTTP 404');
  });

  test('a no-RSS source offers a Validate form prefilled with its URL', async ({
    page,
  }) => {
    await gotoSources(page, '?source=Studio+Halcyon');
    const pane = detailPane(page);
    const input = pane.getByRole('textbox', { name: 'Feed URL' });
    await expect(input).toHaveValue(`${FEED_ORIGIN}/studio-halcyon`);
    await input.fill(`${FEED_ORIGIN}/feeds/rss.xml`);
    await pane.getByRole('button', { name: 'Validate' }).click();
    await expect(pane.getByRole('alert')).toContainText('Valid RSS feed');
  });

  test('the copy button puts the feed URL on the clipboard', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoSources(page, '?source=Quiet+Kernel');
    const pane = detailPane(page);
    await pane.getByRole('button', { name: 'Copy feed URL' }).click();
    await expect(
      pane.getByRole('button', { name: 'Feed URL copied' }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      urlOf('Quiet Kernel'),
    );
  });

  test('Activate in the pane writes the vault through the existing request', async ({
    page,
  }) => {
    await gotoSources(page, '?source=Owl+Street+Essays');
    const pane = detailPane(page);
    const patch = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/sources') && r.request().method() === 'PATCH',
    );
    await pane.getByRole('button', { name: 'Activate' }).click();
    expect((await patch).request().postDataJSON()).toEqual({
      name: 'Owl Street Essays',
      action: 'activate',
    });
    await expect(pane.getByRole('button', { name: 'Retire' })).toBeVisible();
    expect(readVault(SOURCES_FILE)).toContain('- [x] **Owl Street Essays**');
    await expect(sourceRows(page)).toHaveCount(30);
  });
});
