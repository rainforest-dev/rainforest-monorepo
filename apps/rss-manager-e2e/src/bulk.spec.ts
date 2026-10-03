import { expect, type Page, test } from '@playwright/test';

import {
  bulkButton,
  bulkToolbar,
  facetOption,
  gotoSources,
  pager,
  rowCheckbox,
  sectionOf,
  selectedCount,
  sourceRow,
  sourceRows,
  startSelecting,
  toasts,
} from './support/desk';
import {
  readVault,
  resetVault,
  SOURCES_FILE,
  writeVaultFile,
} from './support/vault';

test.beforeEach(() => resetVault());

function countPatches(page: Page): { bodies: unknown[] } {
  const seen = { bodies: [] as unknown[] };
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().endsWith('/api/sources'))
      seen.bodies.push(request.postDataJSON());
  });
  return seen;
}

async function select(page: Page, names: readonly string[]): Promise<void> {
  for (const name of names) await rowCheckbox(page, name).click();
}

test.describe('select mode and bulk writes', () => {
  test('Select adds the checkbox column; the header checkbox covers the page', async ({
    page,
  }) => {
    await gotoSources(page);
    await expect(page.getByRole('checkbox', { name: /^Select / })).toHaveCount(
      0,
    );
    await startSelecting(page);
    await expect(sourceRows(page).getByRole('checkbox')).toHaveCount(30);

    const header = page.getByRole('checkbox', {
      name: 'Select all on this page',
    });
    await header.click();
    await expect(selectedCount(page)).toHaveText('30 selected');
    await expect(header).toHaveAttribute('aria-checked', 'true');

    await rowCheckbox(page, 'Birch Compiler').click();
    await expect(selectedCount(page)).toHaveText('29 selected');
    await expect(header).toHaveAttribute('aria-checked', 'mixed');

    await bulkToolbar(page)
      .getByRole('button', { name: 'Select all 30 on this page' })
      .click();
    await expect(selectedCount(page)).toHaveText('30 selected');
    await expect(
      bulkToolbar(page).getByRole('button', { name: /^Select all/ }),
    ).toHaveCount(0);

    await header.click();
    await expect(bulkToolbar(page)).toHaveCount(0);

    await rowCheckbox(page, 'Cinder Blog').click();
    await bulkToolbar(page).getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('checkbox', { name: /^Select / })).toHaveCount(
      0,
    );
    await startSelecting(page);
    await expect(rowCheckbox(page, 'Cinder Blog')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(bulkToolbar(page)).toHaveCount(0);
  });

  test('applicable counts cover the whole selection, across pages and filters', async ({
    page,
  }) => {
    await gotoSources(page);
    await startSelecting(page);
    await select(page, ['Birch Compiler', 'Ferry Ops', 'Token Tides']);
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 1');
    await expect(bulkButton(page, 'Retire')).toHaveText('Retire 2');

    await pager(page).getByRole('button', { name: 'Next' }).click();
    await select(page, ['Studio Halcyon']);
    await pager(page).getByRole('button', { name: 'Next' }).click();
    await select(page, ['Old Lamp Review']);
    await expect(selectedCount(page)).toHaveText('5 selected');
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 2');
    await expect(bulkButton(page, 'Retire')).toHaveText('Retire 3');

    await facetOption(page, 'Status', 'Retired').click();
    await expect(sourceRows(page)).toHaveCount(10);
    await expect(selectedCount(page)).toHaveText('5 selected');
    await expect(rowCheckbox(page, 'Old Lamp Review')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await rowCheckbox(page, 'Old Lamp Review').click();
    await expect(selectedCount(page)).toHaveText('4 selected');
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 1');
  });

  test('a bulk action that applies to none is disabled and says why', async ({
    page,
  }) => {
    await gotoSources(page);
    await startSelecting(page);
    await select(page, ['Ferry Ops']);
    for (const action of ['Activate', 'Retire'] as const) {
      const button = bulkButton(page, action);
      await expect(button).toHaveText(`${action} 0`);
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute(
        'title',
        /^None of the selected sources can be/,
      );
    }
  });

  test('Activate N writes the file once and moves every entry to Active', async ({
    page,
  }) => {
    const patches = countPatches(page);
    await gotoSources(page);
    await startSelecting(page);
    await select(page, ['Birch Compiler', 'Cinder Blog', 'Token Tides']);
    await pager(page).getByRole('button', { name: 'Next' }).click();
    await pager(page).getByRole('button', { name: 'Next' }).click();
    await select(page, ['Old Lamp Review']);
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 3');

    await bulkButton(page, 'Activate').click();

    const toast = toasts(page);
    await expect(toast).toContainText('Activated 3 sources');
    await expect(toast).toContainText('Written to RSS-Source-Registry.md');
    expect(patches.bodies).toEqual([
      {
        names: ['Birch Compiler', 'Cinder Blog', 'Old Lamp Review'],
        action: 'activate',
      },
    ]);

    const markdown = readVault(SOURCES_FILE);
    for (const name of ['Birch Compiler', 'Cinder Blog', 'Old Lamp Review']) {
      expect(sectionOf(markdown, name)).toBe('Active Sources');
      expect(markdown).toContain(`- [x] **${name}**`);
    }
    expect(sectionOf(markdown, 'Token Tides')).toBe('Active Sources');

    await expect(bulkToolbar(page)).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', { name: 'Select all on this page' }),
    ).toBeVisible();
  });

  test('Retire N writes once, keeps the stale comment and hides its badge', async ({
    page,
  }) => {
    const patches = countPatches(page);
    await gotoSources(page);
    await startSelecting(page);
    await select(page, ['Birch Compiler', 'Token Tides', 'Ferry Ops']);
    await expect(sourceRow(page, 'Token Tides')).toContainText('Low value');
    await expect(bulkButton(page, 'Retire')).toHaveText('Retire 2');

    await bulkButton(page, 'Retire').click();
    await expect(toasts(page)).toContainText('Retired 2 sources');
    expect(patches.bodies).toEqual([
      { names: ['Token Tides', 'Birch Compiler'], action: 'retire' },
    ]);

    const markdown = readVault(SOURCES_FILE);
    expect(sectionOf(markdown, 'Birch Compiler')).toBe('Retired');
    expect(sectionOf(markdown, 'Token Tides')).toBe('Retired');
    expect(sectionOf(markdown, 'Ferry Ops')).toBe('Active Sources');
    expect(markdown).toContain(
      '- [ ] **Token Tides** #domain/ai <!-- stale: low-value | mostly reposted press releases -->',
    );

    await facetOption(page, 'Status', 'Retired').click();
    const retired = sourceRow(page, 'Token Tides');
    await expect(retired).toContainText('Retired');
    await expect(retired).not.toContainText('Low value');
    await expect(
      retired.getByRole('button', { name: 'Activate' }),
    ).toBeVisible();
  });

  test('a pending bulk write shows a Spinner in its button and keeps the label', async ({
    page,
  }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/sources', async (route) => {
      if (route.request().method() === 'PATCH') await held;
      await route.continue();
    });
    await gotoSources(page);
    await startSelecting(page);
    await select(page, ['Birch Compiler', 'Cinder Blog']);
    await bulkButton(page, 'Activate').click();

    const button = bulkButton(page, 'Activate');
    await expect(button).toBeDisabled();
    await expect(button).toContainText('Activate 2');
    await expect(button.getByRole('status', { name: 'Loading' })).toBeVisible();
    await expect(bulkButton(page, 'Retire')).not.toContainText('Loading');
    await expect(sourceRow(page, 'Birch Compiler')).toHaveAttribute(
      'data-pending',
      'true',
    );
    await expect(
      sourceRow(page, 'Birch Compiler').getByRole('button', {
        name: 'Activate',
      }),
    ).toBeDisabled();
    await expect(sourceRow(page, 'Birch Compiler')).toContainText('Proposed');
    await expect(
      sourceRow(page, 'Copper Kettle Dev').getByRole('button', {
        name: 'Activate',
      }),
    ).toBeEnabled();

    release();
    await expect(toasts(page)).toContainText('Activated 2 sources');
    await expect(bulkToolbar(page)).toHaveCount(0);
  });

  test('a rejected batch names the source, leaves the file and keeps the selection', async ({
    page,
  }) => {
    await gotoSources(page);
    await startSelecting(page);
    await select(page, ['Birch Compiler', 'Cinder Blog']);
    await expect(bulkButton(page, 'Activate')).toHaveText('Activate 2');

    const edited = readVault(SOURCES_FILE).replace(
      '**Cinder Blog**',
      '**Cinder Log**',
    );
    writeVaultFile(SOURCES_FILE, edited);

    const patch = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/sources') && r.request().method() === 'PATCH',
    );
    await bulkButton(page, 'Activate').click();
    expect((await patch).status()).toBe(409);

    const toast = toasts(page);
    await expect(toast).toContainText("Couldn't activate 2 sources");
    await expect(toast).toContainText('Cinder Blog (not in the registry)');
    expect(readVault(SOURCES_FILE)).toBe(edited);
    await expect(selectedCount(page)).toHaveText('2 selected');
    await expect(rowCheckbox(page, 'Birch Compiler')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(sourceRow(page, 'Birch Compiler')).toContainText('Proposed');
    await expect(bulkButton(page, 'Activate')).toBeEnabled();
  });

  test('a row action goes through the batch endpoint with one name', async ({
    page,
  }) => {
    const patches = countPatches(page);
    await gotoSources(page);
    await sourceRow(page, 'Birch Compiler')
      .getByRole('button', { name: 'Retire' })
      .click();
    await expect(toasts(page)).toContainText('Retired Birch Compiler');
    expect(patches.bodies).toEqual([
      { names: ['Birch Compiler'], action: 'retire' },
    ]);
    expect(sectionOf(readVault(SOURCES_FILE), 'Birch Compiler')).toBe(
      'Retired',
    );
  });
});
