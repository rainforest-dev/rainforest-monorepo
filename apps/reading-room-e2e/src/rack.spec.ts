import { expect, type Page, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { waitForHydration } from './support/desk';
import { FEED_ORIGIN } from './support/feed-server';
import { QUEUE } from './support/fixture-vault';
import { hideDevToolbar } from './support/phone';
import {
  QUEUE_FILE,
  removeFile,
  resetVault,
  writeVaultFile,
} from './support/vault';

test.beforeEach(async ({ page }) => {
  resetVault();
  await hideDevToolbar(page);
});

const TIER_LABELS = [
  'Finish what you started',
  'Blind spot in your stack',
  'Wiki leverage',
  'Covered interest',
];

const shelf = (page: Page, label: string) =>
  page.getByRole('region', { name: new RegExp(`^${label} \\d+$`) });

test.describe('rack', () => {
  test('shelves the reading queue by tier, in rank order, with counts', async ({
    page,
  }) => {
    await page.goto('/rack');
    for (const [i, label] of TIER_LABELS.entries()) {
      const titles = QUEUE.titles
        .filter(([tier]) => tier === i + 1)
        .map(([, title]) => title);
      const region = shelf(page, label);
      await expect(
        region.getByRole('heading', { level: 2 }),
      ).toHaveAccessibleName(`${label} ${titles.length}`);
      await expect(region.getByRole('listitem')).toHaveCount(titles.length);
      await expect(region.locator('li .font-semibold')).toHaveText(titles);
    }
    await expect(page.getByText('generated 2026-09-30')).toBeVisible();
  });

  test('a card opens the article in Reader, in a new tab', async ({ page }) => {
    await page.goto('/rack');
    const [, title, minutes] = QUEUE.titles[0];
    const card = page.getByRole('link', { name: new RegExp(title) });
    await expect(card).toHaveAttribute('href', `${FEED_ORIGIN}/read/e2e-1`);
    await expect(card).toHaveAttribute('target', '_blank');
    await expect(card).toContainText(`example.test · ${minutes} min`);
    await expect(card).toContainText('fixture reason 1');
    await expect(card).toContainText('Time-sensitive');
  });

  test('the hall API shelves every queued article and links it to its card', async ({
    page,
    request,
  }) => {
    const res = await request.get('/rack/api/hall-items');
    expect(res.ok()).toBe(true);
    const { items } = (await res.json()) as {
      items: { kind: string; title: string; href: string; groups: string[] }[];
    };
    expect(items.map((i) => i.title)).toEqual(QUEUE.titles.map(([, t]) => t));
    expect(items.every((i) => i.kind === 'article')).toBe(true);
    expect(items[0].groups).toContain('tier:1');

    await page.goto(items[0].href);
    await expect(page).toHaveURL(/\/rack#article-e2e-0001$/);
    await expect(page.locator(':target')).toContainText(QUEUE.titles[0][1]);
  });

  test('the hall API is empty before the queue exists', async ({ request }) => {
    removeFile(QUEUE_FILE);
    const res = await request.get('/rack/api/hall-items');
    expect(await res.json()).toEqual({ items: [] });
  });

  test('a missing queue is an empty state, a broken one an error', async ({
    page,
  }) => {
    removeFile(QUEUE_FILE);
    await page.goto('/rack');
    await expect(
      page.getByText('No reading queue has been generated yet.'),
    ).toBeVisible();

    writeVaultFile(QUEUE_FILE, '{"generated": "2026-09-30", "queue": [');
    await page.goto('/rack');
    await expect(page.getByRole('alert')).toContainText(
      "Couldn't read the reading queue",
    );
  });

  test('links to the full queue table on the desk', async ({ page }) => {
    await page.goto('/rack');
    await page.getByRole('link', { name: 'Sources → Queue' }).click();
    await expect(page).toHaveURL(/\/rack\/sources\?tab=queue$/);
    await expect(
      page.getByRole('grid', { name: 'Reading queue' }),
    ).toBeVisible();
  });

  test('has no axe violations', async ({ page }) => {
    await page.goto('/rack');
    await waitForHydration(page);
    await expectNoViolations(page);
  });
});

test.describe('library shell', () => {
  // These read the Chinese copy; locale.spec.ts covers the English side.
  test.use({ locale: 'zh-TW' });

  test('the top bar names the room, links every collection and marks the rack', async ({
    page,
  }) => {
    await page.goto('/rack');
    const banner = page.getByRole('banner');
    await expect(
      banner.getByRole('heading', { level: 1, name: '閱覽室' }),
    ).toBeVisible();
    const collections = banner.getByRole('navigation', { name: '館藏' });
    await expect(collections.getByRole('link')).toHaveText([
      '大廳',
      '書',
      '筆記本',
      '報架',
      '知識庫',
    ]);
    await expect(
      collections.getByRole('link', { name: '報架' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(collections.getByRole('link', { name: '書' })).toHaveAttribute(
      'href',
      '/books',
    );

    const sections = banner.getByRole('navigation', { name: '閱覽室' });
    await expect(sections.getByRole('link', { name: '報架' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await sections.getByRole('link', { name: '來源' }).click();
    await expect(page).toHaveURL(/\/rack\/sources$/);
    await expect(
      page
        .getByRole('navigation', { name: '閱覽室' })
        .getByRole('link', { name: '來源' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('loads the shared /_shell assets, view transitions and prerender rules', async ({
    page,
  }) => {
    await page.goto('/rack');
    const css = page.locator(
      'link[rel="stylesheet"][href="/_shell/shell.css"]',
    );
    await expect(css).toHaveCount(1);
    const res = await page.request.get('/_shell/shell.css');
    expect(res.ok()).toBe(true);
    expect(await res.text()).toContain("'Inter Variable'");

    const rules = JSON.parse(
      (await page.locator('script[type="speculationrules"]').textContent()) ??
        '{}',
    ) as { prerender: unknown[] };
    expect(rules.prerender).toHaveLength(1);

    await expect(page.getByRole('banner')).toHaveCSS(
      'view-transition-name',
      'library-shell-header',
    );
  });

  test('remembers where the rack was left, for the other collections to link back', async ({
    page,
  }) => {
    await page.goto('/rack/sources?tab=topics');
    await waitForHydration(page);
    await page.goto('/kb');
    await waitForHydration(page);
    await expect(
      page
        .getByRole('navigation', { name: '館藏' })
        .getByRole('link', { name: '報架' }),
    ).toHaveAttribute('href', '/rack/sources?tab=topics');
  });

  test('the knowledge base opens under the shell with its own tab current', async ({
    page,
  }) => {
    const res = await page.goto('/kb');
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole('banner').getByRole('heading', { name: '知識庫' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: '館藏' })
        .getByRole('link', { name: '知識庫' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('old addresses', () => {
  test('the root opens the rack', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/rack$/);
  });

  test('a desk link from before the move keeps its query', async ({ page }) => {
    await page.goto('/?tab=topics&tstatus=proposed');
    await expect(page).toHaveURL(
      /\/rack\/sources\?tab=topics&tstatus=proposed$/,
    );
    await expect(page.getByRole('grid', { name: 'Topics' })).toBeVisible();
  });
});
