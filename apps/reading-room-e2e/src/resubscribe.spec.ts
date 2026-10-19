import { type BrowserContext, expect, type Page, test } from '@playwright/test';

import {
  deskTab,
  detailPane,
  gotoSources,
  openSource,
  READER_FEEDS_URL,
  sourceRow,
  waitForHydration,
} from './support/desk';
import { SOURCES } from './support/fixture-vault';
import { readVault, resetVault, SOURCES_FILE } from './support/vault';

const urlOf = (name: string): string => {
  const source = SOURCES.find((s) => s.name === name);
  if (!source) throw new Error(`No fixture source ${name}`);
  return source.url;
};

async function stubReader(context: BrowserContext): Promise<void> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route('https://read.readwise.io/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Feeds</title><p>Reader stand-in</p>',
    }),
  );
}

async function clipboardOf(page: Page): Promise<string> {
  await page.bringToFront();
  return page.evaluate(() => navigator.clipboard.readText());
}

const SESSION_NOTE = 'Re-subscribed in this session';

test.beforeEach(() => resetVault());

test.describe('Re-subscribe', () => {
  test('the row link opens Readwise, copies the feed URL and writes nothing', async ({
    page,
    context,
  }) => {
    await stubReader(context);
    const patches: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PATCH') patches.push(r.url());
    });
    await gotoSources(page);
    const before = readVault(SOURCES_FILE);

    const link = sourceRow(page, 'Ferry Ops').getByRole('link', {
      name: 'Re-subscribe',
    });
    await expect(link).toHaveAttribute('href', READER_FEEDS_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    const opened = context.waitForEvent('page');
    await link.click();
    const reader = await opened;
    await reader.waitForLoadState();
    expect(reader.url()).toBe(READER_FEEDS_URL);

    await expect(
      sourceRow(page, 'Ferry Ops').getByRole('link', { name: 'Copied' }),
    ).toBeVisible();
    expect(await clipboardOf(page)).toBe(urlOf('Ferry Ops'));
    await expect(
      sourceRow(page, 'Ferry Ops').getByRole('link', { name: 'Re-subscribe' }),
    ).toBeVisible({ timeout: 5000 });

    expect(readVault(SOURCES_FILE)).toBe(before);
    expect(patches).toEqual([]);
    await expect(sourceRow(page, 'Ferry Ops')).toContainText('Delivery gap');

    const pane = await openSource(page, 'Ferry Ops');
    await expect(pane).toContainText(SESSION_NOTE);
    await expect(pane.getByRole('alert')).toContainText('Delivery gap');
  });

  test('the pane link does the same, and the note lasts the session', async ({
    page,
    context,
  }) => {
    await stubReader(context);
    await gotoSources(page, '?source=Dispatch+Nine');
    const pane = detailPane(page);
    await expect(pane).not.toContainText(SESSION_NOTE);
    const before = readVault(SOURCES_FILE);

    const opened = context.waitForEvent('page');
    await pane.getByRole('link', { name: 'Re-subscribe' }).click();
    expect((await opened).url()).toBe(READER_FEEDS_URL);
    await expect(pane).toContainText(SESSION_NOTE);
    expect(await clipboardOf(page)).toBe(urlOf('Dispatch Nine'));
    expect(readVault(SOURCES_FILE)).toBe(before);

    await pane.getByRole('button', { name: 'Close details' }).click();
    await deskTab(page, 'topics').click();
    await deskTab(page, 'sources').click();
    await expect(await openSource(page, 'Dispatch Nine')).toContainText(
      SESSION_NOTE,
    );
    await expect(await openSource(page, 'Ferry Ops')).not.toContainText(
      SESSION_NOTE,
    );

    await page.reload();
    await waitForHydration(page);
    await expect(
      detailPane(page).getByRole('heading', { name: 'Ferry Ops' }),
    ).toBeVisible();
    await expect(await openSource(page, 'Dispatch Nine')).not.toContainText(
      SESSION_NOTE,
    );
  });
});
