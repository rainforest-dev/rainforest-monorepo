import { expect, type Page, test } from '@playwright/test';

import {
  bulkButton,
  bulkToolbar,
  deskTab,
  gotoSources,
  gotoTab,
  READ_ONLY_NOTE,
  rowCheckbox,
  sectionOf,
  selectedCount,
  startSelecting,
  toasts,
  topicRow,
  topicRows,
  topicSearch,
  topicsGrid,
  topicStatus,
  topicStatusButton,
  waitForHydration,
} from './support/desk';
import { TOPICS, type TopicStatus } from './support/fixture-vault';
import {
  canDropWritePermission,
  makeReadOnly,
  readVault,
  resetVault,
  TOPICS_FILE,
  writeVaultFile,
} from './support/vault';

test.beforeEach(() => resetVault());

const countOf = (status: TopicStatus): number =>
  TOPICS.filter((t) => t.status === status).length;

const ORDER = [
  'Accessibility audits',
  'Data visualisation',
  'Home lab networking',
  'Local-first apps',
  'Developer tooling',
  'Edge infrastructure',
  'Small language models',
  'Type & layout',
  'Web platform & CSS',
  'Celebrity tech',
  'Crypto markets',
  'Gaming hardware',
];

const rowNames = (page: Page) => topicRows(page).locator('p.font-medium');

function countPatches(page: Page): unknown[] {
  const bodies: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().endsWith('/api/topics'))
      bodies.push(request.postDataJSON());
  });
  return bodies;
}

async function select(page: Page, names: readonly string[]): Promise<void> {
  for (const name of names) await rowCheckbox(page, name).click();
}

async function expectStatusCounts(
  page: Page,
  counts: Record<'All' | 'Proposed' | 'Active' | 'Declined', number>,
): Promise<void> {
  for (const [label, n] of Object.entries(counts))
    await expect(topicStatusButton(page, label)).toHaveAccessibleName(
      `${label} ${n}`,
    );
}

test.describe('topics table', () => {
  test('lists topics proposed first, then active, then declined', async ({
    page,
  }) => {
    await gotoTab(page, 'topics');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Topics' }),
    ).toBeVisible();
    await expect(topicsGrid(page).getByRole('columnheader')).toHaveText([
      'Topic',
      'Tags',
      'Status',
      'Proposed',
      'Actions',
    ]);
    await expect(rowNames(page)).toHaveText(ORDER);

    const proposed = topicRow(page, 'Home lab networking');
    await expect(proposed).toContainText('VLANs, DNS and routers at home');
    await expect(proposed).not.toContainText('proposed by rss-discover');
    await expect(proposed).toContainText('Proposed');
    await expect(proposed).toContainText(/\d+d ago|today/);
    await expect(proposed).toContainText('domain/infra');
    await expect(proposed.getByRole('button')).toHaveText([
      'Activate',
      'Decline',
    ]);

    await expect(
      topicRow(page, 'Crypto markets').getByRole('button'),
    ).toHaveText(['Activate']);
    await expect(
      topicRow(page, 'Web platform & CSS').getByRole('button'),
    ).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('the status ToggleGroup counts, filters and lives in the URL', async ({
    page,
  }) => {
    await gotoSources(page);
    await deskTab(page, 'topics').click();
    await expect(page).toHaveURL(/\?tab=topics$/);
    await expectStatusCounts(page, {
      All: TOPICS.length,
      Proposed: countOf('proposed'),
      Active: countOf('active'),
      Declined: countOf('declined'),
    });
    await expect(topicStatusButton(page, 'All')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await topicStatusButton(page, 'Proposed').click();
    await expect(page).toHaveURL(/\?tab=topics&tstatus=proposed$/);
    await expect(topicStatusButton(page, 'Proposed')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(topicRows(page)).toHaveCount(countOf('proposed'));

    await topicStatusButton(page, 'Proposed').click();
    await expect(page).toHaveURL(/\?tab=topics&tstatus=proposed$/);
    await expect(topicRows(page)).toHaveCount(countOf('proposed'));

    await page.reload();
    await waitForHydration(page);
    await expect(topicStatusButton(page, 'Proposed')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(topicRows(page)).toHaveCount(countOf('proposed'));

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\?tab=topics&tstatus=proposed$/);
    await expect(topicRows(page)).toHaveCount(countOf('proposed'));

    await topicStatusButton(page, 'Declined').click();
    await expect(rowNames(page)).toHaveText([
      'Celebrity tech',
      'Crypto markets',
      'Gaming hardware',
    ]);
    await topicStatusButton(page, 'All').click();
    await expect(page).toHaveURL(/\?tab=topics$/);
    await expect(topicRows(page)).toHaveCount(TOPICS.length);
  });

  test('search filters by name, description and tag, and survives reload and Back', async ({
    page,
  }) => {
    await gotoSources(page);
    await deskTab(page, 'topics').click();
    await page.keyboard.press('/');
    await expect(topicSearch(page)).toBeFocused();
    await page.keyboard.type('network');
    await expect(page).toHaveURL(/\?tab=topics&tq=network$/);
    await expect(rowNames(page)).toHaveText([
      'Home lab networking',
      'Edge infrastructure',
    ]);
    await expectStatusCounts(page, {
      All: 2,
      Proposed: 1,
      Active: 1,
      Declined: 0,
    });

    await topicSearch(page).fill('domain/news');
    await expect(rowNames(page)).toHaveText([
      'Celebrity tech',
      'Crypto markets',
      'Gaming hardware',
    ]);

    await topicSearch(page).fill('network');
    await expect(page).toHaveURL(/\?tab=topics&tq=network$/);
    await page.reload();
    await waitForHydration(page);
    await expect(topicSearch(page)).toHaveValue('network');
    await expect(topicRows(page)).toHaveCount(2);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(topicSearch(page)).toHaveValue('network');
    await expect(topicRows(page)).toHaveCount(2);

    await topicStatusButton(page, 'Declined').click();
    await expect(page.getByText('No topics here')).toBeVisible();
    await page.getByRole('button', { name: 'Show all topics' }).click();
    await expect(page).toHaveURL(/\?tab=topics$/);
    await expect(topicSearch(page)).toHaveValue('');
    await expect(topicRows(page)).toHaveCount(TOPICS.length);
  });
});

test.describe('topics: select mode and bulk writes', () => {
  test('applicable counts follow the owner rules, across status filters', async ({
    page,
  }) => {
    await gotoTab(page, 'topics');
    await startSelecting(page);
    await expect(topicsGrid(page)).toHaveAttribute(
      'aria-multiselectable',
      'true',
    );
    await select(page, ['Web platform & CSS', 'Crypto markets']);
    await expect(selectedCount(page)).toHaveText('2 selected');
    await expect(topicStatus(page)).toHaveCount(0);
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 1');
    const decline = bulkButton(page, 'Decline');
    await expect(decline).toHaveText('Decline 0');
    await expect(decline).toBeDisabled();
    await expect(decline).toHaveAttribute(
      'title',
      'None of the selected topics can be declined. Decline applies to proposed topics.',
    );
    await expect(topicRow(page, 'Crypto markets')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await topicRow(page, 'Home lab networking').getByText('Proposed').click();
    await expect(selectedCount(page)).toHaveText('3 selected');
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 2');
    await expect(bulkButton(page, 'Decline')).toHaveText('Decline 1');

    await topicSearch(page).fill('network');
    await expect(rowNames(page)).toHaveText([
      'Home lab networking',
      'Edge infrastructure',
    ]);
    await expect(selectedCount(page)).toHaveText('3 selected');
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 2');
    await bulkToolbar(page)
      .getByRole('button', { name: 'Select all 2 shown' })
      .click();
    await expect(selectedCount(page)).toHaveText('4 selected');
    await expect(
      page.getByRole('checkbox', { name: 'Select all shown' }),
    ).toHaveAttribute('aria-checked', 'true');

    await bulkToolbar(page).getByRole('button', { name: 'Done' }).click();
    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(topicStatus(page)).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Select all shown' }),
    ).toHaveCount(0);
  });

  test('Activate N writes once and moves proposed and declined topics to Active', async ({
    page,
  }) => {
    const patches = countPatches(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/topics', async (route) => {
      if (route.request().method() === 'PATCH') await held;
      await route.continue();
    });
    await gotoTab(page, 'topics');
    await startSelecting(page);
    await select(page, [
      'Home lab networking',
      'Crypto markets',
      'Edge infrastructure',
    ]);
    const button = bulkButton(page, 'Activate');
    await expect(button).toHaveText('Activate 2');
    await button.click();

    await expect(button).toBeDisabled();
    await expect(button).toContainText('Activate 2');
    await expect(button.getByRole('status', { name: 'Loading' })).toBeVisible();
    await expect(topicRow(page, 'Crypto markets')).toHaveAttribute(
      'data-pending',
      'true',
    );
    await expect(
      topicRow(page, 'Data visualisation').getByRole('button', {
        name: 'Activate',
      }),
    ).toBeEnabled();

    release();
    const toast = toasts(page);
    await expect(toast).toContainText('Activated 2 topics');
    await expect(toast).toContainText('Written to RSS-Topic-Registry.md');
    expect(patches).toEqual([
      { names: ['Home lab networking', 'Crypto markets'], action: 'activate' },
    ]);

    const markdown = readVault(TOPICS_FILE);
    for (const name of ['Home lab networking', 'Crypto markets']) {
      expect(sectionOf(markdown, name)).toBe('Active');
      expect(markdown).toContain(`- [x] **${name}**`);
    }
    expect(sectionOf(markdown, 'Edge infrastructure')).toBe('Active');

    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(topicRow(page, 'Crypto markets')).toContainText('Active');
    await expect(
      page.getByRole('tab', {
        name: `Topics ${countOf('proposed') - 1} proposed`,
      }),
    ).toBeVisible();
    await expectStatusCounts(page, {
      All: TOPICS.length,
      Proposed: countOf('proposed') - 1,
      Active: countOf('active') + 2,
      Declined: countOf('declined') - 1,
    });
  });

  test('Decline N writes once and moves proposed topics to Declined', async ({
    page,
  }) => {
    const patches = countPatches(page);
    await gotoTab(page, 'topics');
    await startSelecting(page);
    await select(page, [
      'Data visualisation',
      'Local-first apps',
      'Web platform & CSS',
    ]);
    await expect(bulkButton(page, 'Decline')).toHaveText('Decline 2');
    await bulkButton(page, 'Decline').click();

    await expect(toasts(page)).toContainText('Declined 2 topics');
    expect(patches).toEqual([
      { names: ['Data visualisation', 'Local-first apps'], action: 'decline' },
    ]);
    const markdown = readVault(TOPICS_FILE);
    for (const name of ['Data visualisation', 'Local-first apps']) {
      expect(sectionOf(markdown, name)).toBe('Declined');
      expect(markdown).toContain(`- [ ] **${name}**`);
    }
    expect(sectionOf(markdown, 'Web platform & CSS')).toBe('Active');
    await expect(rowNames(page).last()).toHaveText('Local-first apps');
  });

  test('a rejected batch names the topic, leaves the file and keeps the selection', async ({
    page,
  }) => {
    await gotoTab(page, 'topics');
    await startSelecting(page);
    await select(page, ['Home lab networking', 'Data visualisation']);
    const edited = readVault(TOPICS_FILE).replace(
      '**Data visualisation**',
      '**Data visualization**',
    );
    writeVaultFile(TOPICS_FILE, edited);

    const patch = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/topics') && r.request().method() === 'PATCH',
    );
    await bulkButton(page, 'Activate').click();
    expect((await patch).status()).toBe(409);

    const toast = toasts(page);
    await expect(toast).toContainText("Couldn't activate 2 topics");
    await expect(toast).toContainText(
      'Data visualisation (not in the registry)',
    );
    expect(readVault(TOPICS_FILE)).toBe(edited);
    await expect(selectedCount(page)).toHaveText('2 selected');
    await expect(rowCheckbox(page, 'Home lab networking')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(topicRow(page, 'Home lab networking')).toContainText(
      'Proposed',
    );
    await expect(bulkButton(page, 'Activate')).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a row action goes through the batch endpoint with one name', async ({
    page,
  }) => {
    const patches = countPatches(page);
    await gotoTab(page, 'topics');
    await topicRow(page, 'Accessibility audits')
      .getByRole('button', { name: 'Decline' })
      .click();
    await expect(toasts(page)).toContainText('Declined Accessibility audits');
    expect(patches).toEqual([
      { names: ['Accessibility audits'], action: 'decline' },
    ]);
    expect(sectionOf(readVault(TOPICS_FILE), 'Accessibility audits')).toBe(
      'Declined',
    );
    await expect(topicRow(page, 'Accessibility audits')).toContainText(
      'Declined',
    );
  });
});

test.describe('topics: read-only vault', () => {
  test.skip(!canDropWritePermission, 'root ignores the permission bits');

  test('the banner shows, writes are off, and selecting still works', async ({
    page,
  }) => {
    makeReadOnly(TOPICS_FILE);
    const patches = countPatches(page);
    await gotoTab(page, 'topics');
    await expect(page.getByRole('status')).toContainText('Read-only vault');
    for (const action of ['Activate', 'Decline']) {
      const button = topicRow(page, 'Local-first apps').getByRole('button', {
        name: action,
      });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('title', READ_ONLY_NOTE);
    }

    await startSelecting(page);
    await select(page, ['Local-first apps', 'Gaming hardware']);
    await expect(selectedCount(page)).toHaveText('2 selected');
    for (const [action, n] of [
      ['Activate', 2],
      ['Decline', 1],
    ] as const) {
      const button = bulkButton(page, action);
      await expect(button).toHaveText(`${action} ${n}`);
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('title', READ_ONLY_NOTE);
    }
    expect(patches).toEqual([]);
  });

  test('a write that hits a read-only file shows the banner, not a toast', async ({
    page,
  }) => {
    await gotoTab(page, 'topics');
    await startSelecting(page);
    await select(page, ['Home lab networking']);
    const before = readVault(TOPICS_FILE);
    makeReadOnly(TOPICS_FILE);

    const patch = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/topics') && r.request().method() === 'PATCH',
    );
    await bulkButton(page, 'Decline').click();
    expect((await patch).status()).toBe(409);

    await expect(page.getByRole('status')).toContainText(READ_ONLY_NOTE);
    await expect(toasts(page)).toHaveCount(0);
    await expect(bulkButton(page, 'Decline')).toBeDisabled();
    await expect(selectedCount(page)).toHaveText('1 selected');
    expect(readVault(TOPICS_FILE)).toBe(before);
  });
});
