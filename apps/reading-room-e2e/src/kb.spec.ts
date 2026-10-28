import { expect, type Page, test } from '@playwright/test';

import { expectNoViolations } from './support/axe';
import { HIDDEN_MARKERS } from './support/kb-vault';

const READWISE_PAGE =
  '/kb/readwise/articles/2026-02-01%20-%20Kite%20Flying%20Basics%20-%20example.org';

const article = (page: Page) => page.getByRole('article');

async function expectNoHiddenMarkers(page: Page): Promise<void> {
  const html = (await page.content()).toLowerCase();
  for (const marker of HIDDEN_MARKERS)
    expect(html).not.toContain(marker.toLowerCase());
}

test.describe('knowledge base', () => {
  // These read the Chinese copy; locale.spec.ts covers the English side.
  test.use({ locale: 'zh-TW' });

  test('the index shelves the visible wiki pages and switches to Readwise', async ({
    page,
  }) => {
    await page.goto('/kb');
    const main = page.getByRole('main');
    await expect(
      main.getByRole('heading', { level: 2, name: '知識庫' }),
    ).toBeVisible();
    // The sources are the knowledge base's sections, in the row under the bar.
    await expect(
      page
        .getByRole('navigation', { name: '知識庫來源' })
        .getByRole('link', { name: 'wiki 4' }),
    ).toHaveAttribute('aria-current', 'page');
    for (const title of ['Kites', 'Wind', 'String', 'Client portal'])
      await expect(
        main.getByRole('link', { name: new RegExp(`^${title}`) }),
      ).toBeVisible();
    await expectNoHiddenMarkers(page);

    await page.getByRole('link', { name: 'Readwise 1' }).first().click();
    await expect(page).toHaveURL(/source=readwise/);
    await expect(
      main.getByRole('link', { name: /^Kite Flying Basics/ }),
    ).toBeVisible();
    await expectNoHiddenMarkers(page);
  });

  test('a wiki page renders its body, backlinks and sources, and every wikilink opens', async ({
    page,
  }) => {
    await page.goto('/kb/pages/tech-kites');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Kites' }),
    ).toBeVisible();
    await expect(article(page)).toContainText('Kites ride the wind.');
    await expectNoHiddenMarkers(page);

    const crumbs = page.getByRole('navigation', { name: '目前位置' });
    await expect(crumbs.getByRole('link')).toHaveText(['知識庫', 'wiki']);
    await expect(crumbs.getByRole('link', { name: 'wiki' })).toHaveAttribute(
      'href',
      '/kb?source=wiki',
    );

    const related = page.getByRole('complementary', { name: '相關內容' });
    await expect(related.getByRole('link', { name: 'String' })).toBeVisible();
    await expect(related.getByRole('link', { name: 'Wind' })).toBeVisible();
    await expect(
      related.getByRole('link', { name: /Kite Flying Basics/ }),
    ).toBeVisible();

    await expect(article(page).getByText('私人筆記')).toHaveCount(2);
    await expect(
      article(page).getByRole('link', { name: 'box-kites' }),
    ).toHaveAttribute('href', /^obsidian:\/\/open\?vault=/);

    const hrefs = await article(page)
      .locator('a[data-kind="kb"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length).toBe(3);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBe(200);
    }

    await article(page).getByRole('link', { name: 'steady wind' }).click();
    await expect(page).toHaveURL(/\/kb\/pages\/wind$/);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Wind' }),
    ).toBeVisible();
  });

  test('a Readwise document links its original and the pages that cite it', async ({
    page,
  }) => {
    await page.goto(READWISE_PAGE);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Kite Flying Basics' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: '原文 ↗' })).toHaveAttribute(
      'href',
      'https://example.org/kites',
    );
    await expect(
      page.getByRole('complementary').getByRole('link', { name: 'Kites' }),
    ).toBeVisible();
  });

  test('a work page shows as usual', async ({ page }) => {
    await page.goto('/kb/pages/client-portal');
    await expect(
      page.getByText('The Glimmerco portal flies kites.'),
    ).toBeVisible();
    await page.goto('/kb/pages/tech-kites');
    await expect(
      page.getByText('Built for Glimmerco under contract'),
    ).toBeVisible();
  });

  test('private and excluded pages answer 404', async ({ page }) => {
    for (const path of [
      '/kb/pages/moonvault-plans',
      '/kb/pages/starcellar',
      '/kb/readwise/books/2025-01-01%20-%20Owlpost%20Letters%20-%20Someone',
      '/kb/readwise/personal/2025-01-01%20-%20Fogbank',
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expectNoHiddenMarkers(page);
    }
  });

  test('search finds visible pages and nothing kept out', async ({ page }) => {
    await page.goto('/kb');
    await page.getByRole('searchbox', { name: '搜尋知識庫' }).fill('kites');
    await page.getByRole('button', { name: '搜尋' }).click();
    await expect(page).toHaveURL(/q=kites/);
    await expect(
      page.getByRole('heading', { name: /「kites」/ }),
    ).toBeVisible();
    await expectNoHiddenMarkers(page);
    await expect(
      page.locator('#kb-results + ul a[href="/kb/pages/tech-kites"]'),
    ).toBeVisible();
    const hits = await (
      await page.request.get('/kb/api/search?q=kites')
    ).json();
    expect(hits.results.map((r: { href: string }) => r.href)).toContain(
      '/kb/pages/tech-kites',
    );

    for (const marker of HIDDEN_MARKERS) {
      const res = await page.request.get(`/kb/api/search?q=${marker}`);
      expect(await res.json()).toEqual({ results: [] });
    }
  });

  test('the hall shelf lists only visible pages', async ({ page }) => {
    const res = await page.request.get('/kb/api/hall-items');
    const body = await res.json();
    expect(body.items.map((i: { id: string }) => i.id).sort()).toEqual([
      'readwise:articles/2026-02-01 - Kite Flying Basics - example.org',
      'wiki:client-portal',
      'wiki:string',
      'wiki:tech-kites',
      'wiki:wind',
    ]);
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(
      new RegExp(HIDDEN_MARKERS.join('|'), 'i'),
    );
  });

  test('the index and a page pass axe', async ({ page }) => {
    await page.goto('/kb');
    await expectNoViolations(page);
    await page.goto('/kb/pages/tech-kites');
    await expectNoViolations(page);
  });
  test('the sidebar closes on every page and stays closed', async ({
    page,
  }) => {
    await page.goto('/kb');
    const sidebar = page.locator('#library-sidebar');
    await expect(sidebar).toBeVisible();
    // The toggle lives in the bar's island; a click before it hydrates does nothing.
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByRole('button', { name: '收起側欄' }).click();
    await expect(sidebar).toBeHidden();

    // The choice is the library's, so the rack's registry desk opens with its filters closed.
    await page.goto('/rack/sources');
    await expect(page.locator('#library-sidebar')).toBeHidden();
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    const reopen = page.getByRole('button', { name: '展開側欄' });
    await expect(reopen).toHaveAttribute('aria-expanded', 'false');
    await reopen.click();
    await expect(page.locator('#library-sidebar')).toBeVisible();
  });

  test('the bar has no sidebar toggle on a page without a sidebar', async ({
    page,
  }) => {
    await page.goto('/rack');
    await expect(page.getByRole('button', { name: '收起側欄' })).toBeHidden();
  });
});
