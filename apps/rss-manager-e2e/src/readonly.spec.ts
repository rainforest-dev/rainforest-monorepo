import { expect, test } from '@playwright/test';

import {
  bulkButton,
  deskTab,
  detailPane,
  gotoSources,
  gotoTab,
  openValidate,
  READ_ONLY_BANNER,
  READ_ONLY_NOTE,
  READER_FEEDS_URL,
  rowCheckbox,
  selectedCount,
  sourceRow,
  startSelecting,
  toasts,
  topicCard,
} from './support/desk';
import { FEEDS } from './support/feed-server';
import {
  canDropWritePermission,
  makeReadOnly,
  readVault,
  resetVault,
  SOURCES_FILE,
  TOPICS_FILE,
} from './support/vault';

test.skip(!canDropWritePermission, 'root ignores the permission bits');

test.beforeEach(() => resetVault());

test.describe('read-only vault', () => {
  test('sources load read-only with the banner and disabled actions', async ({
    page,
  }) => {
    makeReadOnly(SOURCES_FILE);
    await gotoTab(page, 'sources');

    const banner = page.getByRole('status');
    await expect(banner).toContainText('Read-only vault');
    await expect(banner).toContainText(READ_ONLY_BANNER);
    for (const [name, action] of [
      ['Birch Compiler', 'Activate'],
      ['Byte Ledger', 'Retire'],
    ] as const) {
      const button = sourceRow(page, name).getByRole('button', {
        name: action,
      });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('title', READ_ONLY_NOTE);
    }
    await expect(
      sourceRow(page, 'Ferry Ops').getByRole('link', { name: 'Re-subscribe' }),
    ).toBeVisible();

    await deskTab(page, 'topics').click();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('Validate still works on a read-only vault', async ({ page }) => {
    makeReadOnly(SOURCES_FILE);
    makeReadOnly(TOPICS_FILE);
    await gotoTab(page, 'sources');
    const popover = await openValidate(page);
    await popover.getByRole('textbox', { name: 'Feed URL' }).fill(FEEDS.rss);
    await popover.getByRole('button', { name: 'Validate' }).click();
    await expect(popover.getByRole('alert')).toContainText('Valid RSS feed');
  });

  test('topics load read-only with the banner and disabled actions', async ({
    page,
  }) => {
    makeReadOnly(TOPICS_FILE);
    await gotoTab(page, 'topics');

    const banner = page.getByRole('status');
    await expect(banner).toContainText('Read-only vault');
    await expect(banner).toContainText(READ_ONLY_BANNER);
    const card = topicCard(page, 'Local-first apps');
    for (const action of ['Activate', 'Decline']) {
      const button = card.getByRole('button', { name: action });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('title', READ_ONLY_NOTE);
    }
  });

  test('a write that hits a read-only file flips the sources view', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');
    await expect(page.getByRole('status')).toHaveCount(0);
    const before = readVault(SOURCES_FILE);

    makeReadOnly(SOURCES_FILE);
    const patch = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/sources') && r.request().method() === 'PATCH',
    );
    await sourceRow(page, 'Birch Compiler')
      .getByRole('button', { name: 'Activate' })
      .click();
    expect((await patch).status()).toBe(409);

    await expect(page.getByRole('status')).toContainText(READ_ONLY_NOTE);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
      sourceRow(page, 'Birch Compiler').getByRole('button', {
        name: 'Activate',
      }),
    ).toBeDisabled();
    await expect(sourceRow(page, 'Birch Compiler')).toContainText('Proposed');
    expect(readVault(SOURCES_FILE)).toBe(before);
  });

  test('a write that hits a read-only file flips the topics view', async ({
    page,
  }) => {
    await gotoTab(page, 'topics');
    const before = readVault(TOPICS_FILE);

    makeReadOnly(TOPICS_FILE);
    await topicCard(page, 'Accessibility audits')
      .getByRole('button', { name: 'Decline' })
      .click();

    await expect(page.getByRole('status')).toContainText(READ_ONLY_NOTE);
    await expect(
      topicCard(page, 'Accessibility audits').getByRole('button', {
        name: 'Activate',
      }),
    ).toBeDisabled();
    expect(readVault(TOPICS_FILE)).toBe(before);
  });

  test('bulk buttons are disabled on a read-only vault, but selecting works', async ({
    page,
  }) => {
    makeReadOnly(SOURCES_FILE);
    await gotoTab(page, 'sources');
    await startSelecting(page);
    await rowCheckbox(page, 'Birch Compiler').click();
    await rowCheckbox(page, 'Token Tides').click();
    await expect(selectedCount(page)).toHaveText('2 selected');
    for (const [action, n] of [
      ['Activate', 1],
      ['Retire', 2],
    ] as const) {
      const button = bulkButton(page, action);
      await expect(button).toHaveText(`${action} ${n}`);
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('title', READ_ONLY_NOTE);
    }
  });

  test('Re-subscribe still opens Readwise and copies on a read-only vault', async ({
    page,
    context,
  }) => {
    makeReadOnly(SOURCES_FILE);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.route('https://read.readwise.io/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Feeds</title>' }),
    );
    await gotoSources(page, '?source=Ferry+Ops');
    const before = readVault(SOURCES_FILE);

    const opened = context.waitForEvent('page');
    await detailPane(page).getByRole('link', { name: 'Re-subscribe' }).click();
    expect((await opened).url()).toBe(READER_FEEDS_URL);
    await expect(detailPane(page)).toContainText(
      'Re-subscribed in this session',
    );
    await page.bringToFront();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      '/ferry-ops/',
    );
    expect(readVault(SOURCES_FILE)).toBe(before);
  });

  test('a batch write that hits a read-only file shows the banner, not a toast', async ({
    page,
  }) => {
    await gotoTab(page, 'sources');
    await startSelecting(page);
    await rowCheckbox(page, 'Birch Compiler').click();
    await rowCheckbox(page, 'Cinder Blog').click();
    const before = readVault(SOURCES_FILE);

    makeReadOnly(SOURCES_FILE);
    const patch = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/sources') && r.request().method() === 'PATCH',
    );
    await bulkButton(page, 'Activate').click();
    const response = await patch;
    expect(response.status()).toBe(409);
    expect(response.request().postDataJSON()).toEqual({
      names: ['Birch Compiler', 'Cinder Blog'],
      action: 'activate',
    });

    await expect(page.getByRole('status')).toContainText(READ_ONLY_NOTE);
    await expect(bulkButton(page, 'Activate')).toBeDisabled();
    await expect(bulkButton(page, 'Activate')).toHaveAttribute(
      'title',
      READ_ONLY_NOTE,
    );
    await expect(selectedCount(page)).toHaveText('2 selected');
    await expect(toasts(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(readVault(SOURCES_FILE)).toBe(before);
  });
});
